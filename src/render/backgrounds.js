import { workspaceManager } from '../core/workspace.js';
import { assetResolver } from '../legacy/assetResolver.js';

export class BackgroundRenderer {
  constructor(app, container, interactions) {
    this.app = app;
    this.container = container;
    this.elements = new Map();
    this.interactions = interactions;
  }

  render() {
    const notes = this.app.state.notes;
    const isNoteSelection = this.app.selection.type === 'note';

    // Cleanup Loop
    for (const [id, el] of this.elements.entries()) {
      if (!notes.has(id) || notes.get(id).type !== 'background-image') {
        el.remove();
        this.elements.delete(id);
      }
    }

    // Render Loop
    for (const [id, note] of notes.entries()) {
      if (note.type !== 'background-image') continue;
      
      let el = this.elements.get(id);
      if (!el) {
        el = this.createNodeElement(note);
        this.container.appendChild(el);
        this.elements.set(id, el);
      }
      
      el.style.transform = `translate(${note.x}px, ${note.y}px)`;
      if (note.w !== undefined) el.style.width = `${note.w}px`;
      if (note.h !== undefined) el.style.height = `${note.h}px`;

      el.classList.toggle('is-selected', isNoteSelection && this.app.selection.has(id));
      el.classList.toggle('is-locked', !!note.locked);
    }
  }

  createNodeElement(note) {
    const el = document.createElement('div');
    el.className = 'orbit-background-image';
    el.dataset.id = note.id;
    
    // Add data-type attribute for drag interaction distinction if needed
    el.dataset.type = 'background-image';
    
    const img = document.createElement('img');
    img.className = 'orbit-background-img-element';
    // Use fill (100% width/height without objectFit) or contain. We use 100% width/height strictly.
    img.style.width = '100%';
    img.style.height = '100%';
    // We let user manually stretch backgrounds, so we don't enforce object-fit: contain here.
    img.style.userSelect = 'none';
    img.style.pointerEvents = 'none'; // Prevent native image dragging

    // Async resolve image src
    if (this.app.state.sourceType === 'native') {
      workspaceManager.resolveAssetUrl(this.app.state.boardId, note.src).then(resolvedSrc => {
        if (resolvedSrc) img.src = resolvedSrc;
      });
    } else {
      assetResolver.resolveImage(note.src).then(resolvedSrc => {
        if (resolvedSrc) img.src = resolvedSrc;
      });
    }
    el.appendChild(img);
    
    // Prevent interaction if locked
    el.addEventListener('pointerdown', (e) => {
      // Ignore left clicks completely if locked (so we don't start dragging/selecting)
      // but allow right clicks (button === 2) to continue so context menu works
      if (note.locked && e.button !== 2) return;
      
      // In ORBit, pointerdown delegates to drag system
      this.interactions.handlePointerDown('note', note.id, e);
    });

    if (this.app.state.sourceType === 'native') {
      const handle = document.createElement('div');
      handle.className = 'orbit-resize-handle';
      
      let isResizing = false;
      let startW, startH, startX, startY, zoom;

      handle.addEventListener('pointerdown', (e) => {
        if (note.locked) return; // Prevent resize if locked
        e.stopPropagation();
        e.preventDefault();
        
        isResizing = true;
        handle.setPointerCapture(e.pointerId);
        
        startW = el.offsetWidth;
        startH = el.offsetHeight;
        startX = e.clientX;
        startY = e.clientY;
        zoom = this.app.state.canvas.zoom || 1;
      });

      handle.addEventListener('pointermove', (e) => {
        if (!isResizing) return;
        
        const dx = (e.clientX - startX) / zoom;
        const dy = (e.clientY - startY) / zoom;
        
        let newW = Math.max(30, startW + dx);
        let newH = Math.max(30, startH + dy);
        
        el.style.width = `${newW}px`;
        el.style.height = `${newH}px`;
      });

      const cleanup = (e) => {
        if (!isResizing) return;
        isResizing = false;
        handle.releasePointerCapture(e.pointerId);
        
        const finalW = el.offsetWidth;
        const finalH = el.offsetHeight;
        
        this.app.state.updateBackgroundBounds(note.id, finalW, finalH);
        this.app.commitHistory();
      };

      handle.addEventListener('pointerup', cleanup);
      handle.addEventListener('pointercancel', cleanup);
      handle.addEventListener('lostpointercapture', cleanup);
      
      el.appendChild(handle);
    }
    
    return el;
  }
}
