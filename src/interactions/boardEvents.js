import { ContextMenu } from '../shell/contextMenu.js';

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

    container.addEventListener('contextmenu', (e) => {
      // Allow frame creation if multiple native notes are selected.
      if (this.app.state.sourceType === 'native' && this.app.selection.selectedIds.size >= 2) {
        // Only run if triggered on blank canvas or one of the strictly selected notes
        const targetId = e.target.closest('.orbit-note')?.dataset.id;
        const validTrigger = !targetId || this.app.selection.selectedIds.has(targetId);
        
        if (validTrigger) {
          e.preventDefault();
          e.stopPropagation();
          ContextMenu.show(e.clientX, e.clientY, [
            {
              label: `Create Frame from Selection (${this.app.selection.selectedIds.size})`,
              onClick: () => {
                const newFrameId = this.app.state.createFrameFromSelection(this.app.selection.selectedIds);
                if (newFrameId) {
                  this.app.selection.clear();
                  this.app.selection.select(newFrameId, 'frame');
                  this.app.commitHistory();
                }
              }
            }
          ]);
        }
      }
    });

    let marqueeEl = null;
    let isMarquee = false;

    container.addEventListener('pointerdown', (e) => {
      // Right-click check for context menus
      if (e.button === 2) return;

      if (e.target.id === 'canvas-container' || e.target.id === 'edge-layer') {
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          this.app.selection.clear();
        }
        
        if (e.shiftKey) {
          this.isPanning = false;
          isMarquee = true;
          this.panStartX = e.clientX;
          this.panStartY = e.clientY;
          
          marqueeEl = document.createElement('div');
          marqueeEl.className = 'orbit-marquee';
          document.body.appendChild(marqueeEl);
        } else {
          this.isPanning = true;
          isMarquee = false;
          this.panStartX = e.clientX;
          this.panStartY = e.clientY;
        }
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
      } else if (isMarquee && marqueeEl) {
        const left = Math.min(e.clientX, this.panStartX);
        const top = Math.min(e.clientY, this.panStartY);
        const width = Math.abs(e.clientX - this.panStartX);
        const height = Math.abs(e.clientY - this.panStartY);
        
        marqueeEl.style.left = `${left}px`;
        marqueeEl.style.top = `${top}px`;
        marqueeEl.style.width = `${width}px`;
        marqueeEl.style.height = `${height}px`;
      } else {
        this.drag.handlePointerMove(e);
        this.edgeDraw.handlePointerMove(e);
      }
    });

    container.addEventListener('pointerup', (e) => {
      if (this.isPanning) {
        this.isPanning = false;
        container.releasePointerCapture(e.pointerId);
      } else if (isMarquee) {
        isMarquee = false;
        container.releasePointerCapture(e.pointerId);

        if (marqueeEl) {
          const rect = marqueeEl.getBoundingClientRect();
          marqueeEl.remove();
          marqueeEl = null;

          // Convert screen rect to canvas rect
          const tl = this.canvas.viewport.screenToCanvas(rect.left, rect.top);
          const br = this.canvas.viewport.screenToCanvas(rect.right, rect.bottom);
          
          const selLeft = tl.x;
          const selTop = tl.y;
          const selRight = br.x;
          const selBottom = br.y;

          // Find intersecting nodes
          if (!e.ctrlKey && !e.metaKey) {
            this.app.selection.clear();
          }

          let anySelected = false;
          for (const [id, note] of this.app.state.notes.entries()) {
            if (note.isImage) continue; // MVP blocks images from mass selection

            // Bbox fallback if undefined
            let nW = note.width || 120;
            let nH = note.height || 56;
            
            const el = document.querySelector(`.orbit-note[data-id="${id}"]`);
            if (el) {
              nW = el.offsetWidth;
              nH = el.offsetHeight;
            }

            const nLeft = note.x;
            const nTop = note.y;
            const nRight = note.x + nW;
            const nBottom = note.y + nH;

            // Intersection Math
            if (selLeft < nRight && selRight > nLeft && selTop < nBottom && selBottom > nTop) {
              this.app.selection.selectedIds.add(id);
              this.app.selection.type = 'note';
              anySelected = true;
            }
          }
          
          if (anySelected) {
            this.app.selection.notify();
          }
        }
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
        if (this.app.selection.selectedIds.size > 0) {
          for (const id of Array.from(this.app.selection.selectedIds)) {
            this.app.state.deleteNode(id);
          }
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
