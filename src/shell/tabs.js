import { workspaceLoader } from '../legacy/workspaceLoader.js';
import { legacyAdapter } from '../legacy/boardAdapter.js';

export class TabManager {
  constructor(elementId, app) {
    this.element = document.getElementById(elementId);
    this.app = app;
    this.openTabs = new Map(); // id -> { id, title, type: 'legacy'|'native', slug? }
  }

  syncTabFromState() {
    const id = this.app.state.boardId;
    const type = this.app.state.sourceType;
    if (!id || !type) return;

    const key = `${type}:${id}`;
    if (!this.openTabs.has(key)) {
      this.openTabs.set(key, {
        id,
        title: this.app.state.title || 'Untitled Board',
        type,
        slug: this.app.state.slug || ''
      });
    } else {
      const tab = this.openTabs.get(key);
      if (tab.title !== this.app.state.title) {
        tab.title = this.app.state.title;
      }
    }
  }

  updateTabTitle(id, type, newTitle) {
      const key = `${type}:${id}`;
      if (this.openTabs.has(key)) {
          this.openTabs.get(key).title = newTitle;
          this.render();
      }
  }

  mount() {
    this.syncTabFromState();
    this.render();
    
    this.app.onBoardChanged = () => {
      this.syncTabFromState();
      this.render();
    };
    
    this.app.onTitleChanged = () => {
      this.syncTabFromState();
      this.render();
    };
  }

  render() {
    this.element.innerHTML = '';
    
    const currentKey = this.app.state.boardId && this.app.state.sourceType 
      ? `${this.app.state.sourceType}:${this.app.state.boardId}` 
      : null;
    
    // Render all tracked tabs
    for (const [key, tabInfo] of this.openTabs.entries()) {
      const isActive = currentKey === key;
      const tabEl = document.createElement('div');
      tabEl.className = `board-tab ${isActive ? 'is-active' : ''}`;
      tabEl.style.gap = '8px';
      
      const titleSpan = document.createElement('span');
      titleSpan.textContent = tabInfo.title;
      titleSpan.style.marginRight = '8px';
      
      // Close button
      // Close button class handles appearance in CSS
      const closeBtn = document.createElement('span');
      closeBtn.textContent = '×';
      closeBtn.className = 'tab-close-btn';
      
      closeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        
        const keysArray = Array.from(this.openTabs.keys());
        const closedIndex = keysArray.indexOf(key);
        
        this.openTabs.delete(key);
        
        // If we closed the active tab, fallback to nearest native tab
        if (isActive) {
          const remainingKeys = Array.from(this.openTabs.keys());
          if (remainingKeys.length > 0) {
             let fallbackIndex = closedIndex;
             if (fallbackIndex >= remainingKeys.length) fallbackIndex = remainingKeys.length - 1;
             
             const nearestNative = remainingKeys.slice(fallbackIndex).find(k => this.openTabs.get(k).type === 'native') ||
                                   remainingKeys.slice(0, fallbackIndex).reverse().find(k => this.openTabs.get(k).type === 'native');
                                   
             if (nearestNative) {
                 await this.app.loadNativeBoard(this.openTabs.get(nearestNative).id);
             } else {
                 await this.app.loadNativeBoard();
             }
          } else {
             await this.app.loadNativeBoard();
          }
        } else {
          this.render();
        }
      });
      
      tabEl.appendChild(titleSpan);
      tabEl.appendChild(closeBtn);
      
      tabEl.addEventListener('click', async () => {
        if (!isActive) {
          if (tabInfo.type === 'native') {
              await this.app.loadNativeBoard(tabInfo.id);
          } else {
              const legacyData = await workspaceLoader.loadBoardState(tabInfo.id, tabInfo.slug);
              if (legacyData) {
                const fakeManifestEntry = { id: tabInfo.id, title: tabInfo.title, slug: tabInfo.slug };
                const snapshot = legacyAdapter.adapt(fakeManifestEntry, legacyData.meta, legacyData.state);
                await this.app.loadLegacyBoard(snapshot);
              }
          }
        }
      });
      
      this.element.appendChild(tabEl);
    }
  }
}

