export class BoardEvents {
  constructor(app, canvas, drag, edgeDraw) {
    this.app = app;
    this.canvas = canvas;
    this.drag = drag;
    this.edgeDraw = edgeDraw;
    
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
  }

  bind() {
    const container = document.getElementById('canvas-container');

    container.addEventListener('pointerdown', (e) => {
      if (e.target.id === 'canvas-container' || e.target.id === 'edge-layer') {
        this.app.selection.clear();
        this.isPanning = true;
        this.panStartX = e.clientX;
        this.panStartY = e.clientY;
        container.setPointerCapture(e.pointerId);
      }
    });

    container.addEventListener('pointermove', (e) => {
      if (this.isPanning) {
        const dx = e.clientX - this.panStartX;
        const dy = e.clientY - this.panStartY;
        this.canvas.viewport.pan(dx, dy);
        this.panStartX = e.clientX;
        this.panStartY = e.clientY;
      } else {
        this.drag.handlePointerMove(e);
        this.edgeDraw.handlePointerMove(e);
      }
    });

    container.addEventListener('pointerup', (e) => {
      if (this.isPanning) {
        this.isPanning = false;
        container.releasePointerCapture(e.pointerId);
      } else {
        this.drag.handlePointerUp(e);
        this.edgeDraw.handlePointerUp(e);
      }
    });

    container.addEventListener('dblclick', (e) => {
      if (e.target.id === 'canvas-container' || e.target.id === 'edge-layer') {
        const coords = this.canvas.viewport.screenToCanvas(e.clientX, e.clientY);
        this.app.state.addNote(coords.x - 60, coords.y - 20, '');
        this.app.commitHistory();
      }
    });

    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      // Use Ctrl/Cmd for zoom, otherwise pan
      if (e.ctrlKey || e.metaKey || e.deltaMode !== 0) { 
        // Trackpads sometimes emit deltaMode 0 for pixel scroll, mouse wheels 1.
        // We'll trust ctrlKey for pinch zoom mostly.
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        this.canvas.viewport.zoomAt(e.clientX, e.clientY, factor);
      } else {
        this.canvas.viewport.pan(-e.deltaX, -e.deltaY);
      }
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (document.activeElement.isContentEditable) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) {
          this.app.redo();
          e.preventDefault();
        } else if (e.key.toLowerCase() === 'z') {
          this.app.undo();
          e.preventDefault();
        }
      }
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.app.selection.selectedId) {
          this.app.state.deleteNode(this.app.selection.selectedId);
          this.app.selection.clear();
          this.app.commitHistory();
        }
      }
    });
  }

  handlePointerDown(type, id, e) {
    this.drag.handlePointerDown(type, id, e);
  }
}
