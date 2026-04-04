import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile, remove, rename, writeFile } from '@tauri-apps/plugin-fs';
import { convertFileSrc } from '@tauri-apps/api/core';

const getSafeDirName = (id, title) => {
  const safeTitle = (title || 'Untitled').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim().replace(/\s+/g, '_');
  return `${id}__${safeTitle}`.substring(0, 200);
};

export class NativeWorkspaceManager {
  constructor() {
    this.basePathObj = null; // { baseDir: BaseDirectory... } or empty for absolute, but we prefer baseDir
    this.workspaceDirName = 'workspace';
    this.manifestName = 'boards.json';
    this.manifest = null;
    this.crossBoardLinkIndex = new Map(); // Map<`${sourceBoardId}::${sourceNoteId}`, Array<{boardId, noteId, boardTitle, snapshotKind}>>
    this.globalAdjacencyGraph = new Map(); // Map<fromBoardId, Map<toBoardId, { count }>>
    this.onManifestUpdated = null;
  }

  async init() {
    let rootOpts = {};
    let hasAccess = false;
    this.workspaceDirName = 'workspace';
    
    // In Dev mode, forcefully use the target/debug path that the user requested
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      rootOpts = { baseDir: undefined };
      this.workspaceDirName = 'D:/Antigravity/ORBit/src-tauri/target/debug/workspace';
      try {
        if (!(await exists(this.workspaceDirName))) {
          await mkdir(this.workspaceDirName, { recursive: true });
        }
        hasAccess = true;
      } catch (e) {
        console.warn("Dev mode absolute path creation failed.", e);
        // Fall through
      }
    }

    if (!hasAccess) {
      this.workspaceDirName = 'workspace';
      rootOpts = { baseDir: BaseDirectory.Executable };
      try {
        if (!(await exists(this.workspaceDirName, rootOpts))) {
          await mkdir(this.workspaceDirName, { ...rootOpts, recursive: true });
        }
        hasAccess = true;
      } catch (e) {
        console.warn("ExecutableDir workspace creation failed. Falling back to AppLocalData.", e);
        rootOpts = { baseDir: BaseDirectory.AppLocalData };
      }
    }

    if (!hasAccess) {
      try {
        if (!(await exists(this.workspaceDirName, rootOpts))) {
          await mkdir(this.workspaceDirName, { ...rootOpts, recursive: true });
        }
      } catch(e) {
        console.error("Critical error: Could not create workspace in AppLocalData fallback.", e);
        throw e;
      }
    }

    this.basePathObj = rootOpts;

    // Ensure subdirectories exist
    await this.ensureDir(`${this.workspaceDirName}/boards`);
    await this.ensureDir(`${this.workspaceDirName}/templates`);
    
    // Load or create the manifest
    await this.loadManifest();
  }

  async ensureDir(subPath) {
    if (!(await exists(subPath, this.basePathObj))) {
      await mkdir(subPath, { ...this.basePathObj, recursive: true });
    }
  }

  async loadManifest() {
    const manifestPath = `${this.workspaceDirName}/${this.manifestName}`;
    if (await exists(manifestPath, this.basePathObj)) {
      try {
        const content = await readTextFile(manifestPath, this.basePathObj);
        this.manifest = JSON.parse(content);
        
        // Hydration upgrades and safety
        if (!this.manifest.folders) this.manifest.folders = [];
        
        // Ensure missing or invalid folderIds are resolved to null (Inbox)
        const validFolderIds = new Set(this.manifest.folders.map(f => f.id));
        if (this.manifest.boards) {
          for (const board of this.manifest.boards) {
            if (board.folderId !== null && board.folderId !== undefined) {
              if (!validFolderIds.has(board.folderId)) {
                board.folderId = null;
              }
            } else {
              board.folderId = null;
            }
          }
        }
      } catch (e) {
        console.error("Failed to parse native boards.json, creating a fresh one.", e);
        this.manifest = this.createEmptyManifest();
      }
    } else {
      this.manifest = this.createEmptyManifest();
      await this.saveManifest();
    }
    return this.manifest;
  }

  createEmptyManifest() {
    return {
      version: 2,
      lastOpenedBoardId: null,
      recentBoardIds: [],
      folders: [],
      boards: []
    };
  }

  getFolders() {
    if (!this.manifest || !this.manifest.folders) return [];
    // Deep copy for read-only via shell
    return JSON.parse(JSON.stringify(this.manifest.folders));
  }

  async createFolder(name) {
    if (!this.manifest) await this.init();
    if (!this.manifest.folders) this.manifest.folders = [];
    
    const cleanName = (name || '').trim();
    if (!cleanName) return null;
    
    const normalized = cleanName.toLowerCase();
    const isDuplicate = this.manifest.folders.some(f => f.name.toLowerCase() === normalized);
    if (isDuplicate) return null; // Reject silently, UI handles validation state
    
    const newId = `fld_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.manifest.folders.push({
      id: newId,
      name: cleanName,
      createdAt: new Date().toISOString()
    });
    
    await this.saveManifest();
    return newId;
  }

  async saveManifest() {
    if (!this.manifest) return;
    const manifestPath = `${this.workspaceDirName}/${this.manifestName}`;
    const content = JSON.stringify(this.manifest, null, 2);
    await writeTextFile(manifestPath, content, this.basePathObj);
    if (this.onManifestUpdated) this.onManifestUpdated();
  }

  async createBoard(title = "Untitled Board", topic = "", folderId = null) {
    if (!this.manifest) await this.init();

    let targetFolderId = null;
    if (folderId && typeof folderId === 'string' && folderId.trim() !== '') {
      if (this.manifest.folders && this.manifest.folders.some(f => f.id === folderId)) {
        targetFolderId = folderId;
      }
    }

    const newId = crypto.randomUUID();
    const dirName = getSafeDirName(newId, title);
    const boardDir = `${this.workspaceDirName}/boards/${dirName}`;
    
    // Ensure the specific board directory exists
    await this.ensureDir(boardDir);

    const now = new Date().toISOString();

    const meta = {
      id: newId,
      title: title,
      folderId: targetFolderId,
      createdAt: now,
      updatedAt: now
    };
    
    if (topic && topic.trim() !== "") {
      meta.topic = topic.trim();
    }

    // Minimal safe initial state
    const state = {
      notes: [],
      edges: [],
      frames: [],
      canvas: { panX: 0, panY: 0, zoom: 1 }
    };

    // Write initial files
    await writeTextFile(`${boardDir}/meta.json`, JSON.stringify(meta, null, 2), this.basePathObj);
    await writeTextFile(`${boardDir}/state.json`, JSON.stringify(state, null, 2), this.basePathObj);

    const boardEntry = {
      id: newId,
      dirName: dirName,
      title: title,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
      folderId: targetFolderId
    };

    if (topic && topic.trim() !== "") {
      boardEntry.topic = topic.trim();
    }

    this.manifest.boards.push(boardEntry);
    this.manifest.lastOpenedBoardId = newId;
    
    if (!this.manifest.recentBoardIds.includes(newId)) {
      this.manifest.recentBoardIds.unshift(newId);
    }

    await this.saveManifest();

    return { id: newId, meta, state };
  }
  
  getKnownBoardTopics() {
    if (!this.manifest || !this.manifest.boards) return [];
    const topics = new Set();
    for (const b of this.manifest.boards) {
      if (b.topic && typeof b.topic === 'string') {
        const trimmed = b.topic.trim();
        if (trimmed.length > 0) {
          topics.add(trimmed);
        }
      }
    }
    return Array.from(topics).sort();
  }

  getBoardDirName(boardId) {
    if (!this.manifest) return boardId;
    const entry = this.manifest.boards.find(b => b.id === boardId);
    return entry && entry.dirName ? entry.dirName : boardId;
  }

  async loadBoardState(boardId) {
    if (!this.manifest) await this.init();
    
    const dirName = this.getBoardDirName(boardId);
    const boardDir = `${this.workspaceDirName}/boards/${dirName}`;
    try {
      const metaPath = `${boardDir}/meta.json`;
      const statePath = `${boardDir}/state.json`;
      
      const metaContents = await readTextFile(metaPath, this.basePathObj);
      const stateContents = await readTextFile(statePath, this.basePathObj);
      
      return {
        meta: JSON.parse(metaContents),
        state: JSON.parse(stateContents)
      };
    } catch (e) {
      console.error(`Failed to load native board state for ${boardId}:`, e);
      return null;
    }
  }

  async touchBoard(boardId, newTitle = null) {
      if (!this.manifest) return;
      const now = new Date().toISOString();
      const boardEntry = this.manifest.boards.find(b => b.id === boardId);
      
      if (boardEntry) {
          boardEntry.updatedAt = now;
          if (newTitle) boardEntry.title = newTitle;
      }
      
      this.manifest.lastOpenedBoardId = boardId;
      
      // Update recents
      this.manifest.recentBoardIds = this.manifest.recentBoardIds.filter(id => id !== boardId);
      this.manifest.recentBoardIds.unshift(boardId);
      
      await this.saveManifest();
  }

  async renameBoard(boardId, newTitle) {
    if (!this.manifest) return false;
    
    const boardEntry = this.manifest.boards.find(b => b.id === boardId);
    if (!boardEntry) return false;
    
    const oldDirName = boardEntry.dirName || boardId;
    let newDirName = getSafeDirName(boardId, newTitle);
    
    const oldBoardDir = `${this.workspaceDirName}/boards/${oldDirName}`;
    const newBoardDir = `${this.workspaceDirName}/boards/${newDirName}`;
    
    if (oldDirName !== newDirName) {
      try {
        await rename(oldBoardDir, newBoardDir, this.basePathObj);
        boardEntry.dirName = newDirName;
      } catch (e) {
        console.error(`Failed to rename directory from ${oldDirName} to ${newDirName}`, e);
        newDirName = oldDirName; // Revert to old if fs rename fails
      }
    }
    
    boardEntry.title = newTitle;
    boardEntry.updatedAt = new Date().toISOString();
    
    // Update meta.json
    const boardDir = `${this.workspaceDirName}/boards/${newDirName}`;
    try {
      const metaPath = `${boardDir}/meta.json`;
      const metaContents = await readTextFile(metaPath, this.basePathObj);
      const meta = JSON.parse(metaContents);
      meta.title = newTitle;
      meta.updatedAt = boardEntry.updatedAt;
      await writeTextFile(metaPath, JSON.stringify(meta, null, 2), this.basePathObj);
    } catch (e) {
      console.error(`Failed to update meta.json during rename of ${boardId}`, e);
    }
    
    await this.saveManifest();
    return true;
  }

  async updateBoardTopic(boardId, newTopic) {
    if (!this.manifest) return false;
    
    const boardEntry = this.manifest.boards.find(b => b.id === boardId);
    if (!boardEntry) return false;
    
    boardEntry.topic = newTopic;
    boardEntry.updatedAt = new Date().toISOString();
    
    // Update meta.json
    const dirName = boardEntry.dirName || boardId;
    const boardDir = `${this.workspaceDirName}/boards/${dirName}`;
    try {
      const metaPath = `${boardDir}/meta.json`;
      const metaContents = await readTextFile(metaPath, this.basePathObj);
      const meta = JSON.parse(metaContents);
      meta.topic = newTopic;
      meta.updatedAt = boardEntry.updatedAt;
      await writeTextFile(metaPath, JSON.stringify(meta, null, 2), this.basePathObj);
    } catch (e) {
      console.error(`Failed to update meta.json during topic update of ${boardId}`, e);
    }
    
    await this.saveManifest();
    return true;
  }

  async updateBoardFolder(boardId, newFolderId) {
    if (!this.manifest) return false;
    
    const boardEntry = this.manifest.boards.find(b => b.id === boardId);
    if (!boardEntry) return false;

    // Validate folder exists or null
    let targetFolderId = null;
    if (newFolderId && typeof newFolderId === 'string' && newFolderId.trim() !== '') {
      if (this.manifest.folders && this.manifest.folders.some(f => f.id === newFolderId)) {
        targetFolderId = newFolderId;
      }
    }
    
    boardEntry.folderId = targetFolderId;
    boardEntry.updatedAt = new Date().toISOString();
    
    // Update meta.json
    const dirName = boardEntry.dirName || boardId;
    const boardDir = `${this.workspaceDirName}/boards/${dirName}`;
    try {
      const metaPath = `${boardDir}/meta.json`;
      const metaContents = await readTextFile(metaPath, this.basePathObj);
      const meta = JSON.parse(metaContents);
      meta.folderId = targetFolderId;
      meta.updatedAt = boardEntry.updatedAt;
      await writeTextFile(metaPath, JSON.stringify(meta, null, 2), this.basePathObj);
    } catch (e) {
      console.error(`Failed to update meta.json during folder update of ${boardId}`, e);
    }
    
    await this.saveManifest();
    return true;
  }

  async deleteBoard(boardId) {
    if (!this.manifest) return false;
    
    // Resolve the dirName FIRST before filtering it out of the manifest!
    const dirName = this.getBoardDirName(boardId);
    
    this.manifest.boards = this.manifest.boards.filter(b => b.id !== boardId);
    this.manifest.recentBoardIds = this.manifest.recentBoardIds.filter(id => id !== boardId);
    
    if (this.manifest.lastOpenedBoardId === boardId) {
      this.manifest.lastOpenedBoardId = this.manifest.recentBoardIds.length > 0 ? this.manifest.recentBoardIds[0] : null;
    }
    
    await this.saveManifest();
    
    try {
      const boardDir = `${this.workspaceDirName}/boards/${dirName}`;
      await remove(boardDir, { ...this.basePathObj, recursive: true });
    } catch (e) {
      console.error(`Failed to delete directory for board ${boardId}`, e);
    }
    
    return true;
  }

  async resolveBoardPath(boardId) {
    const { resolve, executableDir, appLocalDataDir } = await import('@tauri-apps/api/path');
    let rootPath = this.workspaceDirName;
    const dirName = this.getBoardDirName(boardId);
    
    if (this.basePathObj && this.basePathObj.baseDir !== undefined) {
      if (this.basePathObj.baseDir === BaseDirectory.Executable) {
        rootPath = await resolve(await executableDir(), this.workspaceDirName);
      } else if (this.basePathObj.baseDir === BaseDirectory.AppLocalData) {
        rootPath = await resolve(await appLocalDataDir(), this.workspaceDirName);
      }
    }
    
    return await resolve(rootPath, 'boards', dirName);
  }

  async saveBoardAsset(boardId, arrayBuffer, suffix) {
    if (!this.manifest) await this.init();
    
    const dirName = this.getBoardDirName(boardId);
    const boardDir = `${this.workspaceDirName}/boards/${dirName}`;
    const assetsDir = `${boardDir}/assets/images`;
    
    await this.ensureDir(assetsDir);
    
    const uuid = crypto.randomUUID();
    const relativePath = `assets/images/${uuid}.${suffix}`;
    const absoluteStorePath = `${boardDir}/${relativePath}`;
    
    try {
      const uint8Array = new Uint8Array(arrayBuffer);
      await writeFile(absoluteStorePath, uint8Array, this.basePathObj);
      return relativePath;
    } catch (e) {
      console.error(`Failed to write board asset for ${boardId}:`, e);
      return null;
    }
  }

  async resolveAssetUrl(boardId, relativeSrc) {
    if (!relativeSrc) return null;
    if (relativeSrc.startsWith('http') || relativeSrc.startsWith('data:')) return relativeSrc;
    
    const boardPath = await this.resolveBoardPath(boardId);
    const { resolve } = await import('@tauri-apps/api/path');
    const absolutePath = await resolve(boardPath, relativeSrc);
    return convertFileSrc(absolutePath);
  }

  async getAssetFolderPath(boardId) {
    const boardPath = await this.resolveBoardPath(boardId);
    const { resolve } = await import('@tauri-apps/api/path');
    return await resolve(boardPath, 'assets', 'images');
  }

  async getAbsoluteAssetPath(boardId, relativeSrc) {
    if (!relativeSrc || relativeSrc.startsWith('http') || relativeSrc.startsWith('data:')) return null;
    const boardPath = await this.resolveBoardPath(boardId);
    const { resolve } = await import('@tauri-apps/api/path');
    return await resolve(boardPath, relativeSrc);
  }

  async buildCrossBoardLinkIndex() {
    if (!this.manifest || !this.manifest.boards) return;
    this.crossBoardLinkIndex.clear();
    
    // Dynamically import required tauri path/fs utilities
    const { resolve } = await import('@tauri-apps/api/path');
    
    for (const board of this.manifest.boards) {
      try {
        const boardPath = await this.resolveBoardPath(board.id);
        if (!boardPath) continue;
        const statePath = await resolve(boardPath, 'state.json');
        if (await exists(statePath, this.basePathObj)) {
          const content = await readTextFile(statePath, this.basePathObj);
          const state = JSON.parse(content);
          if (state && state.notes) {
            for (const [noteId, note] of state.notes) {
              if (note.type === 'linked-note' && note.sourceRef) {
                const compositeKey = `${note.sourceRef.boardId}::${note.sourceRef.noteId}`;
                let refs = this.crossBoardLinkIndex.get(compositeKey);
                if (!refs) {
                  refs = [];
                  this.crossBoardLinkIndex.set(compositeKey, refs);
                }
                refs.push({
                  boardId: board.id,
                  noteId: noteId,
                  boardTitle: board.title,
                  snapshotKind: note.snapshot?.kind || 'text'
                });
              }
            }
          }
        }
      } catch (e) {
        // skip failed boards
      }
    }
    this.rebuildGlobalAdjacencyGraph();
  }

  getNoteReferences(boardId, noteId) {
    const compositeKey = `${boardId}::${noteId}`;
    return this.crossBoardLinkIndex.get(compositeKey) || [];
  }

  rebuildGlobalAdjacencyGraph() {
    this.globalAdjacencyGraph.clear();
    for (const [key, refs] of this.crossBoardLinkIndex.entries()) {
      const sourceBoardId = key.split('::')[0];
      for (const ref of refs) {
        const fromBoard = ref.boardId;
        const toBoard = sourceBoardId;
        
        let targets = this.globalAdjacencyGraph.get(fromBoard);
        if (!targets) {
          targets = new Map();
          this.globalAdjacencyGraph.set(fromBoard, targets);
        }
        let relation = targets.get(toBoard);
        if (!relation) {
          relation = { count: 0 };
          targets.set(toBoard, relation);
        }
        relation.count++;
      }
    }
  }

  getBoardTitle(boardId) {
    if (!this.manifest) return 'Unknown';
    const b = this.manifest.boards.find(b => b.id === boardId);
    return b ? b.title : 'Unknown';
  }

  getBoardRelations(boardId, localNotesMap) {
    const direct = new Map(); // targetBoardId -> { boardId, title, count, incoming: 0, outgoing: 0 }

    const addDirect = (tBoardId, isIncoming) => {
       if (tBoardId === boardId) return; // avoid self
       let rec = direct.get(tBoardId);
       if (!rec) {
         rec = { boardId: tBoardId, title: this.getBoardTitle(tBoardId), count: 0, incoming: 0, outgoing: 0 };
         direct.set(tBoardId, rec);
       }
       rec.count++;
       if (isIncoming) rec.incoming++;
       else rec.outgoing++;
    };

    // 1. Incoming (another board OUTGOING to us)
    // We check who has us as a target
    // Wait, globalAdjacencyGraph has Map<from, to>.
    // So Incoming = who maps TO us.
    for (const [fromId, targetsMap] of this.globalAdjacencyGraph.entries()) {
      if (targetsMap.has(boardId)) {
        const c = targetsMap.get(boardId).count;
        for (let i = 0; i < c; i++) addDirect(fromId, true);
      }
    }

    // 2. Outgoing (we OUTGOING to another board)
    const ourTargets = this.globalAdjacencyGraph.get(boardId);
    if (ourTargets) {
       for (const [toId, relation] of ourTargets.entries()) {
          for (let i = 0; i < relation.count; i++) addDirect(toId, false);
       }
    }

    const directRelations = Array.from(direct.values());
    directRelations.sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
    return directRelations;
  }

  getTwoHopRelations(boardId, directRelationsArray) {
    const directSet = new Set(directRelationsArray.map(r => r.boardId));
    const Candidates = new Map(); // targetId -> { boardId, title, score, viaList: [] }

    const addCandidate = (tId, viaId, strength) => {
       if (tId === boardId || directSet.has(tId)) return;
       let cand = Candidates.get(tId);
       if (!cand) {
         cand = { boardId: tId, title: this.getBoardTitle(tId), score: 0, viaList: new Set() };
         Candidates.set(tId, cand);
       }
       cand.score += strength;
       cand.viaList.add(this.getBoardTitle(viaId));
    };

    for (const d of directRelationsArray) {
      // Boards that point to `d`
      for (const [fromId, targetsMap] of this.globalAdjacencyGraph.entries()) {
        if (targetsMap.has(d.boardId)) {
          addCandidate(fromId, d.boardId, targetsMap.get(d.boardId).count);
        }
      }
      
      // Boards `d` points to
      const dTargets = this.globalAdjacencyGraph.get(d.boardId);
      if (dTargets) {
        for (const [toId, relation] of dTargets.entries()) {
          addCandidate(toId, d.boardId, relation.count);
        }
      }
    }
    
    // Flatten, format, and sort by score
    const result = Array.from(Candidates.values()).map(c => ({
      boardId: c.boardId,
      title: c.title,
      score: c.score,
      via: Array.from(c.viaList).join(', ')
    }));
    
    result.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
    return result;
  }

  updateLinkIndexIncremental(boardId, boardTitle, updatedNotesMap) {
    // 1. Remove all old references originating FROM this board
    for (const refs of this.crossBoardLinkIndex.values()) {
      for (let i = refs.length - 1; i >= 0; i--) {
        if (refs[i].boardId === boardId) {
          refs.splice(i, 1);
        }
      }
    }
    
    // 2. Add current references
    for (const [noteId, note] of updatedNotesMap) {
      if (note.type === 'linked-note' && note.sourceRef) {
        const compositeKey = `${note.sourceRef.boardId}::${note.sourceRef.noteId}`;
        let refs = this.crossBoardLinkIndex.get(compositeKey);
        if (!refs) {
          refs = [];
          this.crossBoardLinkIndex.set(compositeKey, refs);
        }
        refs.push({
          boardId: boardId,
          noteId: noteId,
          boardTitle: boardTitle,
          snapshotKind: note.snapshot?.kind || 'text'
        });
      }
    }
    this.rebuildGlobalAdjacencyGraph();
  }
}

export const workspaceManager = new NativeWorkspaceManager();
