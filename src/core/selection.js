export class Selection {
  constructor() {
    this.selectedId = null;
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
      fn({ id: this.selectedId, type: this.type });
    }
  }

  select(id, type) {
    if (this.selectedId !== id) {
      this.selectedId = id;
      this.type = type;
      this.notify();
    }
  }

  clear() {
    if (this.selectedId !== null) {
      this.selectedId = null;
      this.type = null;
      this.notify();
    }
  }
}
