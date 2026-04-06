import { HelpContent } from '../data/helpContent.js';

export class HelpUI {
  constructor(app) {
    this.app = app;
    this.overlay = document.getElementById('orbit-help-overlay');
    this.isOpen = false;
    this.activeCategoryIndex = 0;
    
    this.init();
  }

  init() {
    this.overlay.innerHTML = '';
    this.overlay.className = 'orbit-help-overlay';
    
    // Create Modal Container
    this.modal = document.createElement('div');
    this.modal.className = 'orbit-help-modal';

    // Header
    const header = document.createElement('div');
    header.className = 'orbit-help-header';
    header.innerHTML = `
      <div class="orbit-help-title">Help & Shortcuts</div>
      <button class="orbit-help-close" title="Close (ESC)">×</button>
    `;
    header.querySelector('.orbit-help-close').addEventListener('click', () => this.close());

    // Body
    this.body = document.createElement('div');
    this.body.className = 'orbit-help-body';

    // Sidebar (Categories)
    this.sidebar = document.createElement('div');
    this.sidebar.className = 'orbit-help-sidebar';
    
    // Content Area
    this.contentArea = document.createElement('div');
    this.contentArea.className = 'orbit-help-content';

    this.body.appendChild(this.sidebar);
    this.body.appendChild(this.contentArea);

    this.modal.appendChild(header);
    this.modal.appendChild(this.body);
    this.overlay.appendChild(this.modal);

    // Overlay click to close
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    this.renderSidebar();
    this.renderContent();
  }

  renderSidebar() {
    this.sidebar.innerHTML = '';
    HelpContent.forEach((cat, idx) => {
      const btn = document.createElement('button');
      btn.className = `orbit-help-tab ${idx === this.activeCategoryIndex ? 'is-active' : ''}`;
      btn.textContent = cat.category;
      btn.addEventListener('click', () => {
        this.activeCategoryIndex = idx;
        this.renderSidebar();
        this.renderContent();
      });
      this.sidebar.appendChild(btn);
    });
  }

  renderContent() {
    const data = HelpContent[this.activeCategoryIndex];
    if (!data) return;

    this.contentArea.innerHTML = '';
    
    const catTitle = document.createElement('h2');
    catTitle.textContent = data.category;
    this.contentArea.appendChild(catTitle);

    const list = document.createElement('div');
    list.className = 'orbit-help-item-list';

    data.items.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'orbit-help-item';
      
      const titleEl = document.createElement('div');
      titleEl.className = 'orbit-help-item-title';
      if (item.icon) {
        titleEl.innerHTML = `<span class="orbit-help-item-icon">${item.icon}</span> ${item.title}`;
      } else {
        titleEl.textContent = item.title;
      }
      
      const descEl = document.createElement('div');
      descEl.className = 'orbit-help-item-desc';
      descEl.style.whiteSpace = 'pre-wrap';
      descEl.textContent = item.description;

      itemEl.appendChild(titleEl);
      itemEl.appendChild(descEl);

      if (item.shortcuts && item.shortcuts.length > 0) {
        const shortcutsEl = document.createElement('div');
        shortcutsEl.className = 'orbit-help-shortcuts';
        item.shortcuts.forEach(sc => {
            // Very simple parser to wrap keys in <kbd> if needed,
            // or just render as a single string. Let's wrap splitting by '+'
            const keyParts = sc.split('+').map(p => p.trim());
            const scContainer = document.createElement('span');
            scContainer.className = 'orbit-shortcut-combo';
            keyParts.forEach((part, i) => {
               const kbd = document.createElement('kbd');
               kbd.textContent = part;
               scContainer.appendChild(kbd);
               if (i < keyParts.length - 1) {
                  scContainer.appendChild(document.createTextNode(' + '));
               }
            });
            shortcutsEl.appendChild(scContainer);
        });
        itemEl.appendChild(shortcutsEl);
      }

      list.appendChild(itemEl);
    });

    this.contentArea.appendChild(list);
    this.contentArea.scrollTo(0, 0); // reset scroll
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.activeCategoryIndex = 0;
    this.renderSidebar();
    this.renderContent();
    this.overlay.style.display = 'flex';
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.overlay.style.display = 'none';
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
}
