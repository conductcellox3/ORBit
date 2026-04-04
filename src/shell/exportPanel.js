export class ExportPanel {
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
        div.id = 'export-panel';
        div.classList.add('orbit-popover');
        div.style.position = 'absolute';
        div.style.top = '48px';
        div.style.right = '120px'; // near utilities
        div.style.width = '260px';
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
        header.textContent = 'Export & Print';
        this.element.appendChild(header);

        const body = document.createElement('div');
        body.style.padding = '16px';
        body.style.display = 'flex';
        body.style.flexDirection = 'column';
        body.style.gap = '16px';
        
        // Layout Toggle
        const layoutRow = document.createElement('div');
        layoutRow.style.display = 'flex';
        layoutRow.style.alignItems = 'center';
        layoutRow.style.justifyContent = 'space-between';
        
        const layoutLabel = document.createElement('span');
        layoutLabel.textContent = 'Layout Overlay';
        layoutLabel.style.fontSize = '12px';
        layoutLabel.style.color = 'var(--color-text-main)';
        
        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = this.app.printLayout?.isActive ? 'On' : 'Off';
        toggleBtn.style.padding = '4px 8px';
        toggleBtn.style.fontSize = '11px';
        toggleBtn.style.background = this.app.printLayout?.isActive ? 'var(--bg-layer-3, #e2e8f0)' : 'var(--bg-layer-2, transparent)';
        toggleBtn.style.color = 'var(--color-text-main)';
        toggleBtn.style.border = '1px solid var(--border-color, #e2e8f0)';
        toggleBtn.style.borderRadius = '4px';
        toggleBtn.style.cursor = 'pointer';
        
        toggleBtn.onclick = () => {
            if (this.app.printLayout) {
                const newState = !this.app.printLayout.isActive;
                this.app.printLayout.toggle(newState);
                toggleBtn.textContent = newState ? 'On' : 'Off';
                toggleBtn.style.background = newState ? 'var(--bg-layer-3, #e2e8f0)' : 'var(--bg-layer-2, transparent)';
                this.updateCrossingCount(this.app.printLayout.crossingWarnings);
            }
        };
        
        layoutRow.appendChild(layoutLabel);
        layoutRow.appendChild(toggleBtn);
        body.appendChild(layoutRow);
        
        // Settings Group
        const settingsGroup = document.createElement('div');
        settingsGroup.style.display = 'flex';
        settingsGroup.style.flexDirection = 'column';
        settingsGroup.style.gap = '8px';
        
        // Paper Size
        const sizeRow = document.createElement('div');
        sizeRow.style.display = 'flex';
        sizeRow.style.alignItems = 'center';
        sizeRow.style.justifyContent = 'space-between';
        const sizeLabel = document.createElement('span');
        sizeLabel.textContent = 'Paper Size';
        sizeLabel.style.fontSize = '11px';
        sizeLabel.style.color = 'var(--color-text-muted)';
        
        const sizeSelect = document.createElement('select');
        sizeSelect.style.fontSize = '11px';
        sizeSelect.style.padding = '2px 4px';
        sizeSelect.style.background = 'var(--bg-layer-1)';
        sizeSelect.style.color = 'var(--color-text-main)';
        sizeSelect.style.border = '1px solid var(--border-color)';
        sizeSelect.innerHTML = `
            <option value="A0" ${this.app.printLayout?.currentSize === 'A0' ? 'selected' : ''}>A0</option>
            <option value="A1" ${this.app.printLayout?.currentSize === 'A1' ? 'selected' : ''}>A1</option>
            <option value="A2" ${this.app.printLayout?.currentSize === 'A2' ? 'selected' : ''}>A2</option>
            <option value="A3" ${this.app.printLayout?.currentSize === 'A3' ? 'selected' : ''}>A3</option>
            <option value="A4" ${this.app.printLayout?.currentSize === 'A4' ? 'selected' : ''}>A4</option>
            <option value="Letter" ${this.app.printLayout?.currentSize === 'Letter' ? 'selected' : ''}>Letter</option>
        `;
        sizeRow.appendChild(sizeLabel);
        sizeRow.appendChild(sizeSelect);
        
        // Orientation
        const oriRow = document.createElement('div');
        oriRow.style.display = 'flex';
        oriRow.style.alignItems = 'center';
        oriRow.style.justifyContent = 'space-between';
        const oriLabel = document.createElement('span');
        oriLabel.textContent = 'Orientation';
        oriLabel.style.fontSize = '11px';
        oriLabel.style.color = 'var(--color-text-muted)';
        
        const oriSelect = document.createElement('select');
        oriSelect.style.fontSize = '11px';
        oriSelect.style.padding = '2px 4px';
        oriSelect.style.background = 'var(--bg-layer-1)';
        oriSelect.style.color = 'var(--color-text-main)';
        oriSelect.style.border = '1px solid var(--border-color)';
        oriSelect.innerHTML = `
            <option value="Portrait" ${this.app.printLayout?.currentOrientation === 'Portrait' ? 'selected' : ''}>Portrait</option>
            <option value="Landscape" ${this.app.printLayout?.currentOrientation === 'Landscape' ? 'selected' : ''}>Landscape</option>
        `;
        oriRow.appendChild(oriLabel);
        oriRow.appendChild(oriSelect);
        
        const updateSettings = () => {
            if (this.app.printLayout) {
                this.app.printLayout.setSettings(sizeSelect.value, oriSelect.value);
                this.updateCrossingCount(this.app.printLayout.crossingWarnings);
            }
        };
        
        sizeSelect.onchange = updateSettings;
        oriSelect.onchange = updateSettings;
        
        settingsGroup.appendChild(sizeRow);
        settingsGroup.appendChild(oriRow);
        body.appendChild(settingsGroup);
        
        // Warning
        this.warningEl = document.createElement('div');
        this.warningEl.style.fontSize = '10px';
        this.warningEl.style.color = '#eab308'; // Amber
        this.warningEl.style.fontStyle = 'italic';
        this.warningEl.style.display = 'none';
        body.appendChild(this.warningEl);
        
        // Buttons
        const btnGroup = document.createElement('div');
        btnGroup.style.display = 'flex';
        btnGroup.style.gap = '8px';
        btnGroup.style.marginTop = '8px';
        
        const pngBtn = document.createElement('button');
        pngBtn.className = 'orbit-property-button primary';
        pngBtn.style.flex = '1';
        pngBtn.textContent = 'Export PNG';
        pngBtn.onclick = () => {
            this.close();
            if (this.app.boardSnapshot) this.app.boardSnapshot.exportPNG();
        };
        
        const pdfBtn = document.createElement('button');
        pdfBtn.className = 'orbit-property-button primary';
        pdfBtn.style.flex = '1';
        pdfBtn.textContent = 'Export PDF';
        pdfBtn.onclick = () => {
            this.close();
            if (this.app.boardSnapshot) this.app.boardSnapshot.exportPDF();
        };
        
        btnGroup.appendChild(pngBtn);
        btnGroup.appendChild(pdfBtn);
        body.appendChild(btnGroup);

        this.element.appendChild(body);
        
        if (this.app.printLayout) {
             this.updateCrossingCount(this.app.printLayout.crossingWarnings);
        }
    }
    
    updateCrossingCount(count) {
        if (!this.warningEl) return;
        if (!this.app.printLayout?.isActive) {
            this.warningEl.style.display = 'none';
            return;
        }
        
        if (count > 0) {
            this.warningEl.textContent = `⚠ ${count} items cross page boundaries.`;
            this.warningEl.style.display = 'block';
        } else {
            this.warningEl.style.display = 'none';
        }
    }

    toggle(anchorEl) {
        if (this.isOpen) {
            this.close();
        } else {
            this.open(anchorEl);
        }
    }

    open(anchorEl) {
        this.render();
        this.element.style.display = 'block';
        this.isOpen = true;
        
        // Simple positioning relative to bounds
        if (anchorEl) {
            const rect = anchorEl.getBoundingClientRect();
            this.element.style.top = (rect.bottom + 8) + 'px';
            this.element.style.right = (window.innerWidth - rect.right - 12) + 'px';
            this.element.style.left = 'auto';
        }
    }

    close() {
        this.element.style.display = 'none';
        this.isOpen = false;
    }
}
