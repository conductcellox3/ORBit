import { assetResolver } from '../legacy/assetResolver.js';

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
      
      if (note.height !== undefined) el.style.height = `${note.height}px`;
      else el.style.removeProperty('height');
      
      const contentEl = el.querySelector('.orbit-note-content');
      if (contentEl && document.activeElement !== contentEl) {
        contentEl.textContent = note.text;
      }

      if (note.colorKey) el.dataset.color = note.colorKey;
      else delete el.dataset.color;

      el.classList.toggle('is-selected', isNoteSelection && this.app.selection.has(id));
    }
  }

  createNodeElement(note) {
    const el = document.createElement('div');
    el.className = 'orbit-note';
    el.dataset.id = note.id;
    
    if (note.isImage) {
      el.classList.add('is-image-note');
      
      const img = document.createElement('img');
      img.className = 'orbit-note-image';
      img.alt = note.caption || 'Image';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      
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
      assetResolver.resolveImage(note.src).then(resolvedSrc => {
        if (resolvedSrc) {
          img.src = resolvedSrc;
        } else {
          img.dispatchEvent(new Event('error'));
        }
      });
      
      el.appendChild(img);
      
      if (note.caption) {
        const caption = document.createElement('div');
        caption.className = 'orbit-note-caption';
        caption.textContent = note.caption;
        caption.style.fontSize = '12px';
        caption.style.opacity = '0.7';
        caption.style.marginTop = '4px';
        caption.style.textAlign = 'center';
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
        
        const newW = Math.max(120, startW + dx);
        const newH = Math.max(56, startH + dy);
        
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
