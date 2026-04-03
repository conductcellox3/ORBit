import { workspaceLoader } from '../legacy/workspaceLoader.js';
import { legacyAdapter } from '../legacy/boardAdapter.js';

export class TabManager {
  constructor(elementId, app) {
    this.element = document.getElementById(elementId);
    this.app = app;
    this.openTabs = new Map(); // id -> { id, title, type: 'legacy', slug }
  }

  mount() {
    this.render();
    this.app.state.subscribe(() => {
      // Sync open legacy board if it's new
      if (this.app.state.sourceType === 'legacy') {
        const id = this.app.state.boardId;
        if (!this.openTabs.has(id)) {
          this.openTabs.set(id, {
            id,
            title: this.app.state.title || 'Untitled Board',
            type: 'legacy',
            slug: this.app.state.slug || ''
          });
        }
      }
      this.render();
    });
  }

  render() {
    this.element.innerHTML = '';
    
    const currentId = this.app.state.sourceType === 'legacy' ? this.app.state.boardId : 'default';
    
    // Always render native Main Board tab
    const nativeTab = document.createElement('div');
    nativeTab.className = `board-tab ${currentId === 'default' ? 'is-active' : ''}`;
    nativeTab.textContent = 'Default';
    nativeTab.addEventListener('click', async () => {
      if (currentId !== 'default') {
        await this.app.loadNativeBoard();
      }
    });
    this.element.appendChild(nativeTab);
    
    // Render all tracked legacy tabs
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
        
        // If we closed the active tab, fall back to Default
        if (currentId === id) {
          await this.app.loadNativeBoard();
        } else {
          this.render(); // just re-render to remove it visually
        }
      });
      
      tabEl.appendChild(titleSpan);
      tabEl.appendChild(closeBtn);
      
      tabEl.addEventListener('click', async () => {
        if (currentId !== id) {
          const legacyData = await workspaceLoader.loadBoardState(id, tabInfo.slug);
          if (legacyData) {
            // Need a minimal manifest entry shape for the adapter
            const fakeManifestEntry = { title: tabInfo.title, slug: tabInfo.slug };
            const snapshot = legacyAdapter.adapt(fakeManifestEntry, legacyData.meta, legacyData.state);
            await this.app.loadLegacyBoard(snapshot);
          }
        }
      });
      
      this.element.appendChild(tabEl);
    }
  }
}

