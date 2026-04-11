import { HarvestEngine } from '../core/harvest.js';

export class HarvestPanel {
    constructor(app) {
        this.app = app;
        this.container = document.createElement('div');
        this.container.className = 'orbit-properties orbit-harvest-panel';
        
        this.selectedIds = new Set();
        this.reviewQueue = [];
        this.reviewCursor = 0;
        this.isReviewing = false;

        // Header and Footer
        this.contentArea = document.createElement('div');
        this.contentArea.className = 'harvest-content';
        this.contentArea.style.flex = '1';
        this.contentArea.style.overflowY = 'auto';

        this.savedScrollTop = 0;
        this.contentArea.addEventListener('scroll', () => {
             this.savedScrollTop = this.contentArea.scrollTop;
        });

        this.footerArea = document.createElement('div');
        this.footerArea.className = 'harvest-footer';
        this.footerArea.style.padding = '12px';
        this.footerArea.style.borderTop = '1px solid var(--border-color)';
        
        this.selectOnCanvasBtn = document.createElement('button');
        this.selectOnCanvasBtn.className = 'orbit-property-button primary';
        this.selectOnCanvasBtn.textContent = 'Send to Queue';
        this.selectOnCanvasBtn.style.width = '100%';
        this.selectOnCanvasBtn.onclick = () => this.startReviewQueue();
        this.footerArea.appendChild(this.selectOnCanvasBtn);

        this.reviewControls = document.createElement('div');
        this.reviewControls.style.display = 'none';
        this.reviewControls.style.flexDirection = 'row';
        this.reviewControls.style.gap = '8px';
        this.reviewControls.style.alignItems = 'center';
        
        this.reviewStatus = document.createElement('div');
        this.reviewStatus.style.flex = '1';
        this.reviewStatus.style.fontSize = '12px';
        this.reviewStatus.style.color = 'var(--text-color)';
        this.reviewStatus.style.textAlign = 'center';
        
        this.reviewSkipBtn = document.createElement('button');
        this.reviewSkipBtn.className = 'orbit-property-button';
        this.reviewSkipBtn.textContent = 'Skip';
        this.reviewSkipBtn.onclick = () => this.nextReviewItem(true);

        this.reviewNextBtn = document.createElement('button');
        this.reviewNextBtn.className = 'orbit-property-button primary';
        this.reviewNextBtn.textContent = 'Next >';
        this.reviewNextBtn.onclick = () => this.nextReviewItem(false);

        this.reviewControls.appendChild(this.reviewSkipBtn);
        this.reviewControls.appendChild(this.reviewStatus);
        this.reviewControls.appendChild(this.reviewNextBtn);
        this.footerArea.appendChild(this.reviewControls);

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
        const oldScroll = this.savedScrollTop || 0;
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
        const { nearMisses, farConnections } = HarvestEngine.getConnections(this.app.state);

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

        this.renderPairSection(padDiv, '🛤️ Near Miss', nearMisses);
        this.renderPairSection(padDiv, '✨ Far Connection', farConnections);

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

        setTimeout(() => {
            if (this.contentArea) {
                this.contentArea.scrollTop = oldScroll;
            }
        }, 10);
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

    renderPairSection(parent, title, pairs) {
        if (!pairs || pairs.length === 0) return;

        const section = document.createElement('div');
        section.className = 'orbit-properties-group no-label';
        section.style.marginBottom = '20px';

        const header = document.createElement('div');
        header.textContent = `${title} (${pairs.length})`;
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

        pairs.forEach(pair => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'flex-start';
            row.style.gap = '8px';
            row.style.backgroundColor = 'var(--bg-layer-1)';
            row.style.padding = '6px 8px';
            row.style.borderRadius = '4px';
            row.style.border = '1px solid var(--border-color)';

            const pairId = `PAIR:${pair.noteA.id}:${pair.noteB.id}`;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = this.selectedIds.has(pairId);
            checkbox.style.marginTop = '4px';
            checkbox.style.cursor = 'pointer';
            checkbox.onchange = (e) => {
                if (e.target.checked) {
                    this.selectedIds.add(pairId);
                } else {
                    this.selectedIds.delete(pairId);
                }
                this.updateSelectButtonState();
            };
            row.appendChild(checkbox);

            const contentDiv = document.createElement('div');
            contentDiv.style.flex = '1';
            contentDiv.style.overflow = 'hidden';
            contentDiv.onmouseenter = () => row.style.backgroundColor = 'var(--bg-hover)';
            contentDiv.onmouseleave = () => row.style.backgroundColor = 'var(--bg-layer-1)';

            const makeSnip = (note) => {
                let txt = note.text || note.ocrText || '(Empty)';
                const el = document.createElement('div');
                el.textContent = txt.trim() || '(Empty)';
                el.style.fontSize = '11px';
                el.style.color = 'var(--color-text-main)';
                el.style.display = '-webkit-box';
                el.style.webkitLineClamp = '1';
                el.style.webkitBoxOrient = 'vertical';
                el.style.overflow = 'hidden';
                el.style.textOverflow = 'ellipsis';
                
                el.style.cursor = 'pointer';
                el.style.padding = '2px 4px';
                el.style.margin = '0 -4px';
                el.style.borderRadius = '3px';
                el.title = 'Click to view this note';
                el.onmouseenter = (e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)';
                    e.currentTarget.style.color = 'var(--color-interactive-primary, #3B82F6)';
                };
                el.onmouseleave = (e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--color-text-main)';
                };
                el.onclick = (e) => {
                    e.stopPropagation();
                    this.jumpToNote(note.id);
                };
                
                return el;
            };

            contentDiv.appendChild(makeSnip(pair.noteA));
            
            const divider = document.createElement('div');
            divider.style.height = '1px';
            divider.style.backgroundColor = 'var(--border-color)';
            divider.style.margin = '4px 0';
            contentDiv.appendChild(divider);
            
            contentDiv.appendChild(makeSnip(pair.noteB));

            if (pair.reason) {
                const reasonEl = document.createElement('div');
                reasonEl.textContent = `↳ ${pair.reason}`;
                reasonEl.style.fontSize = '10px';
                reasonEl.style.color = 'var(--color-text-muted)';
                reasonEl.style.fontStyle = 'italic';
                reasonEl.style.marginTop = '6px';
                contentDiv.appendChild(reasonEl);
            }

            row.appendChild(contentDiv);
            listContainer.appendChild(row);
        });

        section.appendChild(listContainer);
        parent.appendChild(section);
    }

    updateSelectButtonState() {
        if (this.isReviewing) {
            this.selectOnCanvasBtn.style.display = 'none';
            this.reviewControls.style.display = 'flex';
        } else {
            this.selectOnCanvasBtn.style.display = 'block';
            this.reviewControls.style.display = 'none';
            const count = this.selectedIds.size;
            this.selectOnCanvasBtn.textContent = count > 0 ? `Send to Queue (${count})` : 'Send to Queue';
            this.selectOnCanvasBtn.disabled = count === 0;
            this.selectOnCanvasBtn.style.opacity = count === 0 ? '0.5' : '1.0';
            this.selectOnCanvasBtn.style.cursor = count === 0 ? 'default' : 'pointer';
        }
    }

    jumpToNote(id) {
        if (!this.app || !this.app.state) return;
        if (this.app.jumpToNoteCenter) {
            this.app.jumpToNoteCenter(id);
        }
    }

    startReviewQueue() {
        if (this.selectedIds.size === 0) return;
        this.reviewQueue = Array.from(this.selectedIds);
        this.reviewCursor = 0;
        this.isReviewing = true;
        this.selectedIds.clear();
        this.updateSelectButtonState();
        this.focusCurrentReviewItem();
    }

    focusCurrentReviewItem() {
        if (!this.isReviewing || this.reviewCursor >= this.reviewQueue.length) {
            this.isReviewing = false;
            this.updateSelectButtonState();
            return;
        }

        const currentId = this.reviewQueue[this.reviewCursor];
        if (currentId.startsWith('PAIR:')) {
            const parts = currentId.split(':');
            const n1 = this.app.state.notes.get(parts[1]);
            const n2 = this.app.state.notes.get(parts[2]);
            if (!n1 && !n2) {
                return this.nextReviewItem(true);
            }
            this.jumpToMultiple([parts[1], parts[2]]);
        } else {
            if (!this.app.state.notes.has(currentId)) {
                return this.nextReviewItem(true);
            }
            this.jumpToNote(currentId);
        }
        
        this.reviewStatus.textContent = `${this.reviewCursor + 1} of ${this.reviewQueue.length}`;
    }

    nextReviewItem(isSkip) {
        this.reviewCursor++;
        if (this.reviewCursor >= this.reviewQueue.length) {
            this.isReviewing = false;
            this.updateSelectButtonState();
        } else {
            this.focusCurrentReviewItem();
        }
    }

    jumpToMultiple(idsArray) {
        if (!idsArray || idsArray.length === 0) return;
        
        this.app.selection.clear();
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
