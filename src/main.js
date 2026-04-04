import { App } from './core/app.js';
import { CanvasOrchestrator } from './render/canvas.js';
import { DragInteraction } from './interactions/drag.js';
import { EdgeDrawInteraction } from './interactions/edgeDraw.js';
import { BoardEvents } from './interactions/boardEvents.js';

import { ShellLayout } from './shell/layout.js';
import { ImageViewer } from './render/imageViewer.js';
import { PropertiesPanel } from './shell/propertiesPanel.js';

import { SearchEngine } from './core/search.js';
import { SearchUI } from './shell/searchUI.js';
import { BoardsGraphView } from './render/boardsGraphView.js';

import { PrintLayout } from './core/export/printLayout.js';
import { BoardSnapshot } from './core/export/boardSnapshot.js';
import { ExportPanel } from './shell/exportPanel.js';

async function bootstrap() {
  const app = new App();
  app.imageViewer = new ImageViewer(app);
  app.searchEngine = new SearchEngine(app);
  await app.init();
  window.app = app;
  
  app.printLayout = new PrintLayout(app);
  app.boardSnapshot = new BoardSnapshot(app);
  
  const shell = new ShellLayout(app);
  shell.mount();
  app.shell = shell;
  app.propertiesPanel = new PropertiesPanel(app);
  app.searchUI = new SearchUI(app);
  app.exportPanel = new ExportPanel(app, 'export-panel');
  
  app.onToggleSearch = () => {
    app.searchUI.toggle();
  };
  
  app.onLinkIndexUpdated = () => {
    if (app.propertiesPanel) {
      app.propertiesPanel.softUpdate();
    }
    if (canvas && canvas.notesRenderer) {
      canvas.notesRenderer.updateBacklinkBadges();
    }
    if (app.printLayout?.isActive) {
      app.printLayout.render();
    }
  };
  
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

  const boardsGraph = new BoardsGraphView(app, 'canvas-container');
  app.boardsGraph = boardsGraph;

  drag.canvas = canvas;
  edgeDraw.canvas = canvas;
  interactionsManager.canvas = canvas;

  interactionsManager.bind();

  canvas.render();
}

window.addEventListener('DOMContentLoaded', bootstrap);
