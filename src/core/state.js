export class State {
  constructor() {
    this.boardId = crypto.randomUUID();
    this.notes = new Map(); // id -> { id, text, x, y, width, height }
    this.frames = new Map(); // id -> { id, title, x, y, width, height }
    this.edges = new Map(); // id -> { id, sourceId, targetId }
    
    this.listeners = [];
  }

  subscribe(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  notify() {
    for (const fn of this.listeners) {
      fn(this);
    }
  }

  getSnapshot() {
    return {
      boardId: this.boardId,
      notes: Array.from(this.notes.entries()).map(([k, v]) => [k, { ...v }]),
      frames: Array.from(this.frames.entries()).map(([k, v]) => [k, { ...v }]),
      edges: Array.from(this.edges.entries()).map(([k, v]) => [k, { ...v }])
    };
  }

  restoreSnapshot(snapshot) {
    this.boardId = snapshot.boardId;
    this.notes = new Map(snapshot.notes.map(([k, v]) => [k, { ...v }]));
    this.frames = new Map(snapshot.frames.map(([k, v]) => [k, { ...v }]));
    this.edges = new Map(snapshot.edges.map(([k, v]) => [k, { ...v }]));
    this.notify();
  }

  addNote(x, y, text = '') {
    const id = crypto.randomUUID();
    this.notes.set(id, { id, text, x, y });
    this.notify();
    return id;
  }

  updateNoteText(id, text) {
    const note = this.notes.get(id);
    if (note && note.text !== text) {
      note.text = text;
      this.notify();
    }
  }

  moveNote(id, x, y) {
    const note = this.notes.get(id);
    if (note && (note.x !== x || note.y !== y)) {
      note.x = x;
      note.y = y;
      this.notify();
    }
  }

  addEdge(sourceId, targetId) {
    // Avoid duplicates
    for (const edge of this.edges.values()) {
      if ((edge.sourceId === sourceId && edge.targetId === targetId) ||
          (edge.sourceId === targetId && edge.targetId === sourceId)) {
        return edge.id;
      }
    }
    const id = crypto.randomUUID();
    this.edges.set(id, { id, sourceId, targetId });
    this.notify();
    return id;
  }

  addFrame(x, y, title = 'New Frame', width = 400, height = 300) {
    const id = crypto.randomUUID();
    this.frames.set(id, { id, title, x, y, width, height });
    this.notify();
    return id;
  }
  
  moveFrame(id, x, y) {
    const frame = this.frames.get(id);
    if (frame && (frame.x !== x || frame.y !== y)) {
      frame.x = x;
      frame.y = y;
      this.notify();
    }
  }

  deleteNode(id) {
    if (this.notes.has(id)) {
      this.notes.delete(id);
      // Clean up connected edges
      for (const [edgeId, edge] of this.edges.entries()) {
        if (edge.sourceId === id || edge.targetId === id) {
          this.edges.delete(edgeId);
        }
      }
      this.notify();
      return true;
    }
    if (this.frames.has(id)) {
      this.frames.delete(id);
      this.notify();
      return true;
    }
    if (this.edges.has(id)) {
      this.edges.delete(id);
      this.notify();
      return true;
    }
    return false;
  }
}
