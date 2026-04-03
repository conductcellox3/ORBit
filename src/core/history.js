export class History {
  constructor(state) {
    this.state = state;
    this.undoStack = [];
    this.redoStack = [];
    this.maxDepth = 50;
    
    // Save initial state
    this.commit();
  }

  commit() {
    const snapshot = this.state.getSnapshot();
    
    // Prevent consecutive identical snapshots
    if (this.undoStack.length > 0) {
      const prev = this.undoStack[this.undoStack.length - 1];
      if (JSON.stringify(prev) === JSON.stringify(snapshot)) {
        return;
      }
    }

    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    this.redoStack = []; // Clear redo stack on new action
  }

  undo() {
    if (this.undoStack.length > 1) {
      const current = this.undoStack.pop();
      this.redoStack.push(current);
      const prev = this.undoStack[this.undoStack.length - 1];
      this.state.restoreSnapshot(prev);
    }
  }

  redo() {
    if (this.redoStack.length > 0) {
      const next = this.redoStack.pop();
      this.undoStack.push(next);
      this.state.restoreSnapshot(next);
    }
  }
}
