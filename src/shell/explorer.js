import { workspaceLoader } from '../legacy/workspaceLoader.js';
import { legacyAdapter } from '../legacy/boardAdapter.js';

export class Explorer {
  constructor(app, containerId) {
    this.app = app;
    this.container = document.getElementById(containerId);
  }

  async mount() {
    if (!this.container) return;
    
    // Clear out mock-tree HTML and build ours
    const treeContainer = this.container.querySelector('.mock-tree');
    if (!treeContainer) return;
    
    treeContainer.innerHTML = '<div class="mock-tree-item" style="opacity:0.5;">Loading boards...</div>';
    
    // 1. Load manifest
    const manifest = await workspaceLoader.loadManifest();
    treeContainer.innerHTML = ''; // clear
    
    if (!manifest || !manifest.boards || manifest.boards.length === 0) {
      treeContainer.innerHTML = '<div class="mock-tree-item" style="opacity:0.5;">No legacy boards found.</div>';
      return;
    }
    
    // 2. Render boards based on manifest ordering
    for (const board of manifest.boards) {
      const itemEl = document.createElement('div');
      itemEl.className = 'mock-tree-item';
      
      const iconEl = document.createElement('span');
      iconEl.className = 'mock-icon';
      iconEl.textContent = '📄';
      
      const titleEl = document.createElement('span');
      titleEl.textContent = board.title || 'Untitled Board';
      titleEl.style.flex = "1";
      titleEl.style.overflow = "hidden";
      titleEl.style.whiteSpace = "nowrap";
      titleEl.style.textOverflow = "ellipsis";
      
      itemEl.appendChild(iconEl);
      itemEl.appendChild(titleEl);
      
      // Optional: If there's a topic, show a tiny topic badge
      if (board.topic) {
        const topicEl = document.createElement('span');
        topicEl.textContent = board.topic;
        topicEl.style.fontSize = '9px';
        topicEl.style.opacity = '0.5';
        topicEl.style.padding = '2px 4px';
        topicEl.style.border = '1px solid var(--border-color)';
        topicEl.style.borderRadius = '3px';
        itemEl.appendChild(topicEl);
      }
      
      // 3. Click handler for lazy loading
      itemEl.addEventListener('click', async () => {
        // Remove active class from all
        treeContainer.querySelectorAll('.mock-tree-item').forEach(el => el.classList.remove('is-active'));
        itemEl.classList.add('is-active');
        
        // Lazy load board state
        const legacyData = await workspaceLoader.loadBoardState(board.id, board.slug);
        if (legacyData) {
          const snapshot = legacyAdapter.adapt(legacyData.meta, legacyData.state);
          // Pass the legacy snapshot to the app
          await this.app.loadLegacyBoard(snapshot);
        }
      });
      
      treeContainer.appendChild(itemEl);
    }
    
    // Optional: auto-open lastOpenedBoardId
    if (manifest.lastOpenedBoardId) {
      // Find the element with that ID... a bit tricky without data-id
      // but let's just trigger first board if needed later.
    }
  }
}
