import { workspaceLoader } from '../legacy/workspaceLoader.js';
import { legacyAdapter } from '../legacy/boardAdapter.js';

export class TabManager {
  constructor(elementId, app) {
    this.element = document.getElementById(elementId);
    this.app = app;
    this.openTabs = new Map(); // id -> { id, title, type: 'legacy'|'native', slug? }
  }

  syncTabFromState() {
    if (this.app.isGraphActive) {
      const key = 'native:__orbit_boards_graph__';
      if (!this.openTabs.has(key)) {
         this.openTabs.set(key, {
            id: '__orbit_boards_graph__',
            title: 'Boards Graph',
            type: 'native'
         });
      }
      return;
    }

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

  async activateTab(tabInfo) {
      if (tabInfo.id === '__orbit_boards_graph__') {
          if (this.app.openGraphTab) await this.app.openGraphTab();
      } else if (tabInfo.type === 'native') {
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

  showDropdown(e) {
      import('./contextMenu.js').then(({ ContextMenu }) => {
          const items = Array.from(this.openTabs.values()).map(tab => ({
              label: tab.title,
              onClick: () => {
                 if (this.app.state.boardId !== tab.id && !this.app.isGraphActive) {
                     this.activateTab(tab);
                 } else if (tab.id === '__orbit_boards_graph__' && !this.app.isGraphActive) {
                     this.activateTab(tab);
                 }
              }
          }));

          if (items.length === 0) {
              items.push({ label: 'No open tabs', disabled: true });
          }

          const rect = this.dropdownBtn.getBoundingClientRect();
          // Dropdown appears from right alignment
          ContextMenu.show(rect.right - 140, rect.bottom, items);
      });
  }

  mount() {
    if (!this.dropdownWrapper) {
      this.dropdownWrapper = document.createElement('div');
      this.dropdownWrapper.className = 'top-center-tabs-wrapper';
      this.dropdownWrapper.style.display = 'flex';
      this.dropdownWrapper.style.flex = '1';
      this.dropdownWrapper.style.minWidth = '0';
      this.dropdownWrapper.style.height = '100%';
      this.dropdownWrapper.style.alignItems = 'center';
      
      this.element.parentNode.insertBefore(this.dropdownWrapper, this.element);
      this.dropdownWrapper.appendChild(this.element);
      
      this.dropdownBtn = document.createElement('div');
      this.dropdownBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
      this.dropdownBtn.className = 'tab-dropdown-btn';
      this.dropdownBtn.title = 'Open Tabs';
      this.dropdownBtn.onclick = (e) => this.showDropdown(e);
      
      this.dropdownWrapper.appendChild(this.dropdownBtn);
    }

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
    
    let currentKey = null;
    if (this.app.isGraphActive) {
       currentKey = 'native:__orbit_boards_graph__';
    } else if (this.app.state.boardId && this.app.state.sourceType) {
       currentKey = `${this.app.state.sourceType}:${this.app.state.boardId}`;
    }
    
    // Render all tracked tabs
    for (const [key, tabInfo] of this.openTabs.entries()) {
      const isActive = currentKey === key;
      const tabEl = document.createElement('div');
      tabEl.className = `board-tab ${isActive ? 'is-active' : ''}`;
      tabEl.style.gap = '8px';
      
      const titleSpan = document.createElement('span');
      titleSpan.className = 'tab-title-text';
      titleSpan.textContent = tabInfo.title;
      titleSpan.title = tabInfo.title; // Show full title on native hover
      
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
                 const tInfo = this.openTabs.get(nearestNative);
                 await this.activateTab(tInfo);
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
           await this.activateTab(tabInfo);
        }
      });
      
      this.element.appendChild(tabEl);
      
      if (isActive) {
          // ensure the active tab is scrolled into view gently
          setTimeout(() => {
             tabEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
          }, 10);
      }
    }
  }
}

