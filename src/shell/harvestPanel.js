import { HarvestEngine } from '../core/harvest.js';

export class HarvestPanel {
    constructor(app) {
        this.app = app;
        this.container = document.createElement('div');
        this.container.className = 'orbit-properties orbit-harvest-panel';
        
        this.selectedIds = new Set();

        // Header and Footer
        this.contentArea = document.createElement('div');
        this.contentArea.className = 'harvest-content';
        this.contentArea.style.flex = '1';
        this.contentArea.style.overflowY = 'auto';

        this.footerArea = document.createElement('div');
        this.footerArea.className = 'harvest-footer';
        this.footerArea.style.padding = '12px';
        this.footerArea.style.borderTop = '1px solid var(--border-color)';
        
        this.selectOnCanvasBtn = document.createElement('button');
        this.selectOnCanvasBtn.className = 'orbit-property-button primary';
        this.selectOnCanvasBtn.textContent = 'Select Chosen on Canvas';
        this.selectOnCanvasBtn.style.width = '100%';
        this.selectOnCanvasBtn.onclick = () => this.handleSelectOnCanvas();
        this.footerArea.appendChild(this.selectOnCanvasBtn);

        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.height = '100%';

        this.container.appendChild(this.contentArea);
        this.container.appendChild(this.footerArea);

        this.updateSelectButtonState();
    }

    mount() {
        this.fullRender();
    }

    fullRender() {
        this.contentArea.innerHTML = '';

        const desc = document.createElement('div');
        desc.textContent = 'Quietly discover isolated seeds and unresolved items on this board.';
        desc.style.padding = '12px 16px 8px 16px';
        desc.style.fontSize = '11px';
        desc.style.color = 'var(--color-text-muted)';
        desc.style.fontStyle = 'italic';
        this.contentArea.appendChild(desc);

        // Calculate Data
        const { textSeeds, ocrSeeds } = HarvestEngine.getSeeds(this.app.state);
        const markers = HarvestEngine.getMarkers(this.app.state);

        const padDiv = document.createElement('div');
        padDiv.style.padding = '8px 16px';

        // Sections
        this.renderSection(padDiv, '🌱 Text Seeds', textSeeds, (n) => n.text);
        this.renderSection(padDiv, '🖼️ OCR Seeds', ocrSeeds, (n) => n.ocrText);

        const markerConfigs = [
            { key: 'action', title: '🎯 Actions' },
            { key: 'question', title: '❓ Questions' },
            { key: 'risk', title: '⚠️ Risks' },
            { key: 'decision', title: '✅ Decisions' }
        ];

        markerConfigs.forEach(cfg => {
            const list = markers[cfg.key] || [];
            this.renderSection(padDiv, cfg.title, list, (n) => n.text || n.caption || 'Unnamed Note');
        });

        if (padDiv.childNodes.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No harvest targets found.';
            empty.style.color = 'var(--color-text-muted)';
            empty.style.fontSize = '12px';
            empty.style.textAlign = 'center';
            empty.style.marginTop = '20px';
            padDiv.appendChild(empty);
        }

        this.contentArea.appendChild(padDiv);

        // Cleanup selected IDs that a deleted
        for (const id of this.selectedIds) {
            if (!this.app.state.notes.has(id)) {
                this.selectedIds.delete(id);
            }
        }
        this.updateSelectButtonState();
    }

    renderSection(parent, title, items, getTextSnippet) {
        if (!items || items.length === 0) return;

        const section = document.createElement('div');
        section.className = 'orbit-properties-group no-label';
        section.style.marginBottom = '20px';

        const header = document.createElement('div');
        header.textContent = `${title} (${items.length})`;
        header.style.fontSize = '12px';
        header.style.fontWeight = '600';
        header.style.color = 'var(--color-text-main)';
        header.style.marginBottom = '8px';
        header.style.borderBottom = '1px solid var(--border-color)';
        header.style.paddingBottom = '4px';
        section.appendChild(header);

        const listContainer = document.createElement('div');
        listContainer.style.display = 'flex';
        listContainer.style.flexDirection = 'column';
        listContainer.style.gap = '6px';

        items.forEach(note => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'flex-start';
            row.style.gap = '8px';
            row.style.backgroundColor = 'var(--bg-layer-1)';
            row.style.padding = '6px 8px';
            row.style.borderRadius = '4px';
            row.style.border = '1px solid var(--border-color)';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = this.selectedIds.has(note.id);
            checkbox.style.marginTop = '4px';
            checkbox.style.cursor = 'pointer';
            checkbox.onchange = (e) => {
                if (e.target.checked) {
                    this.selectedIds.add(note.id);
                } else {
                    this.selectedIds.delete(note.id);
                }
                this.updateSelectButtonState();
            };
            row.appendChild(checkbox);

            const contentDiv = document.createElement('div');
            contentDiv.style.flex = '1';
            contentDiv.style.cursor = 'pointer';
            contentDiv.style.overflow = 'hidden';
            contentDiv.onmouseenter = () => row.style.backgroundColor = 'var(--bg-hover)';
            contentDiv.onmouseleave = () => row.style.backgroundColor = 'var(--bg-layer-1)';

            const focusFn = () => this.jumpToNote(note.id);
            contentDiv.onclick = focusFn;

            let textContent = getTextSnippet(note) || '';
            textContent = textContent.trim();
            if (textContent.length === 0) textContent = '(Empty)';

            const snipEl = document.createElement('div');
            snipEl.textContent = textContent;
            snipEl.style.fontSize = '11px';
            snipEl.style.color = 'var(--color-text-main)';
            snipEl.style.display = '-webkit-box';
            snipEl.style.webkitLineClamp = '2';
            snipEl.style.webkitBoxOrient = 'vertical';
            snipEl.style.overflow = 'hidden';
            snipEl.style.textOverflow = 'ellipsis';
            snipEl.style.whiteSpace = 'pre-wrap';
            
            contentDiv.appendChild(snipEl);
            row.appendChild(contentDiv);

            listContainer.appendChild(row);
        });

        section.appendChild(listContainer);
        parent.appendChild(section);
    }

    updateSelectButtonState() {
        const count = this.selectedIds.size;
        this.selectOnCanvasBtn.textContent = count > 0 ? `Select Chosen on Canvas (${count})` : 'Select Chosen on Canvas';
        this.selectOnCanvasBtn.disabled = count === 0;
        this.selectOnCanvasBtn.style.opacity = count === 0 ? '0.5' : '1.0';
        this.selectOnCanvasBtn.style.cursor = count === 0 ? 'default' : 'pointer';
    }

    jumpToNote(id) {
        if (!this.app || !this.app.state) return;
        if (this.app.jumpToNoteCenter) {
            this.app.jumpToNoteCenter(id);
        }
    }

    handleSelectOnCanvas() {
        if (this.selectedIds.size === 0) return;
        
        this.app.selection.clear();
        const idsArray = Array.from(this.selectedIds);
        this.app.selection.multiSelect(idsArray, 'note');
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const id of idsArray) {
            const n = this.app.state.notes.get(id);
            if (n) {
                let w = n.width || 400;
                let h = n.height || 300;
                const el = document.querySelector(`.orbit-note[data-id="${id}"]`);
                if (el) {
                    w = el.offsetWidth;
                    h = el.offsetHeight;
                }

                if (n.x < minX) minX = n.x;
                if (n.y < minY) minY = n.y;
                if (n.x + w > maxX) maxX = n.x + w;
                if (n.y + h > maxY) maxY = n.y + h;
            }
        }

        if (minX !== Infinity) {
            const cx = minX + (maxX - minX) / 2;
            const cy = minY + (maxY - minY) / 2;
            
            let cw = window.innerWidth;
            let ch = window.innerHeight;
            const container = document.getElementById('canvas-container');
            if (container) {
                const rect = container.getBoundingClientRect();
                cw = rect.width;
                ch = rect.height;
            }

            const zoom = this.app.state.canvas.zoom || 1;
            const panX = (cw / 2) - cx * zoom;
            const panY = (ch / 2) - cy * zoom;

            this.app.state.canvas.panX = panX;
            this.app.state.canvas.panY = panY;
            
            if (this.app.onBoardLoad) {
                this.app.onBoardLoad(this.app.state.canvas);
            }
        }
    }
}
