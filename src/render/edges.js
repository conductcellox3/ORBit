export class EdgeRenderer {
  constructor(app, svgContainer) {
    this.app = app;
    this.svgContainer = svgContainer;
    this.paths = new Map();
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

  calculateBezier(source, target) {
    // Estimating note dimensions if not stored
    const sW = source.width || 120;
    const sH = source.height || 40;
    const tW = target.width || 0;
    const tH = target.height || 0;

    const sX = source.x + sW / 2;
    const sY = source.y + sH / 2;
    const tX = target.x + tW / 2;
    const tY = target.y + tH / 2;

    const dx = Math.abs(tX - sX) * 0.5;
    return `M ${sX} ${sY} C ${sX + dx} ${sY}, ${tX - dx} ${tY}, ${tX} ${tY}`;
  }
}
