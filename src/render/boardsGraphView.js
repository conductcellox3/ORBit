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
    this.isDraggingViewport = false;
    this.draggingNode = null;
    
    // Neighborhood and Inspection state
    this.selectedGraphNodeId = null;
    this.hoveredGraphNodeId = null;
    this.hoveredEdge = null;
    
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
    
    // Edge Detail Tooltip
    this.edgeTooltip = document.createElement('div');
    this.edgeTooltip.id = 'graph-edge-tooltip';
    this.edgeTooltip.className = 'boards-graph-tooltip';
    this.edgeTooltip.style.position = 'absolute';
    this.edgeTooltip.style.pointerEvents = 'none';
    this.edgeTooltip.style.background = 'var(--bg-layer-2, white)';
    this.edgeTooltip.style.border = '1px solid var(--border-color, #ccc)';
    this.edgeTooltip.style.borderRadius = '8px';
    this.edgeTooltip.style.padding = '8px 12px';
    this.edgeTooltip.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
    this.edgeTooltip.style.fontSize = '12px';
    this.edgeTooltip.style.color = 'var(--text-main, #222)';
    this.edgeTooltip.style.zIndex = '10000';
    this.edgeTooltip.style.opacity = '0';
    this.edgeTooltip.style.transition = 'opacity 0.2s ease';
    this.graphRoot.appendChild(this.edgeTooltip);
    
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

       if (!this.isDraggingViewport) {
           this.handleEdgeHoverHitTest(e);
           return;
       }
       this.panX += e.movementX;
       this.panY += e.movementY;
       this.updatePlaneTransform();
    });
    
    window.addEventListener('mouseup', () => {
       this.isDraggingViewport = false;
       this.draggingNode = null;
    });

    // Background click clearing
    this.graphRoot.addEventListener('click', (e) => {
        // If clicked directly on the background (not a node label)
        if (e.target === this.graphRoot || e.target === this.graphPlane || e.target === this.edgesCanvas) {
            this.selectedGraphNodeId = null;
            this.updateNodeStyles();
            this.dirtyRender();
            if (this.app.propertiesPanel) {
                this.app.selection.clear(); // Ensure native is clear too
                this.app.propertiesPanel.fullRender();
            }
        }
    });
    
    // Listen to model updates purely locally so we don't spam when backgrounded
    this.app.graphModel.onGraphUpdated = (nodes, edges) => {
        if (!this.isActive) return;
        this.nodes = nodes;
        this.edges = edges;
        this.triggerLayoutUpdate();
    };
  }

  pointToLineDistance(px, py, x1, y1, x2, y2) {
      let l2 = (x1 - x2) ** 2 + (y1 - y2) ** 2;
      if (l2 === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
      let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
      t = Math.max(0, Math.min(1, t));
      let projX = x1 + t * (x2 - x1);
      let projY = y1 + t * (y2 - y1);
      return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
  }

  handleEdgeHoverHitTest(e) {
      // If hovering a node, let node's mouseenter handle it, skip edge hover
      if (e.target && e.target.classList && e.target.classList.contains('board-graph-node')) {
          return;
      }
      
      const rect = this.graphRoot.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      
      const planeX = (localX - this.panX) / this.zoom;
      const planeY = (localY - this.panY) / this.zoom;

      let foundEdge = null;
      let minDist = Number.MAX_VALUE;
      
      // Hit testing with basic bounds reject
      for (const edge of this.visibleEdges || []) {
          const minEX = Math.min(edge.source.x, edge.target.x) - 10;
          const maxEX = Math.max(edge.source.x, edge.target.x) + 10;
          const minEY = Math.min(edge.source.y, edge.target.y) - 10;
          const maxEY = Math.max(edge.source.y, edge.target.y) + 10;
          
          if (planeX < minEX || planeX > maxEX || planeY < minEY || planeY > maxEY) continue;

          const dist = this.pointToLineDistance(planeX, planeY, edge.source.x, edge.source.y, edge.target.x, edge.target.y);
          const hitRadius = Math.max(8, (edge.weight * 2) + 4) / this.zoom; 
          
          if (dist < hitRadius && dist < minDist) {
              minDist = dist;
              foundEdge = edge;
          }
      }
      
      if (this.hoveredEdge !== foundEdge) {
          this.hoveredEdge = foundEdge;
          this.updateTooltipDOM(localX, localY);
          this.dirtyRender(); // Rerender edges
      } else if (this.hoveredEdge) {
          // just move tooltip
          this.edgeTooltip.style.left = (localX + 15) + 'px';
          this.edgeTooltip.style.top = (localY + 15) + 'px';
      }
  }

  updateTooltipDOM(mouseX, mouseY) {
      if (!this.hoveredEdge) {
          this.edgeTooltip.style.opacity = '0';
          return;
      }
      
      const inCount = this.hoveredEdge.inbound || 0;
      const outCount = this.hoveredEdge.outbound || 0;
      
      this.edgeTooltip.innerHTML = `
          <div style="font-weight:bold; margin-bottom:4px;">${this.hoveredEdge.source.title} ↔ ${this.hoveredEdge.target.title}</div>
          <div style="color:var(--text-muted)">Total Links: ${this.hoveredEdge.weight}</div>
          <div style="color:var(--text-muted); font-size:10px;">(In: ${inCount}, Out: ${outCount})</div>
      `;
      
      this.edgeTooltip.style.left = (mouseX + 15) + 'px';
      this.edgeTooltip.style.top = (mouseY + 15) + 'px';
      this.edgeTooltip.style.opacity = '1';
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
     
     // 1.5 Clear selection if no longer visible
     if (this.selectedGraphNodeId && !activeNodeSet.has(this.selectedGraphNodeId)) {
         this.selectedGraphNodeId = null;
         if (this.app.propertiesPanel && this.app.isGraphActive) {
             this.app.propertiesPanel.fullRender();
         }
     }
     
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
      // Common state
      const activeBase = this.selectedGraphNodeId || this.hoveredGraphNodeId;
      const oneHopIds = new Set();
      if (activeBase) {
          oneHopIds.add(activeBase);
          for (const e of this.visibleEdges || []) {
              if (e.source.id === activeBase) oneHopIds.add(e.target.id);
              if (e.target.id === activeBase) oneHopIds.add(e.source.id);
          }
      }
      
      const hoveredEdgeIdStr = this.hoveredEdge ? `${this.hoveredEdge.source.id}-${this.hoveredEdge.target.id}` : null;
      
      // Redraw Canvas Edges
      this.ctx.clearRect(0, 0, this.edgesCanvas.width, this.edgesCanvas.height);
      const centerOffsetX = 4000;
      const centerOffsetY = 4000;

      this.ctx.save();
      this.ctx.translate(centerOffsetX, centerOffsetY);
      
      for (const e of this.visibleEdges) {
          const thickness = Math.max(0.5, Math.log1p(e.weight) * 2);
          
          let isEmphasized = false;
          let isDimmed = false;
          
          if (activeBase) {
              // Dimmed by default if there's an active base
              isDimmed = true;
              
              if (e.source.id === activeBase || e.target.id === activeBase) {
                  isEmphasized = true;
                  isDimmed = false;
              }
          }
          
          if (hoveredEdgeIdStr && `${e.source.id}-${e.target.id}` === hoveredEdgeIdStr) {
              isEmphasized = true;
              isDimmed = false;
          }

          this.ctx.beginPath();
          this.ctx.moveTo(e.source.x, e.source.y);
          this.ctx.lineTo(e.target.x, e.target.y);
          
          this.ctx.lineWidth = thickness;
          
          if (isDimmed) {
              this.ctx.strokeStyle = 'rgba(0,0,0, 0.05)';
          } else if (isEmphasized) {
              this.ctx.strokeStyle = `rgba(0,0,0, 0.4)`;
              this.ctx.lineWidth = thickness + 1;
          } else {
              this.ctx.strokeStyle = `rgba(0,0,0, 0.15)`;
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
              let targetScale = 1;

              if (activeBase) {
                  if (node.id === activeBase) {
                      el.style.opacity = '1';
                      el.style.zIndex = '100';
                      el.style.borderColor = 'var(--text-main, #333)';
                      el.style.background = 'white';
                      
                      if (this.selectedGraphNodeId === node.id) targetScale = 1.05;
                  } else if (oneHopIds.has(node.id)) {
                      el.style.opacity = '1';
                      el.style.zIndex = '50';
                      el.style.borderColor = 'var(--border-color, #ccc)';
                      el.style.background = 'var(--bg-layer-1, #f9f9f9)';
                  } else {
                      el.style.opacity = '0.3';
                      el.style.zIndex = '10';
                      el.style.borderColor = 'var(--border-color, #ccc)';
                      el.style.background = 'var(--bg-layer-1, #f9f9f9)';
                  }
              } else {
                  el.style.opacity = '1';
                  el.style.zIndex = '10';
                  el.style.borderColor = 'var(--border-color, #ccc)';
                  el.style.background = 'var(--bg-layer-1, #f9f9f9)';
              }
              
              if (this.hoveredGraphNodeId === node.id && !this.selectedGraphNodeId) {
                  el.style.background = 'var(--bg-hover, #efefef)';
              }

              el.style.transform = `translate(${Math.round(node.x)}px, ${Math.round(node.y)}px) scale(${targetScale})`;
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
              this.selectedGraphNodeId = node.id;
              
              // Decouple native selection
              this.app.selection.clear();
              
              this.draggingNode = node;
              this.dirtyRender();
              
              if (this.app.propertiesPanel) {
                  this.app.propertiesPanel.switchTab('inspect', true);
                  this.app.propertiesPanel.fullRender();
              }
          });
          
          el.addEventListener('dblclick', (e) => {
              e.stopPropagation();
              this.app.loadNativeBoard(node.id);
          });
          
          el.addEventListener('mouseenter', () => {
              this.hoveredGraphNodeId = node.id;
              this.dirtyRender();
          });
          el.addEventListener('mouseleave', () => {
              if (this.hoveredGraphNodeId === node.id) {
                  this.hoveredGraphNodeId = null;
                  this.dirtyRender();
              }
          });

          this.nodesDiv.appendChild(el);
      }
      this.dirtyRender();
  }
}
