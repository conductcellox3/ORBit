import { appSettings } from '../core/settings.js';
import { ImportLegacyBoardDialog } from './importLegacyBoardDialog.js';
import { workspaceManager } from '../core/workspace.js';

export class SettingsPanel {
    constructor(app, elementId) {
        this.app = app;
        this.element = document.getElementById(elementId) || this.createContainer();
        this.isOpen = false;
        
        this.render();
        
        // Close when clicking outside
        document.addEventListener('mousedown', (e) => {
            if (this.isOpen && !this.element.contains(e.target) && e.target.closest('.utility-button') === null) {
                this.close();
            }
        });
    }
    
    createContainer() {
        const div = document.createElement('div');
        div.id = 'settings-panel';
        div.classList.add('orbit-popover');
        div.style.position = 'absolute';
        div.style.top = '48px';
        div.style.right = '40px'; 
        div.style.width = '240px';
        div.style.backgroundColor = 'var(--color-app-bg, var(--bg-layer-0, #ffffff))';
        div.style.border = '1px solid var(--border-color)';
        div.style.borderRadius = '8px';
        div.style.boxShadow = '0 6px 16px rgba(0,0,0,0.15)';
        div.style.display = 'none';
        div.style.zIndex = '9000';
        document.getElementById('shell-container').appendChild(div);
        return div;
    }

    render() {
        this.element.innerHTML = '';
        
        const header = document.createElement('div');
        header.style.padding = '12px 16px';
        header.style.borderBottom = '1px solid var(--border-color)';
        header.style.fontWeight = '500';
        header.style.fontSize = '12px';
        header.style.color = 'var(--color-text-main)';
        header.textContent = 'Settings';
        this.element.appendChild(header);

        const body = document.createElement('div');
        body.style.padding = '16px';
        body.style.display = 'flex';
        body.style.flexDirection = 'column';
        body.style.gap = '16px';
        
        // Legacy Archive Toggle
        const legacyRow = document.createElement('div');
        legacyRow.style.display = 'flex';
        legacyRow.style.alignItems = 'flex-start';
        legacyRow.style.gap = '10px';
        
        const toggleCheckbox = document.createElement('input');
        toggleCheckbox.type = 'checkbox';
        toggleCheckbox.id = 'toggle-legacy-archive';
        toggleCheckbox.checked = appSettings.getShowLegacyArchive();
        toggleCheckbox.style.marginTop = '2px';
        toggleCheckbox.style.cursor = 'pointer';

        const labelContainer = document.createElement('div');
        labelContainer.style.display = 'flex';
        labelContainer.style.flexDirection = 'column';
        labelContainer.style.gap = '2px';

        const labelText = document.createElement('label');
        labelText.htmlFor = 'toggle-legacy-archive';
        labelText.textContent = 'Show Legacy Archive in Explorer';
        labelText.style.fontSize = '12px';
        labelText.style.color = 'var(--color-text-main)';
        labelText.style.cursor = 'pointer';

        const subText = document.createElement('div');
        subText.textContent = 'Reveals legacy boards (Read-only)';
        subText.style.fontSize = '10px';
        subText.style.color = 'var(--color-text-muted)';
        
        labelContainer.appendChild(labelText);
        labelContainer.appendChild(subText);
        
        legacyRow.appendChild(toggleCheckbox);
        legacyRow.appendChild(labelContainer);
        
        toggleCheckbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            appSettings.setShowLegacyArchive(isChecked);
            if (this.app.shell && this.app.shell.explorer) {
                this.app.shell.explorer.mount(); // Re-render Explorer immediately
            }
        });
        
        body.appendChild(legacyRow);

        // Daily Workflow Section
        const dailyHeader = document.createElement('div');
        dailyHeader.style.marginTop = '8px';
        dailyHeader.style.paddingTop = '16px';
        dailyHeader.style.borderTop = '1px solid var(--border-color)';
        dailyHeader.style.fontWeight = '500';
        dailyHeader.style.fontSize = '12px';
        dailyHeader.style.color = 'var(--color-text-main)';
        dailyHeader.textContent = 'Daily Workflow';
        body.appendChild(dailyHeader);

        const createSelectRow = (labelStr, getter, setter) => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.flexDirection = 'column';
            row.style.gap = '4px';

            const label = document.createElement('label');
            label.textContent = labelStr;
            label.style.fontSize = '12px';
            label.style.color = 'var(--color-text-main)';

            const select = document.createElement('select');
            select.style.padding = '4px';
            select.style.fontSize = '12px';
            select.style.borderRadius = '4px';
            select.style.border = '1px solid var(--border-color)';
            select.style.backgroundColor = 'var(--bg-layer-1, #f9f9f9)';
            select.style.color = 'var(--color-text-main)';
            select.style.outline = 'none';

            const buildOptions = () => {
                const folders = workspaceManager.getFolders();

                let html = `<option value="">-- Unset --</option>`;
                const currentId = getter();
                let isStale = currentId ? true : false;

                folders.forEach(f => {
                    if (f.id === currentId) isStale = false;
                    html += `<option value="${f.id}" ${f.id === currentId ? 'selected' : ''}>${f.name}</option>`;
                });

                if (isStale) {
                    html += `<option value="${currentId}" selected style="color:#d9534f;">Missing Folder (Needs Reset)</option>`;
                }
                select.innerHTML = html;
            };

            buildOptions();

            select.addEventListener('change', (e) => {
                setter(e.target.value);
            });

            row.appendChild(label);
            row.appendChild(select);
            return { row, select, buildOptions };
        };

        const dailyCfg = createSelectRow('Daily Board Folder', appSettings.getDailyFolderId, appSettings.setDailyFolderId);
        const weeklyCfg = createSelectRow('Weekly Board Folder', appSettings.getWeeklyFolderId, appSettings.setWeeklyFolderId);

        body.appendChild(dailyCfg.row);
        body.appendChild(weeklyCfg.row);
        this._selects = [dailyCfg, weeklyCfg];

        // Editor Features Section
        const editorHeader = document.createElement('div');
        editorHeader.style.marginTop = '16px';
        editorHeader.style.paddingTop = '16px';
        editorHeader.style.borderTop = '1px solid var(--border-color)';
        editorHeader.style.fontWeight = '500';
        editorHeader.style.fontSize = '12px';
        editorHeader.style.color = 'var(--color-text-main)';
        editorHeader.textContent = 'Editor Features';
        body.appendChild(editorHeader);

        const emacsRow = document.createElement('div');
        emacsRow.style.display = 'flex';
        emacsRow.style.alignItems = 'flex-start';
        emacsRow.style.gap = '10px';
        
        const emacsCheckbox = document.createElement('input');
        emacsCheckbox.type = 'checkbox';
        emacsCheckbox.id = 'toggle-emacs-editing';
        emacsCheckbox.checked = appSettings.getEmacsEditingEnabled();
        emacsCheckbox.style.marginTop = '2px';
        emacsCheckbox.style.cursor = 'pointer';

        const emacsLabelContainer = document.createElement('div');
        emacsLabelContainer.style.display = 'flex';
        emacsLabelContainer.style.flexDirection = 'column';
        emacsLabelContainer.style.gap = '2px';

        const emacsLabelText = document.createElement('label');
        emacsLabelText.htmlFor = 'toggle-emacs-editing';
        emacsLabelText.textContent = 'Enable Emacs-style text editing in notes';
        emacsLabelText.style.fontSize = '12px';
        emacsLabelText.style.color = 'var(--color-text-main)';
        emacsLabelText.style.cursor = 'pointer';

        const emacsSubText = document.createElement('div');
        emacsSubText.textContent = 'Ctrl+A/E/F/B, Alt+F/B etc.';
        emacsSubText.style.fontSize = '10px';
        emacsSubText.style.color = 'var(--color-text-muted)';
        
        emacsLabelContainer.appendChild(emacsLabelText);
        emacsLabelContainer.appendChild(emacsSubText);
        
        emacsRow.appendChild(emacsCheckbox);
        emacsRow.appendChild(emacsLabelContainer);
        
        emacsCheckbox.addEventListener('change', (e) => {
            appSettings.setEmacsEditingEnabled(e.target.checked);
        });
        
        body.appendChild(emacsRow);

        // Developer Menu Section
        const devHeader = document.createElement('div');
        devHeader.style.marginTop = '16px';
        devHeader.style.paddingTop = '16px';
        devHeader.style.borderTop = '1px solid var(--border-color)';
        devHeader.style.fontWeight = '500';
        devHeader.style.fontSize = '12px';
        devHeader.style.color = 'var(--color-text-main)';
        devHeader.textContent = 'Developer Menu';
        body.appendChild(devHeader);

        const importBtn = document.createElement('button');
        importBtn.textContent = 'Import Legacy Board...';
        importBtn.style.padding = '6px 12px';
        importBtn.style.fontSize = '11px';
        importBtn.style.cursor = 'pointer';
        importBtn.style.border = '1px solid var(--border-color)';
        importBtn.style.backgroundColor = 'transparent';
        importBtn.style.borderRadius = '4px';
        importBtn.style.color = 'var(--color-text-main)';
        importBtn.style.textAlign = 'left';
        
        importBtn.addEventListener('mouseenter', () => importBtn.style.backgroundColor = 'rgba(0,0,0,0.05)');
        importBtn.addEventListener('mouseleave', () => importBtn.style.backgroundColor = 'transparent');
        
        importBtn.addEventListener('click', () => {
            this.close();
            const dialog = new ImportLegacyBoardDialog(this.app);
            dialog.startFlow();
        });

        body.appendChild(importBtn);

        this.element.appendChild(body);
    }

    toggle(anchorElement) {
        if (this.isOpen) {
            this.close();
        } else {
            this.open(anchorElement);
        }
    }

    open(anchorElement) {
        if (anchorElement) {
            const rect = anchorElement.getBoundingClientRect();
            this.element.style.top = `${rect.bottom + 8}px`;
            // Align relative to window right
            const rightOffset = window.innerWidth - rect.right;
            this.element.style.right = `${rightOffset}px`;
        }
        
        // Refresh values when popping open in case multiple tabs modified it
        const toggleCheckbox = this.element.querySelector('#toggle-legacy-archive');
        if (toggleCheckbox) {
            toggleCheckbox.checked = appSettings.getShowLegacyArchive();
        }

        const emacsCheckbox = this.element.querySelector('#toggle-emacs-editing');
        if (emacsCheckbox) {
            emacsCheckbox.checked = appSettings.getEmacsEditingEnabled();
        }

        if (this._selects) {
            this._selects.forEach(cfg => cfg.buildOptions());
        }

        this.element.style.display = 'block';
        this.isOpen = true;
    }

    close() {
        this.element.style.display = 'none';
        this.isOpen = false;
    }
}
