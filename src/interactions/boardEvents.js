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

      const noteEl = e.target.closest('.orbit-note, .orbit-background-image');
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

      if (targetType === 'note') {
        const checkNote = this.app.state.notes.get(targetId);
        if (checkNote && checkNote.type === 'background-image') {
          const bgItems = [];
          bgItems.push({
            label: checkNote.locked ? 'Unlock Background' : 'Lock Background',
            onClick: () => {
              checkNote.locked = !checkNote.locked;
              this.app.state.notify();
              this.app.commitHistory();
            }
          });
          bgItems.push({ type: 'separator' });
          bgItems.push({
            label: 'Delete Background',
            onClick: () => {
              this.app.state.deleteNode(targetId);
              this.app.selection.clear();
              this.app.commitHistory();
            }
          });
          ContextMenu.show(e.clientX, e.clientY, bgItems);
          return;
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

      if (targetType === 'frame' && this.app.selection.selectedIds.size === 1) {
        items.push({
          label: 'New Note in Frame',
          onClick: () => {
             const frameId = targetId;
             const frame = this.app.state.frames.get(frameId);
             if (frame) {
               if (frame.isCollapsed) {
                 frame.isCollapsed = false;
                 // Re-calculate size if needed for visual feedback
                 if (frame.childIds) {
                   let maxH = 100;
                   for(const cid of frame.childIds) {
                      const cnote = this.app.state.notes.get(cid);
                      if (cnote) {
                         const nH = cnote.y + (cnote.height || 56) + 32;
                         if (nH > maxH) maxH = nH;
                      }
                   }
                   frame.height = Math.max(frame.height || 400, maxH - frame.y);
                 }
               }

               // Light staggered placement inside the frame
               const offset = (frame.childIds ? frame.childIds.length : 0) * 8;
               const pad = 24;
               const nx = frame.x + pad + offset;
               const ny = frame.y + pad + 32 + offset; // 32px below header
               
               const noteId = this.app.state.addNote(nx, ny, '');
               this.app.state.addNoteToFrame(noteId, frameId);
               
               this.app.pendingFocusNoteId = noteId;
               this.app.selection.clear();
               this.app.selection.select(noteId, 'note');
               this.app.commitHistory();
             }
          }
        });
      }

      if (targetType === 'note') {
        let allHaveParents = true;
        for (const id of this.app.selection.selectedIds) {
           const note = this.app.state.notes.get(id);
           if (!note || !note.parentFrameId) {
              allHaveParents = false;
              break;
           }
        }
        if (allHaveParents && this.app.selection.selectedIds.size > 0) {
           items.push({
             label: 'Remove from Frame',
             onClick: () => {
               for (const id of this.app.selection.selectedIds) {
                 this.app.state.removeNoteFromFrame(id);
               }
               this.app.commitHistory();
             }
           });
           items.push({ type: 'separator' });
        }
      }

      if (!targetId) {
        items.push({
          label: 'Create Frame Here',
          onClick: () => {
            const pt = this.canvas.viewport.screenToCanvas(e.clientX, e.clientY);
            // Default size is 400x300, offset by half so the cursor is exactly at center
            const newFrameId = this.app.state.addFrame(pt.x - 200, pt.y - 150, 'New Frame', 400, 300);
            if (newFrameId) {
              this.app.selection.clear();
              this.app.selection.select(newFrameId, 'frame');
              this.app.commitHistory();
            }
          }
        });

        const payload = this.app.clipboard?.linkPayload;
        if (payload) {
          items.push({
            label: `Insert Linked Note (${payload.sourceBoardTitle})`,
            onClick: () => {
              const pt = this.canvas.viewport.screenToCanvas(e.clientX, e.clientY);
              const newNode = {
                type: 'linked-note',
                x: pt.x,
                y: pt.y,
                w: 250,
                h: payload.snapshot.kind === 'image' ? undefined : 150,
                sourceRef: {
                  boardId: payload.boardId,
                  noteId: payload.noteId
                },
                snapshot: payload.snapshot,
                linkMeta: {
                  sourceBoardTitle: payload.sourceBoardTitle,
                  sourceBoardDirName: payload.sourceBoardDirName,
                  cachedAt: payload.timestamp
                }
              };
              const id = this.app.state.addLinkedNote(newNode);
              if (id) {
                this.app.commitHistory();
                this.app.selection.clear();
                this.app.selection.select(id, 'note');
              }
            }
          });
          items.push({
            label: 'Clear Pending Link',
            onClick: () => {
              this.app.clipboard.linkPayload = null;
            }
          });
        }
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
        let isSingleTextNote = false;
        let isLinkableSource = false;
        let isLinkedNote = false;
        
        if (targetType === 'note') {
          for (const id of this.app.selection.selectedIds) {
            const note = this.app.state.notes.get(id);
            if (note && (note.type === 'image' || note.isImage)) {
              hasImage = true;
            }
          }
          if (this.app.selection.selectedIds.size === 1) {
            const n = this.app.state.notes.get(targetId);
            if (n && n.type === 'linked-note') {
              isLinkedNote = true;
            } else if (n && n.type !== 'calc') {
              isLinkableSource = true;
              if (!hasImage) isSingleTextNote = true;
            }
          }
        }

        if (hasImage && this.app.selection.selectedIds.size === 1 && !isLinkedNote) {
          items.push({
            label: 'Run / Refresh OCR',
            onClick: () => {
              const n = this.app.state.notes.get(targetId);
              if (n && n.src) {
                 this.app.requestOcrForNote(this.app.state.boardId, targetId, n.src);
              }
            }
          });
          items.push({
            label: 'Edit Caption...',
            onClick: () => {
              this.spawnCaptionInput(targetId);
            }
          });
        }

        if (isLinkableSource && this.app.state.sourceType === 'native') {
          items.push({ type: 'separator' });
          items.push({
            label: 'Create Cross-board Link',
            onClick: () => {
              const n = this.app.state.notes.get(targetId);
              this.app.clipboard = this.app.clipboard || {};
              this.app.clipboard.linkPayload = {
                sourceType: 'native',
                boardId: this.app.state.boardId,
                noteId: targetId,
                sourceNoteType: (n.type === 'image' || n.isImage) ? 'image' : 'note',
                sourceBoardTitle: this.app.state.title,
                sourceBoardDirName: this.app.state.dirName || this.app.state.boardId,
                snapshot: {
                  kind: (n.type === 'image' || n.isImage) ? 'image' : 'note',
                  text: n.text,
                  caption: n.caption,
                  src: n.src
                },
                timestamp: Date.now()
              };
              const toast = document.createElement('div');
              toast.textContent = 'Link stored to pending payload';
              toast.style.position = 'absolute';
              toast.style.top = '16px';
              toast.style.left = '50%';
              toast.style.transform = 'translateX(-50%)';
              toast.style.background = 'var(--accent-color, #3b82f6)';
              toast.style.color = 'white';
              toast.style.padding = '6px 12px';
              toast.style.borderRadius = '4px';
              toast.style.fontSize = '12px';
              toast.style.zIndex = '9999';
              document.body.appendChild(toast);
              setTimeout(() => { toast.remove(); }, 1500);
            }
          });
        }

        if (isLinkedNote) {
          items.push({ type: 'separator' });
          items.push({
            label: 'Open Source Note',
            onClick: () => {
              const n = this.app.state.notes.get(targetId);
              if (n && n.sourceRef && window.app) {
                window.app.jumpToBoardNote(n.sourceRef.boardId, n.sourceRef.noteId);
              }
            }
          });
          items.push({
            label: 'Refresh from Source',
            onClick: async () => {
              const n = this.app.state.notes.get(targetId);
              if (!n || !n.sourceRef) return;
              
              const { boardId, noteId } = n.sourceRef;
              let sourceNoteData = null;
              
              if (this.app.state.boardId === boardId) {
                sourceNoteData = this.app.state.notes.get(noteId);
              } else {
                const entry = workspaceManager.manifest.boards.find(b => b.id === boardId);
                if (entry) {
                  const boardPath = await workspaceManager.resolveBoardPath(boardId);
                  if (boardPath) {
                    try {
                      // Dynamically import tauri fs and path
                      const { readTextFile } = await import('@tauri-apps/plugin-fs');
                      const { resolve } = await import('@tauri-apps/api/path');
                      
                      const statePath = await resolve(boardPath, 'state.json');
                      const rawState = await readTextFile(statePath);
                      const json = JSON.parse(rawState);
                      const noteEntry = json.notes?.find(x => x[0] === noteId);
                      if (noteEntry) {
                        sourceNoteData = noteEntry[1];
                      }
                    } catch (e) {
                      console.error("Failed to read remote board state", e);
                    }
                  }
                }
              }

              if (sourceNoteData) {
                n.snapshot.text = sourceNoteData.text;
                n.snapshot.caption = sourceNoteData.caption;
                n.snapshot.src = sourceNoteData.src;
                n.linkMeta.cachedAt = Date.now();
                n.hasUpdateAvailable = false;
                this.app.commitHistory();
                this.app.state.notify();
                
                const toast = document.createElement('div');
                toast.textContent = 'Linked note snapshot refreshed';
                toast.style.position = 'absolute';
                toast.style.top = '16px';
                toast.style.left = '50%';
                toast.style.transform = 'translateX(-50%)';
                toast.style.background = 'var(--accent-color, #3b82f6)';
                toast.style.color = 'white';
                toast.style.padding = '6px 12px';
                toast.style.borderRadius = '4px';
                toast.style.fontSize = '12px';
                toast.style.zIndex = '9999';
                document.body.appendChild(toast);
                setTimeout(() => { toast.remove(); }, 1500);
              } else {
                const toast = document.createElement('div');
                toast.textContent = 'Source note could not be found';
                toast.style.position = 'absolute';
                toast.style.top = '16px';
                toast.style.left = '50%';
                toast.style.transform = 'translateX(-50%)';
                toast.style.background = '#ef4444'; // red
                toast.style.color = 'white';
                toast.style.padding = '6px 12px';
                toast.style.borderRadius = '4px';
                toast.style.fontSize = '12px';
                toast.style.zIndex = '9999';
                document.body.appendChild(toast);
                setTimeout(() => { toast.remove(); }, 1500);
              }
            }
          });
        }
        
        if (isSingleTextNote && this.app.state.sourceType === 'native') {
          items.push({ type: 'separator' });
          const noteNode = this.app.state.notes.get(targetId);
          const currentMarkers = noteNode.markers || [];
          ['action', 'question', 'decision', 'risk', 'reference'].forEach(m => {
            const isActive = currentMarkers.includes(m);
            items.push({
              label: `${isActive ? '[✓]' : '[  ]'} Toggle ${m.charAt(0).toUpperCase() + m.slice(1)}`,
              keepOpen: true,
              onClick: (e, itemEl) => {
                this.app.state.toggleNoteMarker(targetId, m);
                this.app.commitHistory();
                
                // Re-poll explicitly from state to cleanly redraw
                const updatedNote = this.app.state.notes.get(targetId);
                const isNowActive = updatedNote && updatedNote.markers && updatedNote.markers.includes(m);
                if (itemEl) {
                  itemEl.textContent = `${isNowActive ? '[✓]' : '[  ]'} Toggle ${m.charAt(0).toUpperCase() + m.slice(1)}`;
                }
              }
            });
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

      let isCanvasBg = false;
      if (e.target.id === 'canvas-container' || e.target.id === 'edge-layer') {
        isCanvasBg = true;
      } else {
        const bgEl = e.target.closest('.orbit-background-image');
        if (bgEl && bgEl.classList.contains('is-locked')) {
          isCanvasBg = true;
        }
      }

      if (isCanvasBg) {
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
      let isCanvasBg = false;
      if (e.target.id === 'canvas-container' || e.target.id === 'edge-layer') {
        isCanvasBg = true;
      } else {
        const bgEl = e.target.closest('.orbit-background-image');
        if (bgEl && bgEl.classList.contains('is-locked')) {
          isCanvasBg = true;
        }
      }
      
      if (isCanvasBg) {
        const coords = this.canvas.viewport.screenToCanvas(e.clientX, e.clientY);
        this.app.createAndFocusNote(coords.x - 60, coords.y - 20, '');
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
      // Capture Flow chaining (Ctrl+Enter / Ctrl+Shift+Enter) allowed even if inside editor
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (e.isComposing) return;
        
        const active = document.activeElement;
        // Do not intercept if inside search UI or properties panel (to avoid conflicts)
        if (active && (active.closest('.orbit-search-overlay') || active.closest('.orbit-properties'))) {
          return;
        }

        e.preventDefault();
        
        // Let the app safely read the text content and update state if needed, then blur
        this.app.flushActiveEditor();

        const withEdge = e.shiftKey;
        this.app.createNextNoteFromSelection(withEdge);
        return;
      }

      // Mind Map Flow: Child and Sibling Creation
      if ((e.ctrlKey || e.metaKey) && e.altKey) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          if (e.isComposing) return;

          const active = document.activeElement;
          if (active && (active.closest('.orbit-search-overlay') || active.closest('.orbit-properties'))) {
            return;
          }

          e.preventDefault();
          this.app.flushActiveEditor();

          if (e.key === 'ArrowRight') {
            this.app.createChildNoteFromSelection();
          } else if (e.key === 'ArrowDown') {
            this.app.createSiblingNoteFromSelection();
          }
          return;
        }
      }

      // Mind Map Flow: Traversal
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          if (e.isComposing) return;

          const active = document.activeElement;
          if (active && (active.closest('.orbit-search-overlay') || active.closest('.orbit-properties'))) {
            return; // Allow native inputs inside UI overlays
          }

          e.preventDefault();
          // Blur if currently in a note, saving its content
          this.app.flushActiveEditor();

          const dirMap = {
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'ArrowLeft': 'left',
            'ArrowRight': 'right'
          };
          this.app.moveSelectionAmongConnected(dirMap[e.key]);
          return;
        }
      }

      // Generic Enter: Start typing in the currently selected text note
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (!document.activeElement.isContentEditable) {
          const active = document.activeElement;
          if (!active || !(active.closest('.orbit-search-overlay') || active.closest('.orbit-properties'))) {
            if (this.app.selection.type === 'note' && this.app.selection.selectedIds.size === 1) {
              const id = Array.from(this.app.selection.selectedIds)[0];
              const note = this.app.state.notes.get(id);
              if (note && note.type !== 'image' && !note.isImage) {
                e.preventDefault();
                this.app.pendingFocusNoteId = id;
                this.app.state.notify(); // Trigger DOM read and focus
                return;
              }
            }
          }
        }
      }

      if (document.activeElement.isContentEditable) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) {
          this.app.redo();
          e.preventDefault();
        } else if (e.key.toLowerCase() === 'z') {
          this.app.undo();
          e.preventDefault();
        } else if (e.key.toLowerCase() === 'c') {
          if (!this.app.isTextEditingContext() && this.app.selection.selectedIds.size > 0) {
            this.app.getClipboardData(this.app.selection.selectedIds);
            e.preventDefault();
          }
        } else if (e.key.toLowerCase() === 'v') {
          if (!this.app.isTextEditingContext() && this.app.clipboard.objects) {
            let canvasX, canvasY;
            if (this.lastCursorScreenX !== null && this.lastCursorScreenY !== null) {
              const pt = this.canvas.viewport.screenToCanvas(this.lastCursorScreenX, this.lastCursorScreenY);
              canvasX = pt.x;
              canvasY = pt.y;
            }
            this.app.pasteClipboardData(canvasX, canvasY);
            e.preventDefault();
          }
        }
      }
      
      if (e.key === 'Escape') {
        const tag = document.activeElement ? document.activeElement.tagName : '';
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !document.activeElement.isContentEditable) {
           if (this.app.activePeek) {
             this.app.returnFromPeek();
           } else {
             this.app.selection.clear();
           }
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
                
                // Trigger background OCR
                this.app.requestOcrForNote(this.app.state.boardId, newId, relativeSrc);
                
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
