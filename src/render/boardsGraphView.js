import { GraphLayouts } from '../core/graphLayouts.js';

export class BoardsGraphView {
  constructor(app, containerId) {
    this.app = app;
    this.container = document.getElementById(containerId);
    this.isActive = false;
    
    // Viewport logic
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1;
    this.isDraggingViewport = false;
    this.draggingNode = null;
    
    // Derived View Data
    this.nodes = [];
    this.edges = [];
    this.labels = [];
    
    // UI Filters
    this.currentLayout = 'force'; // force, topic, timeline
    this.textFilter = '';
    this.hideIsolated = false;
    this.minStrength = 1;
    this.startDate = '';
    this.endDate = '';
    
    // Physics settling
    this.animationFrame = null;
    this.settlingTicks = 0;
    this.MAX_TICKS = 150; // Re-settles bounded amount to avoid perpetual drain
    
    this.buildDOMTree();
    this.hookGlobalEvents();
  }
  
  buildDOMTree() {
    // The top-level bounding container
    this.graphRoot = document.createElement('div');
    this.graphRoot.className = 'boards-graph-root';
    this.graphRoot.style.position = 'absolute';
    this.graphRoot.style.top = '0';
    this.graphRoot.style.left = '0';
    this.graphRoot.style.width = '100%';
    this.graphRoot.style.height = '100%';
    this.graphRoot.style.overflow = 'hidden';
    this.graphRoot.style.background = 'var(--bg-app)';
    this.graphRoot.style.display = 'none';
    this.graphRoot.style.zIndex = '0';
    
    // Transform plane (moved by pan/zoom)
    this.graphPlane = document.createElement('div');
    this.graphPlane.className = 'boards-graph-plane';
    this.graphPlane.style.position = 'absolute';
    this.graphPlane.style.transformOrigin = '0 0';
    
    // Edges Canvas (background)
    this.edgesCanvas = document.createElement('canvas');
    this.edgesCanvas.style.position = 'absolute';
    this.edgesCanvas.style.top = '-4000px'; 
    this.edgesCanvas.style.left = '-4000px'; 
    this.edgesCanvas.width = 8000;
    this.edgesCanvas.height = 8000;
    this.ctx = this.edgesCanvas.getContext('2d');
    
    // Nodes Container (DOM based for sharp text & interactions)
    this.nodesDiv = document.createElement('div');
    this.nodesDiv.className = 'boards-graph-nodes';
    this.nodesDiv.style.position = 'absolute';
    this.nodesDiv.style.top = '0';
    this.nodesDiv.style.left = '0';
    
    this.graphPlane.appendChild(this.edgesCanvas);
    this.graphPlane.appendChild(this.nodesDiv);
    this.graphRoot.appendChild(this.graphPlane);
    this.container.appendChild(this.graphRoot);
    
    // Add Mouse Wheel handling for zoom
    this.graphRoot.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
    
    // Viewport Panning via middle mouse click or Space/Drag
    this.graphRoot.addEventListener('mousedown', (e) => {
      // Allow click-through if they clicked a node directly (that stops propagation)
      if (e.target !== this.graphRoot && e.target !== this.graphPlane && e.target !== this.edgesCanvas) return;
      
      this.isDraggingViewport = true;
      this.app.selection.clear();
      this.dirtyRender();
    });
    
    window.addEventListener('mousemove', (e) => {
       if (!this.isActive) return;
       
       if (this.draggingNode) {
           this.draggingNode.x += e.movementX / this.zoom;
           this.draggingNode.y += e.movementY / this.zoom;
           
           // Nudge layout to resettle after moving node
           this.settlingTicks = Math.max(0, this.settlingTicks - 5);
           if (this.currentLayout === 'force' && this.settlingTicks > this.MAX_TICKS - 10) {
               this.settlingTicks = 50; 
               this.startAnimationLoop();
           }
           this.dirtyRender();
           return;
       }

       if (!this.isDraggingViewport) return;
       this.panX += e.movementX;
       this.panY += e.movementY;
       this.updatePlaneTransform();
    });
    
    window.addEventListener('mouseup', () => {
       this.isDraggingViewport = false;
       this.draggingNode = null;
    });
    
    // Listen to model updates purely locally so we don't spam when backgrounded
    this.app.graphModel.onGraphUpdated = (nodes, edges) => {
        if (!this.isActive) return;
        this.nodes = nodes;
        this.edges = edges;
        this.triggerLayoutUpdate();
    };
  }

  handleWheel(e) {
    if (!this.isActive) return;
    
    // Copied exact behavior from standard canvas interactions
    let dx = e.deltaX;
    let dy = e.deltaY;
    
    if (e.deltaMode === 1) { dx *= 30; dy *= 30; } 
    else if (e.deltaMode === 2) { dx *= 100; dy *= 100; }
    
    if (e.ctrlKey || e.metaKey || e.deltaY === 0) {
      e.preventDefault();
      const zoomFactor = dy > 0 ? 0.9 : 1.1;
      const rect = this.graphRoot.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      
      const planeX = (clientX - this.panX) / this.zoom;
      const planeY = (clientY - this.panY) / this.zoom;
      
      this.zoom = Math.min(Math.max(this.zoom * zoomFactor, 0.1), 4);
      
      this.panX = clientX - planeX * this.zoom;
      this.panY = clientY - planeY * this.zoom;
      this.updatePlaneTransform();
    } else {
      this.panX -= dx;
      this.panY -= dy;
      this.updatePlaneTransform();
    }
  }

  updatePlaneTransform() {
    this.graphPlane.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
  }

  fitToView() {
      if (!this.visibleNodes || this.visibleNodes.length === 0) return;
      
      let minX = Infinity, minY = Infinity;
      let maxX = -Infinity, maxY = -Infinity;
      
      for (const n of this.visibleNodes) {
          minX = Math.min(minX, n.x);
          minY = Math.min(minY, n.y);
          maxX = Math.max(maxX, n.x);
          maxY = Math.max(maxY, n.y);
      }
      
      for (const l of this.labels || []) {
          minX = Math.min(minX, l.x);
          minY = Math.min(minY, l.y);
          maxX = Math.max(maxX, l.x);
          maxY = Math.max(maxY, l.y);
      }
      
      // Ensure there's a valid rect even for 1 item
      if (minX === maxX) { minX -= 100; maxX += 100; }
      if (minY === maxY) { minY -= 100; maxY += 100; }
      
      const padding = 120;
      minX -= padding;
      minY -= padding;
      maxX += padding;
      maxY += padding;
      
      const graphWidth = maxX - minX;
      const graphHeight = maxY - minY;
      
      const rect = this.graphRoot.getBoundingClientRect();
      const viewWidth = rect.width;
      const viewHeight = rect.height;
      
      const scaleX = viewWidth / graphWidth;
      const scaleY = viewHeight / graphHeight;
      
      this.zoom = Math.max(0.05, Math.min(scaleX, scaleY, 2));
      
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      
      this.panX = (viewWidth / 2) - (centerX * this.zoom);
      this.panY = (viewHeight / 2) - (centerY * this.zoom);
      
      this.updatePlaneTransform();
  }

  hookGlobalEvents() {
    this.app.onGraphTabOpened = () => {
       this.isActive = true;
       this.graphRoot.style.display = 'block';
       this.graphRoot.style.zIndex = '1000';
       
       // Hide normal board elements by ID
       const boardTransform = document.getElementById('board-transform');
       if (boardTransform) boardTransform.style.display = 'none';
       
       const edgeLayer = document.getElementById('edge-layer');
       if (edgeLayer) edgeLayer.style.display = 'none';

       // Force properties panel to refresh
       if (this.app.propertiesPanel) {
           this.app.propertiesPanel.fullRender();
       }
       
       // Center graph if not set
       if (this.panX === 0 && this.panY === 0) {
           this.panX = window.innerWidth / 2;
           this.panY = window.innerHeight / 2;
           this.updatePlaneTransform();
       }
       
       // Sync Model
       this.nodes = this.app.graphModel.nodes;
       this.edges = this.app.graphModel.edges;
       
       this.triggerLayoutUpdate();
    };
    
    // When a normal board is opened, we hide
    const origBoardLoad = this.app.onBoardLoad;
    this.app.onBoardLoad = (canvas) => {
       this.isActive = false;
       this.graphRoot.style.display = 'none';
       
       // Restore normal board elements
       const boardTransform = document.getElementById('board-transform');
       if (boardTransform) boardTransform.style.display = '';
       
       const edgeLayer = document.getElementById('edge-layer');
       if (edgeLayer) edgeLayer.style.display = '';

       if (origBoardLoad) origBoardLoad(canvas);

       // Force properties panel to refresh
       if (this.app.propertiesPanel) {
           this.app.propertiesPanel.fullRender();
       }
    };

    // Peek save/restore
    this.app.onGraphPeekCapture = () => {
        return {
           panX: this.panX,
           panY: this.panY,
           zoom: this.zoom,
           selectedNodeId: Array.from(this.app.selection.selectedIds)[0],
           layout: this.currentLayout,
           textFilter: this.textFilter
        };
    };

    this.app.onGraphPeekRestore = (state) => {
        this.panX = state.panX || this.panX;
        this.panY = state.panY || this.panY;
        this.zoom = state.zoom || this.zoom;
        this.currentLayout = state.layout || this.currentLayout;
        this.textFilter = state.textFilter || this.textFilter;
        this.updatePlaneTransform();
        if (state.selectedNodeId) {
            this.app.selection.select(state.selectedNodeId, 'graph-node');
        }
        this.triggerLayoutUpdate();
    };
  }

  // Called when data, layout style, or filter changes
  triggerLayoutUpdate() {
     this.settlingTicks = 0;
     
     // 1. Pre-filter visible items
     const lowerFilter = this.textFilter.toLowerCase().trim();
     this.visibleNodes = this.nodes.filter(n => {
         if (lowerFilter && !n.title.toLowerCase().includes(lowerFilter) && !n.topic.toLowerCase().includes(lowerFilter)) {
            return false;
         }
         if (this.hideIsolated && n.totalWeight === 0) {
             return false;
         }
         if (this.startDate || this.endDate) {
             const d = n.createdAt ? new Date(n.createdAt) : new Date(0);
             if (this.startDate && d < new Date(this.startDate)) return false;
             if (this.endDate && d > new Date(this.endDate)) return false;
         }
         return true;
     });
     
     const activeNodeSet = new Set(this.visibleNodes.map(n => n.id));
     
     this.visibleEdges = this.edges.filter(e => {
         return activeNodeSet.has(e.source.id) && 
                activeNodeSet.has(e.target.id) && 
                e.weight >= this.minStrength;
     });
     
     // 2. Pre-layout structural changes (Topic/Timeline don't need continuous ticking)
     this.labels = [];
     if (this.currentLayout === 'topic') {
        this.labels = GraphLayouts.applyTopicLayout(this.visibleNodes) || [];
        this.settlingTicks = this.MAX_TICKS; // Skip physics
     } else if (this.currentLayout === 'timeline') {
        this.labels = GraphLayouts.applyTimelineLayout(this.visibleNodes) || [];
        this.settlingTicks = this.MAX_TICKS; // Skip physics
     }

     this.syncNodesDOM();
     this.startAnimationLoop();
  }

  startAnimationLoop() {
      if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
      const loop = () => {
          if (!this.isActive) return;
          
          if (this.currentLayout === 'force' && this.settlingTicks < this.MAX_TICKS) {
              const alpha = Math.max(0.01, 0.1 * (1 - this.settlingTicks / this.MAX_TICKS));
              GraphLayouts.tickForce(this.visibleNodes, this.visibleEdges, { alpha });
              this.settlingTicks++;
          }
          
          this.dirtyRender();
          
          if (this.currentLayout === 'force' && this.settlingTicks < this.MAX_TICKS) {
             this.animationFrame = requestAnimationFrame(loop);
          }
      };
      this.animationFrame = requestAnimationFrame(loop);
  }

  // Updates X/Y positions on screen
  dirtyRender() {
      // Redraw Canvas Edges
      this.ctx.clearRect(0, 0, this.edgesCanvas.width, this.edgesCanvas.height);
      const centerOffsetX = 4000;
      const centerOffsetY = 4000;

      const selectedId = Array.from(this.app.selection.selectedIds)[0];

      this.ctx.save();
      this.ctx.translate(centerOffsetX, centerOffsetY);
      
      for (const e of this.visibleEdges) {
          const thickness = Math.max(0.5, Math.log1p(e.weight) * 2);
          const isSelectedPath = selectedId && (e.source.id === selectedId || e.target.id === selectedId);
          const isDimmedState = selectedId && !isSelectedPath;

          this.ctx.beginPath();
          this.ctx.moveTo(e.source.x, e.source.y);
          this.ctx.lineTo(e.target.x, e.target.y);
          
          this.ctx.lineWidth = thickness;
          
          if (isDimmedState) {
              this.ctx.strokeStyle = 'rgba(0,0,0, 0.05)';
          } else {
              this.ctx.strokeStyle = `rgba(0,0,0, ${isSelectedPath ? 0.3 : 0.15})`;
          }
          
          this.ctx.stroke();
      }
      this.ctx.restore();

      // Update Native DOM nodes
      const lookupDOMMap = new Map();
      Array.from(this.nodesDiv.children).forEach(el => lookupDOMMap.set(el.dataset.id, el));
      
      // We assume DOM elements were created in syncNodesDOM and just update transforms
      for (const node of this.visibleNodes) {
          const el = lookupDOMMap.get(node.id);
          if (el) {
              el.style.transform = `translate(${Math.round(node.x)}px, ${Math.round(node.y)}px)`;
              
              if (selectedId === node.id) {
                  el.style.borderColor = 'var(--text-main, #333)';
                  el.style.background = 'white';
                  el.style.zIndex = '100';
              } else if (selectedId) {
                  // Dim non-selected
                  el.style.opacity = '0.4';
                  el.style.zIndex = '10';
                  el.style.borderColor = 'var(--border-color, #ccc)';
              } else {
                  // Normal view
                  el.style.opacity = '1';
                  el.style.zIndex = '10';
                  el.style.borderColor = 'var(--border-color, #ccc)';
              }
          }
      }
  }

  // Ensures exact number of divs match visibleNodes AND labels
  syncNodesDOM() {
      this.nodesDiv.innerHTML = '';
      
      // Render Background Labels (Topic layout)
      for (const label of this.labels) {
          const el = document.createElement('div');
          el.className = 'board-graph-label';
          el.style.position = 'absolute';
          el.style.fontSize = '24px';
          el.style.fontWeight = 'bold';
          el.style.color = 'var(--text-muted, #999)';
          el.style.opacity = '0.3';
          el.style.pointerEvents = 'none'; // Click through
          el.style.whiteSpace = 'nowrap';
          el.style.transform = `translate(${Math.round(label.x)}px, ${Math.round(label.y)}px)`;
          el.style.transformOrigin = 'center left';
          el.textContent = label.text;
          el.style.zIndex = '1';
          this.nodesDiv.appendChild(el);
      }
      
      for (const node of this.visibleNodes) {
          const el = document.createElement('div');
          el.dataset.id = node.id;
          el.className = 'board-graph-node';
          
          // Styling (calm monochrome)
          el.style.position = 'absolute';
          el.style.padding = '8px 12px';
          el.style.background = 'var(--bg-layer-1, #f9f9f9)';
          el.style.border = '1px solid var(--border-color, #ccc)';
          el.style.borderRadius = '20px';
          el.style.fontSize = '12px';
          el.style.color = 'var(--text-main, #222)';
          el.style.cursor = 'pointer';
          el.style.whiteSpace = 'nowrap';
          el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
          el.style.transformOrigin = 'center center';
          // Start exactly center so translate matches
          el.style.marginLeft = '-50%';
          el.style.marginTop = '-20px';
          
          el.textContent = node.title;
          
          // Interactions!
          el.addEventListener('mousedown', (e) => {
              e.stopPropagation();
              this.app.selection.clear();
              this.app.selection.select(node.id, 'graph-node');
              this.draggingNode = node;
              this.dirtyRender();
          });
          
          el.addEventListener('dblclick', (e) => {
              e.stopPropagation();
              this.app.loadNativeBoard(node.id);
          });
          
          // Hover highlighting
          el.addEventListener('mouseenter', () => {
              // Soft visual feedback
              el.style.background = 'var(--bg-hover, #efefef)';
          });
          el.addEventListener('mouseleave', () => {
              if (this.app.selection.selectedIds.has(node.id)) {
                  el.style.background = 'white';
              } else {
                  el.style.background = 'var(--bg-layer-1, #f9f9f9)';
              }
          });

          this.nodesDiv.appendChild(el);
      }
      this.dirtyRender();
  }
}
