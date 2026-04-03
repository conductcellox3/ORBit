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
    const selectedId = this.app.selection.type === 'note' ? this.app.selection.selectedId : null;

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
      if (note.width) el.style.width = `${note.width}px`;
      if (note.height) el.style.height = `${note.height}px`;
      
      const contentEl = el.querySelector('.orbit-note-content');
      if (contentEl && document.activeElement !== contentEl) {
        contentEl.textContent = note.text;
      }

      el.classList.toggle('is-selected', id === selectedId);
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
      
      // Async resolve image src
      assetResolver.resolveImage(note.src).then(resolvedSrc => {
        if (resolvedSrc) img.src = resolvedSrc;
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
    
    return el;
  }
}
