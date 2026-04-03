export class EdgeDrawInteraction {
  constructor(app, canvas) {
    this.app = app;
    this.canvas = canvas;
    this.isDrawing = false;
    this.sourceId = null;
    this.targetPoint = {x: 0, y: 0};
  }

  start(sourceId, e) {
    this.isDrawing = true;
    this.sourceId = sourceId;
    this.updateTargetPoint(e);
    
    const el = document.querySelector(`[data-id="${sourceId}"]`);
    if (el) el.classList.add('is-connection-source');
    
    e.stopPropagation();
  }

  handlePointerMove(e) {
    if (this.isDrawing) {
      this.updateTargetPoint(e);
      this.canvas.render({ sourceId: this.sourceId, targetPoint: this.targetPoint });
    }
  }

  handlePointerUp(e) {
    if (this.isDrawing) {
      this.isDrawing = false;
      const srcEl = document.querySelector(`[data-id="${this.sourceId}"]`);
      if (srcEl) srcEl.classList.remove('is-connection-source');

      let targetId = null;
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      for (const el of elements) {
        if (el.classList.contains('orbit-note') && el.dataset.id !== this.sourceId) {
          targetId = el.dataset.id;
          break;
        }
      }

      if (targetId) {
        this.app.state.addEdge(this.sourceId, targetId);
        this.app.commitHistory();
      }

      this.sourceId = null;
      this.canvas.render();
    }
  }

  updateTargetPoint(e) {
    const coords = this.canvas.viewport.screenToCanvas(e.clientX, e.clientY);
    this.targetPoint = { x: coords.x, y: coords.y };
  }
}
