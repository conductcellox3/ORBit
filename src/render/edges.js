export class EdgeRenderer {
  constructor(app, svgContainer) {
    this.app = app;
    this.svgContainer = svgContainer;
    this.paths = new Map();
    this.initMarkers();
  }

  initMarkers() {
    let defs = this.svgContainer.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      this.svgContainer.appendChild(defs);
    }
    
    // Forward Arrowhead
    const markerEnd = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    markerEnd.setAttribute('id', 'arrowhead');
    markerEnd.setAttribute('markerWidth', '6');
    markerEnd.setAttribute('markerHeight', '6');
    markerEnd.setAttribute('refX', '15'); // offset from edge so it doesn't overlap under notes
    markerEnd.setAttribute('refY', '3');
    markerEnd.setAttribute('orient', 'auto-start-reverse');
    
    const pathEnd = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEnd.setAttribute('d', 'M 0 0 L 6 3 L 0 6 z');
    pathEnd.setAttribute('fill', 'var(--color-edge-active)');
    pathEnd.setAttribute('class', 'orbit-edge-marker');
    markerEnd.appendChild(pathEnd);
    
    // Backward Arrowhead
    const markerStart = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    markerStart.setAttribute('id', 'arrowhead-start');
    markerStart.setAttribute('markerWidth', '6');
    markerStart.setAttribute('markerHeight', '6');
    markerStart.setAttribute('refX', '0'); // start of line
    markerStart.setAttribute('refY', '3');
    markerStart.setAttribute('orient', 'auto-start-reverse'); 
    
    const pathStart = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathStart.setAttribute('d', 'M 6 0 L 0 3 L 6 6 z'); // opposite pointer
    pathStart.setAttribute('fill', 'var(--color-edge-active)');
    pathStart.setAttribute('class', 'orbit-edge-marker');
    markerStart.appendChild(pathStart);
    
    defs.appendChild(markerEnd);
    defs.appendChild(markerStart);
  }

  render(activeDrawEdge = null) {
    const edges = this.app.state.edges;
    const isEdgeSelection = this.app.selection.type === 'edge';

    for (const [id, path] of this.paths.entries()) {
      if (id !== 'draw-preview' && !edges.has(id)) {
        path.remove();
        this.paths.delete(id);
      }
    }

    for (const [id, edge] of edges.entries()) {
      let group = this.paths.get(id);
      if (!group) {
        group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.dataset.id = id;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'orbit-edge');

        const hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hit.setAttribute('class', 'orbit-edge-hit');
        hit.dataset.id = id;
        
        hit.addEventListener('pointerdown', (e) => {
            if (e.button === 0) {
               this.app.selection.select(id, 'edge');
               e.stopPropagation();
            } else if (e.button === 2) {
               this.app.selection.select(id, 'edge');
            }
        });

        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bg.setAttribute('class', 'orbit-edge-label-bg');
        
        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('class', 'orbit-edge-label-text');
        txt.setAttribute('text-anchor', 'middle');
        txt.setAttribute('dominant-baseline', 'central');

        group.appendChild(path);
        group.appendChild(hit);
        group.appendChild(bg);
        group.appendChild(txt);
        this.svgContainer.appendChild(group);

        group._nodes = { path, hit, bg, txt };
        this.paths.set(id, group);
      }

      const { path, hit, bg, txt } = group._nodes;
      const sourceNote = this.app.state.notes.get(edge.sourceId);
      const targetNote = this.app.state.notes.get(edge.targetId);

      if (sourceNote && targetNote) {
        const shape = this.calculateBezier(sourceNote, targetNote);
        path.setAttribute('d', shape.d);
        hit.setAttribute('d', shape.d);
        
        if (edge.comment) {
            hit.setAttribute('title', edge.comment);
            const titleEl = hit.querySelector('title') || document.createElementNS('http://www.w3.org/2000/svg', 'title');
            titleEl.textContent = edge.comment;
            if (!hit.querySelector('title')) hit.appendChild(titleEl);
        } else {
            hit.removeAttribute('title');
            const titleEl = hit.querySelector('title');
            if (titleEl) titleEl.remove();
        }
        
        // Handle Directionality
        path.removeAttribute('marker-end');
        path.removeAttribute('marker-start');
        
        if (edge.direction === 'forward' || edge.direction === 'both' || edge.direction === 'Yes') {
          path.setAttribute('marker-end', 'url(#arrowhead)');
        }
        if (edge.direction === 'backward' || edge.direction === 'both') {
          path.setAttribute('marker-start', 'url(#arrowhead-start)');
        }

        // Apply visual presets
        const preset = edge.preset || 'standard';
        let strokeClass = `orbit-edge preset-${preset}`;
        if (isEdgeSelection && this.app.selection.has(id)) {
            strokeClass += ' is-selected';
        }
        path.setAttribute('class', strokeClass);

        // Apply Labels
        if (edge.label && edge.label.trim() !== '') {
            const rawLabel = edge.label.trim();
            const displayLabel = rawLabel.length > 20 ? rawLabel.substring(0, 20) + '...' : rawLabel;
            
            txt.textContent = displayLabel;
            
            // Re-calc BBox to size the rect natively
            const bbox = txt.getBBox ? txt.getBBox() : { width: 0, height: 0 };
            const padX = 6;
            const padY = 2;
            
            bg.setAttribute('x', shape.cx - (bbox.width / 2) - padX);
            bg.setAttribute('y', shape.cy - (bbox.height / 2) - padY);
            bg.setAttribute('width', Math.max(0, bbox.width + padX * 2));
            bg.setAttribute('height', Math.max(0, bbox.height + padY * 2));
            bg.style.display = 'block';
            
            txt.setAttribute('x', shape.cx);
            txt.setAttribute('y', shape.cy);
            txt.style.display = 'block';
        } else {
            txt.style.display = 'none';
            bg.style.display = 'none';
        }
      }
    }

    let previewPath = this.paths.get('draw-preview');
    if (activeDrawEdge) {
      if (!previewPath) {
        previewPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        previewPath.setAttribute('class', 'drawing-edge');
        this.svgContainer.appendChild(previewPath);
        this.paths.set('draw-preview', previewPath);
      }
      
      const sourceNote = this.app.state.notes.get(activeDrawEdge.sourceId);
      if (sourceNote) {
        const targetPoint = activeDrawEdge.targetPoint;
        const shape = this.calculateBezier(sourceNote, { x: targetPoint.x, y: targetPoint.y, width: 0, height: 0 });
        previewPath.setAttribute('d', shape.d);
      }
    } else if (previewPath) {
      previewPath.remove();
      this.paths.delete('draw-preview');
    }
  }

  calculateBezier(sourceNote, targetNote) {
    // Get actual DOM dimensions for mathematically perfect centering and intersections
    let sW = sourceNote.width || 120;
    let sH = sourceNote.height || 40;
    const sourceEl = document.querySelector(`[data-id="${sourceNote.id}"]`);
    if (sourceEl) {
      sW = sourceEl.offsetWidth || sW;
      sH = sourceEl.offsetHeight || sH;
    }

    let tW = targetNote.width || 0;
    let tH = targetNote.height || 0;
    // targetPoint from preview won't have an ID
    if (targetNote.id) {
      const targetEl = document.querySelector(`[data-id="${targetNote.id}"]`);
      if (targetEl) {
        tW = targetEl.offsetWidth || tW;
        tH = targetEl.offsetHeight || tH;
      }
    }

    const sX = sourceNote.x + sW / 2;
    const sY = sourceNote.y + sH / 2;
    
    // For drawing preview, targetNote is a pure coordinate
    const targetX = targetNote.x !== undefined ? targetNote.x : 0;
    const targetY = targetNote.y !== undefined ? targetNote.y : 0;
    const tX = targetX + tW / 2;
    const tY = targetY + tH / 2;

    const dx = tX - sX;
    const dy = tY - sY;
    
    const cx = sX + dx / 2;
    const cy = sY + dy / 2;
    
    if (dx === 0 && dy === 0) return { d: `M ${sX} ${sY} L ${tX} ${tY}`, cx, cy };

    // Target rect intersection backward
    // Prevent divide by zero
    const absDx = Math.abs(dx) || 0.0001;
    const absDy = Math.abs(dy) || 0.0001;
    
    const tx = (tW / 2) / absDx;
    const ty = (tH / 2) / absDy;
    const t = Math.min(tx, ty);
    
    const intersectX = tX - (dx * t);
    const intersectY = tY - (dy * t);

    // Source rect intersection forward
    const tsx = (sW / 2) / absDx;
    const tsy = (sH / 2) / absDy;
    const ts = Math.min(tsx, tsy);
    
    const sourceIntersectX = sX + (dx * ts);
    const sourceIntersectY = sY + (dy * ts);

    return { d: `M ${sourceIntersectX} ${sourceIntersectY} L ${intersectX} ${intersectY}`, cx, cy };
  }
}
