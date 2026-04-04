import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export class BoardSnapshot {
    constructor(app) {
        this.app = app;
        this.sandbox = document.getElementById('print-overlay-sandbox');
    }

    /**
     * Builds an isolated copy of the board elements (stripping UI/hover/cursors)
     * places it into the sandbox DOM, positioned exactly at top-left 0,0 based on content scope.
     * @returns {HTMLElement} The isolated cloned container ready for rendering.
     */
    prepareClone() {
        const scope = this.app.printLayout.layoutScope;
        
        // Setup sandbox
        this.sandbox.innerHTML = '';
        this.sandbox.style.display = 'block';
        this.sandbox.style.width = scope.width + 'px';
        this.sandbox.style.height = scope.height + 'px';
        
        // Deep clone the transform layer
        const sourceTransform = document.getElementById('board-transform');
        const clone = sourceTransform.cloneNode(true);
        
        // Clean out UI specific transients and resets coords
        // The clone will be shifted so scope.x/scope.y maps to 0,0 locally
        clone.id = 'print-cloned-transform';
        clone.style.transform = `translate(${-scope.x}px, ${-scope.y}px) scale(1)`;
        clone.style.transition = 'none';
        
        // Ensure edge layer has dimensions so html2canvas doesn't cull the SVG paths due to its 1x1 default size
        const edgeLayer = clone.querySelector('#edge-layer');
        if (edgeLayer) {
            // The SVG remains in original absolute coordinates, so dimension it large enough to cover the bottom-right extent
            edgeLayer.style.width = Math.max(0, scope.x + scope.width + 2000) + 'px';
            edgeLayer.style.height = Math.max(0, scope.y + scope.height + 2000) + 'px';
        }
        
        // Strip active UI states
        const uiRemovals = clone.querySelectorAll('.orbit-context-menu, .orbit-note-resize-handle, .selection-box, .drag-ghost, #print-boundaries-layer');
        uiRemovals.forEach(el => el.parentNode?.removeChild(el));

        // Bake intrinsic dimensions to prevent html2canvas flex-collapse for auto-sized nodes
        const originalNotes = sourceTransform.querySelectorAll('.orbit-note');
        const clonedNotes = clone.querySelectorAll('.orbit-note');
        for (let i = 0; i < originalNotes.length; i++) {
            const oNote = originalNotes[i];
            const cNote = clonedNotes[i];
            if (oNote && cNote) {
                cNote.style.width = oNote.offsetWidth + 'px';
                cNote.style.height = oNote.offsetHeight + 'px';
                
                // Specific fixes for linked notes where html2canvas frequently drops the node due to flex+clip stacking limitations
                if (cNote.classList.contains('is-linked-note')) {
                    cNote.style.overflow = 'visible'; // Prevent html2canvas from trying to generate buggy clipping paths
                    cNote.style.display = 'block'; // Fallback from flex to block to prevent inner-collapse
                    
                    const cContent = cNote.querySelector('.orbit-linked-note-content');
                    if (cContent) {
                        cContent.style.opacity = '1';
                        cContent.style.display = 'block';
                    }
                    
                    const cHeader = cNote.querySelector('.orbit-linked-note-header');
                    if (cHeader) {
                        cHeader.style.display = 'flex'; // Header can usually stay flex, but lets force its height
                        const oHeader = oNote.querySelector('.orbit-linked-note-header');
                        if (oHeader) cHeader.style.height = oHeader.offsetHeight + 'px';
                    }
                    
                    // Kill the transparent overlay which can sometimes block z-index flattened renders
                    const cBlockOverlay = cNote.querySelector('div[style*="inset: 0"]');
                    if (cBlockOverlay) cBlockOverlay.remove();
                }
            }
        }
        
        // Prevent html2canvas from skipping SVG elements lacking xmlns
        clone.querySelectorAll('svg:not([xmlns])').forEach(svg => {
            svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        });

        // Strip hover, selection, and warning badge classes
        const transientClasses = ['is-selected', 'is-hovered', 'is-active', 'print-cross-warning'];
        transientClasses.forEach(c => {
            clone.querySelectorAll('.' + c).forEach(el => el.classList.remove(c));
        });

        this.sandbox.appendChild(clone);
        return this.sandbox;
    }

    cleanup() {
        this.sandbox.innerHTML = '';
        this.sandbox.style.display = 'none';
    }

    async exportPNG() {
        if (this.app.state.sourceType === 'legacy') return;
        
        try {
            const container = this.prepareClone();
            
            // Allow DOM repaints
            await new Promise(r => requestAnimationFrame(r));
            
            const canvas = await html2canvas(container, {
                backgroundColor: getComputedStyle(document.body).getPropertyValue('--color-bg-base').trim() || '#f8f9fa',
                scale: 2, // Retina resolution
                useCORS: true,
                logging: false,
                width: parseInt(container.style.width),
                height: parseInt(container.style.height)
            });
            
            this.cleanup();
            
            // Execute OS save
            const { save } = await import('@tauri-apps/plugin-dialog');
            const safeTitle = (this.app.state.title || this.app.state.slug || 'board').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
            const defaultFilename = safeTitle + '.png';
            const filepath = await save({
                defaultPath: defaultFilename,
                filters: [{ name: 'PNG Image', extensions: ['png'] }]
            });
            
            if (filepath) {
                const { writeFile } = await import('@tauri-apps/plugin-fs');
                
                // Convert data URL to binary array
                const dataUrl = canvas.toDataURL('image/png');
                const base64Part = dataUrl.split(',')[1];
                const cleanBase64 = base64Part.replace(/\s/g, '');
                const raw = window.atob(cleanBase64);
                const rawLength = raw.length;
                const uInt8Array = new Uint8Array(rawLength);
                for (let i = 0; i < rawLength; ++i) uInt8Array[i] = raw.charCodeAt(i);
                
                await writeFile(filepath, uInt8Array);
                console.log("PNG exported to", filepath);
            }
            
        } catch (e) {
            console.error("PNG Export Failed:", e);
            this.cleanup();
        }
    }

    async exportPDF() {
        if (this.app.state.sourceType === 'legacy') return;
        
        try {
            const container = this.prepareClone();
            
            // Allow DOM repaints
            await new Promise(r => requestAnimationFrame(r));
            
            // 1. Render entire logical layout as a giant high-res canvas
            const baseScale = 2; // Retina resolution
            const fullCanvas = await html2canvas(container, {
                backgroundColor: getComputedStyle(document.body).getPropertyValue('--color-bg-base').trim() || '#ffffff',
                scale: baseScale,
                useCORS: true,
                logging: false,
                width: parseInt(container.style.width),
                height: parseInt(container.style.height)
            });
            
            this.cleanup();
            
            // 2. Determine slice geometry
            const layout = this.app.printLayout;
            const paperProps = layout.paperSizes[layout.currentSize] || layout.paperSizes['A4'];
            let pWidth = paperProps.width;
            let pHeight = paperProps.height;
            if (layout.currentOrientation === 'Landscape') {
                const temp = pWidth;
                pWidth = pHeight;
                pHeight = temp;
            }

            // Calculate grid count (logical px / page px)
            const scopeW = parseInt(container.style.width);
            const scopeH = parseInt(container.style.height);
            const cols = Math.max(1, Math.ceil(scopeW / pWidth));
            const rows = Math.max(1, Math.ceil(scopeH / pHeight));

            // Initialize jsPDF. Units are explicitly calculated in logical px to map 1:1
            const pdf = new jsPDF({
                orientation: layout.currentOrientation.toLowerCase(), // 'portrait', 'landscape'
                unit: 'px',
                format: [pWidth, pHeight]
            });

            // 3. Slice and append
            let addedPages = 0;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const sx = c * pWidth * baseScale;
                    const sy = r * pHeight * baseScale;
                    
                    // Check if this logical page area has any content
                    const cellMinX = layout.layoutScope.x + c * pWidth;
                    const cellMinY = layout.layoutScope.y + r * pHeight;
                    const cellMaxX = cellMinX + pWidth;
                    const cellMaxY = cellMinY + pHeight;
                    
                    let hasNodes = false;
                    for (const frame of this.app.state.frames.values()) {
                        const fw = frame.width;
                        const fh = frame.height;
                        if (!(frame.x > cellMaxX || frame.x + fw < cellMinX || frame.y > cellMaxY || frame.y + fh < cellMinY)) {
                            hasNodes = true; break;
                        }
                    }
                    if (!hasNodes) {
                        for (const note of this.app.state.notes.values()) {
                            let nw = note.width || 120;
                            let nh = note.height || 56;
                            const el = document.querySelector(`[data-id="${note.id}"]`);
                            if (el) { nw = el.offsetWidth || nw; nh = el.offsetHeight || nh; }
                            if (!(note.x > cellMaxX || note.x + nw < cellMinX || note.y > cellMaxY || note.y + nh < cellMinY)) {
                                hasNodes = true; break;
                            }
                        }
                    }
                    
                    if (!hasNodes) continue;

                    if (addedPages > 0) {
                        pdf.addPage([pWidth, pHeight], layout.currentOrientation.toLowerCase());
                    }
                    addedPages++;
                    
                    // Create slicing canvas
                    const sliceCanvas = document.createElement('canvas');
                    sliceCanvas.width = pWidth * baseScale;
                    sliceCanvas.height = pHeight * baseScale;
                    const ctx = sliceCanvas.getContext('2d');
                    
                    // Base background white
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
                    
                    // Slice from source
                    const sw = Math.min(sliceCanvas.width, fullCanvas.width - sx);
                    const sh = Math.min(sliceCanvas.height, fullCanvas.height - sy);
                    
                    if (sw > 0 && sh > 0) {
                        ctx.drawImage(fullCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
                    }
                    
                    // Standard JPEG compression reduces native PDF file bloat natively
                    const imgData = sliceCanvas.toDataURL('image/jpeg', 0.95);
                    pdf.addImage(imgData, 'JPEG', 0, 0, pWidth, pHeight);
                }
            }
            
            if (addedPages === 0) {
                console.warn("No printable pages found, cancelling export");
                document.body.classList.remove('is-printing-mode');
                return;
            }

            // 4. Save via Tauri API natively
            const { save } = await import('@tauri-apps/plugin-dialog');
            const safeTitle = (this.app.state.title || this.app.state.slug || 'board').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
            const defaultFilename = safeTitle + '.pdf';
            const filepath = await save({
                defaultPath: defaultFilename,
                filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
            });
            
            if (filepath) {
                const { writeFile } = await import('@tauri-apps/plugin-fs');
                
                // Get buffer explicitly
                const arrayBuffer = pdf.output('arraybuffer');
                const uInt8Array = new Uint8Array(arrayBuffer);
                
                await writeFile(filepath, uInt8Array);
                console.log("PDF strictly chunked and exported to", filepath);
            }
            
        } catch (e) {
            console.error("PDF Export Failed:", e);
            document.body.classList.remove('is-printing-mode');
            this.cleanup();
        }
    }
}
