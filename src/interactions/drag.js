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

    if (!this.app.selection.has(id)) {
      if (type === 'note' && this.app.state.notes.get(id)?.isImage) {
         // Single select image
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
        this.app.commitHistory();
      }

      this.draggingType = null;
      this.initPositions.clear();
      this.moved = false;
    }
  }
}
