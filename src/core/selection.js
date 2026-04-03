export class Selection {
  constructor() {
    this.selectedIds = new Set();
    this.type = null; // 'note', 'frame', 'edge'
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
      fn({ ids: Array.from(this.selectedIds), type: this.type });
    }
  }

  has(id) {
    return this.selectedIds.has(id);
  }

  get singleId() {
    return this.selectedIds.size === 1 ? Array.from(this.selectedIds)[0] : null;
  }

  select(id, type) {
    if (this.type !== type || this.selectedIds.size !== 1 || !this.selectedIds.has(id)) {
      this.selectedIds.clear();
      if (id) this.selectedIds.add(id);
      this.type = type;
      this.notify();
    }
  }

  toggleSelect(id, type) {
    if (this.type !== type && this.selectedIds.size > 0) {
      // If clicking a different type, clear first
      this.selectedIds.clear();
    }
    this.type = type;

    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
      if (this.selectedIds.size === 0) this.type = null;
    } else {
      this.selectedIds.add(id);
    }
    this.notify();
  }

  clear() {
    if (this.selectedIds.size > 0) {
      this.selectedIds.clear();
      this.type = null;
      this.notify();
    }
  }
}
