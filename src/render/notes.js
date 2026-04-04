import { assetResolver } from '../legacy/assetResolver.js';
import { workspaceManager } from '../core/workspace.js';

export class NoteRenderer {
  constructor(app, container, interactions) {
    this.app = app;
    this.container = container;
    this.elements = new Map();
    this.interactions = interactions;
  }

  render() {
    const notes = this.app.state.notes;
    const isNoteSelection = this.app.selection.type === 'note';

    for (const [id, el] of this.elements.entries()) {
      if (!notes.has(id)) {
        el.remove();
        this.elements.delete(id);
      }
    }

    for (const [id, note] of notes.entries()) {
      let el = this.elements.get(id);
      if (!el) {
        el = this.createNodeElement(note);
        this.container.appendChild(el);
        this.elements.set(id, el);
      }
      
      el.style.transform = `translate(${note.x}px, ${note.y}px)`;
      if (note.width !== undefined) el.style.width = `${note.width}px`;
      else el.style.removeProperty('width');
      
      if (note.type === 'image' || note.isImage) {
        el.style.height = 'auto';
      } else {
        if (note.height !== undefined) el.style.height = `${note.height}px`;
        else el.style.removeProperty('height');
      }
      
      if (note.type === 'image' || note.isImage) {
        let captionEl = el.querySelector('.orbit-note-caption');
        if (note.caption) {
          if (!captionEl) {
            captionEl = document.createElement('div');
            captionEl.className = 'orbit-note-caption';
            captionEl.style.fontSize = '12px';
            captionEl.style.textAlign = 'center';
            captionEl.style.whiteSpace = 'nowrap';
            captionEl.style.overflow = 'hidden';
            captionEl.style.textOverflow = 'ellipsis';
            captionEl.style.maxWidth = '100%';
            captionEl.style.color = 'var(--color-text-muted, #64748b)';
            captionEl.style.flexShrink = '0';
            captionEl.style.cursor = 'text';

            captionEl.addEventListener('dblclick', (e) => {
              e.stopPropagation();
              e.preventDefault();
              this.interactions.spawnCaptionInput(note.id);
            });

            el.appendChild(captionEl);
          }
          captionEl.textContent = note.caption;
        } else if (captionEl) {
          captionEl.remove();
        }
      } else if (note.type === 'linked-note') {
        const headerText = el.querySelector('.orbit-linked-note-header span');
        if (headerText && note.linkMeta) {
          headerText.textContent = `Linked from: ${note.linkMeta.sourceBoardTitle || 'Unknown'}`;
        }
        
        let badge = el.querySelector('.orbit-update-badge');
        if (note.hasUpdateAvailable) {
          if (!badge) {
            badge = document.createElement('div');
            badge.className = 'orbit-update-badge';
            badge.title = 'Update available. Right-click -> Refresh from Source';
            const header = el.querySelector('.orbit-linked-note-header');
            if (header) header.appendChild(badge);
          }
        } else {
          if (badge) badge.remove();
        }
      } else {
        const contentEl = el.querySelector('.orbit-note-content');
        if (contentEl && document.activeElement !== contentEl) {
          contentEl.textContent = note.text;
        }

        // Modest Marker Chips
        let markerContainer = el.querySelector('.orbit-note-markers');
        if (note.markers && note.markers.length > 0) {
          const isSelected = isNoteSelection && this.app.selection.has(id);
          const availableW = (parseFloat(note.w) || parseFloat(note.width) || 250) - 18;
          let maxVisible = 2;
          
          if (availableW < 70) maxVisible = 0;
          else if (availableW < 130) maxVisible = 1;

          if (maxVisible === 0 && !isSelected) {
            if (markerContainer) markerContainer.remove();
          } else {
            if (!markerContainer) {
              markerContainer = document.createElement('div');
              markerContainer.className = 'orbit-note-markers';
              markerContainer.style.position = 'absolute';
              markerContainer.style.bottom = '-8px';
              markerContainer.style.left = '8px';
              markerContainer.style.display = 'flex';
              markerContainer.style.gap = '3px';
              el.appendChild(markerContainer);
            }
            markerContainer.innerHTML = '';
            
            const FIXED_ORDER = ['action', 'question', 'decision', 'risk', 'reference'];
            const sortedMarkers = [];
            // Match fixed order
            FIXED_ORDER.forEach(m => {
              if (note.markers.includes(m)) sortedMarkers.push(m);
            });
            // Append unknown/custom/legacy markers
            note.markers.forEach(m => {
              if (!FIXED_ORDER.includes(m)) sortedMarkers.push(m);
            });

            const visibleMarkers = maxVisible === 0 ? [] : sortedMarkers.slice(0, maxVisible);
            const hiddenCount = sortedMarkers.length - visibleMarkers.length;

            const createChip = (text) => {
              const mSpan = document.createElement('span');
              mSpan.textContent = text;
              mSpan.style.background = 'var(--bg-layer-1, #FFFFFF)';
              mSpan.style.color = 'var(--color-text-muted, #64748b)';
              mSpan.style.fontSize = '9px';
              mSpan.style.padding = '1px 4px';
              mSpan.style.borderRadius = '4px';
              mSpan.style.border = '1px solid var(--border-color)';
              mSpan.style.textTransform = 'capitalize';
              mSpan.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
              return mSpan;
            };

            visibleMarkers.forEach(m => {
              markerContainer.appendChild(createChip(m));
            });

            if (hiddenCount > 0) {
              markerContainer.appendChild(createChip(`+${hiddenCount}`));
            }
          }
        } else if (markerContainer) {
          markerContainer.remove();
        }
      }

      if (note.colorKey) el.dataset.color = note.colorKey;
      else delete el.dataset.color;

      el.classList.toggle('is-selected', isNoteSelection && this.app.selection.has(id));
    }

    if (this.app.pendingFocusNoteId) {
      const focusId = this.app.pendingFocusNoteId;
      this.app.pendingFocusNoteId = null;
      
      requestAnimationFrame(() => {
        const el = this.elements.get(focusId);
        if (el) {
          const contentEl = el.querySelector('.orbit-note-content');
          if (contentEl) {
            contentEl.focus();
            
            // Move cursor to the end
            if (contentEl.childNodes.length > 0) {
              const range = document.createRange();
              const sel = window.getSelection();
              range.selectNodeContents(contentEl);
              range.collapse(false);
              sel.removeAllRanges();
              sel.addRange(range);
            }
          }
        }
      });
    }
  }

  createNodeElement(note) {
    const el = document.createElement('div');
    el.className = 'orbit-note';
    el.dataset.id = note.id;
    
    if (note.type === 'linked-note') {
      el.classList.add('is-linked-note');
      el.style.display = 'flex';
      el.style.flexDirection = 'column';
      el.style.backgroundColor = 'var(--bg-layer-2, #F8F9FA)';
      el.style.overflow = 'hidden';

      const header = document.createElement('div');
      header.className = 'orbit-linked-note-header';
      header.style.fontSize = '10px';
      header.style.color = 'var(--color-text-muted, #64748b)';
      header.style.backgroundColor = 'rgba(0,0,0,0.03)';
      header.style.padding = '4px 8px';
      header.style.borderBottom = '1px solid var(--border-color)';
      header.style.display = 'flex';
      header.style.alignItems = 'center';
      header.style.gap = '4px';
      header.style.userSelect = 'none';
      header.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
        </svg>
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Linked from: ${note.linkMeta?.sourceBoardTitle || 'Unknown'}</span>
      `;
      el.appendChild(header);

      const content = document.createElement('div');
      content.className = 'orbit-linked-note-content';
      content.style.flex = '1';
      content.style.position = 'relative';
      content.style.opacity = '0.9';
      
      // Transparent overlay to prevent edit/selection interactions
      const blockOverlay = document.createElement('div');
      blockOverlay.style.position = 'absolute';
      blockOverlay.style.inset = '0';
      blockOverlay.style.zIndex = '10';
      blockOverlay.style.cursor = 'pointer';
      
      blockOverlay.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (window.app && note.sourceRef) {
          window.app.jumpToBoardNote(note.sourceRef.boardId, note.sourceRef.noteId);
        }
      });
      content.appendChild(blockOverlay);

      if (note.snapshot?.kind === 'image') {
        content.style.display = 'flex';
        content.style.flexDirection = 'column';
        content.style.padding = '8px';
        content.style.gap = '8px';
        
        const img = document.createElement('img');
        img.className = 'orbit-note-image';
        img.style.width = '100%';
        img.style.minHeight = '0';
        img.style.objectFit = 'contain';
        img.style.flex = '1';
        
        if (workspaceManager && note.sourceRef) {
          workspaceManager.resolveAssetUrl(note.sourceRef.boardId, note.snapshot.src).then(resolvedSrc => {
             if (resolvedSrc) img.src = resolvedSrc;
          });
        }
        content.appendChild(img);
        
        if (note.snapshot.caption) {
          const caption = document.createElement('div');
          caption.textContent = note.snapshot.caption;
          caption.style.fontSize = '12px';
          caption.style.textAlign = 'center';
          caption.style.color = 'var(--color-text-muted, #64748b)';
          content.appendChild(caption);
        }
      } else {
        content.style.padding = '12px';
        const innerText = document.createElement('div');
        innerText.textContent = note.snapshot?.text || '';
        innerText.style.fontSize = '14px';
        innerText.style.wordBreak = 'break-word';
        innerText.style.whiteSpace = 'pre-wrap';
        content.appendChild(innerText);
      }
      
      el.appendChild(content);

      // Prevent pointer events crossing into editable logic
      el.addEventListener('pointerdown', (e) => {
        this.interactions.handlePointerDown('note', note.id, e);
      });

    } else if (note.type === 'image' || note.isImage) {
      el.classList.add('is-image-note');
      el.style.display = 'flex';
      el.style.flexDirection = 'column';
      el.style.gap = '8px';
      
      const img = document.createElement('img');
      img.className = 'orbit-note-image';
      img.alt = note.caption || 'Image';
      img.style.width = '100%';
      img.style.flex = '1';
      img.style.minHeight = '0';
      img.style.objectFit = 'contain';
      
      img.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.app.imageViewerSrc = img.src;
        this.app.imageViewer.open(note);
      });
      
      // Set fallback to avoid breaking legacy layouts if image files are missing
      img.onerror = () => {
        el.innerHTML = '';
        el.classList.remove('is-image-note');
        
        const fallbackBox = document.createElement('div');
        fallbackBox.style.width = '100%';
        fallbackBox.style.height = '100%';
        fallbackBox.style.display = 'flex';
        fallbackBox.style.flexDirection = 'column';
        fallbackBox.style.alignItems = 'center';
        fallbackBox.style.justifyContent = 'center';
        fallbackBox.style.border = '1px dashed var(--border-color)';
        fallbackBox.style.borderRadius = 'var(--radius-note)';
        fallbackBox.style.backgroundColor = 'var(--color-canvas-bg)';
        fallbackBox.style.color = 'var(--color-text-muted)';
        fallbackBox.style.padding = '8px';
        fallbackBox.style.boxSizing = 'border-box';
        fallbackBox.style.textAlign = 'center';
        fallbackBox.style.overflow = 'hidden';

        const icon = document.createElement('div');
        icon.textContent = '🖼️';
        icon.style.opacity = '0.5';
        icon.style.marginBottom = '8px';
        
        const text = document.createElement('div');
        text.textContent = 'Missing Asset';
        text.style.fontSize = '12px';
        text.style.fontWeight = '500';
        
        const filename = document.createElement('div');
        // fallback extracting just the file name
        const shortName = note.src ? note.src.split('/').pop() : 'unknown';
        filename.textContent = shortName;
        filename.style.fontSize = '10px';
        filename.style.opacity = '0.7';
        filename.style.wordBreak = 'break-all';
        filename.style.marginTop = '4px';

        fallbackBox.appendChild(icon);
        fallbackBox.appendChild(text);
        fallbackBox.appendChild(filename);

        if (note.caption) {
          const caption = document.createElement('div');
          caption.textContent = note.caption;
          caption.style.fontSize = '10px';
          caption.style.fontStyle = 'italic';
          caption.style.opacity = '0.6';
          caption.style.marginTop = '8px';
          caption.style.borderTop = '1px solid rgba(0,0,0,0.1)';
          caption.style.paddingTop = '8px';
          caption.style.width = '80%';
          fallbackBox.appendChild(caption);
        }

        el.appendChild(fallbackBox);
      };

      // Async resolve image src
      if (this.app.state.sourceType === 'native') {
        workspaceManager.resolveAssetUrl(this.app.state.boardId, note.src).then(resolvedSrc => {
          if (resolvedSrc) {
            img.src = resolvedSrc;
          } else {
            img.dispatchEvent(new Event('error'));
          }
        });
      } else {
        assetResolver.resolveImage(note.src).then(resolvedSrc => {
          if (resolvedSrc) {
            img.src = resolvedSrc;
          } else {
            img.dispatchEvent(new Event('error'));
          }
        });
      }
      
      el.appendChild(img);
      
      if (note.caption) {
        const caption = document.createElement('div');
        caption.className = 'orbit-note-caption';
        caption.textContent = note.caption;
        caption.style.fontSize = '12px';
        caption.style.textAlign = 'center';
        caption.style.whiteSpace = 'nowrap';
        caption.style.overflow = 'hidden';
        caption.style.textOverflow = 'ellipsis';
        caption.style.maxWidth = '100%';
        caption.style.color = 'var(--color-text-muted, #64748b)';
        caption.style.flexShrink = '0';
        caption.style.cursor = 'text';

        caption.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          e.preventDefault();
          this.interactions.spawnCaptionInput(note.id);
        });

        el.appendChild(caption);
      }
    } else {
      const content = document.createElement('div');
      content.className = 'orbit-note-content';
      content.contentEditable = 'true';
      content.textContent = note.text;
      
      // Force plain text paste
      content.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      // basic fallback if execCommand fails
      if (!document.execCommand('insertText', false, text)) {
        const sel = window.getSelection();
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
      }
    });

      content.addEventListener('blur', () => {
        if (content.textContent !== this.app.state.notes.get(note.id).text) {
          this.app.state.updateNoteText(note.id, content.textContent);
          this.app.commitHistory();
        }
      });
      el.appendChild(content);
    }
    
    // Prevent dragging when clicking strictly inside text if we have selection,
    // or just let pointerdown handle it
    el.addEventListener('pointerdown', (e) => {
      this.interactions.handlePointerDown('note', note.id, e);
    });

    if (this.app.state.sourceType === 'native') {
      const handle = document.createElement('div');
      handle.className = 'orbit-resize-handle';
      
      let isResizing = false;
      let startW, startH, startX, startY, zoom;

      handle.addEventListener('pointerdown', (e) => {
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
        
        if (note.type === 'image' || note.isImage) {
          // Fix aspect ratio based on whichever dimension has changed more drastically, or just Width.
          // Standard corner drag maps cleanly to Width, adjusting Height.
          // Ensure we don't divide by zero.
          if (startW > 0) {
              newH = newW * (startH / startW);
          }
        } else {
          newW = Math.max(120, newW);
          newH = Math.max(56, newH);
        }
        
        el.style.width = `${newW}px`;
        el.style.height = `${newH}px`;
        
        if (this.interactions.canvas && this.interactions.canvas.edgeRenderer) {
          this.interactions.canvas.edgeRenderer.render();
        }
      });

      const cleanup = (e) => {
        if (!isResizing) return;
        isResizing = false;
        handle.releasePointerCapture(e.pointerId);
        
        const finalW = el.offsetWidth;
        const finalH = el.offsetHeight;
        
        this.app.state.resizeNote(note.id, finalW, finalH);
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
