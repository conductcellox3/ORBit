import { HarvestEngine } from '../core/harvest.js';

export class HarvestPanel {
    constructor(app) {
        this.app = app;
        this.container = document.createElement('div');
        this.container.className = 'orbit-properties orbit-harvest-panel';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.height = '100%';

        this.contentArea = document.createElement('div');
        this.contentArea.className = 'harvest-content';
        this.contentArea.style.flex = '1';
        this.contentArea.style.overflowY = 'auto';

        this.savedScrollTop = 0;
        this.contentArea.addEventListener('scroll', () => {
             this.savedScrollTop = this.contentArea.scrollTop;
        });

        this.container.appendChild(this.contentArea);
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

    jumpToNote(id) {
        if (!this.app || !this.app.state) return;
        if (this.app.jumpToNoteCenter) {
            this.app.jumpToNoteCenter(id);
        }
    }
}
