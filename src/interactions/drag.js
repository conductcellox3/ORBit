export class DragInteraction {
  constructor(app, canvas, edgeDraw) {
    this.app = app;
    this.canvas = canvas;
    this.edgeDraw = edgeDraw;
    this.draggingType = null;
    this.draggingId = null;
    this.startX = 0;
    this.startY = 0;
    this.initX = 0;
    this.initY = 0;
    this.moved = false;
  }

  handlePointerDown(type, id, e) {
    if (e.shiftKey && type === 'note') {
      this.edgeDraw.start(id, e);
      return;
    }
    
    this.app.selection.select(id, type);

    let obj = type === 'note' ? this.app.state.notes.get(id) : this.app.state.frames.get(id);
    if (!obj) return;

    this.draggingType = type;
    this.draggingId = id;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.initX = obj.x;
    this.initY = obj.y;
    this.moved = false;

    const el = document.querySelector(`[data-id="${id}"]`);
    if (el) el.classList.add('is-dragging');

    e.stopPropagation();
  }

  handlePointerMove(e) {
    if (this.draggingId) {
      this.moved = true;
      const dx = (e.clientX - this.startX) / this.canvas.viewport.zoom;
      const dy = (e.clientY - this.startY) / this.canvas.viewport.zoom;

      const newX = this.initX + dx;
      const newY = this.initY + dy;

      if (this.draggingType === 'note') {
        this.app.state.moveNote(this.draggingId, newX, newY);
      } else if (this.draggingType === 'frame') {
        this.app.state.moveFrame(this.draggingId, newX, newY);
      }
    }
  }

  handlePointerUp(e) {
    if (this.draggingId) {
      const el = document.querySelector(`[data-id="${this.draggingId}"]`);
      if (el) el.classList.remove('is-dragging');

      if (this.moved) {
        this.app.commitHistory();
      }

      this.draggingType = null;
      this.draggingId = null;
      this.moved = false;
    }
  }
}
