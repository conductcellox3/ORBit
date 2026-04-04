export class State {
  constructor() {
    this.boardId = crypto.randomUUID();
    this.title = 'Main Board';
    this.slug = '';
    this.notes = new Map(); // id -> { id, text, x, y, width, height }
    this.frames = new Map(); // id -> { id, title, x, y, width, height }
    this.edges = new Map(); // id -> { id, sourceId, targetId }
    
    this.sourceType = 'native'; // or 'legacy'
    this.canvas = { panX: 0, panY: 0, zoom: 1 };
    
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
      title: this.title,
      slug: this.slug,
      sourceType: this.sourceType,
      canvas: { ...this.canvas },
      notes: Array.from(this.notes.entries()).map(([k, v]) => [k, { ...v }]),
      frames: Array.from(this.frames.entries()).map(([k, v]) => [k, { ...v, childIds: v.childIds ? [...v.childIds] : [] }]),
      edges: Array.from(this.edges.entries()).map(([k, v]) => [k, { ...v }])
    };
  }

  restoreSnapshot(snapshot) {
    this.boardId = snapshot.boardId;
    this.title = snapshot.title || 'Main Board';
    this.slug = snapshot.slug || '';
    this.sourceType = snapshot.sourceType || 'native';
    this.canvas = snapshot.canvas || { panX: 0, panY: 0, zoom: 1 };
    this.notes = new Map(snapshot.notes.map(([k, v]) => {
      const width = v.width ?? v.w;
      const height = v.height ?? v.h;
      return [k, { ...v, width: width === null ? undefined : width, height: height === null ? undefined : height }];
    }));
    this.frames = new Map(snapshot.frames ? snapshot.frames.map(([k, v]) => [k, { ...v, childIds: v.childIds ? [...v.childIds] : [] }]) : []);
    this.edges = new Map(snapshot.edges.map(([k, v]) => [k, { ...v }]));

    // Hydration Repair Loop: ensure childIds and parentFrameId match
    for (const [frameId, frame] of this.frames.entries()) {
      frame.childIds = frame.childIds.filter(id => this.notes.has(id));
      for (const childId of frame.childIds) {
        this.notes.get(childId).parentFrameId = frameId;
      }
    }
    
    // Reverse check: Note might claim a parent that doesn't acknowledge it
    for (const [noteId, note] of this.notes.entries()) {
      if (note.parentFrameId) {
        const parentFrame = this.frames.get(note.parentFrameId);
        if (parentFrame) {
          if (!parentFrame.childIds.includes(noteId)) {
            parentFrame.childIds.push(noteId);
          }
        } else {
          note.parentFrameId = null;
        }
      }
    }
    this.notify();
  }

  addNote(x, y, text = '') {
    const id = crypto.randomUUID();
    this.notes.set(id, { id, text, x, y, parentFrameId: null });
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

  resizeNote(id, width, height) {
    if (this.sourceType === 'legacy') return;
    const note = this.notes.get(id);
    if (note && (note.width !== width || note.height !== height)) {
      note.width = width;
      note.height = height;
      this.notify();
    }
  }

  resizeFrame(id, width, height) {
    if (this.sourceType === 'legacy') return;
    const frame = this.frames.get(id);
    if (frame && (frame.width !== width || frame.height !== height)) {
      frame.width = width;
      frame.height = height;
      this.notify();
    }
  }

  setNoteColor(id, preset) {
    if (this.sourceType === 'legacy') return;
    const note = this.notes.get(id);
    if (!note) return;
    
    if (preset === 'none' || preset === 'neutral') {
      delete note.colorKey;
      delete note.colorShade;
    } else {
      note.colorKey = preset;
      note.colorShade = 'light';
    }
    this.notify();
  }

  setFrameColor(id, preset) {
    if (this.sourceType === 'legacy') return;
    const frame = this.frames.get(id);
    if (!frame) return;
    
    if (preset === 'none' || preset === 'neutral') {
      delete frame.colorKey;
      delete frame.shade;
    } else {
      frame.colorKey = preset;
      frame.shade = 'light';
    }
    this.notify();
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
    this.frames.set(id, { id, title, x, y, width, height, childIds: [] });
    this.notify();
    return id;
  }
  
  createFrameFromSelection(ids) {
    if (this.sourceType === 'legacy' || !ids || ids.size < 2) return null;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const childIds = [];
    
    for (const id of ids) {
      const note = this.notes.get(id);
      if (note) {
        childIds.push(id);
        const nw = note.width || 120;
        const nh = note.height || 56;
        minX = Math.min(minX, note.x);
        minY = Math.min(minY, note.y);
        maxX = Math.max(maxX, note.x + nw);
        maxY = Math.max(maxY, note.y + nh);
      }
    }
    
    if (childIds.length < 2) return null;

    const pad = 32;
    const x = minX - pad;
    const y = minY - pad * 2;
    const width = (maxX - minX) + pad * 2;
    const height = (maxY - minY) + pad * 3;

    const frameId = crypto.randomUUID();
    this.frames.set(frameId, {
      id: frameId,
      title: 'Untitled Frame',
      x, y, width, height,
      childIds: [...childIds]
    });

    for (const id of childIds) {
      this.notes.get(id).parentFrameId = frameId;
    }

    this.notify();
    return frameId;
  }

  renameFrame(id, newTitle) {
    const frame = this.frames.get(id);
    if (frame && frame.title !== newTitle) {
      frame.title = newTitle;
      this.notify();
    }
  }

  moveFrame(id, x, y) {
    const frame = this.frames.get(id);
    if (frame && (frame.x !== x || frame.y !== y)) {
      const dx = x - frame.x;
      const dy = y - frame.y;
      
      frame.x = x;
      frame.y = y;
      
      if (frame.childIds) {
        for (const childId of frame.childIds) {
          const child = this.notes.get(childId);
          if (child) {
            child.x += dx;
            child.y += dy;
          }
        }
      }
      
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
      const frame = this.frames.get(id);
      if (frame.childIds) {
        for (const childId of frame.childIds) {
          const child = this.notes.get(childId);
          if (child) child.parentFrameId = null;
        }
      }
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
