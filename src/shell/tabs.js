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
    if (id && !this.openTabs.has(id)) {
      this.openTabs.set(id, {
        id,
        title: this.app.state.title || 'Untitled Board',
        type: this.app.state.sourceType,
        slug: this.app.state.slug || ''
      });
    } else if (id && this.openTabs.has(id)) {
      const tab = this.openTabs.get(id);
      if (tab.title !== this.app.state.title) {
        tab.title = this.app.state.title;
      }
    }
  }

  mount() {
    this.syncTabFromState();
    this.render();
    
    this.app.state.subscribe(() => {
      this.syncTabFromState();
      this.render();
    });
  }

  render() {
    this.element.innerHTML = '';
    
    const currentId = this.app.state.boardId;
    
    // Render all tracked tabs
    for (const [id, tabInfo] of this.openTabs.entries()) {
      const tabEl = document.createElement('div');
      tabEl.className = `board-tab ${currentId === id ? 'is-active' : ''}`;
      tabEl.style.gap = '8px';
      
      const titleSpan = document.createElement('span');
      titleSpan.textContent = tabInfo.title;
      titleSpan.style.marginRight = '8px';
      
      // Close button
      const closeBtn = document.createElement('span');
      closeBtn.textContent = '×';
      closeBtn.className = 'tab-close-btn';
      closeBtn.style.cursor = 'pointer';
      closeBtn.style.opacity = '0.4';
      closeBtn.style.padding = '2px 4px';
      closeBtn.style.borderRadius = '4px';
      
      closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.opacity = '1';
        closeBtn.style.backgroundColor = 'rgba(0,0,0,0.05)';
      });
      closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.opacity = '0.4';
        closeBtn.style.backgroundColor = 'transparent';
      });
      
      closeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        this.openTabs.delete(id);
        
        // If we closed the active tab, fall back to the first available tab
        if (currentId === id) {
          const nextTab = this.openTabs.values().next().value;
          if (nextTab) {
             if (nextTab.type === 'native') {
                 await this.app.loadNativeBoard(nextTab.id);
             } else {
                 const legacyData = await workspaceLoader.loadBoardState(nextTab.id, nextTab.slug);
                 if (legacyData) {
                   const fakeManifestEntry = { title: nextTab.title, slug: nextTab.slug };
                   const snapshot = legacyAdapter.adapt(fakeManifestEntry, legacyData.meta, legacyData.state);
                   await this.app.loadLegacyBoard(snapshot);
                 }
             }
          } else {
             // If all tabs closed, load native fallback
             await this.app.loadNativeBoard();
          }
        } else {
          this.render(); // just re-render to remove it visually
        }
      });
      
      tabEl.appendChild(titleSpan);
      tabEl.appendChild(closeBtn);
      
      tabEl.addEventListener('click', async () => {
        if (currentId !== id) {
          if (tabInfo.type === 'native') {
              await this.app.loadNativeBoard(tabInfo.id);
          } else {
              const legacyData = await workspaceLoader.loadBoardState(id, tabInfo.slug);
              if (legacyData) {
                const fakeManifestEntry = { title: tabInfo.title, slug: tabInfo.slug };
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

