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
      
      const contentEl = el.querySelector('.orbit-note-content');
      if (document.activeElement !== contentEl) {
        contentEl.textContent = note.text;
      }

      el.classList.toggle('is-selected', id === selectedId);
    }
  }

  createNodeElement(note) {
    const el = document.createElement('div');
    el.className = 'orbit-note';
    el.dataset.id = note.id;
    
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
    
    // Prevent dragging when clicking strictly inside text if we have selection,
    // or just let pointerdown handle it
    el.addEventListener('pointerdown', (e) => {
      this.interactions.handlePointerDown('note', note.id, e);
    });
    
    el.appendChild(content);
    return el;
  }
}
