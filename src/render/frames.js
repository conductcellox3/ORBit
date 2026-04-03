export class FrameRenderer {
  constructor(app, container, interactions) {
    this.app = app;
    this.container = container;
    this.elements = new Map();
    this.interactions = interactions;
  }

  render() {
    const frames = this.app.state.frames;
    const selectedId = this.app.selection.type === 'frame' ? this.app.selection.selectedId : null;

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

      el.classList.toggle('is-selected', id === selectedId);
    }
  }

  createFrameElement(frame) {
    const el = document.createElement('div');
    el.className = 'orbit-frame';
    el.dataset.id = frame.id;
    
    const title = document.createElement('div');
    title.className = 'orbit-frame-title';
    title.textContent = frame.title;
    
    el.appendChild(title);

    el.addEventListener('pointerdown', (e) => {
      this.interactions.handlePointerDown('frame', frame.id, e);
    });

    return el;
  }
}
