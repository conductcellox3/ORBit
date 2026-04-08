export class State {
  constructor() {
    this.boardId = null;
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
      if (v.type === 'background-image' || v.type === 'linked-board') {
        return [k, { ...v }];
      }
      if (!v.type || v.type === 'text') {
        v.textFormat = v.textFormat || 'plain';
      }
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
    this.notes.set(id, { id, text, textFormat: 'plain', type: 'text', x, y, width: 240, parentFrameId: null });
    this.notify();
    return id;
  }

  addImageNote(x, y, src, width, height) {
    if (this.sourceType === 'legacy') return null;
    const id = crypto.randomUUID();
    this.notes.set(id, { id, type: 'image', src, x, y, width, height, caption: '', parentFrameId: null });
    this.notify();
    return id;
  }

  addBackgroundImage(x, y, src, w, h, sourceTemplatePath) {
    if (this.sourceType === 'legacy') return null;
    const id = crypto.randomUUID();
    this.notes.set(id, { 
      id, 
      type: 'background-image', 
      src, 
      x, y, w, h, 
      locked: false, 
      sourceTemplatePath 
    });
    this.notify();
    return id;
  }

  addLinkedNote(payload) {
    if (this.sourceType === 'legacy') return null;
    const id = crypto.randomUUID();
    this.notes.set(id, { id, ...payload, parentFrameId: null });
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

  updateNoteHeightQuietly(id, height) {
    if (this.sourceType === 'legacy') return;
    const note = this.notes.get(id);
    if (note && note.height !== height) {
      note.height = height;
    }
  }

  updateImageCaption(id, caption) {
    if (this.sourceType === 'legacy') return;
    const note = this.notes.get(id);
    if (note && (note.type === 'image' || note.isImage) && note.caption !== caption) {
      note.caption = caption || '';
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

  setNoteTextFormat(id, format) {
    if (this.sourceType === 'legacy') return;
    const note = this.notes.get(id);
    if (!note || note.type === 'image' || note.isImage) return;
    if (format !== 'plain' && format !== 'markdown') return;

    if (note.textFormat !== format) {
      note.textFormat = format;
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

  updateBackgroundBounds(id, w, h) {
    if (this.sourceType === 'legacy') return;
    const note = this.notes.get(id);
    if (note && note.type === 'background-image') {
      if (note.w !== w || note.h !== h) {
        note.w = w;
        note.h = h;
        this.notify();
      }
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

  toggleNoteMarker(id, marker) {
    if (this.sourceType === 'legacy') return;
    const note = this.notes.get(id);
    // Explicitly restrict to basic text notes
    if (!note || note.type === 'image' || note.isImage || note.type === 'calc') return;
    
    if (!Array.isArray(note.markers)) {
      note.markers = [];
    }

    const m = marker.trim().toLowerCase();
    const idx = note.markers.indexOf(m);
    
    if (idx !== -1) {
      note.markers.splice(idx, 1);
    } else {
      note.markers.push(m);
    }
    
    // Normalize string array: distinct and sorted alphabetically
    note.markers = [...new Set(note.markers)].sort();
    
    if (note.markers.length === 0) {
      delete note.markers; // Keep clean JSON when empty
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

  addNoteToFrame(noteId, frameId) {
    if (this.sourceType === 'legacy') return;
    const note = this.notes.get(noteId);
    const frame = this.frames.get(frameId);
    if (!note || !frame) return;

    // Remove from old frame if needed
    if (note.parentFrameId && note.parentFrameId !== frameId) {
      const oldFrame = this.frames.get(note.parentFrameId);
      if (oldFrame && oldFrame.childIds) {
        oldFrame.childIds = oldFrame.childIds.filter(id => id !== noteId);
      }
    }

    note.parentFrameId = frameId;
    if (!frame.childIds) frame.childIds = [];
    if (!frame.childIds.includes(noteId)) {
      frame.childIds.push(noteId);
    }
    this.notify();
  }

  removeNoteFromFrame(noteId) {
    if (this.sourceType === 'legacy') return;
    const note = this.notes.get(noteId);
    if (!note || !note.parentFrameId) return;

    const oldFrame = this.frames.get(note.parentFrameId);
    if (oldFrame && oldFrame.childIds) {
      oldFrame.childIds = oldFrame.childIds.filter(id => id !== noteId);
    }
    note.parentFrameId = null;
    this.notify();
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

  async checkLinkedNotesForUpdates() {
    if (this.sourceType !== 'native') return;

    const targetBoards = new Map();
    for (const note of this.notes.values()) {
      if (note.type === 'linked-note' && note.sourceRef) {
        if (note.sourceRef.boardId === this.boardId) continue; 
        let list = targetBoards.get(note.sourceRef.boardId);
        if (!list) {
          list = [];
          targetBoards.set(note.sourceRef.boardId, list);
        }
        list.push(note);
      }
    }

    if (targetBoards.size === 0) return;

    try {
      const { workspaceManager } = await import('./workspace.js');
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      const { resolve } = await import('@tauri-apps/api/path');

      let needsNotify = false;

      for (const [boardId, notes] of targetBoards.entries()) {
        const entry = workspaceManager.manifest.boards.find(b => b.id === boardId);
        if (!entry) continue;

        const boardPath = await workspaceManager.resolveBoardPath(boardId);
        if (!boardPath) continue;

        try {
          const statePath = await resolve(boardPath, 'state.json');
          const rawState = await readTextFile(statePath);
          const json = JSON.parse(rawState);
          
          for (const note of notes) {
            const noteEntry = json.notes?.find(x => x[0] === note.sourceRef.noteId);
            if (noteEntry) {
              const remoteNote = noteEntry[1];
              const snapshot = note.snapshot || {};
              let hasChange = false;
              
              if (snapshot.text !== remoteNote.text) hasChange = true;
              if (snapshot.caption !== remoteNote.caption) hasChange = true;
              if (snapshot.src !== remoteNote.src) hasChange = true;
              
              if (hasChange && !note.hasUpdateAvailable) {
                note.hasUpdateAvailable = true;
                needsNotify = true;
              } else if (!hasChange && note.hasUpdateAvailable) {
                note.hasUpdateAvailable = false;
                needsNotify = true;
              }
            } else {
              if (!note.sourceNoteMissing) {
                note.sourceNoteMissing = true;
                needsNotify = true;
              }
            }
          }
        } catch (e) {
          console.error(`Failed to check updates for remote board ${boardId}`, e);
        }
      }

      if (needsNotify) {
        this.notify();
      }
    } catch (e) {
      console.error("Failed to execute checkLinkedNotesForUpdates:", e);
    }
  }
}
