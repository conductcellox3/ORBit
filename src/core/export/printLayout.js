// Manages the boundary grid and crossing logic for the Board.
export class PrintLayout {
    constructor(app) {
        this.app = app;
        this.canvasContainer = document.getElementById('canvas-container');
        this.boardTransform = document.getElementById('board-transform');
        this.isActive = false;
        
        // 96 DPI defaults
        this.paperSizes = {
            'A0': { width: 3179, height: 4494 },
            'A1': { width: 2245, height: 3179 },
            'A2': { width: 1587, height: 2245 },
            'A3': { width: 1123, height: 1587 },
            'A4': { width: 794, height: 1123 },
            'Letter': { width: 816, height: 1056 }
        };
        
        this.currentSize = 'A4';
        this.currentOrientation = 'Portrait';
        
        this.overlayEl = document.createElement('div');
        this.overlayEl.id = 'print-boundaries-layer';
        this.overlayEl.style.position = 'absolute';
        this.overlayEl.style.top = '0';
        this.overlayEl.style.left = '0';
        this.overlayEl.style.width = '100%';
        this.overlayEl.style.height = '100%';
        this.overlayEl.style.pointerEvents = 'none';
        this.overlayEl.style.zIndex = '50';
        
        this.crossingWarnings = 0;
    }
    
    get physicalDimensions() {
        const size = this.paperSizes[this.currentSize];
        if (this.currentOrientation === 'Landscape') {
            return { width: size.height, height: size.width };
        }
        return size;
    }

    get layoutScope() {
        // Find outer bounds of board
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let hasContent = false;
        
        for (const frame of this.app.state.frames.values()) {
            minX = Math.min(minX, frame.x);
            minY = Math.min(minY, frame.y);
            maxX = Math.max(maxX, frame.x + frame.width);
            maxY = Math.max(maxY, frame.y + frame.height);
            hasContent = true;
        }
        
        for (const note of this.app.state.notes.values()) {
            let w = note.width || 120;
            let h = note.height || 56;
            const el = document.querySelector(`[data-id="${note.id}"]`);
            if (el) {
                w = el.offsetWidth || w;
                h = el.offsetHeight || h;
            }
            minX = Math.min(minX, note.x);
            minY = Math.min(minY, note.y);
            maxX = Math.max(maxX, note.x + w);
            maxY = Math.max(maxY, note.y + h);
            hasContent = true;
        }

        if (!hasContent) {
            return { x: 0, y: 0, width: 800, height: 600 };
        }
        
        // 64px padding
        minX -= 64; minY -= 64;
        maxX += 64; maxY += 64;
        
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }
    
    toggle(state) {
        this.isActive = state;
        if (this.isActive) {
            this.boardTransform.appendChild(this.overlayEl);
            this.render();
        } else {
            if (this.overlayEl.parentNode) {
                this.overlayEl.parentNode.removeChild(this.overlayEl);
            }
            this.clearCrossingStyles();
        }
    }
    
    setSettings(size, orientation) {
        if (this.paperSizes[size]) this.currentSize = size;
        if (['Portrait', 'Landscape'].includes(orientation)) this.currentOrientation = orientation;
        if (this.isActive) this.render();
    }
    
    clearCrossingStyles() {
        const crossingEls = document.querySelectorAll('.print-cross-warning');
        crossingEls.forEach(el => el.classList.remove('print-cross-warning'));
    }

    render() {
        if (!this.isActive) return;
        this.overlayEl.innerHTML = '';
        this.clearCrossingStyles();
        
        const scope = this.layoutScope;
        const page = this.physicalDimensions;
        
        // Snap scope to align with top-left of standard pages
        // Calculate how many pages wide/tall we need
        const cols = Math.ceil(scope.width / page.width);
        const rows = Math.ceil(scope.height / page.height);
        
        const startX = scope.x;
        const startY = scope.y;
        
        // Draw grid
        for (let r = 0; r <= rows; r++) {
            const line = document.createElement('div');
            line.style.position = 'absolute';
            line.style.left = startX + 'px';
            line.style.top = (startY + r * page.height) + 'px';
            line.style.width = (cols * page.width) + 'px';
            line.style.height = '1px';
            line.style.borderTop = '1px dashed rgba(255, 0, 0, 0.4)';
            this.overlayEl.appendChild(line);
        }
        
        for (let c = 0; c <= cols; c++) {
            const line = document.createElement('div');
            line.style.position = 'absolute';
            line.style.left = (startX + c * page.width) + 'px';
            line.style.top = startY + 'px';
            line.style.width = '1px';
            line.style.height = (rows * page.height) + 'px';
            line.style.borderLeft = '1px dashed rgba(255, 0, 0, 0.4)';
            this.overlayEl.appendChild(line);
        }
        
        // Calculate Crossings
        let crossingCount = 0;
        
        const checkCross = (itemX, itemY, itemW, itemH, domId) => {
            // Check if bounds cross any grid line
            const itemRight = itemX + itemW;
            const itemBottom = itemY + itemH;
            
            // Note absolute coords relative to startX/startY
            const relX = itemX - startX;
            const relRight = itemRight - startX;
            const relY = itemY - startY;
            const relBottom = itemBottom - startY;
            
            const startCol = Math.floor(relX / page.width);
            const endCol = Math.floor(relRight / page.width);
            const startRow = Math.floor(relY / page.height);
            const endRow = Math.floor(relBottom / page.height);
            
            if (startCol !== endCol || startRow !== endRow) {
                crossingCount++;
                const el = document.querySelector(`[data-id="${domId}"]`);
                if (el) el.classList.add('print-cross-warning');
            }
        };

        for (const frame of this.app.state.frames.values()) {
            checkCross(frame.x, frame.y, frame.width, frame.height, frame.id);
        }
        
        for (const note of this.app.state.notes.values()) {
            const w = note.width || 120;
            const h = note.height || 56;
            checkCross(note.x, note.y, w, h, note.id);
        }
        
        this.crossingWarnings = crossingCount;
        
        if (this.app.exportPanel) {
            this.app.exportPanel.updateCrossingCount(this.crossingWarnings);
        }
    }
}
