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
    const selectedId = this.app.selection.type === 'edge' ? this.app.selection.selectedId : null;

    for (const [id, path] of this.paths.entries()) {
      if (id !== 'draw-preview' && !edges.has(id)) {
        path.remove();
        this.paths.delete(id);
      }
    }

    for (const [id, edge] of edges.entries()) {
      let path = this.paths.get(id);
      if (!path) {
        path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'orbit-edge');
        path.dataset.id = id;
        this.svgContainer.appendChild(path);
        this.paths.set(id, path);
      }

      const sourceNote = this.app.state.notes.get(edge.sourceId);
      const targetNote = this.app.state.notes.get(edge.targetId);

      if (sourceNote && targetNote) {
        const d = this.calculateBezier(sourceNote, targetNote);
        path.setAttribute('d', d);
        
        // Handle Directionality
        path.removeAttribute('marker-end');
        path.removeAttribute('marker-start');
        
        if (edge.direction === 'forward' || edge.direction === 'both' || edge.direction === 'Yes') {
          path.setAttribute('marker-end', 'url(#arrowhead)');
        }
        if (edge.direction === 'backward' || edge.direction === 'both') {
          path.setAttribute('marker-start', 'url(#arrowhead-start)');
        }
      }

      path.classList.toggle('is-selected', id === selectedId);
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
        const d = this.calculateBezier(sourceNote, { x: targetPoint.x, y: targetPoint.y, width: 0, height: 0 });
        previewPath.setAttribute('d', d);
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
    
    if (dx === 0 && dy === 0) return `M ${sX} ${sY} L ${tX} ${tY}`;

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

    return `M ${sourceIntersectX} ${sourceIntersectY} L ${intersectX} ${intersectY}`;
  }
}
