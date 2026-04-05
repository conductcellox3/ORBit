export class DragInteraction {
  constructor(app, canvas, edgeDraw) {
    this.app = app;
    this.canvas = canvas;
    this.edgeDraw = edgeDraw;
    this.draggingType = null;
    this.startX = 0;
    this.startY = 0;
    this.initPositions = new Map();
    this.moved = false;
    this.activeDropTargetFrameId = null;
  }

  handlePointerDown(type, id, e) {
    if (e.shiftKey && type === 'note') {
      this.edgeDraw.start(id, e);
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      if (type === 'note' && !this.app.state.notes.get(id)?.isImage) {
        this.app.selection.toggleSelect(id, type);
      }
      e.stopPropagation();
      return;
    }

    if (e.altKey && type === 'note') {
      const connected = new Set([id]);
      const queue = [id];
      while (queue.length > 0) {
        const curr = queue.shift();
        for (const edge of this.app.state.edges.values()) {
          const neighbor = edge.sourceId === curr ? edge.targetId : (edge.targetId === curr ? edge.sourceId : null);
          if (neighbor && !connected.has(neighbor)) {
            if (this.app.state.notes.has(neighbor)) {
              connected.add(neighbor);
              queue.push(neighbor);
            }
          }
        }
      }
      // Bulk select the component
      this.app.selection.selectedIds.clear();
      for (const cId of connected) {
        this.app.selection.selectedIds.add(cId);
      }
      this.app.selection.type = 'note';
      this.app.selection.notify();
    } else if (!this.app.selection.has(id)) {
      if (type === 'note' && this.app.state.notes.get(id)?.isImage) {
         this.app.selection.select(id, type);
      } else {
         this.app.selection.select(id, type);
      }
    }

    this.draggingType = type;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.initPositions.clear();
    this.moved = false;
    this.activeDropTargetFrameId = null;

    for (const selectedId of this.app.selection.selectedIds) {
      const obj = type === 'note' ? this.app.state.notes.get(selectedId) : this.app.state.frames.get(selectedId);
      if (obj) {
        this.initPositions.set(selectedId, { x: obj.x, y: obj.y });
        const el = document.querySelector(`[data-id="${selectedId}"]`);
        if (el) el.classList.add('is-dragging');
        
        if (type === 'frame' && obj.childIds) {
          for (const childId of obj.childIds) {
            const childEl = document.querySelector(`[data-id="${childId}"]`);
            if (childEl) childEl.classList.add('is-dragging');
          }
        }
      }
    }

    e.stopPropagation();
  }

  handlePointerMove(e) {
    if (this.initPositions.size > 0) {
      this.moved = true;
      const dx = (e.clientX - this.startX) / this.canvas.viewport.zoom;
      const dy = (e.clientY - this.startY) / this.canvas.viewport.zoom;

      for (const [id, initPos] of this.initPositions.entries()) {
        const newX = initPos.x + dx;
        const newY = initPos.y + dy;

        if (this.draggingType === 'note') {
          this.app.state.moveNote(id, newX, newY);
        } else if (this.draggingType === 'frame') {
          this.app.state.moveFrame(id, newX, newY);
        }
      }
      
      // Hover Drop Target logic for Notes
      if (this.draggingType === 'note' && this.app.selection.selectedIds.size > 0) {
        const pointerCanvas = this.canvas.viewport.screenToCanvas(e.clientX, e.clientY);
        let hoveredFrameId = null;
        
        for (const [fId, frame] of this.app.state.frames.entries()) {
          // Exclude collapsed frames from drop target
          if (frame.isCollapsed) continue;
          
          if (pointerCanvas.x >= frame.x && pointerCanvas.x <= frame.x + frame.width &&
              pointerCanvas.y >= frame.y && pointerCanvas.y <= frame.y + frame.height) {
            hoveredFrameId = fId;
            // Break early just to get any intersecting frame
            break;
          }
        }
        
        if (hoveredFrameId !== this.activeDropTargetFrameId) {
          if (this.activeDropTargetFrameId) {
            const oldTarget = document.querySelector(`[data-id="${this.activeDropTargetFrameId}"]`);
            if (oldTarget) oldTarget.classList.remove('is-drop-target');
          }
          if (hoveredFrameId) {
            const newTarget = document.querySelector(`[data-id="${hoveredFrameId}"]`);
            if (newTarget) newTarget.classList.add('is-drop-target');
          }
          this.activeDropTargetFrameId = hoveredFrameId;
        }

        // Apply visual separation feedback to dragging notes
        for (const id of this.app.selection.selectedIds) {
          const note = this.app.state.notes.get(id);
          if (note && note.parentFrameId) {
            const el = document.querySelector(`[data-id="${id}"]`);
            if (el) {
              if (hoveredFrameId === null) {
                el.classList.add('is-detaching-from-frame');
              } else {
                el.classList.remove('is-detaching-from-frame');
              }
            }
          }
        }
      }
    }
  }

  handlePointerUp(e) {
    if (this.initPositions.size > 0) {
      for (const id of this.initPositions.keys()) {
        const el = document.querySelector(`[data-id="${id}"]`);
        if (el) el.classList.remove('is-dragging');
        
        if (this.draggingType === 'frame') {
          const frame = this.app.state.frames.get(id);
          if (frame && frame.childIds) {
            for (const childId of frame.childIds) {
              const childEl = document.querySelector(`[data-id="${childId}"]`);
              if (childEl) childEl.classList.remove('is-dragging');
            }
          }
        }
      }

      if (this.moved) {
        if (this.draggingType === 'note') {
          if (this.activeDropTargetFrameId) {
            // Drop onto a frame -> reparent
            for (const id of this.initPositions.keys()) {
              this.app.state.addNoteToFrame(id, this.activeDropTargetFrameId);
            }
          } else {
            // Dropped onto empty canvas -> DETACH
            for (const id of this.initPositions.keys()) {
              const note = this.app.state.notes.get(id);
              if (note && note.parentFrameId) {
                this.app.state.removeNoteFromFrame(id);
              }
            }
          }
        }
        this.app.commitHistory();
      }

      // Cleanup CSS classes
      if (this.draggingType === 'note') {
        for (const id of this.initPositions.keys()) {
          const el = document.querySelector(`[data-id="${id}"]`);
          if (el) el.classList.remove('is-detaching-from-frame');
        }
      }

      if (this.activeDropTargetFrameId) {
        const dropEl = document.querySelector(`[data-id="${this.activeDropTargetFrameId}"]`);
        if (dropEl) dropEl.classList.remove('is-drop-target');
      }

      this.draggingType = null;
      this.initPositions.clear();
      this.moved = false;
      this.activeDropTargetFrameId = null;
    }
  }
}
