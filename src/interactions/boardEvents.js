import { ContextMenu } from '../shell/contextMenu.js';
import { workspaceManager } from '../core/workspace.js';

export class BoardEvents {
  constructor(app, canvas, drag, edgeDraw) {
    this.app = app;
    this.canvas = canvas;
    this.drag = drag;
    this.edgeDraw = edgeDraw;
    
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
    
    this.lastCursorScreenX = null;
    this.lastCursorScreenY = null;
  }

  bind() {
    const container = document.getElementById('canvas-container');

    container.addEventListener('contextmenu', (e) => {
      if (this.app.state.sourceType !== 'native') return;
      
      e.preventDefault();
      e.stopPropagation();

      const noteEl = e.target.closest('.orbit-note');
      const frameEl = e.target.closest('.orbit-frame');
      
      let targetId = null;
      let targetType = null;

      if (noteEl) {
        targetId = noteEl.dataset.id;
        targetType = 'note';
      } else if (frameEl) {
        targetId = frameEl.dataset.id;
        targetType = 'frame';
      }

      if (targetId) {
        if (!this.app.selection.selectedIds.has(targetId) || this.app.selection.type !== targetType) {
          this.app.selection.clear();
          this.app.selection.select(targetId, targetType);
        }
      }

      const items = [];

      if (this.app.selection.selectedIds.size >= 2 && this.app.selection.type === 'note') {
        items.push({
          label: `Create Frame from Selection (${this.app.selection.selectedIds.size})`,
          onClick: () => {
            const newFrameId = this.app.state.createFrameFromSelection(this.app.selection.selectedIds);
            if (newFrameId) {
              this.app.selection.clear();
              this.app.selection.select(newFrameId, 'frame');
              this.app.commitHistory();
            }
          }
        });
      }

      if (targetId && this.app.selection.selectedIds.size > 0) {
        let hasNonImage = false;
        for (const id of this.app.selection.selectedIds) {
          if (this.app.selection.type === 'note') {
            const note = this.app.state.notes.get(id);
            if (note && note.type !== 'image' && !note.isImage) {
              hasNonImage = true;
              break;
            }
          } else {
            hasNonImage = true;
            break;
          }
        }

        if (hasNonImage) {
          items.push({
          label: 'Change Color...',
          onClick: () => {
             // ... [already intact inside]
             const colors = ['neutral', 'blue', 'cyan', 'green', 'yellow', 'red'];
             const colorItems = colors.map(c => ({
               label: c === 'neutral' ? 'None (Default)' : c.charAt(0).toUpperCase() + c.slice(1),
               onClick: () => {
                 for (const id of this.app.selection.selectedIds) {
                   if (this.app.selection.type === 'note') {
                     this.app.state.setNoteColor(id, c);
                   } else if (this.app.selection.type === 'frame') {
                     this.app.state.setFrameColor(id, c);
                   }
                 }
                 this.app.commitHistory();
               }
             }));
             setTimeout(() => { ContextMenu.show(e.clientX, e.clientY, colorItems); }, 10);
          }
        });
        }
        
        let hasImage = false;
        if (targetType === 'note') {
          for (const id of this.app.selection.selectedIds) {
            const note = this.app.state.notes.get(id);
            if (note && (note.type === 'image' || note.isImage)) {
              hasImage = true;
              break;
            }
          }
        }

        if (hasImage && this.app.selection.selectedIds.size === 1) {
          items.push({
            label: 'Edit Caption...',
            onClick: () => {
              this.spawnCaptionInput(targetId);
            }
          });
        }
        
        items.push({ type: 'separator' });
        items.push({
          label: 'Delete',
          onClick: () => {
            for (const id of Array.from(this.app.selection.selectedIds)) {
              this.app.state.deleteNode(id);
            }
            this.app.selection.clear();
            this.app.commitHistory();
          }
        });
      }

      if (items.length > 0) {
        ContextMenu.show(e.clientX, e.clientY, items);
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
      this.lastCursorScreenX = e.clientX;
      this.lastCursorScreenY = e.clientY;

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

    window.addEventListener('paste', async (e) => {
      if (this.app.state.sourceType !== 'native') return;
      
      if (
        document.activeElement.tagName === 'INPUT' || 
        document.activeElement.tagName === 'TEXTAREA' || 
        document.activeElement.isContentEditable ||
        e.target.closest('[contenteditable="true"]') ||
        e.target.closest('input') ||
        e.target.closest('textarea')
      ) {
        return;
      }

      if (!e.clipboardData || !e.clipboardData.items) return;

      for (const item of Array.from(e.clipboardData.items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          
          const suffix = item.type.split('/')[1] || 'png';
          const file = item.getAsFile();
          if (!file) continue;

          const url = URL.createObjectURL(file);
          const img = new Image();
          img.onload = async () => {
            let w = img.width;
            let h = img.height;
            URL.revokeObjectURL(url);
            
            const maxW = Math.min(600, window.innerWidth * 0.8);
            const maxH = Math.min(600, window.innerHeight * 0.8);
            
            if (w > maxW || h > maxH) {
              const ratio = Math.min(maxW / w, maxH / h);
              w = w * ratio;
              h = h * ratio;
            }

            const arrayBuffer = await file.arrayBuffer();
            const relativeSrc = await workspaceManager.saveBoardAsset(this.app.state.boardId, arrayBuffer, suffix);
            
            if (relativeSrc) {
              let spawnX, spawnY;

              if (this.lastCursorScreenX !== null && this.lastCursorScreenY !== null) {
                const pointerCanvas = this.canvas.viewport.screenToCanvas(this.lastCursorScreenX, this.lastCursorScreenY);
                spawnX = pointerCanvas.x - (w / 2);
                spawnY = pointerCanvas.y - (h / 2);
              } else {
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const center = this.canvas.viewport.screenToCanvas(vw / 2, vh / 2);
                spawnX = center.x - (w / 2);
                spawnY = center.y - (h / 2);
              }
              
              const newId = this.app.state.addImageNote(spawnX, spawnY, relativeSrc, w, h);
              if (newId) {
                this.app.selection.clear();
                this.app.selection.select(newId, 'note');
                this.app.commitHistory();
                
                // Fast Capture: Immediately prompt for a caption
                requestAnimationFrame(() => {
                  this.spawnCaptionInput(newId);
                });
              }
            }
          };
          img.src = url;
          break;
        }
      }
    });
  }

  handlePointerDown(type, id, e) {
    this.drag.handlePointerDown(type, id, e);
  }

  spawnCaptionInput(targetId) {
    const noteEl = document.querySelector(`.orbit-note[data-id="${targetId}"]`);
    const noteData = this.app.state.notes.get(targetId);
    if (!noteEl || !noteData) return;

    // Prevent double spawning
    if (noteEl.querySelector('input')) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = noteData.caption || '';
    input.placeholder = 'Add a caption...';
    input.style.position = 'absolute';
    input.style.bottom = '12px';
    input.style.left = '50%';
    input.style.transform = 'translateX(-50%)';
    input.style.width = 'calc(100% - 24px)';
    input.style.border = '1px solid var(--border-color, #CBD5E1)';
    input.style.background = 'var(--color-canvas-bg, #FFFFFF)';
    input.style.color = 'var(--color-text-main, #202124)';
    input.style.outline = 'none';
    input.style.borderRadius = '3px';
    input.style.padding = '0 4px';
    input.style.fontSize = '12px';
    input.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    input.style.zIndex = '10';
    
    let isCommitted = false;
    const commit = () => {
      if (isCommitted) return;
      isCommitted = true;
      const newCaption = input.value.trim();
      if (noteData.caption !== newCaption) {
        this.app.state.updateImageCaption(targetId, newCaption);
        this.app.commitHistory();
      }
      input.remove();
    };
    
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (ke) => {
      if (ke.key === 'Enter') {
        input.blur();
      } else if (ke.key === 'Escape') {
        input.value = noteData.caption || ''; // Revert
        input.blur();
      }
    });
    
    noteEl.appendChild(input);
    input.focus();
    input.select();
  }
}
