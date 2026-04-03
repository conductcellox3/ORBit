export class ContextMenu {
  static currentMenu = null;
  static onCloseCallback = null;

  static show(x, y, items, onClose = null) {
    this.hide();

    this.onCloseCallback = onClose;

    const menuEl = document.createElement('div');
    menuEl.className = 'explorer-context-menu';
    menuEl.style.position = 'absolute';
    
    // Slightly darker than Explorer background (#F1F3F5), but neutral (less blue)
    menuEl.style.backgroundColor = 'var(--bg-layer-1, #E5E7EB)'; 
    menuEl.style.border = '1px solid var(--border-color, #D1D5DB)';
    menuEl.style.borderRadius = '6px';
    menuEl.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
    menuEl.style.padding = '4px 0';
    menuEl.style.zIndex = '9999';
    menuEl.style.minWidth = '140px';
    menuEl.style.color = 'var(--color-text-main, #202124)';
    menuEl.style.fontSize = '12px';

    items.forEach(item => {
      if (item.type === 'separator') {
        const sep = document.createElement('div');
        sep.style.height = '1px';
        sep.style.backgroundColor = 'var(--border-color, #D1D5DB)';
        sep.style.margin = '4px 0';
        menuEl.appendChild(sep);
        return;
      }

      const itemEl = document.createElement('div');
      itemEl.textContent = item.label;
      itemEl.style.padding = '6px 12px';
      itemEl.style.cursor = item.disabled ? 'not-allowed' : 'pointer';
      itemEl.style.opacity = item.disabled ? '0.4' : '1';
      
      if (!item.disabled) {
        itemEl.addEventListener('mouseenter', () => {
          itemEl.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
        });
        itemEl.addEventListener('mouseleave', () => {
          itemEl.style.backgroundColor = 'transparent';
        });
        itemEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.hide();
          item.onClick();
        });
      }
      menuEl.appendChild(itemEl);
    });

    document.body.appendChild(menuEl);
    this.currentMenu = menuEl;

    // Viewport clamping
    requestAnimationFrame(() => {
      const rect = menuEl.getBoundingClientRect();
      const finalX = Math.min(x, window.innerWidth - rect.width - 4);
      const finalY = Math.min(y, window.innerHeight - rect.height - 4);
      menuEl.style.left = `${finalX}px`;
      menuEl.style.top = `${finalY}px`;
    });

    // Close listener
    const closeListener = (e) => {
      if (!menuEl.contains(e.target)) {
        this.hide();
        document.removeEventListener('click', closeListener);
        document.removeEventListener('contextmenu', closeListener);
      }
    };
    
    // Small timeout to avoid immediate closing
    setTimeout(() => {
      document.addEventListener('click', closeListener);
      document.addEventListener('contextmenu', closeListener);
    }, 10);
  }

  static hide() {
    if (this.currentMenu) {
      this.currentMenu.remove();
      this.currentMenu = null;
      if (this.onCloseCallback) {
        this.onCloseCallback();
        this.onCloseCallback = null;
      }
    }
  }
}
