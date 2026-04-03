export class SidePane {
  constructor(elementId, storageKeyPrefix, defaultWidth) {
    this.element = document.getElementById(elementId);
    this.storageKeyPrefix = storageKeyPrefix;
    this.defaultWidth = defaultWidth;
    
    this.widthParams = {
      open: `${this.storageKeyPrefix}:open`,
      width: `${this.storageKeyPrefix}:width`
    };
    
    this.isOpen = this.loadIsOpen();
    this.width = this.loadWidth();
  }

  mount() {
    this.applyState();
  }

  loadIsOpen() {
    const val = localStorage.getItem(this.widthParams.open);
    if (val === null) {
      // Default left to open, right to closed for initial UX, or just default open
      return this.element.id === 'left-pane'; 
    }
    return val === 'true';
  }

  loadWidth() {
    const val = localStorage.getItem(this.widthParams.width);
    return val ? parseInt(val, 10) : this.defaultWidth;
  }

  saveState() {
    localStorage.setItem(this.widthParams.open, this.isOpen);
    localStorage.setItem(this.widthParams.width, this.width);
  }

  applyState() {
    if (this.isOpen) {
      this.element.classList.remove('is-collapsed');
      this.element.style.width = `${this.width}px`;
    } else {
      this.element.classList.add('is-collapsed');
      this.element.style.width = `0px`;
    }
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.saveState();
    this.applyState();
  }

  setWidth(newWidth) {
    this.width = Math.max(150, Math.min(newWidth, 600)); // Clamp reasonable desktop bounds
    if (this.isOpen) {
      this.saveState();
      this.applyState();
    }
  }
}
