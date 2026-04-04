export class FrameRenderer {
  constructor(app, container, interactions) {
    this.app = app;
    this.container = container;
    this.elements = new Map();
    this.interactions = interactions;
  }

  render() {
    const frames = this.app.state.frames;
    const isFrameSelection = this.app.selection.type === 'frame';

    for (const [id, el] of this.elements.entries()) {
      if (!frames.has(id)) {
        el.remove();
        this.elements.delete(id);
      }
    }

    for (const [id, frame] of frames.entries()) {
      let el = this.elements.get(id);
      if (!el) {
        el = this.createFrameElement(frame);
        // Prepend so frames are visually under notes in the DOM
        this.container.prepend(el);
        this.elements.set(id, el);
      }
      
      el.style.transform = `translate(${frame.x}px, ${frame.y}px)`;
      el.style.width = `${frame.width}px`;
      el.style.height = `${frame.height}px`;

      const titleEl = el.querySelector('.orbit-frame-title');
      titleEl.textContent = frame.title;

      if (frame.colorKey) el.dataset.color = frame.colorKey;
      else delete el.dataset.color;

      el.classList.toggle('is-selected', isFrameSelection && this.app.selection.has(id));
    }
  }

  createFrameElement(frame) {
    const el = document.createElement('div');
    el.className = 'orbit-frame';
    el.dataset.id = frame.id;
    
    const title = document.createElement('div');
    title.className = 'orbit-frame-title';
    title.textContent = frame.title;

    title.addEventListener('dblclick', (e) => {
      if (this.app.state.sourceType === 'legacy') return;
      e.stopPropagation();
      title.contentEditable = 'true';
      title.focus();
      
      // select all text
      const range = document.createRange();
      range.selectNodeContents(title);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });

    const finishEdit = (cancel = false) => {
      if (title.contentEditable !== 'true') return;
      title.contentEditable = 'false';
      window.getSelection().removeAllRanges();
      
      const newTitle = title.textContent.trim() || 'Untitled Frame';
      if (!cancel && newTitle !== frame.title) {
        this.app.state.renameFrame(frame.id, newTitle);
        this.app.commitHistory();
      } else {
        title.textContent = frame.title;
      }
    };

    title.addEventListener('blur', () => finishEdit(false));
    title.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        title.blur();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        finishEdit(true);
      }
    });

    el.appendChild(title);

    el.addEventListener('pointerdown', (e) => {
      this.interactions.handlePointerDown('frame', frame.id, e);
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
        
        const newW = Math.max(160, startW + dx);
        const newH = Math.max(100, startH + dy);
        
        el.style.width = `${newW}px`;
        el.style.height = `${newH}px`;
      });

      const cleanup = (e) => {
        if (!isResizing) return;
        isResizing = false;
        handle.releasePointerCapture(e.pointerId);
        
        const finalW = el.offsetWidth;
        const finalH = el.offsetHeight;
        
        this.app.state.resizeFrame(frame.id, finalW, finalH);
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
