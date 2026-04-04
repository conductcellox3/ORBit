import { workspaceLoader } from '../legacy/workspaceLoader.js';
import { legacyAdapter } from '../legacy/boardAdapter.js';
import { workspaceManager } from '../core/workspace.js';
import { ContextMenu } from './contextMenu.js';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';

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
    
    treeContainer.innerHTML = ''; // clear completely
    
    // 1. Native Boards Section with "New Board" Icon
    const nativeHeaderContainer = document.createElement('div');
    nativeHeaderContainer.style.display = 'flex';
    nativeHeaderContainer.style.alignItems = 'center';
    nativeHeaderContainer.style.justifyContent = 'space-between';
    nativeHeaderContainer.style.margin = '12px 6px 4px 6px';

    const nativeHeader = document.createElement('div');
    nativeHeader.style.fontSize = '10px';
    nativeHeader.style.textTransform = 'uppercase';
    nativeHeader.style.color = 'var(--color-text-muted)';
    nativeHeader.textContent = 'Native Boards';
    nativeHeaderContainer.appendChild(nativeHeader);

    const newBoardBtn = document.createElement('div');
    newBoardBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="12" y1="18" x2="12" y2="12"></line>
      <line x1="9" y1="15" x2="15" y2="15"></line>
    </svg>`;
    newBoardBtn.style.cursor = 'pointer';
    newBoardBtn.style.color = 'var(--color-text-muted)';
    newBoardBtn.style.display = 'flex';
    newBoardBtn.style.alignItems = 'center';
    newBoardBtn.title = 'New Board';
    
    newBoardBtn.addEventListener('mouseenter', () => newBoardBtn.style.color = 'var(--color-text, #fff)');
    newBoardBtn.addEventListener('mouseleave', () => newBoardBtn.style.color = 'var(--color-text-muted)');
    
    newBoardBtn.addEventListener('click', async () => {
      if (document.getElementById('inline-board-create')) return;

      const creationContainer = document.createElement('div');
      creationContainer.id = 'inline-board-create';
      creationContainer.style.padding = '8px 16px';
      creationContainer.style.display = 'flex';
      creationContainer.style.flexDirection = 'column';
      creationContainer.style.gap = '4px';
      creationContainer.style.borderBottom = '1px solid var(--border-color)';
      creationContainer.style.background = 'rgba(0,0,0,0.02)';

      creationContainer.style.position = 'relative';

      const styleInput = (inp) => {
          inp.style.border = '1px solid var(--border-color)';
          inp.style.background = 'var(--bg-panel, #FFFFFF)';
          inp.style.color = 'var(--color-text-main, #202124)';
          inp.style.outline = 'none';
          inp.style.borderRadius = '3px';
          inp.style.padding = '4px 6px';
          inp.style.fontSize = '12px';
          inp.style.fontFamily = 'inherit';
          inp.style.width = '100%';
          inp.style.boxSizing = 'border-box';
      };

      const titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.placeholder = 'Board Title...';
      styleInput(titleInput);
      
      const topicInputContainer = document.createElement('div');
      topicInputContainer.style.position = 'relative';
      topicInputContainer.style.width = '100%';

      const topicInput = document.createElement('input');
      topicInput.type = 'text';
      topicInput.placeholder = 'Topic (optional)';
      styleInput(topicInput);
      topicInputContainer.appendChild(topicInput);
      
      const suggestionBox = document.createElement('div');
      suggestionBox.style.display = 'none';
      suggestionBox.style.position = 'absolute';
      suggestionBox.style.top = '100%';
      suggestionBox.style.left = '0';
      suggestionBox.style.width = '100%';
      suggestionBox.style.backgroundColor = 'var(--bg-panel, #FFFFFF)';
      suggestionBox.style.border = '1px solid var(--border-color)';
      suggestionBox.style.borderRadius = '3px';
      suggestionBox.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
      suggestionBox.style.zIndex = '1000';
      suggestionBox.style.maxHeight = '150px';
      suggestionBox.style.overflowY = 'auto';
      suggestionBox.style.marginTop = '2px';
      topicInputContainer.appendChild(suggestionBox);

      const topics = workspaceManager.getKnownBoardTopics();

      const renderSuggestions = (query) => {
        suggestionBox.innerHTML = '';
        const q = query.toLowerCase().trim();
        const matches = topics.filter(t => t.toLowerCase().includes(q));
        if (matches.length === 0) {
          suggestionBox.style.display = 'none';
          return;
        }
        
        matches.forEach(t => {
          const opt = document.createElement('div');
          opt.textContent = t;
          opt.style.padding = '4px 6px';
          opt.style.fontSize = '11px'; // Minial layout size
          opt.style.cursor = 'pointer';
          opt.style.color = 'var(--color-text-main)';
          opt.addEventListener('mouseenter', () => {
            opt.style.backgroundColor = 'var(--bg-hover, rgba(0,0,0,0.05))';
          });
          opt.addEventListener('mouseleave', () => {
             opt.style.backgroundColor = 'transparent';
          });
          opt.addEventListener('mousedown', (e) => {
            e.preventDefault(); 
            topicInput.value = t;
            suggestionBox.style.display = 'none';
            topicInput.focus();
          });
          suggestionBox.appendChild(opt);
        });
        suggestionBox.style.display = 'block';
      };

      topicInput.addEventListener('input', () => renderSuggestions(topicInput.value));
      topicInput.addEventListener('focus', () => renderSuggestions(topicInput.value));
      topicInput.addEventListener('blur', () => {
        setTimeout(() => { suggestionBox.style.display = 'none'; }, 100);
      });

      creationContainer.appendChild(titleInput);
      creationContainer.appendChild(topicInputContainer);

      treeContainer.insertBefore(creationContainer, nativeHeaderContainer.nextSibling);
      
      titleInput.focus();

      const cleanup = () => {
        if (creationContainer.parentNode) {
          creationContainer.parentNode.removeChild(creationContainer);
        }
      };

      const submit = async () => {
        const title = titleInput.value.trim();
        if (!title) return; // Block empty submission
        const topic = topicInput.value.trim();
        
        cleanup();
        
        const result = await workspaceManager.createBoard(title, topic);
        await this.app.loadNativeBoard(result.id);
        await this.mount(); // Re-render tree
      };

      const handleKey = (e) => {
        if (e.key === 'Escape') {
          cleanup();
          e.preventDefault();
        } else if (e.key === 'Enter') {
          if (e.isComposing) return; // Safe IME check
          // If suggestion box is open, optionally let enter select it if we had keyboard navigation
          // but for minimal implementation, enter just submits.
          submit();
          e.preventDefault();
        }
      };

      titleInput.addEventListener('keydown', handleKey);
      topicInput.addEventListener('keydown', handleKey);
      
      const handleBlur = (e) => {
        setTimeout(() => {
          if (document.activeElement !== titleInput && document.activeElement !== topicInput) {
            cleanup();
          }
        }, 150);
      };
      titleInput.addEventListener('blur', handleBlur);
      topicInput.addEventListener('blur', handleBlur);
    });
    nativeHeaderContainer.appendChild(newBoardBtn);
    treeContainer.appendChild(nativeHeaderContainer);

    const nativeManifest = workspaceManager.manifest;
    if (nativeManifest && nativeManifest.boards.length > 0) {
      for (const board of nativeManifest.boards) {
        const itemEl = this.createTreeItem(board, '📄', false);
        if (this.app.state.boardId === board.id) itemEl.classList.add('is-active');
        
        itemEl.addEventListener('click', async () => {
          await this.app.loadNativeBoard(board.id);
          this.highlightItem(treeContainer, itemEl);
        });
        treeContainer.appendChild(itemEl);
      }
    } else {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'mock-tree-item';
      emptyEl.style.opacity = '0.5';
      emptyEl.textContent = 'No native boards yet.';
      treeContainer.appendChild(emptyEl);
    }
    
    // 2. Legacy Boards Section
    const legacyHeader = document.createElement('div');
    legacyHeader.style.fontSize = '10px';
    legacyHeader.style.textTransform = 'uppercase';
    legacyHeader.style.color = 'var(--color-text-muted)';
    legacyHeader.style.margin = '16px 0 4px 6px';
    legacyHeader.textContent = 'Legacy Archive (Read-Only)';
    treeContainer.appendChild(legacyHeader);

    const legacyManifest = await workspaceLoader.loadManifest();
    
    if (!legacyManifest || !legacyManifest.boards || legacyManifest.boards.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'mock-tree-item';
      emptyEl.style.opacity = '0.5';
      emptyEl.textContent = 'No legacy boards found.';
      treeContainer.appendChild(emptyEl);
    } else {
      for (const board of legacyManifest.boards) {
        const itemEl = this.createTreeItem(board, '🗄️', true);
        if (this.app.state.boardId === board.id) itemEl.classList.add('is-active');
        
        itemEl.addEventListener('click', async () => {
          const legacyData = await workspaceLoader.loadBoardState(board.id, board.slug);
          if (legacyData) {
            const snapshot = legacyAdapter.adapt(board, legacyData.meta, legacyData.state);
            await this.app.loadLegacyBoard(snapshot);
            this.highlightItem(treeContainer, itemEl);
          }
        });
        treeContainer.appendChild(itemEl);
      }
    }
    
    // Re-highlight active item whenever state changes
    if (!this._boundOnBoardChanged) {
        const originalOnBoardChanged = this.app.onBoardChanged;
        this.app.onBoardChanged = (id) => {
          if (originalOnBoardChanged) originalOnBoardChanged(id);
          this.container.querySelectorAll('.mock-tree-item').forEach(el => {
            el.classList.toggle('is-active', el.dataset.id === id);
          });
        };
        this._boundOnBoardChanged = true;
    }
  }

  createTreeItem(board, iconText, isLegacy = false) {
      const itemEl = document.createElement('div');
      itemEl.className = 'mock-tree-item';
      itemEl.dataset.id = board.id;
      itemEl.style.alignItems = 'flex-start';
      itemEl.style.paddingTop = '6px';
      itemEl.style.paddingBottom = '6px';
      itemEl.style.gap = '6px';
      
      const iconEl = document.createElement('span');
      iconEl.className = 'mock-icon';
      iconEl.textContent = iconText;
      iconEl.style.marginTop = '2px';
      
      const contentContainer = document.createElement('div');
      contentContainer.style.display = 'flex';
      contentContainer.style.flexDirection = 'column';
      contentContainer.style.flex = '1';
      contentContainer.style.overflow = 'hidden';
      
      const titleEl = document.createElement('span');
      titleEl.textContent = board.title || 'Untitled Board';
      titleEl.style.whiteSpace = "nowrap";
      titleEl.style.overflow = "hidden";
      titleEl.style.textOverflow = "ellipsis";
      
      contentContainer.appendChild(titleEl);
      
      if (board.topic && board.topic.trim() !== '') {
        const topicEl = document.createElement('span');
        topicEl.textContent = board.topic;
        topicEl.style.fontSize = '11px';
        topicEl.style.color = 'var(--color-text-muted)';
        topicEl.style.whiteSpace = 'nowrap';
        topicEl.style.overflow = 'hidden';
        topicEl.style.textOverflow = 'ellipsis';
        topicEl.style.marginTop = '2px';
        contentContainer.appendChild(topicEl);
      }

      itemEl.appendChild(iconEl);
      itemEl.appendChild(contentContainer);

      itemEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();

        const handleRename = () => {
          const input = document.createElement('input');
          input.type = 'text';
          input.value = board.title;
          input.style.width = '100%';
          input.style.border = '1px solid #CBD5E1';
          input.style.background = '#FFFFFF';
          input.style.color = 'var(--color-text-main, #202124)';
          input.style.outline = 'none';
          input.style.borderRadius = '3px';
          input.style.padding = '0 4px';
          input.style.fontSize = 'inherit';
          input.style.fontFamily = 'inherit';
          input.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.05)';
          
          const commit = async () => {
            const newTitle = input.value.trim();
            if (newTitle && newTitle !== board.title) {
              await workspaceManager.renameBoard(board.id, newTitle);
              board.title = newTitle;
              titleEl.textContent = newTitle;
              
              if (this.app.state.boardId === board.id) {
                  this.app.state.title = newTitle;
                  if (this.app.onTitleChanged) this.app.onTitleChanged();
              } else {
                  if (this.app.notifyTabTitleChanged) {
                    this.app.notifyTabTitleChanged(board.id, isLegacy ? 'legacy' : 'native', newTitle);
                  }
              }
            } else {
               titleEl.textContent = board.title;
            }
          };
          
          input.addEventListener('blur', commit);
          input.addEventListener('keydown', (ke) => {
            if (ke.key === 'Enter') {
               input.blur();
            } else if (ke.key === 'Escape') {
               input.value = board.title; // Revert
               input.blur();
            }
          });
          
          titleEl.textContent = '';
          titleEl.appendChild(input);
          input.focus();
          input.select();
        };

        const resolvePathFn = isLegacy 
          ? () => workspaceLoader.resolveBoardPath(board.id, board.slug)
          : () => workspaceManager.resolveBoardPath(board.id);

        const handleCopyPath = async () => {
          try {
            const path = await resolvePathFn();
            await writeText(path);
          } catch (err) {
            console.error("Failed to copy path", err);
          }
        };

        const handleOpenFolder = async () => {
          try {
            const path = await resolvePathFn();
            await revealItemInDir(path);
          } catch (err) {
            console.error("Failed to open folder", err);
          }
        };

        const handleDelete = async () => {
             if (confirm(`Are you sure you want to delete "${board.title}"?\nThis cannot be undone.`)) {
                await workspaceManager.deleteBoard(board.id);
                if (this.app.state.boardId === board.id) {
                    await this.app.loadNativeBoard();
                }
                await this.mount();
             }
        };

        itemEl.classList.add('has-context-menu');
        
        ContextMenu.show(e.clientX, e.clientY, [
          { label: 'Rename', disabled: isLegacy, onClick: handleRename },
          { label: 'Open Folder', disabled: false, onClick: handleOpenFolder },
          { label: 'Copy Path', disabled: false, onClick: handleCopyPath },
          { type: 'separator', disabled: false },
          { label: 'Delete', disabled: isLegacy, onClick: handleDelete }
        ], () => {
          itemEl.classList.remove('has-context-menu');
        });

      });

      return itemEl;
  }

  highlightItem(container, targetEl) {
    container.querySelectorAll('.mock-tree-item').forEach(el => el.classList.remove('is-active'));
    targetEl.classList.add('is-active');
  }
}
