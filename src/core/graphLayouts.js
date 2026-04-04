export class GraphLayouts {
    
    // Bounds a value between min and max
    static clamp(val, min, max) {
        return Math.min(Math.max(val, min), max);
    }
    
    /**
     * Applies a bounded, settling Force Layout.
     * Call this inside a requestAnimationFrame wrapper or synchronous pre-calc.
     * Modifies node.x, node.y, node.vx, node.vy directly.
     * @param {Array} nodes 
     * @param {Array} edges 
     * @param {Object} options 
     */
    static tickForce(nodes, edges, options = {}) {
        const { width = 1000, height = 800, alpha = 0.1, repulsion = 15000, attraction = 0.03, centerPull = 0.01 } = options;

        // 1. Repulsion between all nodes
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const n1 = nodes[i];
                const n2 = nodes[j];
                let dx = n2.x - n1.x;
                let dy = n2.y - n1.y;
                let dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist === 0) { dx = (Math.random() - 0.5); dy = (Math.random() - 0.5); dist = 1; }
                if (dist < 600) { 
                    // Extra repulsion if too close to avoid text overlapping completely
                    const activeRepulsion = dist < 120 ? repulsion * 3 : repulsion;
                    const force = (activeRepulsion / (dist * dist)) * alpha;
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;
                    
                    n1.vx -= fx;
                    n1.vy -= fy;
                    n2.vx += fx;
                    n2.vy += fy;
                }
            }
        }

        // 2. Attraction along edges
        for (const e of edges) {
            const dx = e.target.x - e.source.x;
            const dy = e.target.y - e.source.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Weight slightly influences attraction, but not overwhelmingly
            const weightBonus = Math.sqrt(e.weight || 1); 
            const force = dist * attraction * alpha * weightBonus;
            
            if (dist > 0) {
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                
                e.source.vx += fx;
                e.source.vy += fy;
                e.target.vx -= fx;
                e.target.vy -= fy;
            }
        }

        // 3. Center gravity to keep them on screen
        for (const n of nodes) {
            n.vx += (0 - n.x) * centerPull * alpha;
            n.vy += (0 - n.y) * centerPull * alpha;
            
            // Apply velocity and dampen
            n.x += n.vx;
            n.y += n.vy;
            n.vx *= 0.6; // strong friction
            n.vy *= 0.6;
        }
    }

    /**
     * Topic layout
     * Clusters nodes into grids grouped by their Topic strings.
     */
    static applyTopicLayout(nodes) {
        const topics = new Map();
        
        for (const n of nodes) {
            const t = n.topic || 'No Topic';
            if (!topics.has(t)) topics.set(t, []);
            topics.get(t).push(n);
        }

        let currentY = -400; // Starting Y coordinate
        const MARGIN = 150;    // Margin between rows
        const COL_SPACE = 220; // Space between columns
        
        const labels = [];

        for (const [topic, groupNodes] of topics.entries()) {
            
            const columns = Math.ceil(Math.sqrt(groupNodes.length));
            const firstX = -((columns * COL_SPACE) / 2) + (COL_SPACE / 2);
            
            // Generate label for the group
            labels.push({
                text: topic,
                x: firstX - 150, // To the left of the group
                y: currentY // Inline with the first row
            });
            
            // Layout this row (or grid depending on count)
            // Just simple horizontal wrapping per topic cluster
            let maxRowHeight = MARGIN;

            groupNodes.forEach((n, i) => {
                const row = Math.floor(i / columns);
                const col = i % columns;
                
                n.x = (col * COL_SPACE) - ((columns * COL_SPACE) / 2) + (COL_SPACE / 2);
                n.y = currentY + (row * MARGIN);
            });

            const rowsRequired = Math.ceil(groupNodes.length / columns);
            currentY += (rowsRequired * MARGIN) + MARGIN;
        }
        
        return labels;
    }

    /**
     * Timeline layout
     * Orders nodes strictly by createdAt time on a vertical timeline with horizontal jitter.
     */
    static applyTimelineLayout(nodes) {
        // Sort strictly by createdAt ascending
        const sorted = [...nodes].sort((a, b) => a.createdAt - b.createdAt);
        
        let startY = -400;
        const SPACE_Y = 120;
        const labels = [];
        let currentMonthYear = '';
        
        sorted.forEach((n, idx) => {
            n.y = startY + (idx * SPACE_Y);
            // Alternate left/right to prevent severe collisions
            n.x = (idx % 2 === 0 ? -1 : 1) * (150 + (idx % 3) * 50);
            
            if (n.createdAt) {
                const date = new Date(n.createdAt);
                const my = `${date.getFullYear()}年${date.getMonth() + 1}月`;
                if (my !== currentMonthYear) {
                    currentMonthYear = my;
                    labels.push({
                        text: my,
                        x: -300, // Keep purely to the left
                        y: n.y
                    });
                }
            }
        });
        
        return labels;
    }
}
