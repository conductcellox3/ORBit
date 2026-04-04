import { workspaceManager } from '../core/workspace.js';

export class PropertiesPanel {
  constructor(app) {
    this.app = app;
    this.bodyEl = document.getElementById('orbit-properties-body');
    this.tabEls = document.querySelectorAll('.orbit-panel-tab');
    
    this.activeTab = 'board';
    this.currentRenderedId = null; 
    this.currentRenderedTab = null;

    this.initTabs();

    this.app.selection.subscribe(() => {
      if (this.app.selection.selectedIds.size === 1) {
        this.switchTab('inspect', true);
      } else if (this.app.selection.selectedIds.size === 0) {
        this.switchTab('board', true);
      }
      this.fullRender();
    });

    this.app.state.subscribe(() => {
      this.softUpdate();
    });
  }

  initTabs() {
    this.tabEls.forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchTab(tab.dataset.target, false);
      });
    });
  }

  switchTab(target, auto = false) {
    if (this.activeTab === target) return;
    this.activeTab = target;
    this.tabEls.forEach(tab => {
      tab.classList.toggle('is-active', tab.dataset.target === target);
    });
    if (!auto) this.fullRender();
  }

  fullRender() {
    this.bodyEl.innerHTML = ''; // Wipe dirty state
    
    if (this.activeTab === 'board') {
      this.renderBoardMode();
      this.currentRenderedId = 'BOARD';
    } else {
      const ids = Array.from(this.app.selection.selectedIds);
      if (ids.length === 1) {
        this.renderInspectMode(ids[0], this.app.selection.type);
        this.currentRenderedId = ids[0];
      } else if (ids.length > 1) {
        this.bodyEl.innerHTML = '<div class="orbit-properties-empty">Multiple items selected.</div>';
        this.currentRenderedId = 'MULTI';
      } else {
        this.bodyEl.innerHTML = '<div class="orbit-properties-empty">No selection.</div>';
        this.currentRenderedId = 'NONE';
      }
    }
    this.currentRenderedTab = this.activeTab;
  }

  softUpdate() {
    // Only update visible values without destroying inputs/focus
    if (this.activeTab !== this.currentRenderedTab) {
       this.fullRender();
       return;
    }

    if (this.activeTab === 'board') {
      this.updateValueElement('board-title', this.app.state.title || 'Untitled Board');
      // Topic is in metadata now, but app.state doesn't have it natively. It's stored in workspaceManager.manifest.
      // We will handle it by reading from manifest.
    } else if (this.activeTab === 'inspect') {
      const ids = Array.from(this.app.selection.selectedIds);
      if (ids.length === 1) {
        const id = ids[0];
        if (this.currentRenderedId !== id) {
           this.fullRender();
           return;
        }
        let type = this.app.selection.type;
        const note = this.app.state.notes.get(id);
        const frame = this.app.state.frames.get(id);

        if (type === 'note' && note) {
          const isImage = note.type === 'image' || note.isImage;
          if (isImage) {
            this.updateValueElement('inspect-caption', note.caption || '');
            this.updateValueElement('inspect-size', `${Math.round(note.width || 0)} × ${Math.round(note.height || 0)}`);
          } else {
            this.updateValueElement('inspect-color', note.colorKey || 'default');
          }
        } else if (type === 'frame' && frame) {
          this.updateValueElement('inspect-title', frame.title || '');
          this.updateValueElement('inspect-color', frame.colorKey || 'default');
          this.updateValueElement('inspect-size', `${Math.round(frame.width || 0)} × ${Math.round(frame.height || 0)}`);
          this.updateValueElement('inspect-count', `${frame.childIds ? frame.childIds.length : 0} items`);
        }
      } else {
        if (this.currentRenderedId !== 'MULTI' && this.currentRenderedId !== 'NONE') {
           this.fullRender();
        }
      }
    }
  }

  updateValueElement(id, value) {
    const el = document.getElementById(`prop-${id}`);
    if (!el) return;
    
    // If it's an input and NOT currently focused, update its value.
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      if (document.activeElement !== el && el.value !== value) {
        el.value = value;
      }
    } else {
      if (el.textContent !== value) {
        el.textContent = value;
      }
    }
  }

  renderBoardMode() {
    const isLegacy = this.app.state.sourceType === 'legacy';
    
    const container = document.createElement('div');
    container.className = 'orbit-properties';

    // Type
    container.appendChild(this.createRow('Type', isLegacy ? 'Legacy Board (Read-only)' : 'Native Board'));

    // Title
    const titleRow = this.createEditRow('board-title', 'Title', this.app.state.title || '', isLegacy, (newVal) => {
      // Rename via workspaceManager to ensure filesystem rename
      if (isLegacy) return;
      
      const oldTitle = this.app.state.title;
      this.app.state.title = newVal; // Optimistic
      if (this.app.onTitleChanged) this.app.onTitleChanged(newVal);

      workspaceManager.renameBoard(this.app.state.boardId, newVal).then(success => {
        if (success) {
           this.app.notifyTabTitleChanged(this.app.state.boardId, 'native', newVal); // Usually requires an app-level helper
           // Instead of full save, renameBoard updates meta.json.
        } else {
           // Revert if failed
           this.app.state.title = oldTitle;
           if (this.app.onTitleChanged) this.app.onTitleChanged(oldTitle);
           this.softUpdate();
        }
      });
    });
    container.appendChild(titleRow);

    // Topic
    let currentTopic = '';
    if (this.app.state.boardId && workspaceManager.manifest) {
      const entry = workspaceManager.manifest.boards.find(b => b.id === this.app.state.boardId);
      if (entry) currentTopic = entry.topic || '';
    }
    
    const topicRow = this.createEditRow('board-topic', 'Topic', currentTopic, isLegacy, (newVal) => {
      if (isLegacy) return;
      if (this.app.state.boardId) {
        workspaceManager.updateBoardTopic(this.app.state.boardId, newVal).then(() => {
          this.softUpdate(); // Soft update after write
        });
      }
    });
    container.appendChild(topicRow);

    // Metadata
    if (this.app.state.boardId && workspaceManager.manifest) {
      const entry = workspaceManager.manifest.boards.find(b => b.id === this.app.state.boardId);
      if (entry) {
        container.appendChild(this.createRow('Created', new Date(entry.createdAt).toLocaleString()));
        container.appendChild(this.createRow('Updated', new Date(entry.updatedAt).toLocaleString()));
      }
    }

    if (!isLegacy) {
      const folderBtn = document.createElement('button');
      folderBtn.className = 'orbit-property-button';
      folderBtn.textContent = '📁 Open Folder';
      folderBtn.onclick = async () => {
        const boardPath = await workspaceManager.resolveBoardPath(this.app.state.boardId);
        if (boardPath) {
          const { revealItemInDir, openPath } = await import('@tauri-apps/plugin-opener');
          try {
            await revealItemInDir(boardPath);
          } catch (e) {
            console.warn("revealItemInDir failed, trying openPath...", e);
            await openPath(boardPath);
          }
        }
      };
      
      const actionRow = document.createElement('div');
      actionRow.className = 'orbit-properties-group no-label';
      actionRow.appendChild(folderBtn);
      container.appendChild(actionRow);
    }

    this.bodyEl.appendChild(container);
  }

  renderInspectMode(id, type) {
    const isLegacy = this.app.state.sourceType === 'legacy';
    const container = document.createElement('div');
    container.className = 'orbit-properties';

    const note = this.app.state.notes.get(id);
    const frame = this.app.state.frames.get(id);

    if (type === 'note' && note) {
      const isImage = note.type === 'image' || note.isImage;

      if (isImage) {
        container.appendChild(this.createRow('Type', 'Image Note'));
        
        const captionRow = this.createEditRow('inspect-caption', 'Caption', note.caption || '', isLegacy, (newVal) => {
          this.app.state.updateImageCaption(id, newVal);
          this.app.commitHistory();
        }, true); // force multi-line (or single line depends on UX, let's keep it input for now)
        container.appendChild(captionRow);

        container.appendChild(this.createRow('Size', `${Math.round(note.width || 0)} × ${Math.round(note.height || 0)}`, 'inspect-size'));
        container.appendChild(this.createRow('Source', note.src || 'Unknown', 'inspect-src'));

        const actionsConfig = document.createElement('div');
        actionsConfig.className = 'orbit-properties-group no-label wrap';

        const viewBtn = document.createElement('button');
        viewBtn.className = 'orbit-property-button primary';
        viewBtn.textContent = '🔍 Open Viewer';
        viewBtn.onclick = async () => {
           const url = await workspaceManager.resolveAssetUrl(this.app.state.boardId, note.src);
           if (url) {
             this.app.imageViewerSrc = url;
             this.app.imageViewer.open(note);
           }
        };
        actionsConfig.appendChild(viewBtn);

        if (!isLegacy) {
          const folderBtn = document.createElement('button');
          folderBtn.className = 'orbit-property-button';
          folderBtn.textContent = '📁 Reveal Asset';
          folderBtn.onclick = async () => {
            const absolutePath = await workspaceManager.getAbsoluteAssetPath(this.app.state.boardId, note.src);
            if (absolutePath) {
              const { revealItemInDir, openPath } = await import('@tauri-apps/plugin-opener');
              try {
                await revealItemInDir(absolutePath);
              } catch (err) {
                const folderPath = await workspaceManager.getAssetFolderPath(this.app.state.boardId);
                await openPath(folderPath);
              }
            }
          };
          actionsConfig.appendChild(folderBtn);
        }

        container.appendChild(actionsConfig);

      } else {
        container.appendChild(this.createRow('Type', 'Text Note'));
        
        // Colors
        const colorRow = this.createColorSelectRow('inspect-color', 'Color', note.colorKey || 'default', isLegacy, (newVal) => {
           this.app.state.setNoteColor(id, newVal);
           this.app.commitHistory();
        });
        container.appendChild(colorRow);

        // Markers (Read only for now)
        if (note.markers && note.markers.length > 0) {
           container.appendChild(this.createRow('Markers', note.markers.join(', ')));
        } else {
           container.appendChild(this.createRow('Markers', 'None'));
        }
      }

    } else if (type === 'frame' && frame) {
        container.appendChild(this.createRow('Type', 'Frame'));
        
        const titleRow = this.createEditRow('inspect-title', 'Title', frame.title || '', isLegacy, (newVal) => {
          this.app.state.renameFrame(id, newVal);
          this.app.commitHistory();
        });
        container.appendChild(titleRow);

        const colorRow = this.createColorSelectRow('inspect-color', 'Color', frame.colorKey || 'default', isLegacy, (newVal) => {
           this.app.state.setFrameColor(id, newVal);
           this.app.commitHistory();
        });
        container.appendChild(colorRow);

        container.appendChild(this.createRow('Size', `${Math.round(frame.width || 0)} × ${Math.round(frame.height || 0)}`, 'inspect-size'));
        container.appendChild(this.createRow('Items', `${frame.childIds ? frame.childIds.length : 0} items`, 'inspect-count'));
    }

    this.bodyEl.appendChild(container);
  }

  createRow(label, value, id = null) {
    const group = document.createElement('div');
    group.className = 'orbit-properties-group';
    
    const labelEl = document.createElement('div');
    labelEl.className = 'orbit-property-label';
    labelEl.textContent = label;

    const valEl = document.createElement('div');
    valEl.className = 'orbit-property-value';
    valEl.textContent = value;
    if (id) valEl.id = `prop-${id}`;

    group.appendChild(labelEl);
    group.appendChild(valEl);
    return group;
  }

  createEditRow(id, label, initialValue, isLegacy, onChange) {
    const group = document.createElement('div');
    group.className = 'orbit-properties-group';
    
    const labelEl = document.createElement('div');
    labelEl.className = 'orbit-property-label';
    labelEl.textContent = label;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'orbit-property-input';
    input.id = `prop-${id}`;
    input.value = initialValue;
    input.disabled = isLegacy;

    let isCommitted = false;
    const commit = () => {
      if (isCommitted) return;
      isCommitted = true;
      const newVal = input.value.trim();
      onChange(newVal);
    };

    input.addEventListener('blur', () => { 
        commit(); 
        isCommitted = false; // Reset for next edit exactly like inline
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        input.blur();
      } else if (e.key === 'Escape') {
        input.value = initialValue;
        input.blur();
      }
    });

    group.appendChild(labelEl);
    group.appendChild(input);
    return group;
  }

  createColorSelectRow(id, label, initialValue, isLegacy, onChange) {
    const group = document.createElement('div');
    group.className = 'orbit-properties-group';
    
    const labelEl = document.createElement('div');
    labelEl.className = 'orbit-property-label';
    labelEl.textContent = label;

    const select = document.createElement('select');
    select.className = 'orbit-property-select';
    select.id = `prop-${id}`;
    select.disabled = isLegacy;

    const colors = ['default', 'blue', 'cyan', 'green', 'yellow', 'red'];
    colors.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c.charAt(0).toUpperCase() + c.slice(1);
      if (initialValue === c || (initialValue === 'none' && c === 'default')) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });

    select.addEventListener('change', () => {
      onChange(select.value === 'default' ? 'none' : select.value);
    });

    group.appendChild(labelEl);
    group.appendChild(select);
    return group;
  }
}
