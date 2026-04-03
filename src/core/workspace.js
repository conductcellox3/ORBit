import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile, remove, rename } from '@tauri-apps/plugin-fs';

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
      boards: []
    };
  }

  async saveManifest() {
    if (!this.manifest) return;
    const manifestPath = `${this.workspaceDirName}/${this.manifestName}`;
    const content = JSON.stringify(this.manifest, null, 2);
    await writeTextFile(manifestPath, content, this.basePathObj);
  }

  async createBoard(title = "Untitled Board") {
    if (!this.manifest) await this.init();

    const newId = crypto.randomUUID();
    const dirName = getSafeDirName(newId, title);
    const boardDir = `${this.workspaceDirName}/boards/${dirName}`;
    
    // Ensure the specific board directory exists
    await this.ensureDir(boardDir);

    const now = new Date().toISOString();

    const meta = {
      id: newId,
      title: title,
      createdAt: now,
      updatedAt: now
    };

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
      lastOpenedAt: now
    };

    this.manifest.boards.push(boardEntry);
    this.manifest.lastOpenedBoardId = newId;
    
    if (!this.manifest.recentBoardIds.includes(newId)) {
      this.manifest.recentBoardIds.unshift(newId);
    }

    await this.saveManifest();

    return { id: newId, meta, state };
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

  async deleteBoard(boardId) {
    if (!this.manifest) return false;
    
    this.manifest.boards = this.manifest.boards.filter(b => b.id !== boardId);
    this.manifest.recentBoardIds = this.manifest.recentBoardIds.filter(id => id !== boardId);
    
    if (this.manifest.lastOpenedBoardId === boardId) {
      this.manifest.lastOpenedBoardId = this.manifest.recentBoardIds.length > 0 ? this.manifest.recentBoardIds[0] : null;
    }
    
    await this.saveManifest();
    
    try {
      const dirName = this.getBoardDirName(boardId);
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
}

export const workspaceManager = new NativeWorkspaceManager();
