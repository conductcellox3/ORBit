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
      const result = await workspaceManager.createBoard("New Native Board");
      await this.app.loadNativeBoard(result.id);
      await this.mount(); // Re-render tree
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
    
    // Re-highlight active item whenever state changes (if we had a subscription)
    // For now we just check during mount.
  }

  createTreeItem(board, iconText, isLegacy = false) {
      const itemEl = document.createElement('div');
      itemEl.className = 'mock-tree-item';
      
      const iconEl = document.createElement('span');
      iconEl.className = 'mock-icon';
      iconEl.textContent = iconText;
      
      const titleEl = document.createElement('span');
      titleEl.textContent = board.title || 'Untitled Board';
      titleEl.style.flex = "1";
      titleEl.style.overflow = "hidden";
      titleEl.style.whiteSpace = "nowrap";
      titleEl.style.textOverflow = "ellipsis";
      
      itemEl.appendChild(iconEl);
      itemEl.appendChild(titleEl);
      
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
                  this.app.state.notify();
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

        ContextMenu.show(e.clientX, e.clientY, [
          { label: 'Rename', disabled: isLegacy, onClick: handleRename },
          { label: 'Open Folder', disabled: false, onClick: handleOpenFolder },
          { label: 'Copy Path', disabled: false, onClick: handleCopyPath },
          { type: 'separator', disabled: false },
          { label: 'Delete', disabled: isLegacy, onClick: handleDelete }
        ]);
      });

      return itemEl;
  }

  highlightItem(container, targetEl) {
    container.querySelectorAll('.mock-tree-item').forEach(el => el.classList.remove('is-active'));
    targetEl.classList.add('is-active');
  }
}
