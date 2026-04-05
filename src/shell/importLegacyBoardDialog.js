import { open } from '@tauri-apps/plugin-dialog';
import { preflightLegacyBoard, executeImport } from '../core/workspace/importLegacy.js';
import { workspaceManager } from '../core/workspace.js';

export class ImportLegacyBoardDialog {
  constructor(app) {
    this.app = app;
    this.container = null;
  }

  async startFlow() {
    try {
      // 1. Pick a folder
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: 'Select Legacy ORBit Board Folder'
      });

      if (!selectedPath) return; // cancelled

      // 2. Preflight
      const preflight = await preflightLegacyBoard(selectedPath);
      
      if (!preflight.valid) {
        this.showErrorDialog(selectedPath, preflight.errorMessage);
        return;
      }

      // 3. Show Form Dialog
      this.showImportForm(selectedPath, preflight);

    } catch(e) {
      console.error(e);
      this.showErrorDialog('Unknown', e.message || String(e));
    }
  }

  showErrorDialog(path, errorMsg) {
    alert(`Import Failed\n\nTarget: ${path}\n\nError: ${errorMsg}`);
  }

  showImportForm(sourcePath, preflight) {
    // Basic modal construction
    this.container = document.createElement('div');
    this.container.className = 'orbit-modal-overlay';
    this.container.style.position = 'fixed';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.right = '0';
    this.container.style.bottom = '0';
    this.container.style.backgroundColor = 'rgba(0,0,0,0.4)';
    this.container.style.zIndex = '10000';
    this.container.style.display = 'flex';
    this.container.style.alignItems = 'center';
    this.container.style.justifyContent = 'center';

    const dialog = document.createElement('div');
    dialog.style.backgroundColor = 'var(--bg-layer-0, #fff)';
    dialog.style.borderRadius = '8px';
    dialog.style.padding = '24px';
    dialog.style.width = '400px';
    dialog.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
    dialog.style.display = 'flex';
    dialog.style.flexDirection = 'column';
    dialog.style.gap = '16px';

    // Header
    const header = document.createElement('h2');
    header.textContent = 'Import Legacy Board';
    header.style.margin = '0';
    header.style.fontSize = '18px';
    header.style.fontWeight = '500';
    dialog.appendChild(header);

    // Source Info
    const sourceEl = document.createElement('div');
    sourceEl.style.fontSize = '11px';
    sourceEl.style.color = 'var(--color-text-muted, #777)';
    sourceEl.style.wordBreak = 'break-all';
    sourceEl.textContent = `Source: ${sourcePath}`;
    dialog.appendChild(sourceEl);

    // Warnings
    if (preflight.warningMessages && preflight.warningMessages.length > 0) {
      const warnBox = document.createElement('div');
      warnBox.style.backgroundColor = '#fffbeb';
      warnBox.style.color = '#b45309';
      warnBox.style.padding = '8px 12px';
      warnBox.style.borderRadius = '4px';
      warnBox.style.fontSize = '12px';
      warnBox.innerHTML = `<strong>Warnings:</strong><br/>` + preflight.warningMessages.join('<br/>');
      dialog.appendChild(warnBox);
    }

    // Title Input
    const titleGroup = document.createElement('div');
    titleGroup.style.display = 'flex';
    titleGroup.style.flexDirection = 'column';
    titleGroup.style.gap = '4px';
    const titleLabel = document.createElement('label');
    titleLabel.textContent = 'Title';
    titleLabel.style.fontSize = '12px';
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.value = preflight.titleCandidate || 'Imported Board';
    titleInput.style.padding = '8px';
    titleInput.style.border = '1px solid var(--border-color)';
    titleInput.style.borderRadius = '4px';
    titleGroup.appendChild(titleLabel);
    titleGroup.appendChild(titleInput);
    dialog.appendChild(titleGroup);

    // Topic Input
    const topicGroup = document.createElement('div');
    topicGroup.style.display = 'flex';
    topicGroup.style.flexDirection = 'column';
    topicGroup.style.gap = '4px';
    const topicLabel = document.createElement('label');
    topicLabel.textContent = 'Topic';
    topicLabel.style.fontSize = '12px';
    const topicInput = document.createElement('input');
    topicInput.type = 'text';
    topicInput.value = preflight.topicCandidate || '';
    topicInput.style.padding = '8px';
    topicInput.style.border = '1px solid var(--border-color)';
    topicInput.style.borderRadius = '4px';
    topicGroup.appendChild(topicLabel);
    topicGroup.appendChild(topicInput);
    dialog.appendChild(topicGroup);

    // Target Folder Select
    const folderGroup = document.createElement('div');
    folderGroup.style.display = 'flex';
    folderGroup.style.flexDirection = 'column';
    folderGroup.style.gap = '4px';
    const folderLabel = document.createElement('label');
    folderLabel.textContent = 'Target Folder';
    folderLabel.style.fontSize = '12px';
    const folderSelect = document.createElement('select');
    folderSelect.style.padding = '8px';
    folderSelect.style.border = '1px solid var(--border-color)';
    folderSelect.style.borderRadius = '4px';
    
    // Populate folders
    const folders = workspaceManager.manifest?.folders || [];
    // Ensure Inbox exists
    if (!folders.find(f => f.id === 'inbox')) {
      const inboxOpt = document.createElement('option');
      inboxOpt.value = 'inbox';
      inboxOpt.textContent = 'Inbox';
      folderSelect.appendChild(inboxOpt);
    }
    for (const f of folders) {
      if (f.id === 'trash') continue;
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.name;
      folderSelect.appendChild(opt);
    }
    folderSelect.value = 'inbox';

    folderGroup.appendChild(folderLabel);
    folderGroup.appendChild(folderSelect);
    dialog.appendChild(folderGroup);

    // Buttons
    const btnGroup = document.createElement('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.justifyContent = 'flex-end';
    btnGroup.style.gap = '12px';
    btnGroup.style.marginTop = '8px';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.padding = '8px 16px';
    cancelBtn.style.background = 'transparent';
    cancelBtn.style.border = 'none';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.color = 'var(--color-text-main)';

    const importBtn = document.createElement('button');
    importBtn.textContent = 'Import';
    importBtn.style.padding = '8px 16px';
    importBtn.style.background = 'var(--color-brand, #2563eb)';
    importBtn.style.color = '#fff';
    importBtn.style.border = 'none';
    importBtn.style.borderRadius = '4px';
    importBtn.style.cursor = 'pointer';

    btnGroup.appendChild(cancelBtn);
    btnGroup.appendChild(importBtn);
    dialog.appendChild(btnGroup);

    cancelBtn.addEventListener('click', () => {
      this.close();
    });

    importBtn.addEventListener('click', async () => {
      importBtn.disabled = true;
      importBtn.textContent = 'Importing...';
      try {
        const formData = {
          title: titleInput.value.trim() || 'Untitled',
          topic: topicInput.value.trim(),
          folderId: folderSelect.value
        };
        const newBoardId = await executeImport(sourcePath, formData);
        
        // Notify success
        if (this.app.shell && this.app.shell.toast) {
          this.app.shell.toast.show(`Imported legacy board successfully.`);
        }

        // Reload Explorer & open board
        if (this.app.shell && this.app.shell.explorer) {
          // The manifest is already updated in memory when we executed the import.
          this.app.shell.explorer.mount();
        }
        await this.app.loadNativeBoard(newBoardId);

        this.close();
      } catch (err) {
        console.error("Import execution failed:", err);
        alert(`Import Error: ${err.message}`);
        importBtn.disabled = false;
        importBtn.textContent = 'Import';
      }
    });

    this.container.appendChild(dialog);
    document.body.appendChild(this.container);
  }

  close() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
