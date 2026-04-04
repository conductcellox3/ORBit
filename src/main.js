import { App } from './core/app.js';
import { CanvasOrchestrator } from './render/canvas.js';
import { DragInteraction } from './interactions/drag.js';
import { EdgeDrawInteraction } from './interactions/edgeDraw.js';
import { BoardEvents } from './interactions/boardEvents.js';

import { ShellLayout } from './shell/layout.js';
import { ImageViewer } from './render/imageViewer.js';

async function bootstrap() {
  const app = new App();
  app.imageViewer = new ImageViewer(app);
  await app.init();
  
  const shell = new ShellLayout(app);
  shell.mount();
  
  const edgeDraw = new EdgeDrawInteraction(app, null);
  const drag = new DragInteraction(app, null, edgeDraw);
  const interactionsManager = new BoardEvents(app, null, drag, edgeDraw);
  
  const canvas = new CanvasOrchestrator(
    app, 
    'canvas-container', 
    'edge-layer', 
    'board-transform', 
    interactionsManager
  );

  drag.canvas = canvas;
  edgeDraw.canvas = canvas;
  interactionsManager.canvas = canvas;

  interactionsManager.bind();

  canvas.render();
}

window.addEventListener('DOMContentLoaded', bootstrap);
