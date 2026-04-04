import { workspaceManager } from './workspace.js';

export class GraphModel {
  constructor(app) {
    this.app = app;
    this.nodes = [];
    this.edges = [];
    
    // Callbacks
    this.onGraphUpdated = null;
  }

  // Regenerates the nodes and edges from workspaceManager state
  build() {
    if (!workspaceManager.manifest || !workspaceManager.manifest.boards) {
      this.nodes = [];
      this.edges = [];
      if (this.onGraphUpdated) this.onGraphUpdated(this.nodes, this.edges);
      return;
    }

    const nodeMap = new Map();
    const newNodes = [];

    // 1. Build Nodes (Native boards only for this sprint config)
    for (const b of workspaceManager.manifest.boards) {
      const gNode = {
        id: b.id,
        title: b.title,
        topic: b.topic || 'No Topic',
        createdAt: new Date(b.createdAt || Date.now()).getTime(),
        updatedAt: new Date(b.updatedAt || Date.now()).getTime(),
        sourceType: 'native',
        x: Math.random() * 800 - 400, // Initial random scatter for force layout seeding
        y: Math.random() * 600 - 300,
        vx: 0,
        vy: 0,
        incoming: 0,
        outgoing: 0,
        totalWeight: 0
      };
      nodeMap.set(b.id, gNode);
      newNodes.push(gNode);
    }

    // 2. Build Edges (Un-directional for the graph, accumulating thickness)
    const edgeMap = new Map(); // e.g. "A_B" -> { source: 'A', target: 'B', weight: N }
    const getEdgeId = (id1, id2) => {
      const sorted = [id1, id2].sort();
      return `${sorted[0]}___${sorted[1]}`;
    };

    if (workspaceManager.globalAdjacencyGraph) {
      for (const [fromId, targetsMap] of workspaceManager.globalAdjacencyGraph.entries()) {
        const fromNode = nodeMap.get(fromId);
        if (!fromNode) continue;

        for (const [toId, relation] of targetsMap.entries()) {
           const toNode = nodeMap.get(toId);
           if (!toNode || fromId === toId) continue; // Avoid self loops or orphans

           fromNode.outgoing += relation.count;
           fromNode.totalWeight += relation.count;
           toNode.incoming += relation.count;
           toNode.totalWeight += relation.count;

           const eId = getEdgeId(fromId, toId);
           let e = edgeMap.get(eId);
           if (!e) {
             e = { id: eId, sourceId: fromId, targetId: toId, weight: 0 };
             edgeMap.set(eId, e);
           }
           e.weight += relation.count;
        }
      }
    }

    // Assign reference to actual node objects for Layout algorithms
    const newEdges = Array.from(edgeMap.values()).map(e => ({
       id: e.id,
       source: nodeMap.get(e.sourceId),
       target: nodeMap.get(e.targetId),
       weight: e.weight
    }));

    // Retain previous positions so the graph doesn't violently explode on every refresh
    for (const old of this.nodes) {
       const replacement = nodeMap.get(old.id);
       if (replacement) {
          replacement.x = old.x;
          replacement.y = old.y;
          replacement.vx = old.vx;
          replacement.vy = old.vy;
       }
    }

    this.nodes = newNodes;
    this.edges = newEdges;

    if (this.onGraphUpdated) {
        this.onGraphUpdated(this.nodes, this.edges);
    }
  }
}
