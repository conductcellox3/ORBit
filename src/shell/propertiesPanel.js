import { workspaceManager } from '../core/workspace.js';
import { BoardMarkdown } from '../core/export/boardMarkdown.js';

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
        if (!this.app.isGraphActive || !this.app.boardsGraph?.selectedGraphNodeId) {
          this.switchTab('board', true);
        }
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
      this.currentRenderedId = 'BOARD:' + this.app.state.boardId;
    } else if (this.activeTab === 'markdown') {
      this.renderMarkdownMode();
      this.currentRenderedId = 'MARKDOWN:' + this.app.state.boardId;
    } else {
      if (this.app.isGraphActive && this.app.boardsGraph?.selectedGraphNodeId) {
          const sid = this.app.boardsGraph.selectedGraphNodeId;
          this.renderGraphNodeInspect(sid);
          this.currentRenderedId = sid;
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
      if (this.currentRenderedId !== 'BOARD:' + this.app.state.boardId) {
         this.fullRender();
         return;
      }
      this.updateValueElement('board-title', this.app.state.title || 'Untitled Board');
      
      let currentTopic = '';
      if (this.app.state.boardId && workspaceManager.manifest) {
        const entry = workspaceManager.manifest.boards.find(b => b.id === this.app.state.boardId);
        if (entry) currentTopic = entry.topic || '';
      }
      this.updateValueElement('board-topic', currentTopic);
    } else if (this.activeTab === 'markdown') {
      if (this.currentRenderedId !== 'MARKDOWN:' + this.app.state.boardId) {
         this.fullRender();
         return;
      }
      // Debounce markdown generation
      if (this.mdDebounce) clearTimeout(this.mdDebounce);
      this.mdDebounce = setTimeout(() => {
          if (this.activeTab === 'markdown') this.renderMarkdownMode();
      }, 500);
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
            
            // Soft-update marker chips
            const activeMarkers = note.markers || [];
            const chips = this.bodyEl.querySelectorAll('.orbit-marker-chip');
            chips.forEach(chip => {
               const m = chip.dataset.marker;
               const isActive = activeMarkers.includes(m);
               chip.style.fontWeight = isActive ? '600' : 'normal';
               chip.style.background = isActive ? 'var(--color-text-main, #333)' : 'transparent';
               chip.style.color = isActive ? '#FFFFFF' : 'var(--color-text-main, #333)';
               chip.style.border = isActive ? '1px solid var(--color-text-main, #333)' : '1px solid var(--border-color)';
            });
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
    if (this.app.isGraphActive) {
      this.renderGraphControlsMode();
      return;
    }

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
          if (this.app.shell && this.app.shell.explorer) {
             this.app.shell.explorer.mount(); // Refresh explorer
          }
        });
      }
    }, false, () => workspaceManager.getKnownBoardTopics());
    container.appendChild(topicRow);

    // Metadata
    if (this.app.state.boardId && workspaceManager.manifest) {
      const entry = workspaceManager.manifest.boards.find(b => b.id === this.app.state.boardId);
      
      if (!isLegacy) {
        const folderRow = document.createElement('div');
        folderRow.className = 'orbit-properties-group';
        
        const fLabel = document.createElement('div');
        fLabel.className = 'orbit-properties-label';
        fLabel.textContent = 'Folder';
        
        const fVal = document.createElement('div');
        fVal.className = 'orbit-property-val';
        
        const fSelect = document.createElement('select');
        fSelect.style.width = '100%';
        fSelect.style.background = 'transparent';
        fSelect.style.border = '1px solid transparent';
        fSelect.style.color = 'var(--color-text-main)';
        fSelect.style.outline = 'none';
        fSelect.style.fontSize = 'inherit';
        fSelect.style.fontFamily = 'inherit';
        fSelect.style.cursor = 'pointer';
        
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = '📥 Inbox';
        fSelect.appendChild(defaultOpt);
        
        const folders = workspaceManager.getFolders();
        folders.sort((a, b) => a.name.localeCompare(b.name));
        folders.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.id;
            opt.textContent = `📁 ${f.name}`;
            fSelect.appendChild(opt);
        });
        
        fSelect.value = entry ? (entry.folderId || '') : '';
        
        fSelect.addEventListener('change', async () => {
          const selectedId = fSelect.value || null;
          if (this.app.state.boardId) {
             await workspaceManager.updateBoardFolder(this.app.state.boardId, selectedId);
             this.softUpdate();
             if (this.app.shell && this.app.shell.explorer) {
                 this.app.shell.explorer.mount(); // Refresh explorer dynamically
             }
          }
        });
        
        fVal.appendChild(fSelect);
        folderRow.appendChild(fLabel);
        folderRow.appendChild(fVal);
        container.appendChild(folderRow);
      }

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
    
    if (!isLegacy && this.app.state.boardId) {
       this.renderBoardRelations(container);
    }
  }

  renderBoardRelations(container) {
     const direct = workspaceManager.getBoardRelations(this.app.state.boardId, this.app.state.notes);
     
     const relHeader = document.createElement('div');
     relHeader.textContent = 'Directly Related Boards';
     relHeader.style.fontSize = '10px';
     relHeader.style.textTransform = 'uppercase';
     relHeader.style.color = 'var(--color-text-muted)';
     relHeader.style.margin = '20px 0 8px 0';
     container.appendChild(relHeader);
     
     if (direct.length === 0) {
        const empty = document.createElement('div');
        empty.textContent = 'No directly related boards';
        empty.style.fontSize = '11px';
        empty.style.color = 'var(--color-text-muted)';
        empty.style.fontStyle = 'italic';
        container.appendChild(empty);
     } else {
        const listContainer = document.createElement('div');
        listContainer.style.display = 'flex';
        listContainer.style.flexDirection = 'column';
        listContainer.style.gap = '6px';
        container.appendChild(listContainer);
        
        direct.forEach(d => {
           let desc = `${d.count} link${d.count > 1 ? 's' : ''}`;
           if (d.incoming > 0 && d.outgoing > 0) desc += ', Both';
           else if (d.incoming > 0) desc += ', Incoming';
           else if (d.outgoing > 0) desc += ', Outgoing';
           listContainer.appendChild(this.createRelationRow(d.boardId, d.title, desc));
        });
     }
     
     const twoHop = workspaceManager.getTwoHopRelations(this.app.state.boardId, direct);
     const hopHeader = document.createElement('div');
     hopHeader.textContent = 'Possibly Related (2-hop)';
     hopHeader.style.fontSize = '10px';
     hopHeader.style.textTransform = 'uppercase';
     hopHeader.style.color = 'var(--color-text-muted)';
     hopHeader.style.margin = '20px 0 8px 0';
     container.appendChild(hopHeader);
     
     if (twoHop.length === 0) {
        const empty = document.createElement('div');
        empty.textContent = 'No 2-hop suggestions';
        empty.style.fontSize = '11px';
        empty.style.color = 'var(--color-text-muted)';
        empty.style.fontStyle = 'italic';
        container.appendChild(empty);
     } else {
        const listContainer = document.createElement('div');
        listContainer.style.display = 'flex';
        listContainer.style.flexDirection = 'column';
        listContainer.style.gap = '6px';
        container.appendChild(listContainer);
        
        twoHop.slice(0, 5).forEach(c => {
           listContainer.appendChild(this.createRelationRow(c.boardId, c.title, `via ${c.via}`));
        });
     }
  }

   async renderMarkdownMode() {
      if (this.app.state.sourceType === 'legacy') {
          this.bodyEl.innerHTML = '<div class="orbit-properties-empty">Cannot export legacy boards to Markdown yet.</div>';
          return;
      }

      if (this.exportIncludeMeta === undefined) {
          this.exportIncludeMeta = true; // Default behavior
      }
      if (this.exportMode === undefined) {
          this.exportMode = 'spatial';
      }

      const { markdown } = BoardMarkdown.serialize(this.app.state, { includeMeta: this.exportIncludeMeta, mode: this.exportMode });
      this.bodyEl.innerHTML = '';

      const container = document.createElement('div');
      container.className = 'orbit-properties';
      
      const controlsRow = document.createElement('div');
      controlsRow.style.display = 'flex';
      controlsRow.style.flexDirection = 'column';
      controlsRow.style.gap = '8px';
      controlsRow.style.marginBottom = '12px';

      const exportBtn = document.createElement('button');
      exportBtn.className = 'orbit-property-button orbit-primary';
      exportBtn.textContent = 'Save as .md...';

      const metaToggleRow = document.createElement('div');
      metaToggleRow.style.display = 'flex';
      metaToggleRow.style.alignItems = 'center';
      metaToggleRow.style.gap = '6px';
      
      const metaCheck = document.createElement('input');
      metaCheck.type = 'checkbox';
      metaCheck.checked = this.exportIncludeMeta;
      metaCheck.id = 'export-meta-toggle';
      metaCheck.style.cursor = 'pointer';
      
      const metaLabel = document.createElement('label');
      metaLabel.htmlFor = 'export-meta-toggle';
      metaLabel.textContent = 'Include Orbit Meta Comments';
      metaLabel.style.fontSize = '11px';
      metaLabel.style.color = 'var(--color-text-main)';
      metaLabel.style.cursor = 'pointer';
      
      metaCheck.onchange = (e) => {
          this.exportIncludeMeta = e.target.checked;
          this.renderMarkdownMode(); // Re-render immediately
      };
      
      metaToggleRow.appendChild(metaCheck);
      metaToggleRow.appendChild(metaLabel);

      const modeToggleRow = document.createElement('div');
      modeToggleRow.style.display = 'flex';
      modeToggleRow.style.alignItems = 'center';
      modeToggleRow.style.gap = '16px';
      modeToggleRow.style.fontSize = '11px';
      modeToggleRow.style.color = 'var(--color-text-main)';

      const createRadio = (val, labelStr) => {
          const label = document.createElement('label');
          label.style.display = 'flex';
          label.style.alignItems = 'center';
          label.style.gap = '4px';
          label.style.cursor = 'pointer';
          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = 'md-export-mode';
          radio.value = val;
          radio.checked = this.exportMode === val;
          radio.onchange = (e) => {
              if (e.target.checked) {
                  this.exportMode = val;
                  this.renderMarkdownMode();
              }
          };
          label.appendChild(radio);
          label.appendChild(document.createTextNode(labelStr));
          return label;
      };

      modeToggleRow.appendChild(createRadio('spatial', 'Spatial Mode'));
      modeToggleRow.appendChild(createRadio('flow', 'Flow Mode'));

      controlsRow.appendChild(exportBtn);
      controlsRow.appendChild(modeToggleRow);
      controlsRow.appendChild(metaToggleRow);

      exportBtn.onclick = async () => {
         const { save } = await import('@tauri-apps/plugin-dialog');
         const { writeTextFile, mkdir, copyFile } = await import('@tauri-apps/plugin-fs');
         const { dirname, join } = await import('@tauri-apps/api/path');

         const safeTitle = (this.app.state.title || this.app.state.slug || 'board').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
         const defaultFilename = safeTitle + '.md';
         const filepath = await save({
            defaultPath: defaultFilename,
            filters: [{ name: 'Markdown Document', extensions: ['md'] }]
         });

         if (filepath) {
            try {
               await writeTextFile(filepath, markdown);
            } catch (err) {
               console.error("Export failure:", err);
            }
         }
      };

      container.appendChild(controlsRow);

      const preview = document.createElement('pre');
      preview.style.background = 'var(--bg-layer-1)';
      preview.style.border = '1px solid var(--border-color)';
      preview.style.borderRadius = '4px';
      preview.style.padding = '8px';
      preview.style.whiteSpace = 'pre-wrap';
      preview.style.fontSize = '11px';
      preview.style.color = 'var(--color-text-main)';
      preview.style.flex = '1';
      container.style.height = '100%';
      preview.style.overflowY = 'auto';
      preview.textContent = markdown;

      container.appendChild(preview);
      this.bodyEl.appendChild(container);
   }

   createRelationRow(targetBoardId, title, desc) {
     const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.padding = '6px 8px';
    row.style.background = 'var(--bg-layer-1)';
    row.style.borderRadius = '4px';
    row.style.border = '1px solid var(--border-color)';

    const info = document.createElement('div');
    info.style.display = 'flex';
    info.style.flexDirection = 'column';
    info.style.overflow = 'hidden';

    const titleEl = document.createElement('span');
    titleEl.textContent = title;
    titleEl.style.fontSize = '12px';
    titleEl.style.color = 'var(--color-text-main)';
    titleEl.style.whiteSpace = 'nowrap';
    titleEl.style.overflow = 'hidden';
    titleEl.style.textOverflow = 'ellipsis';

    const descEl = document.createElement('span');
    descEl.textContent = desc;
    descEl.style.fontSize = '10px';
    descEl.style.color = 'var(--color-text-muted)';
    descEl.style.marginTop = '2px';

    info.appendChild(titleEl);
    info.appendChild(descEl);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '4px';

    const btnStyle = "padding: 2px 6px; font-size: 10px; border-radius: 3px; cursor: pointer; border: 1px solid var(--border-color); background: transparent; color: var(--color-text-main); white-space: nowrap;";

    const peekBtn = document.createElement('button');
    peekBtn.textContent = 'Peek';
    peekBtn.style.cssText = btnStyle;
    peekBtn.title = "Briefly inspect this board temporarily";
    peekBtn.addEventListener('mouseenter', () => peekBtn.style.background = 'var(--bg-hover)');
    peekBtn.addEventListener('mouseleave', () => peekBtn.style.background = 'transparent');
    peekBtn.onclick = () => {
      if (this.app.peekBoard) this.app.peekBoard(targetBoardId);
    };

    const openBtn = document.createElement('button');
    openBtn.textContent = '↗ Open';
    openBtn.style.cssText = btnStyle;
    openBtn.title = "Open this board normally";
    openBtn.addEventListener('mouseenter', () => openBtn.style.background = 'var(--bg-hover)');
    openBtn.addEventListener('mouseleave', () => openBtn.style.background = 'transparent');
    openBtn.onclick = () => {
      // Normal open cancels peek inside loadNativeBoard dynamically, but safe to just load
      if (this.app.loadNativeBoard) this.app.loadNativeBoard(targetBoardId);
    };

    actions.appendChild(peekBtn);
    actions.appendChild(openBtn);

    row.appendChild(info);
    row.appendChild(actions);

    return row;
  }

  renderInspectMode(id, type) {
    if (this.app.isGraphActive && type === 'graph-node') {
       this.renderGraphNodeInspect(id);
       return;
    }
    
    const isLegacy = this.app.state.sourceType === 'legacy';
    const container = document.createElement('div');
    container.className = 'orbit-properties';

    const note = this.app.state.notes.get(id);
    const frame = this.app.state.frames.get(id);

    if (type === 'note' && note) {
      if (note.type === 'linked-note') {
        container.appendChild(this.createRow('Type', 'Linked Note (Read-only)'));
        container.appendChild(this.createRow('Source Board', note.linkMeta?.sourceBoardTitle || 'Unknown'));
        container.appendChild(this.createRow('Snapshot', note.snapshot?.kind === 'image' ? 'Image' : 'Text'));
        
        let dStr = 'Unknown';
        if (note.linkMeta?.cachedAt) {
           dStr = new Date(note.linkMeta.cachedAt).toLocaleString();
        }
        container.appendChild(this.createRow('Cached', dStr));

        if (note.hasUpdateAvailable) {
           const updateRow = this.createRow('Status', '★ Update Available');
           const valEl = updateRow.querySelector('.orbit-property-val');
           if (valEl) {
               valEl.style.color = 'var(--accent-color, #3b82f6)';
               valEl.style.fontWeight = 'bold';
               valEl.title = 'Right-click the note on the canvas to Refresh from Source.';
           }
           container.appendChild(updateRow);
        }

        const actionsConfig = document.createElement('div');
        actionsConfig.className = 'orbit-properties-group no-label wrap';

        const openBtn = document.createElement('button');
        openBtn.className = 'orbit-property-button primary';
        openBtn.textContent = '↗ Open Source Note';
        openBtn.onclick = () => {
          if (note.sourceRef && window.app) {
            window.app.jumpToBoardNote(note.sourceRef.boardId, note.sourceRef.noteId);
          }
        };
        actionsConfig.appendChild(openBtn);
        container.appendChild(actionsConfig);

      } else if (note.type === 'image' || note.isImage) {
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

        if (note.type !== 'calc') {
          if (isLegacy) {
            // Markers (Read only for now)
            if (note.markers && note.markers.length > 0) {
               container.appendChild(this.createRow('Markers', note.markers.join(', ')));
            } else {
               container.appendChild(this.createRow('Markers', 'None'));
            }
          } else {
            const markerSet = ['action', 'question', 'decision', 'risk', 'reference'];
            const markerContainer = document.createElement('div');
            markerContainer.className = 'orbit-properties-group no-label';
            
            const label = document.createElement('div');
            label.textContent = 'Markers';
            label.style.fontSize = '10px';
            label.style.color = 'var(--color-text-muted)';
            label.style.marginBottom = '6px';
            label.style.textTransform = 'uppercase';
            markerContainer.appendChild(label);

            const chipsContainer = document.createElement('div');
            chipsContainer.style.display = 'flex';
            chipsContainer.style.flexWrap = 'wrap';
            chipsContainer.style.gap = '4px';

            const activeMarkers = note.markers || [];

            markerSet.forEach(m => {
               const chip = document.createElement('button');
               chip.className = 'orbit-property-button orbit-marker-chip'; 
               chip.dataset.marker = m;
               const isActive = activeMarkers.includes(m);
               
               chip.style.padding = '3px 8px';
               chip.style.borderRadius = '12px';
               chip.style.textTransform = 'capitalize';
               chip.style.fontWeight = isActive ? '600' : 'normal';
               chip.style.background = isActive ? 'var(--color-text-main, #333)' : 'transparent';
               chip.style.color = isActive ? '#FFFFFF' : 'var(--color-text-main, #333)';
               chip.style.border = isActive ? '1px solid var(--color-text-main, #333)' : '1px solid var(--border-color)';
               
               chip.textContent = m;
               
               chip.onclick = () => {
                  this.app.state.toggleNoteMarker(id, m);
                  this.app.commitHistory();
                  this.softUpdate();
               };
               
               chipsContainer.appendChild(chip);
            });
            
            markerContainer.appendChild(chipsContainer);
            container.appendChild(markerContainer);
          }
        }

        // -----------------------------
        // Cross-Board References
        // -----------------------------
        // Wait! Let's just remove it from here.
      }
      
      // Now, apply Cross-Board References for all non-linked-note types
      if (note.type !== 'linked-note') {
        const refs = workspaceManager.getNoteReferences(this.app.state.boardId, id);
        
        const refsGroup = document.createElement('div');
        refsGroup.className = 'orbit-properties-group no-label';
        refsGroup.style.marginTop = '16px';
        refsGroup.style.paddingTop = '16px';
        refsGroup.style.borderTop = '1px solid var(--border-color)';
        
        const refsLabel = document.createElement('div');
        refsLabel.textContent = 'Referenced By';
        refsLabel.style.fontSize = '10px';
        refsLabel.style.color = 'var(--color-text-muted)';
        refsLabel.style.marginBottom = '8px';
        refsLabel.style.textTransform = 'uppercase';
        refsGroup.appendChild(refsLabel);

        if (refs && refs.length > 0) {
          // Stable sort
          const sortedRefs = [...refs].sort((a, b) => {
            const ta = a.boardTitle || '';
            const tb = b.boardTitle || '';
            return ta.localeCompare(tb);
          });
          
          const listCont = document.createElement('div');
          listCont.style.display = 'flex';
          listCont.style.flexDirection = 'column';
          listCont.style.gap = '6px';
          
          for (const ref of sortedRefs) {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.justifyContent = 'space-between';
            row.style.padding = '4px 8px';
            row.style.background = 'var(--bg-layer-1)';
            row.style.borderRadius = '4px';
            row.style.border = '1px solid var(--border-color)';
            
            const info = document.createElement('div');
            info.style.display = 'flex';
            info.style.alignItems = 'center';
            info.style.gap = '6px';
            info.style.overflow = 'hidden';
            
            const icon = document.createElement('span');
            icon.textContent = ref.snapshotKind === 'image' ? '🖼️' : '📄';
            icon.style.fontSize = '12px';
            
            const title = document.createElement('span');
            title.textContent = ref.boardTitle || 'Unknown';
            title.style.fontSize = '11px';
            title.style.whiteSpace = 'nowrap';
            title.style.overflow = 'hidden';
            title.style.textOverflow = 'ellipsis';
            
            info.appendChild(icon);
            info.appendChild(title);
            
            const jmpBtn = document.createElement('button');
            jmpBtn.className = 'orbit-property-button';
            jmpBtn.style.padding = '2px 6px';
            jmpBtn.style.fontSize = '10px';
            jmpBtn.textContent = '↗ Jump';
            jmpBtn.onclick = () => {
              if (window.app) window.app.jumpToBoardNote(ref.boardId, ref.noteId);
            };
            
            row.appendChild(info);
            row.appendChild(jmpBtn);
            listCont.appendChild(row);
          }
          refsGroup.appendChild(listCont);
        } else {
          const emptySt = document.createElement('div');
          emptySt.textContent = 'No cross-board references';
          emptySt.style.fontSize = '11px';
          emptySt.style.color = 'var(--color-text-muted)';
          emptySt.style.fontStyle = 'italic';
          refsGroup.appendChild(emptySt);
        }
        
        container.appendChild(refsGroup);
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

  createEditRow(id, label, initialValue, isLegacy, onChange, isMultiLine = false, getSuggestions = null) {
    const group = document.createElement('div');
    group.className = 'orbit-properties-group';
    
    // For suggestions we need position relative
    if (getSuggestions) {
      group.style.position = 'relative';
      group.style.overflow = 'visible'; // allow dropdown to break out
    }
    
    const labelEl = document.createElement('div');
    labelEl.className = 'orbit-property-label';
    labelEl.textContent = label;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'orbit-property-input';
    input.id = `prop-${id}`;
    input.autocomplete = 'off'; // prevent native autocomplete
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
        // Delay commit slightly so suggestion clicks can fire
        setTimeout(() => {
          commit(); 
          isCommitted = false; // Reset for next edit exactly like inline
          if (suggestionBox) suggestionBox.style.display = 'none';
        }, 150);
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
    
    const inputWrapper = document.createElement('div');
    inputWrapper.style.position = 'relative';
    inputWrapper.style.width = '100%';
    inputWrapper.style.flex = '2';
    inputWrapper.appendChild(input);

    let suggestionBox = null;
    if (getSuggestions && !isLegacy) {
      suggestionBox = document.createElement('div');
      suggestionBox.style.display = 'none';
      suggestionBox.style.position = 'absolute';
      suggestionBox.style.top = '100%';
      suggestionBox.style.left = '0';
      suggestionBox.style.width = '100%';
      suggestionBox.style.background = 'var(--bg-panel, #FFFFFF)';
      suggestionBox.style.border = '1px solid var(--border-color)';
      suggestionBox.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
      suggestionBox.style.zIndex = '1000';
      suggestionBox.style.maxHeight = '150px';
      suggestionBox.style.overflowY = 'auto';
      suggestionBox.style.borderRadius = '0 0 4px 4px';
      
      const renderSuggestions = () => {
         const topics = getSuggestions();
         suggestionBox.innerHTML = '';
         const q = input.value.toLowerCase().trim();
         const matches = topics.filter(t => t.toLowerCase().includes(q));
         if (matches.length === 0) {
           suggestionBox.style.display = 'none';
           return;
         }
         matches.forEach(t => {
           const opt = document.createElement('div');
           opt.textContent = t;
           opt.style.padding = '4px 6px';
           opt.style.fontSize = '11px';
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
             input.value = t;
             commit();
             suggestionBox.style.display = 'none';
             input.blur();
           });
           suggestionBox.appendChild(opt);
         });
         suggestionBox.style.display = 'block';
      };
      
      input.addEventListener('input', renderSuggestions);
      input.addEventListener('focus', renderSuggestions);
      
      inputWrapper.appendChild(suggestionBox);
      
      // Override group flex behavior for wrapper
      group.style.alignItems = 'flex-start';
      labelEl.style.marginTop = '6px';
    }

    group.appendChild(inputWrapper);
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

  renderGraphControlsMode() {
      const container = document.createElement('div');
      container.className = 'orbit-properties';
      
      const graph = this.app.boardsGraph;
      if (!graph) return;

      container.innerHTML = `
        <div class="orbit-properties-group">
          <label>LAYOUT MODE</label>
          <select id="graph-layout-select" class="orbit-select orbit-full-width" style="margin-top:4px;">
            <option value="force" ${graph.currentLayout === 'force' ? 'selected' : ''}>Relation (Force)</option>
            <option value="topic" ${graph.currentLayout === 'topic' ? 'selected' : ''}>Topic Grouped</option>
            <option value="timeline" ${graph.currentLayout === 'timeline' ? 'selected' : ''}>Timeline</option>
          </select>
        </div>
        <div class="orbit-properties-group">
          <label>FILTER BY TEXT</label>
          <input type="text" id="graph-text-filter" class="orbit-input orbit-full-width" placeholder="Title/topic..." style="margin-top:4px;" value="${graph.textFilter || ''}" />
        </div>
        <div class="orbit-properties-group" style="display:flex; justify-content:space-between; align-items:center; margin-top:12px;">
          <label style="margin:0;">HIDE ISOLATED BOARDS</label>
          <input type="checkbox" id="graph-isolate-check" ${graph.hideIsolated ? 'checked' : ''} />
        </div>
        <div class="orbit-properties-group" style="margin-top:12px;">
          <label>FILTER BY DATE (START - END)</label>
          <div style="display:flex; gap: 4px; margin-top:4px;">
             <input type="month" id="graph-start-date" value="${graph.startDate || ''}" style="width:50%;" />
             <input type="month" id="graph-end-date" value="${graph.endDate || ''}" style="width:50%;" />
          </div>
        </div>
        <div class="orbit-properties-group" style="margin-top:12px;">
          <label>MIN LINK STRENGTH</label>
          <input type="range" id="graph-min-strength" min="1" max="10" value="${graph.minStrength}" style="width:100%; margin-top:4px;" />
          <div id="graph-str-val" style="text-align:right; font-size:10px; color:var(--text-muted);">${graph.minStrength} links minimum</div>
        </div>
        <div class="orbit-properties-group" style="margin-top:20px;">
          <button id="graph-fit-btn" class="orbit-property-button orbit-full-width">Fit to View</button>
        </div>
      `;

      this.bodyEl.appendChild(container);

      document.getElementById('graph-layout-select').addEventListener('change', (e) => {
          graph.currentLayout = e.target.value;
          graph.triggerLayoutUpdate();
      });
      document.getElementById('graph-text-filter').addEventListener('input', (e) => {
          graph.textFilter = e.target.value;
          graph.triggerLayoutUpdate();
      });
      document.getElementById('graph-isolate-check').addEventListener('change', (e) => {
          graph.hideIsolated = e.target.checked;
          graph.triggerLayoutUpdate();
      });
      document.getElementById('graph-start-date').addEventListener('change', (e) => {
          graph.startDate = e.target.value;
          graph.triggerLayoutUpdate();
      });
      document.getElementById('graph-end-date').addEventListener('change', (e) => {
          graph.endDate = e.target.value;
          graph.triggerLayoutUpdate();
      });
      document.getElementById('graph-min-strength').addEventListener('input', (e) => {
          graph.minStrength = parseInt(e.target.value, 10);
          document.getElementById('graph-str-val').textContent = `${graph.minStrength} links minimum`;
          graph.triggerLayoutUpdate();
      });
      document.getElementById('graph-fit-btn').addEventListener('click', () => {
          graph.fitToView();
      });
  }

  renderGraphNodeInspect(id) {
    const node = this.app.boardsGraph?.nodes.find(n => n.id === id);
    if (!node) {
        this.bodyEl.innerHTML = '<div class="orbit-properties-empty">No board selected</div>';
        return;
    }

    const container = document.createElement('div');
    container.className = 'orbit-properties';

    container.appendChild(this.createRow('Type', 'Board Node'));
    container.appendChild(this.createRow('Title', node.title));
    container.appendChild(this.createRow('Topic', node.topic));
    container.appendChild(this.createRow('Created', new Date(node.createdAt).toLocaleString()));
    
    // Detailed local relations
    const edges = this.app.boardsGraph?.visibleEdges || [];
    let visibleIn = 0;
    let visibleOut = 0;
    let visibleLinks = 0;

    for (const e of edges) {
        if (e.target.id === id) {
             visibleIn += e.weight;
             visibleLinks++;
        }
        if (e.source.id === id) {
             visibleOut += e.weight;
             visibleLinks++;
        }
    }
    
    container.appendChild(this.createRow('Local Links', `${visibleLinks} visible connections`));
    container.appendChild(this.createRow('Local Activity', `${visibleIn} In / ${visibleOut} Out weight`));
    container.appendChild(this.createRow('Global Flow', `${node.totalWeight} global weight`));

    // Actions
    const actionRow = document.createElement('div');
    actionRow.className = 'orbit-properties-group no-label';
    actionRow.style.display = 'flex';
    actionRow.style.gap = '8px';
    actionRow.style.marginTop = '16px';
    
    const peekBtn = document.createElement('button');
    peekBtn.className = 'orbit-property-button';
    peekBtn.style.flex = '1';
    peekBtn.textContent = 'Peek';
    peekBtn.onclick = () => {
       if (this.app.peekBoard) this.app.peekBoard(id);
    };

    const openBtn = document.createElement('button');
    openBtn.className = 'orbit-property-button';
    openBtn.style.flex = '1';
    openBtn.textContent = '↗ Open';
    openBtn.onclick = () => {
       if (this.app.loadNativeBoard) this.app.loadNativeBoard(id);
    };

    actionRow.appendChild(peekBtn);
    actionRow.appendChild(openBtn);
    container.appendChild(actionRow);

    this.bodyEl.appendChild(container);
  }
}
