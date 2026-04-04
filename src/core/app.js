import { State } from './state.js';
import { History } from './history.js';
import { Selection } from './selection.js';
import { Persistence } from './persistence.js';

import { workspaceManager } from './workspace.js';

export class App {
  constructor() {
    this.state = new State();
    this.history = new History(this.state);
    this.selection = new Selection();
    this.persistence = new Persistence(this.state, this.history);
    this.pendingFocusNoteId = null;
  }

  async init() {
    await workspaceManager.init();
    
    // Look for last open board, or null to auto-create
    const lastId = workspaceManager.manifest?.lastOpenedBoardId;
    await this.loadNativeBoard(lastId);
  }

  async save() {
    return await this.persistence.save();
  }

  async loadNativeBoard(boardId) {
    if (this.state.sourceType === 'native' && this.state.boardId === boardId) {
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
    await this.persistence.loadNativeBoard(boardId);
    
    if (this.onBoardChanged) this.onBoardChanged(this.state.boardId);
    if (this.onTitleChanged) this.onTitleChanged(this.state.title);
    if (this.onBoardLoad) this.onBoardLoad(this.state.canvas);
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

  commitHistory() {
    this.history.commit();
    this.save().catch(e => console.error(e));
  }

  undo() {
    this.history.undo();
    this.selection.clear();
    this.save().catch(e => console.error(e));
  }

  redo() {
    this.history.redo();
    this.selection.clear();
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

  toggleSearch() {
    if (this.onToggleSearch) {
      this.onToggleSearch();
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
}
