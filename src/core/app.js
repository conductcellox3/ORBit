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
