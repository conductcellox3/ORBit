import { State } from './state.js';
import { History } from './history.js';
import { Selection } from './selection.js';
import { Persistence } from './persistence.js';

import { workspaceManager } from './workspace.js';
import { GraphModel } from './graphModel.js';
import { appSettings } from './settings.js';
import { showToast } from '../shell/toast.js';
import { getTodayString, getIsoWeekString } from '../utils/dateHelper.js';
import { invoke } from '@tauri-apps/api/core';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi';


export class App {
  constructor() {
    this.state = new State();
    this.history = new History(this.state);
    this.selection = new Selection();
    this.persistence = new Persistence(this.state, this.history);
    this.clipboard = { objects: null, pasteCount: 0, lastPasteAnchor: null, linkPayload: null };
    this.pendingFocusNoteId = null;
    this.activePeek = null;
    this.graphModel = new GraphModel(this);
    this.isGraphActive = false;
    workspaceManager.onManifestUpdated = () => {
       this.graphModel.build();
    };
  }

  async init() {
    await workspaceManager.init();
    await workspaceManager.buildCrossBoardLinkIndex();
    
    // Look for last open board, or null to auto-create
    const lastId = workspaceManager.manifest?.lastOpenedBoardId;
    await this.loadNativeBoard(lastId);
  }

  async save() {
    return await this.persistence.save();
  }

  async loadNativeBoard(boardId, options = {}) {
    if (!options.isPeek && !this.isGraphActive && this.state.sourceType === 'native' && this.state.boardId === boardId) {
      if (options.restoreViewport) {
        this.state.canvas.panX = options.restoreViewport.panX;
        this.state.canvas.panY = options.restoreViewport.panY;
        this.state.canvas.zoom = options.restoreViewport.zoom;
        if (this.onBoardLoad) this.onBoardLoad(this.state.canvas);
        
        this.selection.clear();
        for (const id of options.restoreViewport.selectedIds) {
          if (this.state.notes.has(id)) this.selection.select(id, 'note');
          else if (this.state.frames.has(id)) this.selection.select(id, 'frame');
        }
      }
      return;
    }
    
    if (!options.isPeek && this.activePeek) {
       this.activePeek = null;
       if (this.onPeekStateChange) this.onPeekStateChange(null);
    }
    
    if (this.state.boardId || this.isGraphActive) {
      try {
        if (!this.isGraphActive) await this.save();
      } catch (e) {
        console.error("Failed to safely save current board, aborting switch", e);
        return;
      }
    }

    this.isGraphActive = false;
    this.selection.clear();
    await this.persistence.loadNativeBoard(boardId);
    
    if (options.restoreViewport) {
      this.state.canvas.panX = options.restoreViewport.panX;
      this.state.canvas.panY = options.restoreViewport.panY;
      this.state.canvas.zoom = options.restoreViewport.zoom;
      
      this.selection.clear();
      for (const id of options.restoreViewport.selectedIds) {
        if (this.state.notes.has(id)) this.selection.select(id, 'note');
        else if (this.state.frames.has(id)) this.selection.select(id, 'frame');
      }
    }
    
    if (this.onBoardChanged) this.onBoardChanged(this.state.boardId);
    if (this.onTitleChanged) this.onTitleChanged(this.state.title);
    if (this.onBoardLoad) this.onBoardLoad(this.state.canvas);
    
    this.state.checkLinkedNotesForUpdates();
  }

  async _openOrCreateSpecialBoard(folderId, title, topic) {
    if (this.isCreatingSpecialBoard) return;
    if (!folderId) {
      showToast('保存先フォルダが設定されていません');
      if (this.settingsPanel && !this.settingsPanel.isOpen) {
        this.settingsPanel.toggle();
      }
      return;
    }
    
    // Check if the folder actually exists in manifest to prevent orphaned writes
    if (!workspaceManager.manifest || !workspaceManager.manifest.folders.some(f => f.id === folderId)) {
      showToast('設定されたフォルダが存在しません。再設定してください');
      return;
    }

    this.isCreatingSpecialBoard = true;
    try {
      let targetBoard = workspaceManager.findNativeBoardByTitleInFolder(folderId, title);
      
      if (!targetBoard) {
        // Does not exist, create it natively
        targetBoard = await workspaceManager.createNativeBoard({ title, topic, folderId });
      }

      if (targetBoard) {
        await this.loadNativeBoard(targetBoard.id);
        
        // Re-render Explorer to show the newly created board in the tree
        if (this.shell && this.shell.explorer) {
            await this.shell.explorer.mount();
            if (typeof this.shell.explorer.expandFolder === 'function') {
                this.shell.explorer.expandFolder(folderId);
            }
        }
      }
    } finally {
      this.isCreatingSpecialBoard = false;
    }
  }

  async openOrCreateDailyBoard() {
    const folderId = appSettings.getDailyFolderId();
    const title = getTodayString();
    await this._openOrCreateSpecialBoard(folderId, title, '日報');
  }

  async openOrCreateWeeklyBoard() {
    const folderId = appSettings.getWeeklyFolderId();
    const title = getIsoWeekString();
    await this._openOrCreateSpecialBoard(folderId, title, '週報');
  }

  async startCaptureSession() {
    if (this.isCaptureActive) return;
    this.isCaptureActive = true;
    showToast("Starting capture session...");
    try {
      if (!this.captureWin) {
          showToast("Getting capture window...");
          this.captureWin = await WebviewWindow.getByLabel('capture');
          if (this.captureWin) {
              this.captureWin.once('tauri://destroyed', () => { this.captureWin = null; });
          }
      }
      
      if (!this.captureWin) {
          showToast("Creating capture window on demand...");
          this.captureWin = new WebviewWindow('capture', {
              url: '/capture/captureOverlay.html',
              title: 'ORBit Capture',
              transparent: true,
              decorations: false,
              alwaysOnTop: true,
              skipTaskbar: true,
              visible: false,
              resizable: false,
              focus: true
          });
          
          await new Promise((resolve, reject) => {
              this.captureWin.once('tauri://created', resolve);
              this.captureWin.once('tauri://error', (e) => reject(`Failed to create window: ${e}`));
          });
          this.captureWin.once('tauri://destroyed', () => { this.captureWin = null; });
      }
      showToast("Found captureWin, invoking xcap...");
      
      const bounds = await invoke('start_capture_session');
      showToast("xcap finished correctly.");
      
      const now = new Date();
      const filename = `capture_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}.png`;
      
      const { join } = await import('@tauri-apps/api/path');
      const boardAbsPath = await workspaceManager.resolveBoardPath(this.state.boardId);
      const relativeSrc = `assets/images/${filename}`;
      const outPath = await join(boardAbsPath, 'assets', 'images', filename);
      
      const captureInfo = {
        ...bounds,
        relative_src: relativeSrc,
        out_path: outPath
      };
      
      localStorage.setItem('orbit_capture_info', JSON.stringify(captureInfo));
      
      localStorage.removeItem('orbit_capture_result');
      
      await this.captureWin.setPosition(new PhysicalPosition(bounds.virtual_bounds.x, bounds.virtual_bounds.y));
      await this.captureWin.setSize(new PhysicalSize(bounds.virtual_bounds.width, bounds.virtual_bounds.height));
      
      // Listen for window storage update
      const storageHandler = (e) => {
        if (e.key === 'orbit_capture_result' && e.newValue) {
           const res = JSON.parse(e.newValue);
           if (res.status === 'success') {
               const container = document.getElementById('canvas-container');
               const rect = container ? container.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
               
               const screenCenterX = rect.left + rect.width / 2;
               const screenCenterY = rect.top + rect.height / 2;
               
               let pt = { x: screenCenterX, y: screenCenterY };
               if (this.canvas?.viewport?.screenToCanvas) {
                   pt = this.canvas.viewport.screenToCanvas(screenCenterX, screenCenterY);
               }
               
               const newId = this.state.addImageNote(pt.x - 150, pt.y - 100, res.relativeSrc, 300, 200);
               this.selection.clear();
               this.selection.select(newId, 'note');
               
               this.history.commit();
           }
           window.removeEventListener('storage', storageHandler);
           this.isCaptureActive = false;
        }
      };
      
      window.addEventListener('storage', storageHandler);
      
      await this.captureWin.show();
      await this.captureWin.setFocus();
      await this.captureWin.emit('init-capture', captureInfo);
      
    } catch (e) {
       showToast(`Failed to start capture: ${e}`);
       console.error("Failed to start capture", e);
       this.isCaptureActive = false;
    }
  }

  async openGraphTab() {
    if (!this.activePeek && this.isGraphActive) return;

    if (this.state.boardId && !this.isGraphActive) {
      try {
        await this.save();
      } catch (e) {
         console.error("Failed to save before graph", e);
         return;
      }
    }
    
    this.isGraphActive = true;
    this.selection.clear();
    this.graphModel.build();

    if (this.onGraphTabOpened) this.onGraphTabOpened();
    if (this.onBoardChanged) this.onBoardChanged('__orbit_boards_graph__');
    if (this.onTitleChanged) this.onTitleChanged('Boards Graph');
  }

  async peekBoard(boardId) {
    if (!boardId) return;

    if (!this.activePeek) {
        if (this.isGraphActive) {
            this.activePeek = {
               originKind: 'graph',
               originTitle: 'Boards Graph'
            };
            if (this.onGraphPeekCapture) {
               Object.assign(this.activePeek, this.onGraphPeekCapture());
            }
        } else {
            this.activePeek = {
               originKind: 'board',
               originBoardId: this.state.boardId,
               originTitle: this.state.title,
               panX: this.state.canvas.panX,
               panY: this.state.canvas.panY,
               zoom: this.state.canvas.zoom,
               selectedIds: Array.from(this.selection.selectedIds)
            };
        }
    }
    
    await this.loadNativeBoard(boardId, { isPeek: true });
    if (this.onPeekStateChange) this.onPeekStateChange(this.activePeek);
  }

  async returnFromPeek() {
     if (!this.activePeek) return;
     const attemptRestore = { ...this.activePeek };
     this.activePeek = null;
     if (this.onPeekStateChange) this.onPeekStateChange(null);
     
     if (attemptRestore.originKind === 'graph') {
        await this.openGraphTab();
        if (this.onGraphPeekRestore) {
           this.onGraphPeekRestore(attemptRestore);
        }
     } else if (attemptRestore.originBoardId) {
        await this.loadNativeBoard(attemptRestore.originBoardId, { restoreViewport: attemptRestore });
     }
  }

  async loadLegacyBoard(legacySnapshot) {
    // Only block if trying to reload exactly the same board
    if (this.state.sourceType === 'legacy' && this.state.boardId === legacySnapshot.id) {
      return;
    }
    
    if (this.state.boardId) {
      try {
        await this.save();
      } catch (e) {
        console.error("Failed to safely save current board, aborting switch", e);
        return;
      }
    }

    this.selection.clear();
    await this.persistence.loadLegacyBoard(legacySnapshot);
    
    if (this.onBoardChanged) this.onBoardChanged(this.state.boardId);
    if (this.onTitleChanged) this.onTitleChanged(this.state.title);
    if (this.onBoardLoad) this.onBoardLoad(this.state.canvas);
  }

  _updateLinkIndex() {
    if (this.state.sourceType === 'native' && this.state.boardId) {
       workspaceManager.updateLinkIndexIncremental(this.state.boardId, this.state.title, this.state.notes);
       this.graphModel.build(); 
       if (this.onLinkIndexUpdated) this.onLinkIndexUpdated();
    }
  }

  commitHistory() {
    this.history.commit();
    this._updateLinkIndex();
    this.save().catch(e => console.error(e));
  }

  undo() {
    this.history.undo();
    this.selection.clear();
    this._updateLinkIndex();
    this.save().catch(e => console.error(e));
  }

  redo() {
    this.history.redo();
    this.selection.clear();
    this._updateLinkIndex();
    this.save().catch(e => console.error(e));
  }

  notifyTabTitleChanged(boardId, type, newTitle) {
    if (this.onInactiveTabTitleChanged) {
      this.onInactiveTabTitleChanged(boardId, type, newTitle);
    }
  }

  jumpToNoteCenter(noteId) {
    const note = this.state.notes.get(noteId);
    if (!note) return;

    this.pendingFocusNoteId = noteId;
    this.selection.clear();
    this.selection.select(noteId, 'note');

    const zoom = this.state.canvas.zoom || 1;
    let cw = window.innerWidth;
    let ch = window.innerHeight;
    
    // Use the actual canvas container bounds, removing Explorer/RightPane offsets!
    const container = document.getElementById('canvas-container');
    if (container) {
      const rect = container.getBoundingClientRect();
      cw = rect.width;
      ch = rect.height;
    }

    let w = note.width || 400;
    let h = note.height;
    
    // Attempt DOM read for true layout size including auto-height
    const el = document.querySelector(`.orbit-note[data-id="${noteId}"]`);
    if (el) {
      w = el.offsetWidth;
      h = el.offsetHeight;
    }
    if (!h) h = 300;

    const centerX = note.x + w / 2;
    const centerY = note.y + h / 2;

    const newOffsetX = cw / 2 - centerX * zoom;
    const newOffsetY = ch / 2 - centerY * zoom;

    this.state.canvas.panX = newOffsetX;
    this.state.canvas.panY = newOffsetY;
    this.state.canvas.zoom = zoom;
    
    if (this.onBoardLoad) {
      this.onBoardLoad(this.state.canvas);
    }
  }

  async jumpToBoardNote(boardId, noteId) {
    if (this.state.boardId === boardId) {
      this.jumpToNoteCenter(noteId);
      this.selection.clear();
      this.selection.select(noteId, 'note');
      return;
    }

    // Otherwise, load board
    await this.loadNativeBoard(boardId);
    
    // Defer the selection/jump slightly until layout
    requestAnimationFrame(() => {
      this.jumpToNoteCenter(noteId);
      this.selection.clear();
      this.selection.select(noteId, 'note');
    });
  }



  toggleSearch() {
    if (this.shell && this.shell.rightPane) {
      this.shell.rightPane.open();
    }
    if (this.propertiesPanel) {
      this.propertiesPanel.switchTab('search');
      if (this.searchUI && this.searchUI.input) {
        setTimeout(() => this.searchUI.input.focus(), 50);
      }
    }
  }

  createAndFocusNote(x, y, text = '') {
    if (this.state.sourceType === 'legacy') return null;
    const newNoteId = this.state.addNote(x, y, text);
    this.pendingFocusNoteId = newNoteId;
    this.selection.clear();
    this.selection.select(newNoteId, 'note');
    this.commitHistory();
    return newNoteId;
  }

  isTextEditingContext() {
    const active = document.activeElement;
    if (!active) return false;
    
    // Explicit exclusions that hold focus
    if (active.hasAttribute('data-prevent-canvas-shortcuts')) return true;
    
    const tag = active.tagName.toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || active.isContentEditable) {
      return true;
    }
    
    // Search UI and Properties Panel are text editing contexts
    if (active.closest('.orbit-search-overlay')) return true;
    if (active.closest('.orbit-properties')) return true;
    
    return false;
  }

  getClipboardData(selectedIds) {
    if (this.state.sourceType === 'legacy' || !selectedIds || selectedIds.size === 0) return;
    
    const payload = {
      notes: [],
      frames: [],
      edges: []
    };
    
    const eligibleTypes = ['note', 'calc', 'image', 'linked-note'];
    const collectedIds = new Set();
    const frameSelectedIds = new Set(); // Track explicitly selected frames

    const collectNote = (id) => {
      const note = this.state.notes.get(id);
      if (note && eligibleTypes.includes(note.type || 'note')) {
        if (!collectedIds.has(id)) {
          // Deep clone note
          payload.notes.push(JSON.parse(JSON.stringify(note)));
          collectedIds.add(id);
        }
      }
    };

    // First pass: collect explicitly selected entities
    for (const id of selectedIds) {
      if (this.state.frames.has(id)) {
        const frame = this.state.frames.get(id);
        payload.frames.push(JSON.parse(JSON.stringify(frame)));
        collectedIds.add(id);
        frameSelectedIds.add(id);
        
        // Recursively collect frame children implicitly
        if (frame.childIds) {
          for (const childId of frame.childIds) {
            collectNote(childId);
          }
        }
      } else {
        collectNote(id);
      }
    }
    
    // Strip parentFrameId if the parent frame wasn't explicitly included
    for (const note of payload.notes) {
      if (note.parentFrameId && !frameSelectedIds.has(note.parentFrameId)) {
        note.parentFrameId = null;
      }
    }

    // Collect internal edges between anything in collectedIds
    for (const edge of this.state.edges.values()) {
      if (collectedIds.has(edge.sourceId) && collectedIds.has(edge.targetId)) {
        payload.edges.push(JSON.parse(JSON.stringify(edge)));
      }
    }

    if (payload.notes.length > 0 || payload.frames.length > 0) {
      this.clipboard.objects = payload;
      this.clipboard.sourceBoardId = this.state.boardId;
      this.clipboard.pasteCount = 0;
    }
  }

  async pasteClipboardData(targetX, targetY) {
    if (this.state.sourceType === 'legacy' || !this.clipboard.objects) return;
    
    const isCrossBoard = this.clipboard.sourceBoardId && this.clipboard.sourceBoardId !== this.state.boardId;
    
    // Calculate bounds of copied elements to anchor them nicely
    let minX = Infinity, minY = Infinity;
    for (const frame of this.clipboard.objects.frames) {
      if (frame.x < minX) minX = frame.x;
      if (frame.y < minY) minY = frame.y;
    }
    for (const note of this.clipboard.objects.notes) {
      if (!note.parentFrameId) {
        if (note.x < minX) minX = note.x;
        if (note.y < minY) minY = note.y;
      }
    }
    // Fallback if everything was inside frames or bounds failed
    if (minX === Infinity) { minX = 0; minY = 0; }
    
    let offsetX = 32;
    let offsetY = 32;
    
    if (targetX !== undefined && targetY !== undefined) {
      // If we paste repeatedly without moving mouse much, stack them
      if (this.clipboard.lastPasteAnchor &&
          Math.abs(this.clipboard.lastPasteAnchor.x - targetX) < 10 &&
          Math.abs(this.clipboard.lastPasteAnchor.y - targetY) < 10) {
        this.clipboard.pasteCount++;
      } else {
        this.clipboard.pasteCount = 0;
        this.clipboard.lastPasteAnchor = { x: targetX, y: targetY };
      }
      offsetX = (targetX - minX) + (this.clipboard.pasteCount * 32);
      offsetY = (targetY - minY) + (this.clipboard.pasteCount * 32);
    } else {
      this.clipboard.pasteCount++;
      offsetX = this.clipboard.pasteCount * 32;
      offsetY = this.clipboard.pasteCount * 32;
    }
    
    const idMap = new Map();
    const newSelectedIds = new Set();
    let containsFrames = false;
    let containsNotes = false;

    // Reconstruct frames
    for (const frame of this.clipboard.objects.frames) {
      const newId = crypto.randomUUID();
      idMap.set(frame.id, newId);
      
      const pastedFrame = {
        ...frame,
        id: newId,
        x: frame.x + offsetX,
        y: frame.y + offsetY,
        childIds: [] // Will be populated when notes are recreated
      };
      
      this.state.frames.set(newId, pastedFrame);
      newSelectedIds.add(newId);
      containsFrames = true;
    }
    
    // Reconstruct notes
    for (const note of this.clipboard.objects.notes) {
      if ((note.type === 'image' || note.isImage) && isCrossBoard && note.src) {
        const newSrc = await workspaceManager.copyBoardAssetSafe(this.clipboard.sourceBoardId, this.state.boardId, note.src);
        if (!newSrc) {
          console.warn(`Skipped pasting image note ${note.id} due to asset copy failure.`);
          continue; // Safely abort creation of this specific image note
        }
        note.src = newSrc;
      }
      
      const newId = crypto.randomUUID();
      idMap.set(note.id, newId);
      
      const pastedNote = {
        ...note,
        id: newId,
        x: note.x + offsetX,
        y: note.y + offsetY,
        parentFrameId: note.parentFrameId && idMap.has(note.parentFrameId) ? idMap.get(note.parentFrameId) : null
      };

      if (pastedNote.parentFrameId) {
        const parentFrame = this.state.frames.get(pastedNote.parentFrameId);
        if (parentFrame) {
          parentFrame.childIds.push(newId);
        }
      }

      this.state.notes.set(newId, pastedNote);
      newSelectedIds.add(newId);
      containsNotes = true;
    }
    
    // Reconstruct internal edges
    for (const edge of this.clipboard.objects.edges) {
      if (idMap.has(edge.sourceId) && idMap.has(edge.targetId)) {
        this.state.addEdge(idMap.get(edge.sourceId), idMap.get(edge.targetId));
      }
    }

    if (newSelectedIds.size > 0) {
      // Safely perform manual bulk selection without single-item clearing
      this.selection.selectedIds.clear();
      for (const id of newSelectedIds) {
        this.selection.selectedIds.add(id);
      }
      this.selection.type = containsNotes ? 'note' : 'frame';
      
      this.state.notify();
      this.selection.notify();
      this.commitHistory();
    }
  }

  createNextNoteFromSelection(withEdge = false) {
    if (this.state.sourceType === 'legacy') return;

    let targetX, targetY, parentFrameId = null;
    let anchorNodeId = null;
    let anchorType = null;
    
    // Determine spatial anchor
    if (this.selection.selectedIds.size === 1) {
      const id = Array.from(this.selection.selectedIds)[0];
      const type = this.selection.type;
      let obj = type === 'note' ? this.state.notes.get(id) : this.state.frames.get(id);
      
      if (obj) {
        anchorNodeId = id;
        anchorType = type;
        const w = obj.width || (type === 'note' && (obj.type === 'image' || obj.isImage) ? 300 : 120);
        
        targetX = obj.x + w + 40;  // Use gap of 40px to the right
        targetY = obj.y;
        
        if (type === 'note') {
           parentFrameId = obj.parentFrameId || null;
        }
      }
    }
    
    if (targetX === undefined) {
      // Fallback: Viewport center, we try to use the canvas container safely
      const container = document.getElementById('canvas-container');
      if (container && this.state.canvas) {
        const rect = container.getBoundingClientRect();
        const screenX = rect.width / 2;
        const screenY = rect.height / 2;
        targetX = (screenX - this.state.canvas.panX) / this.state.canvas.zoom;
        targetY = (screenY - this.state.canvas.panY) / this.state.canvas.zoom;
      } else {
        targetX = 100;
        targetY = 100;
      }
    }

    const newNoteId = this.state.addNote(targetX, targetY, '');
    
    if (parentFrameId) {
      const note = this.state.notes.get(newNoteId);
      if (note) note.parentFrameId = parentFrameId;
    }

    // Connect Edge
    if (withEdge && anchorNodeId && anchorType !== 'frame') {
      // Explicitly ignoring frames for auto-edge
      this.state.addEdge(anchorNodeId, newNoteId);
    }

    this.pendingFocusNoteId = newNoteId;
    this.selection.clear();
    this.selection.select(newNoteId, 'note');
    
    this.commitHistory();
  }

  flushActiveEditor() {
    // Manually push contenteditable node data to state so we don't drop text
    const active = document.activeElement;
    if (active && active.classList.contains('orbit-note-content')) {
      const noteEl = active.closest('.orbit-note');
      if (noteEl && noteEl.dataset.id) {
        const id = noteEl.dataset.id;
        const note = this.state.notes.get(id);
        if (note && note.text !== active.textContent) {
          this.state.updateNoteText(id, active.textContent);
        }
      }
      active.blur();
    }
  }

  getNoteMetrics(id) {
    const note = this.state.notes.get(id);
    if (!note) return null;
    let width = note.width;
    let height = note.height;
    if (!width || !height) {
      const el = document.querySelector(`[data-id="${id}"]`);
      if (el && this.state.canvas) {
        const rect = el.getBoundingClientRect();
        const z = this.state.canvas.zoom || 1;
        width = width || (rect.width / z);
        height = height || (rect.height / z);
      }
    }
    return {
      x: note.x,
      y: note.y,
      width: width || 120,
      height: height || 56
    };
  }

  createChildNoteFromSelection() {
    if (this.state.sourceType === 'legacy') return;
    if (this.selection.selectedIds.size !== 1) return;
    if (this.selection.type !== 'note') return;

    const sourceId = Array.from(this.selection.selectedIds)[0];
    const sourceNode = this.state.notes.get(sourceId);
    if (!sourceNode || sourceNode.type === 'image' || sourceNode.isImage) return;

    this.flushActiveEditor();

    const metrics = this.getNoteMetrics(sourceId) || { width: 120 };
    const targetX = sourceNode.x + metrics.width + 60;
    const targetY = sourceNode.y;

    const newNoteId = this.state.addNote(targetX, targetY, '');
    if (sourceNode.parentFrameId) {
      const newNote = this.state.notes.get(newNoteId);
      if (newNote) newNote.parentFrameId = sourceNode.parentFrameId;
    }

    this.state.addEdge(sourceId, newNoteId);

    this.pendingFocusNoteId = newNoteId;
    this.selection.clear();
    this.selection.select(newNoteId, 'note');
    this.commitHistory();
  }

  createSiblingNoteFromSelection() {
    if (this.state.sourceType === 'legacy') return;
    if (this.selection.selectedIds.size !== 1) return;
    if (this.selection.type !== 'note') return;

    const sourceId = Array.from(this.selection.selectedIds)[0];
    const sourceNode = this.state.notes.get(sourceId);
    if (!sourceNode || sourceNode.type === 'image' || sourceNode.isImage) return;

    // Check incoming edges
    let incomingEdges = [];
    for (const edge of this.state.edges.values()) {
      if (edge.targetId === sourceId) {
        incomingEdges.push(edge);
      }
    }

    if (incomingEdges.length !== 1) return; // Strict rule: exactly 1 parent

    this.flushActiveEditor();

    const parentId = incomingEdges[0].sourceId;

    const metrics = this.getNoteMetrics(sourceId) || { height: 56 };
    const targetX = sourceNode.x;
    const targetY = sourceNode.y + metrics.height + 40;

    const newNoteId = this.state.addNote(targetX, targetY, '');
    if (sourceNode.parentFrameId) {
      const newNote = this.state.notes.get(newNoteId);
      if (newNote) newNote.parentFrameId = sourceNode.parentFrameId;
    }

    this.state.addEdge(parentId, newNoteId);

    this.pendingFocusNoteId = newNoteId;
    this.selection.clear();
    this.selection.select(newNoteId, 'note');
    this.commitHistory();
  }

  moveSelectionAmongConnected(direction) {
    if (this.selection.selectedIds.size !== 1) return;

    const sourceId = Array.from(this.selection.selectedIds)[0];
    const sourceType = this.selection.type;
    
    let sourceNode;
    if (sourceType === 'note') sourceNode = this.state.notes.get(sourceId);
    else if (sourceType === 'frame') sourceNode = this.state.frames.get(sourceId);
    
    if (!sourceNode) return;

    this.flushActiveEditor();

    let cx = sourceNode.x;
    let cy = sourceNode.y;
    
    if (sourceType === 'note') {
      const metrics = this.getNoteMetrics(sourceId) || { width: 120, height: 56 };
      cx += metrics.width / 2;
      cy += metrics.height / 2;
    } else {
      cx += (sourceNode.width || 120) / 2;
      cy += (sourceNode.height || 56) / 2;
    }

    const candidates = [];
    
    const validTargetIds = new Set();
    const parents = new Set();
    
    // 1. Find direct children and parents
    for (const edge of this.state.edges.values()) {
      if (edge.sourceId === sourceId) {
        validTargetIds.add(edge.targetId);
      } else if (edge.targetId === sourceId) {
        validTargetIds.add(edge.sourceId);
        parents.add(edge.sourceId);
      }
    }
    
    // 2. Find siblings (nodes that share the same parent)
    for (const edge of this.state.edges.values()) {
      if (parents.has(edge.sourceId) && edge.targetId !== sourceId) {
        validTargetIds.add(edge.targetId);
      }
    }
    
    for (const neighborId of validTargetIds) {
        let neighbor = this.state.notes.get(neighborId);
        let nType = 'note';
        if (!neighbor) {
          neighbor = this.state.frames.get(neighborId);
          nType = 'frame';
        }

        if (neighbor) {
          let ncx = neighbor.x;
          let ncy = neighbor.y;
          
          if (nType === 'note') {
            const nMetrics = this.getNoteMetrics(neighborId) || { width: 120, height: 56 };
            ncx += nMetrics.width / 2;
            ncy += nMetrics.height / 2;
          } else {
            ncx += (neighbor.width || 120) / 2;
            ncy += (neighbor.height || 56) / 2;
          }
          
          const dx = ncx - cx;
          const dy = ncy - cy;
          let angle = Math.atan2(dy, dx) * (180 / Math.PI); // -180 to 180
          
          let targetAngle = 0;
          if (direction === 'right') targetAngle = 0;
          else if (direction === 'down') targetAngle = 90;
          else if (direction === 'left') targetAngle = 180;
          else if (direction === 'up') targetAngle = -90;

          // Normalize angle difference to 0-180
          let diff = Math.abs(angle - targetAngle);
          while (diff > 180) diff = Math.abs(diff - 360);

          if (diff <= 60) { // relaxed cone to catch diagonal neighbors
             const distance = Math.sqrt(dx*dx + dy*dy);
             candidates.push({ id: neighborId, type: nType, diff, distance });
          }
        }
    }

    if (candidates.length > 0) {
      // Sort by angular deviation closely, with distance as tiebreaker
      candidates.sort((a, b) => {
        const angleWeight = a.diff - b.diff;
        if (Math.abs(angleWeight) > 10) return angleWeight;
        return a.distance - b.distance;
      });

      const best = candidates[0];
      this.selection.clear();
      this.selection.select(best.id, best.type);
      
      // Auto-pan if out of bounds
      const container = document.getElementById('canvas-container');
      if (container && this.state.canvas) {
         const rect = container.getBoundingClientRect();
         let tObj = best.type === 'note' ? this.state.notes.get(best.id) : this.state.frames.get(best.id);
         if (tObj) {
            const zoom = this.state.canvas.zoom;
            
            let tw = tObj.width || 120;
            let th = tObj.height || 56;
            if (best.type === 'note') {
              const tm = this.getNoteMetrics(best.id);
              if (tm) {
                tw = tm.width;
                th = tm.height;
              }
            }

            // Screen coords
            const sx1 = tObj.x * zoom + this.state.canvas.panX;
            const sy1 = tObj.y * zoom + this.state.canvas.panY;
            const sx2 = sx1 + tw * zoom;
            const sy2 = sy1 + th * zoom;

            const pad = 40;
            if (sx1 < pad || sy1 < pad || sx2 > rect.width - pad || sy2 > rect.height - pad) {
                // simple Pan adjustment to put it exactly in center
                const tcx = tObj.x + tw / 2;
                const tcy = tObj.y + th / 2;
                this.state.canvas.panX = rect.width / 2 - tcx * zoom;
                this.state.canvas.panY = rect.height / 2 - tcy * zoom;
                if (this.onBoardLoad) this.onBoardLoad(this.state.canvas);
            }
         }
      }
    }
  }
}
