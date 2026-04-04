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
    this.activeIndex = -1;
    this.resultEls = [];
    
    this.container = this.createContainer();
    this.bindEvents();
  }

  createContainer() {
    // Container
    const container = document.createElement('div');
    container.className = 'orbit-search-container';

    // Header
    const header = document.createElement('div');
    header.className = 'orbit-search-header';

    const headerRow1 = document.createElement('div');
    headerRow1.style.display = 'flex';
    headerRow1.style.alignItems = 'center';
    headerRow1.style.justifyContent = 'space-between';
    headerRow1.style.marginBottom = '8px';

    const switchWrapper = document.createElement('div');
    switchWrapper.className = 'orbit-search-switch';
    switchWrapper.style.flex = '1';

    this.btnThisBoard = document.createElement('button');
    this.btnThisBoard.className = 'orbit-search-tab is-active';
    this.btnThisBoard.textContent = 'This Board';
    
    this.btnAllBoards = document.createElement('button');
    this.btnAllBoards.className = 'orbit-search-tab';
    this.btnAllBoards.textContent = 'All Boards';

    switchWrapper.appendChild(this.btnThisBoard);
    switchWrapper.appendChild(this.btnAllBoards);

    headerRow1.appendChild(switchWrapper);

    const filterWrapper = document.createElement('div');
    filterWrapper.style.display = 'flex';
    filterWrapper.style.gap = '8px';
    
    this.typeSelect = document.createElement('select');
    ['All Types', 'Text Note', 'Image', 'Calc', 'Frame'].forEach(t => {
       const opt = document.createElement('option');
       opt.value = t === 'All Types' ? 'all' : t.split(' ')[0].toLowerCase();
       opt.textContent = t;
       this.typeSelect.appendChild(opt);
    });

    this.markerSelect = document.createElement('select');
    ['All Markers', 'Action', 'Question', 'Decision', 'Risk', 'Reference'].forEach(m => {
       const opt = document.createElement('option');
       opt.value = m === 'All Markers' ? 'all' : m.toLowerCase();
       opt.textContent = m;
       this.markerSelect.appendChild(opt);
    });

    const applySelectStyles = (sel) => {
       sel.style.padding = '2px 6px';
       sel.style.borderRadius = '4px';
       sel.style.border = '1px solid var(--border-color)';
       sel.style.background = 'transparent';
       sel.style.color = 'var(--color-text-main)';
       sel.style.fontSize = '11px';
       sel.style.cursor = 'pointer';
       sel.style.outline = 'none';
       
       sel.addEventListener('change', () => this.performSearch());
    };
    applySelectStyles(this.typeSelect);
    applySelectStyles(this.markerSelect);

    filterWrapper.appendChild(this.typeSelect);
    filterWrapper.appendChild(this.markerSelect);
    headerRow1.appendChild(filterWrapper);
    
    header.appendChild(headerRow1);

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.className = 'orbit-search-input';
    this.input.placeholder = 'Search within this board...';

    header.appendChild(this.input);

    // Filters Placeholder
    this.filtersContainer = document.createElement('div');
    this.filtersContainer.className = 'orbit-search-filters';
    this.filtersContainer.style.display = 'none';

    // Results area
    this.resultsContainer = document.createElement('div');
    this.resultsContainer.className = 'orbit-search-results';

    container.appendChild(header);
    container.appendChild(this.filtersContainer);
    container.appendChild(this.resultsContainer);

    return container;
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
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        this.app.toggleSearch();
      }
    });

    this.input.addEventListener('keydown', (e) => {
      if (e.isComposing) return;
      if (e.key === 'Escape') {
        this.input.blur();
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        this.setScope(this.scope === 'this_board' ? 'all_boards' : 'this_board');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.setActiveIndex(this.activeIndex + 1, true);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.setActiveIndex(this.activeIndex - 1, true);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (this.activeIndex >= 0 && this.activeIndex < this.results.length) {
          this.handleResultClick(this.results[this.activeIndex]);
        }
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
    
    const filters = {
      type: this.typeSelect ? this.typeSelect.value : 'all',
      marker: this.markerSelect ? this.markerSelect.value : 'all'
    };
    
    const hasFilters = filters.type !== 'all' || filters.marker !== 'all';

    if (!this.query.trim() && !hasFilters) {
      this.results = [];
      this.renderResults();
      return;
    }

    try {
      if (this.scope === 'this_board') {
        this.results = await this.app.searchEngine.searchThisBoard(this.query, filters);
      } else {
        this.results = await this.app.searchEngine.searchAllBoards(this.query, filters);
      }
    } catch (err) {
      console.error("Search failed", err);
      this.results = [];
    }
    
    this.renderResults();
  }

  renderResults() {
    this.resultsContainer.innerHTML = '';
    this.resultEls = [];
    this.activeIndex = -1;
    
    if (this.results.length === 0) {
      const hasFilters = (this.typeSelect && this.typeSelect.value !== 'all') || 
                         (this.markerSelect && this.markerSelect.value !== 'all');
      if (this.query.trim() || hasFilters) {
         this.resultsContainer.innerHTML = '<div class="orbit-search-empty">No results found.</div>';
      } else {
         this.resultsContainer.innerHTML = '<div class="orbit-search-empty">Type to search or select a filter...</div>';
      }
      return;
    }

    this.results.forEach((res, index) => {
      const el = document.createElement('div');
      el.className = 'orbit-search-item';
      
      const metaRow = document.createElement('div');
      metaRow.className = 'orbit-search-meta';
      
      const metaLeft = document.createElement('div');
      metaLeft.className = 'orbit-search-meta-left';
      const typeBadge = document.createElement('span');
      typeBadge.className = 'orbit-search-badge type';
      typeBadge.textContent = res.type.toUpperCase();
      metaLeft.appendChild(typeBadge);

      const metaRight = document.createElement('div');
      metaRight.className = 'orbit-search-meta-right';
      
      if (this.scope === 'all_boards') {
        const boardLabel = document.createElement('span');
        boardLabel.className = 'orbit-search-board-name';
        boardLabel.textContent = `in ${res.boardTitle || 'Untitled'}`;
        metaRight.appendChild(boardLabel);
      }
      
      if (res.sourceType === 'legacy' && this.scope === 'all_boards') {
        const srcBadge = document.createElement('span');
        srcBadge.className = 'orbit-search-badge source';
        srcBadge.textContent = 'Legacy (Read-only)';
        metaRight.appendChild(srcBadge);
      } else if (res.sourceType !== 'legacy' && this.scope === 'all_boards' && res.folderName) {
        const folderBadge = document.createElement('span');
        folderBadge.className = 'orbit-search-badge source';
        folderBadge.style.opacity = '0.6';
        folderBadge.style.fontStyle = 'italic';
        folderBadge.textContent = res.folderName === 'Inbox' ? 'Folder: Inbox' : `Folder: ${res.folderName}`;
        metaRight.appendChild(folderBadge);
      }

      metaRow.appendChild(metaLeft);
      metaRow.appendChild(metaRight);
      
      const snippetEl = document.createElement('div');
      snippetEl.className = 'orbit-search-snippet';
      
      if (res.matchField === 'topic') {
        const topicHint = document.createElement('span');
        topicHint.style.color = 'var(--color-text-muted)';
        topicHint.style.marginRight = '4px';
        topicHint.textContent = 'Topic:';
        snippetEl.appendChild(topicHint);
      } else if (res.matchField === 'marker' && res.matchedMarker) {
        const markerHint = document.createElement('span');
        markerHint.style.color = 'var(--color-text-muted)';
        markerHint.style.marginRight = '4px';
        markerHint.style.fontStyle = 'italic';
        markerHint.textContent = `marker: ${res.matchedMarker} -`;
        snippetEl.appendChild(markerHint);
      }
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
        snippetEl.appendChild(document.createTextNode(res.snippet || ''));
      }

      el.appendChild(metaRow);
      el.appendChild(snippetEl);

      el.addEventListener('click', async () => {
        await this.handleResultClick(res);
      });
      
      el.addEventListener('mouseenter', () => {
        this.setActiveIndex(index, false);
      });

      this.resultsContainer.appendChild(el);
      this.resultEls.push(el);
    });
    
    // Auto active first result
    this.setActiveIndex(0, false);
  }

  setActiveIndex(idx, scroll = false) {
    if (this.results.length === 0) return;
    if (idx < 0) idx = 0;
    if (idx >= this.results.length) idx = this.results.length - 1;
    
    if (this.activeIndex >= 0 && this.activeIndex < this.resultEls.length) {
      this.resultEls[this.activeIndex].classList.remove('is-active');
    }
    
    this.activeIndex = idx;
    const activeEl = this.resultEls[this.activeIndex];
    if (activeEl) {
      activeEl.classList.add('is-active');
      if (scroll) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  async handleResultClick(res) {
    // Keep open so users can test multiple results
    // this.close();
    
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
}
