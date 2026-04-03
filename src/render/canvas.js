import { NoteRenderer } from './notes.js';
import { FrameRenderer } from './frames.js';
import { EdgeRenderer } from './edges.js';
import { Viewport } from './viewport.js';

export class CanvasOrchestrator {
  constructor(app, containerId, svgId, transformId, interactions) {
    this.app = app;
    this.container = document.getElementById(containerId);
    this.svgLayer = document.getElementById(svgId);
    this.transformLayer = document.getElementById(transformId);
    
    this.viewport = new Viewport(this.transformLayer);
    
    this.noteRenderer = new NoteRenderer(app, this.transformLayer, interactions);
    this.frameRenderer = new FrameRenderer(app, this.transformLayer, interactions);
    this.edgeRenderer = new EdgeRenderer(app, this.svgLayer);

    this.app.state.subscribe(() => this.render());
    this.app.selection.subscribe(() => this.render());
    
    this.app.onBoardLoad = (canvasState) => {
      if (canvasState) {
        this.viewport.x = canvasState.panX || 0;
        this.viewport.y = canvasState.panY || 0;
        this.viewport.zoom = canvasState.zoom || 1;
      }
      this.render();
    };
  }

  render(activeDrawEdge = null) {
    this.transformLayer.style.transform = `translate(${this.viewport.x}px, ${this.viewport.y}px) scale(${this.viewport.zoom})`;
    
    
    this.frameRenderer.render();
    this.noteRenderer.render();
    this.edgeRenderer.render(activeDrawEdge);
  }
}
