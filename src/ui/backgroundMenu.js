import { workspaceManager } from '../core/workspace.js';

export class BackgroundMenu {
  constructor(app) {
    this.app = app;
    this.isOpen = false;
    this.element = null;
    this.templates = [];
    this.favorites = [];
    this.currentPath = ''; // Root
    
    this.createDOM();
    
    document.addEventListener('pointerdown', (e) => {
      if (this.isOpen && this.element && !this.element.contains(e.target) && !e.target.closest('.utility-button')) {
        this.close();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (this.isOpen && e.key === 'Escape') {
        this.close();
      }
    });
  }

  createDOM() {
    this.element = document.createElement('div');
    this.element.className = 'orbit-popover';
    this.element.style.position = 'absolute';
    this.element.style.display = 'none';
    this.element.style.width = '300px';
    this.element.style.maxHeight = '400px';
    this.element.style.flexDirection = 'column';
    this.element.style.backgroundColor = 'var(--color-app-bg, var(--bg-layer-0, #ffffff))';
    this.element.style.border = '1px solid var(--border-color)';
    this.element.style.borderRadius = '8px';
    this.element.style.boxShadow = '0 6px 16px rgba(0,0,0,0.15)';
    this.element.style.zIndex = '9000';
    
    this.header = document.createElement('div');
    this.header.style.padding = '12px';
    this.header.style.borderBottom = '1px solid var(--border-color)';
    this.header.style.display = 'flex';
    this.header.style.alignItems = 'center';
    this.header.style.gap = '8px';
    
    this.backBtn = document.createElement('button');
    this.backBtn.innerHTML = '←';
    this.backBtn.style.border = 'none';
    this.backBtn.style.background = 'transparent';
    this.backBtn.style.cursor = 'pointer';
    this.backBtn.style.padding = '4px';
    this.backBtn.onclick = () => {
      if (this.currentPath.includes('/')) {
        const parts = this.currentPath.split('/');
        parts.pop();
        this.currentPath = parts.join('/');
      } else {
        this.currentPath = '';
      }
      this.renderList();
    };

    this.titleEl = document.createElement('div');
    this.titleEl.style.fontWeight = '500';
    this.titleEl.textContent = 'Backgrounds';

    this.header.appendChild(this.backBtn);
    this.header.appendChild(this.titleEl);
    
    this.content = document.createElement('div');
    this.content.style.padding = '8px';
    this.content.style.overflowY = 'auto';
    this.content.style.flex = '1';
    
    this.element.appendChild(this.header);
    this.element.appendChild(this.content);
    
    document.body.appendChild(this.element);
  }

  async loadData() {
    this.templates = await workspaceManager.getBackgroundTemplatesTree();
    this.favorites = await workspaceManager.getBackgroundFavorites();
  }

  async toggle(anchorEl) {
    if (this.isOpen) {
      this.close();
      return;
    }
    
    await this.loadData();
    
    const rect = anchorEl.getBoundingClientRect();
    this.element.style.display = 'flex';
    
    const popoverRect = this.element.getBoundingClientRect();
    let left = rect.left - (popoverRect.width / 2) + (rect.width / 2);
    let top = rect.bottom + 8;

    if (left + popoverRect.width > window.innerWidth - 16) {
      left = window.innerWidth - popoverRect.width - 16;
    }

    this.element.style.left = `${left}px`;
    this.element.style.top = `${top}px`;
    
    this.isOpen = true;
    this.currentPath = '';
    this.renderList();
  }

  close() {
    this.isOpen = false;
    if (this.element) {
      this.element.style.display = 'none';
    }
  }

  getCurrentDirItems() {
    if (!this.currentPath) {
      return this.templates;
    }
    const parts = this.currentPath.split('/');
    let current = this.templates;
    for (const part of parts) {
      const folder = current.find(c => c.isDir && c.name === part);
      if (folder) {
         current = folder.children;
      } else {
         return [];
      }
    }
    return current;
  }

  renderList() {
    this.content.innerHTML = '';
    
    if (!this.currentPath) {
      this.backBtn.style.visibility = 'hidden';
      this.titleEl.textContent = 'Backgrounds';
      
      // Render Favorites Section
      if (this.favorites.length > 0) {
        const favHeader = document.createElement('div');
        favHeader.textContent = 'Favorites';
        favHeader.style.fontSize = '11px';
        favHeader.style.color = 'var(--color-text-muted)';
        favHeader.style.textTransform = 'uppercase';
        favHeader.style.padding = '8px 8px 4px';
        this.content.appendChild(favHeader);
        
        for (const favPath of this.favorites) {
           this.content.appendChild(this.createFileItem({ name: favPath.split('/').pop(), path: favPath, isFav: true }));
        }
        
        const hr = document.createElement('hr');
        hr.style.borderTop = '1px solid var(--border-color)';
        hr.style.margin = '8px 0';
        this.content.appendChild(hr);
        
        const allHeader = document.createElement('div');
        allHeader.textContent = 'All Templates';
        allHeader.style.fontSize = '11px';
        allHeader.style.color = 'var(--color-text-muted)';
        allHeader.style.textTransform = 'uppercase';
        allHeader.style.padding = '8px 8px 4px';
        this.content.appendChild(allHeader);
      }
    } else {
      this.backBtn.style.visibility = 'visible';
      this.titleEl.textContent = this.currentPath;
    }
    
    const items = this.getCurrentDirItems();
    
    if (items.length === 0 && (!this.currentPath || this.favorites.length === 0)) {
       const empty = document.createElement('div');
       empty.textContent = 'No templates found in workspace/templates/backgrounds/';
       empty.style.padding = '12px';
       empty.style.fontSize = '12px';
       empty.style.color = 'var(--color-text-muted)';
       empty.style.textAlign = 'center';
       this.content.appendChild(empty);
       return;
    }

    for (const item of items) {
      if (item.isDir) {
        this.content.appendChild(this.createFolderItem(item));
      } else {
        this.content.appendChild(this.createFileItem(item));
      }
    }
  }

  createFolderItem(item) {
    const el = document.createElement('div');
    el.className = 'orbit-search-item';
    el.style.flexDirection = 'row';
    el.style.alignItems = 'center';
    el.style.gap = '8px';
    
    const icon = document.createElement('div');
    icon.innerHTML = '📁';
    icon.style.filter = 'grayscale(100%) opacity(70%)';
    
    const name = document.createElement('div');
    name.textContent = item.name;
    name.style.flex = '1';
    name.style.fontSize = '13px';
    
    el.appendChild(icon);
    el.appendChild(name);
    
    el.onclick = () => {
      this.currentPath = this.currentPath ? `${this.currentPath}/${item.name}` : item.name;
      this.renderList();
    };
    
    return el;
  }

  createFileItem(item) {
    const el = document.createElement('div');
    el.className = 'orbit-search-item';
    el.style.flexDirection = 'row';
    el.style.alignItems = 'center';
    el.style.gap = '8px';
    
    const icon = document.createElement('div');
    icon.innerHTML = '🖼️';
    icon.style.filter = 'grayscale(100%) opacity(70%)';
    
    const name = document.createElement('div');
    name.textContent = item.name;
    name.style.flex = '1';
    name.style.fontSize = '13px';
    name.style.whiteSpace = 'nowrap';
    name.style.overflow = 'hidden';
    name.style.textOverflow = 'ellipsis';
    
    const favBtn = document.createElement('button');
    const isFav = this.favorites.includes(item.path);
    favBtn.innerHTML = isFav ? '★' : '☆';
    favBtn.style.background = 'none';
    favBtn.style.border = 'none';
    favBtn.style.color = isFav ? '#f59e0b' : 'var(--color-text-muted)';
    favBtn.style.cursor = 'pointer';
    favBtn.style.fontSize = '14px';
    favBtn.onclick = async (e) => {
      e.stopPropagation();
      this.favorites = await workspaceManager.toggleBackgroundFavorite(item.path);
      this.renderList();
    };
    
    el.appendChild(icon);
    el.appendChild(name);
    el.appendChild(favBtn);
    
    el.onclick = async () => {
       await this.insertBackground(item.path);
    };
    
    return el;
  }

  async insertBackground(templateRelPath) {
    if (this.app.state.sourceType === 'legacy') return;
    
    // Attempt to copy into the board's asset area
    const savedPath = await workspaceManager.copyTemplateBackground(this.app.state.boardId, templateRelPath);
    if (savedPath) {
       // Insert at center of viewport
       const vp = this.app.state.canvas;
       let targetX, targetY;
       
       if (this.app.interactions && this.app.interactions.canvas) {
           const containerWidth = this.app.interactions.canvas.container.clientWidth;
           const containerHeight = this.app.interactions.canvas.container.clientHeight;
           targetX = -(vp.panX) + (containerWidth / 2 / vp.zoom) - 200; // rough width 400
           targetY = -(vp.panY) + (containerHeight / 2 / vp.zoom) - 150; // rough height 300
       } else {
           targetX = -(vp.panX);
           targetY = -(vp.panY);
       }
       
       // Fixed size or auto-detect? MVP: 800x600 for frameworks, or 1000x800
       const id = this.app.state.addBackgroundImage(targetX, targetY, savedPath, 1000, 800, templateRelPath);
       this.app.commitHistory();
       
       this.close();
    } else {
       alert("Failed to insert background template. Please ensure the template file is readable.");
    }
  }
}
