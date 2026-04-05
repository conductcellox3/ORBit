export function isLayoutEligibleEntity(entity) {
  if (!entity) return false;
  const type = entity.type || 'note';
  return ['note', 'calc', 'image', 'linked-note', 'linked'].includes(type) || entity.isImage;
}

function getEligibleSelectedNotes(app) {
  const arr = [];
  for (const id of app.selection.selectedIds) {
    if (app.state.notes.has(id)) {
      const entity = app.state.notes.get(id);
      if (isLayoutEligibleEntity(entity)) {
        arr.push(entity);
      }
    }
  }
  return arr;
}

function getAnchorNote(app, eligibleNotes) {
  if (app.pendingFocusNoteId) {
    const anchor = eligibleNotes.find(n => n.id === app.pendingFocusNoteId);
    if (anchor) return anchor;
  }
  return eligibleNotes[eligibleNotes.length - 1];
}

function getMetrics(app, note) {
  return app.getNoteMetrics(note.id);
}

function performBatch(app, eligibleNotes, fn) {
  if (app.state.sourceType === 'legacy') return;
  if (eligibleNotes.length === 0) return;
  
  let changed = false;
  for (const note of eligibleNotes) {
    const metrics = getMetrics(app, note);
    const result = fn(note, metrics);
    if (result && (result.x !== note.x || result.y !== note.y || result.w !== note.width || result.h !== note.height)) {
      if (result.x !== undefined) note.x = result.x;
      if (result.y !== undefined) note.y = result.y;
      if (result.w !== undefined) note.width = result.w;
      if (result.h !== undefined) note.height = result.h;
      changed = true;
    }
  }

  if (changed) {
    app.state.notify();
    app.commitHistory();
  }
}

export function alignLeft(app) {
  const eligibleNotes = getEligibleSelectedNotes(app);
  if (eligibleNotes.length < 2) return;
  const minX = Math.min(...eligibleNotes.map(n => getMetrics(app, n).x));
  performBatch(app, eligibleNotes, (note) => ({ x: minX }));
}

export function alignCenter(app) {
  const eligibleNotes = getEligibleSelectedNotes(app);
  if (eligibleNotes.length < 2) return;
  const metricsList = eligibleNotes.map(n => getMetrics(app, n));
  const minX = Math.min(...metricsList.map(m => m.x));
  const maxX = Math.max(...metricsList.map(m => m.x + m.width));
  const centerX = minX + (maxX - minX) / 2;
  
  performBatch(app, eligibleNotes, (note, metrics) => ({ x: centerX - metrics.width / 2 }));
}

export function alignRight(app) {
  const eligibleNotes = getEligibleSelectedNotes(app);
  if (eligibleNotes.length < 2) return;
  const maxX = Math.max(...eligibleNotes.map(n => {
    const m = getMetrics(app, n);
    return m.x + m.width;
  }));
  performBatch(app, eligibleNotes, (note, metrics) => ({ x: maxX - metrics.width }));
}

export function alignTop(app) {
  const eligibleNotes = getEligibleSelectedNotes(app);
  if (eligibleNotes.length < 2) return;
  const minY = Math.min(...eligibleNotes.map(n => getMetrics(app, n).y));
  performBatch(app, eligibleNotes, (note) => ({ y: minY }));
}

export function alignMiddle(app) {
  const eligibleNotes = getEligibleSelectedNotes(app);
  if (eligibleNotes.length < 2) return;
  const metricsList = eligibleNotes.map(n => getMetrics(app, n));
  const minY = Math.min(...metricsList.map(m => m.y));
  const maxY = Math.max(...metricsList.map(m => m.y + m.height));
  const centerY = minY + (maxY - minY) / 2;
  
  performBatch(app, eligibleNotes, (note, metrics) => ({ y: centerY - metrics.height / 2 }));
}

export function alignBottom(app) {
  const eligibleNotes = getEligibleSelectedNotes(app);
  if (eligibleNotes.length < 2) return;
  const maxY = Math.max(...eligibleNotes.map(n => {
    const m = getMetrics(app, n);
    return m.y + m.height;
  }));
  performBatch(app, eligibleNotes, (note, metrics) => ({ y: maxY - metrics.height }));
}

export function distributeHorizontally(app) {
  const eligibleNotes = getEligibleSelectedNotes(app);
  if (eligibleNotes.length < 3) return;

  const notesWithMetrics = eligibleNotes.map(n => ({ note: n, m: getMetrics(app, n) }));
  notesWithMetrics.sort((a, b) => a.m.x - b.m.x);

  const first = notesWithMetrics[0];
  const last = notesWithMetrics[notesWithMetrics.length - 1];

  const sumMiddleW = notesWithMetrics.slice(1, -1).reduce((sum, item) => sum + item.m.width, 0);
  const totalGap = (last.m.x - first.m.x - first.m.width) - sumMiddleW;
  const step = totalGap / (notesWithMetrics.length - 1);

  if (app.state.sourceType === 'legacy') return;
  
  let currentX = first.m.x + first.m.width + step;
  let changed = false;
  for (let i = 1; i < notesWithMetrics.length - 1; i++) {
    const item = notesWithMetrics[i];
    if (item.note.x !== currentX) {
      item.note.x = currentX;
      changed = true;
    }
    currentX += item.m.width + step;
  }

  if (changed) {
    app.state.notify();
    app.commitHistory();
  }
}

export function distributeVertically(app) {
  const eligibleNotes = getEligibleSelectedNotes(app);
  if (eligibleNotes.length < 3) return;

  const notesWithMetrics = eligibleNotes.map(n => ({ note: n, m: getMetrics(app, n) }));
  notesWithMetrics.sort((a, b) => a.m.y - b.m.y);

  const first = notesWithMetrics[0];
  const last = notesWithMetrics[notesWithMetrics.length - 1];

  const sumMiddleH = notesWithMetrics.slice(1, -1).reduce((sum, item) => sum + item.m.height, 0);
  const totalGap = (last.m.y - first.m.y - first.m.height) - sumMiddleH;
  const step = totalGap / (notesWithMetrics.length - 1);

  if (app.state.sourceType === 'legacy') return;

  let currentY = first.m.y + first.m.height + step;
  let changed = false;
  for (let i = 1; i < notesWithMetrics.length - 1; i++) {
    const item = notesWithMetrics[i];
    if (item.note.y !== currentY) {
      item.note.y = currentY;
      changed = true;
    }
    currentY += item.m.height + step;
  }

  if (changed) {
    app.state.notify();
    app.commitHistory();
  }
}

export function sameWidth(app) {
  const eligibleNotes = getEligibleSelectedNotes(app);
  if (eligibleNotes.length < 2) return;
  const anchor = getAnchorNote(app, eligibleNotes);
  const targetW = getMetrics(app, anchor).width;
  
  performBatch(app, eligibleNotes, (note, metrics) => {
    if (note.id !== anchor.id) return { w: targetW };
  });
}

export function sameHeight(app) {
  const eligibleNotes = getEligibleSelectedNotes(app);
  if (eligibleNotes.length < 2) return;
  const anchor = getAnchorNote(app, eligibleNotes);
  const targetH = getMetrics(app, anchor).height;
  
  performBatch(app, eligibleNotes, (note, metrics) => {
    if (note.id !== anchor.id) return { h: targetH };
  });
}

export function sameSize(app) {
  const eligibleNotes = getEligibleSelectedNotes(app);
  if (eligibleNotes.length < 2) return;
  const anchor = getAnchorNote(app, eligibleNotes);
  const targetW = getMetrics(app, anchor).width;
  const targetH = getMetrics(app, anchor).height;
  
  performBatch(app, eligibleNotes, (note, metrics) => {
    if (note.id !== anchor.id) return { w: targetW, h: targetH };
  });
}
