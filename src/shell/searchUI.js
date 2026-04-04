import { workspaceLoader } from '../legacy/workspaceLoader.js';
import { legacyAdapter } from '../legacy/boardAdapter.js';

export class SearchUI {
  constructor(app) {
    this.app = app;
    this.isOpen = false;
    this.scope = 'this_board'; // 'this_board' | 'all_boards'
    this.query = '';
    this.debounceTimer = null;
    this.results = [];
    
    this.overlay = this.createOverlay();
    document.body.appendChild(this.overlay);
    this.bindEvents();
  }

  createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'orbit-search-overlay';
    overlay.style.display = 'none';

    // Container
    const container = document.createElement('div');
    container.className = 'orbit-search-container';

    // Header (Switch + Input)
    const header = document.createElement('div');
    header.className = 'orbit-search-header';

    const switchWrapper = document.createElement('div');
    switchWrapper.className = 'orbit-search-switch';

    this.btnThisBoard = document.createElement('button');
    this.btnThisBoard.className = 'orbit-search-tab is-active';
    this.btnThisBoard.textContent = 'This Board';
    
    this.btnAllBoards = document.createElement('button');
    this.btnAllBoards.className = 'orbit-search-tab';
    this.btnAllBoards.textContent = 'All Boards';

    switchWrapper.appendChild(this.btnThisBoard);
    switchWrapper.appendChild(this.btnAllBoards);
    
    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.className = 'orbit-search-input';
    this.input.placeholder = 'Search within this board...';

    header.appendChild(switchWrapper);
    header.appendChild(this.input);

    // Results area
    this.resultsContainer = document.createElement('div');
    this.resultsContainer.className = 'orbit-search-results';

    container.appendChild(header);
    container.appendChild(this.resultsContainer);
    overlay.appendChild(container);

    return overlay;
  }

  bindEvents() {
    this.btnThisBoard.addEventListener('click', () => {
      this.setScope('this_board');
    });

    this.btnAllBoards.addEventListener('click', () => {
      this.setScope('all_boards');
    });

    this.input.addEventListener('input', (e) => {
      this.query = e.target.value;
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      
      this.debounceTimer = setTimeout(() => {
        this.performSearch();
      }, this.scope === 'all_boards' ? 300 : 100);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
      // Trigger on Ctrl+F / Cmd+F handled at topbar.js (Wait, actually let's handle global shortcut here)
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        this.toggle();
      }
    });

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });
  }

  setScope(newScope) {
    if (this.scope === newScope) return;
    this.scope = newScope;
    this.btnThisBoard.classList.toggle('is-active', newScope === 'this_board');
    this.btnAllBoards.classList.toggle('is-active', newScope === 'all_boards');
    this.input.placeholder = newScope === 'this_board' ? 'Search within this board...' : 'Search all boards...';
    
    // Re-run search if there's already a query
    if (this.query.trim()) {
      this.performSearch();
    } else {
      this.renderResults();
    }
  }

  async performSearch() {
    this.resultsContainer.innerHTML = '<div class="orbit-search-empty">Searching...</div>';
    
    if (!this.query.trim()) {
      this.results = [];
      this.renderResults();
      return;
    }

    try {
      if (this.scope === 'this_board') {
        this.results = await this.app.searchEngine.searchThisBoard(this.query);
      } else {
        this.results = await this.app.searchEngine.searchAllBoards(this.query);
      }
    } catch (err) {
      console.error("Search failed", err);
      this.results = [];
    }
    
    this.renderResults();
  }

  renderResults() {
    this.resultsContainer.innerHTML = '';
    
    if (this.results.length === 0) {
      if (this.query.trim()) {
         this.resultsContainer.innerHTML = '<div class="orbit-search-empty">No results found.</div>';
      } else {
         this.resultsContainer.innerHTML = '<div class="orbit-search-empty">Type to search...</div>';
      }
      return;
    }

    this.results.forEach(res => {
      const el = document.createElement('div');
      el.className = 'orbit-search-item';
      
      const metaRow = document.createElement('div');
      metaRow.className = 'orbit-search-meta';
      
      const typeBadge = document.createElement('span');
      typeBadge.className = 'orbit-search-badge type';
      typeBadge.textContent = res.type.toUpperCase();

      const srcBadge = document.createElement('span');
      srcBadge.className = 'orbit-search-badge source';
      srcBadge.textContent = res.sourceType === 'legacy' ? 'Legacy' : 'Native';
      
      const boardLabel = document.createElement('span');
      boardLabel.className = 'orbit-search-board-name';
      boardLabel.textContent = res.boardTitle || 'Untitled';

      metaRow.appendChild(typeBadge);
      if (this.scope === 'all_boards') {
        metaRow.appendChild(boardLabel);
      }
      if (res.sourceType === 'legacy') {
         metaRow.appendChild(srcBadge);
      }
      
      const snippetEl = document.createElement('div');
      snippetEl.className = 'orbit-search-snippet';
      
      // Simple highlight
      const qLower = this.query.toLowerCase().trim();
      if (res.snippet && qLower) {
        const parts = res.snippet.split(new RegExp(`(${qLower})`, 'gi'));
        parts.forEach(p => {
          if (p.toLowerCase() === qLower) {
            const h = document.createElement('span');
            h.className = 'orbit-search-highlight';
            h.textContent = p;
            snippetEl.appendChild(h);
          } else {
            snippetEl.appendChild(document.createTextNode(p));
          }
        });
      } else {
        snippetEl.textContent = res.snippet || '';
      }

      el.appendChild(metaRow);
      el.appendChild(snippetEl);

      el.addEventListener('click', async () => {
        await this.handleResultClick(res);
      });

      this.resultsContainer.appendChild(el);
    });
  }

  async handleResultClick(res) {
    this.close();
    
    if (res.sourceType === 'legacy') {
      // Legacy open flow
      import('../core/workspace.js').then(async ({ workspaceManager }) => {
        const legacyManifest = await workspaceLoader.loadManifest();
        const boardMeta = legacyManifest.boards.find(b => b.id === res.boardId);
        if (boardMeta) {
          const legacyData = await workspaceLoader.loadBoardState(boardMeta.id, boardMeta.slug);
          if (legacyData) {
            const snapshot = legacyAdapter.adapt(boardMeta, legacyData.meta, legacyData.state);
            await this.app.loadLegacyBoard(snapshot);
            if (res.id) setTimeout(() => this.app.jumpToNoteCenter(res.id), 50);
          }
        }
      }).catch(err => console.error(err));
    } else {
      // Native open flow
      if (this.app.state.boardId !== res.boardId) {
        await this.app.loadNativeBoard(res.boardId);
      }
      if (res.id) {
        setTimeout(() => this.app.jumpToNoteCenter(res.id), 50);
      }
    }
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.isOpen = true;
    this.overlay.style.display = 'flex';
    this.input.focus();
    this.input.select();
    
    // Auto trigger search if needed, but not required if it persists
    if (this.query) {
      this.performSearch();
    } else {
      this.renderResults();
    }
  }

  close() {
    this.isOpen = false;
    this.overlay.style.display = 'none';
    this.input.blur();
  }
}
