export class BoardMarkdown {
    /**
     * Serializes the board state into markdown.
     * Returns an object { markdown: string }
     */
    static serialize(state, options = {}) {
        const mode = options.mode || 'spatial';
        if (mode === 'flow') {
            return this.serializeFlow(state, options);
        }
        return this.serializeSpatial(state, options);
    }

    static getReadableLabel(note) {
        if (!note) return 'Node';
        if (note.type === 'image' || note.isImage) {
            return note.caption || note.snapshot?.caption || '[image]';
        }
        if (note.type === 'linked-note') {
            return note.snapshot?.caption || note.snapshot?.text || note.text || '[linked-note]';
        }
        return note.title || note.text || '[node]';
    }

    static formatNoteBlock(note, includeMeta, isListMode = false, indentLevel = 0) {
        let output = '';
        const ind = '  '.repeat(indentLevel);
        const prefix = isListMode ? `${ind}- ` : '';
        const blockInd = isListMode ? `${ind}  ` : '';
        
        if (includeMeta) {
            const meta = { id: note.id, coords: [Math.round(note.x), Math.round(note.y)] };
            if (note.colorKey) meta.color = note.colorKey;
            if (note.type === 'linked-note' && note.sourceRef) {
                meta.sourceRef = note.sourceRef;
            }
            output += `${isListMode ? ind : ''}<!-- EXPORT_META: ${JSON.stringify(meta)} -->\n`;
        }
        
        // Markers
        let markerStr = '';
        if (note.markers && note.markers.length > 0) {
            markerStr = note.markers.map(m => `[${m}]`).join(' ') + ' ';
        }
        
        // Content
        if (note.type === 'image' || note.isImage) {
            const caption = note.caption || note.snapshot?.caption || '';
            output += `${prefix}${markerStr}[image] ${caption}\n`;
        } else if (note.type === 'linked-note') {
            const sourceTitle = note.linkMeta?.sourceBoardTitle || 'Unknown';
            output += `${prefix}${markerStr}[linked from: ${sourceTitle}]\n`;
            
            const contentText = note.snapshot?.text || note.snapshot?.caption || '';
            if (contentText) {
                const quoted = `> ${contentText.trim().replace(/\n/g, `\n${blockInd}> `)}`;
                output += `${blockInd}${quoted}\n`;
            }
        } else {
            // Text note
            const textLines = (note.text || '').split('\n');
            if (isListMode) {
                output += `${prefix}${markerStr}${textLines[0]}\n`;
                for (let i = 1; i < textLines.length; i++) {
                    output += `${blockInd}${textLines[i]}\n`;
                }
            } else {
                output += `${markerStr}${note.text || ''}\n`;
            }
        }
        
        return output + (isListMode ? '' : '\n');
    }

    static assignNotesToFrames(state) {
        const frameMap = new Map(state.frames?.entries() || []);
        const noteMap = new Map(state.notes?.entries() || []);
        const noteToFrame = new Map();
        
        const contains = (f, n) => {
            const nw = n.width || 120;
            const nh = n.height || 56;
            return n.x >= f.x && (n.x + nw) <= (f.x + f.width) &&
                   n.y >= f.y && (n.y + nh) <= (f.y + f.height);
        };

        for (const [noteId, note] of noteMap) {
            if (note.parentFrameId && frameMap.has(note.parentFrameId)) {
                noteToFrame.set(noteId, frameMap.get(note.parentFrameId));
            }
        }
        
        for (const [noteId, note] of noteMap) {
            if (!noteToFrame.has(noteId)) {
                for (const frame of frameMap.values()) {
                    if (contains(frame, note)) {
                        noteToFrame.set(noteId, frame);
                        break;
                    }
                }
            }
        }
        return noteToFrame;
    }

    static serializeSpatial(state, options) {
        const includeMeta = options.includeMeta !== false;
        let md = `# ${state.title}\n\n`;
        
        if (includeMeta) {
            md += `<!-- EXPORT_META: {"sourceType": "${state.sourceType}", "zoom": ${state.canvas?.zoom || 1}, "pan": [${state.canvas?.panX || 0}, ${state.canvas?.panY || 0}]} -->\n\n`;
        }

        const frameMap = new Map(state.frames?.entries() || []);
        const noteMap = new Map(state.notes?.entries() || []);
        const noteToFrame = this.assignNotesToFrames(state);
        
        const frameGroups = new Map();
        for (const [frameId, frame] of frameMap) {
            frameGroups.set(frameId, { frame, notes: [] });
        }
        
        const ungroupedNotes = [];
        
        for (const [noteId, note] of noteMap) {
            const frame = noteToFrame.get(noteId);
            if (frame && frameGroups.has(frame.id)) {
                frameGroups.get(frame.id).notes.push(note);
            } else {
                ungroupedNotes.push(note);
            }
        }
        
        const sortedFrames = Array.from(frameGroups.values()).sort((a, b) => {
            if (Math.abs(a.frame.y - b.frame.y) > 10) return a.frame.y - b.frame.y;
            return a.frame.x - b.frame.x;
        });
        
        const sortNotes = (nodes) => {
            return nodes.sort((a, b) => {
                if (Math.abs(a.y - b.y) > 10) return a.y - b.y;
                return a.x - b.x;
            });
        };
        
        // Serialize Frames
        for (const group of sortedFrames) {
            md += `## Frame: ${group.frame.title || 'Untitled'}\n`;
            if (includeMeta) {
                const frameMeta = { id: group.frame.id, coords: [Math.round(group.frame.x), Math.round(group.frame.y)] };
                if (group.frame.colorKey) frameMeta.color = group.frame.colorKey;
                md += `<!-- EXPORT_META: ${JSON.stringify(frameMeta)} -->\n\n`;
            } else {
                md += '\n';
            }
            
            const sortedNodes = sortNotes(group.notes);
            for (const note of sortedNodes) {
                md += this.formatNoteBlock(note, includeMeta, false);
            }
        }
        
        // Serialize Ungrouped
        if (ungroupedNotes.length > 0) {
            md += `## Ungrouped\n\n`;
            const sortedUngrouped = sortNotes(ungroupedNotes);
            for (const note of sortedUngrouped) {
                md += this.formatNoteBlock(note, includeMeta, false);
            }
        }
        
        // Relations Appendix
        if (state.edges && state.edges.size > 0) {
            md += `## Relations\n\n`;
            for (const edge of state.edges.values()) {
                const source = noteMap.get(edge.sourceId);
                const target = noteMap.get(edge.targetId);
                if (source && target) {
                    const safeSource = this.getReadableLabel(source).replace(/\n/g, ' ').substring(0, 50).trim();
                    const safeTarget = this.getReadableLabel(target).replace(/\n/g, ' ').substring(0, 50).trim();
                    md += `- [${safeSource}](${edge.sourceId}) -> [${safeTarget}](${edge.targetId})\n`;
                }
            }
            md += '\n';
        }

        return { markdown: md.trim() + '\n' };
    }

    static serializeFlow(state, options) {
        const includeMeta = options.includeMeta !== false;
        let md = `# ${state.title}\n\n`;
        
        if (includeMeta) {
            md += `<!-- EXPORT_META: {"sourceType": "${state.sourceType}", "zoom": ${state.canvas?.zoom || 1}, "pan": [${state.canvas?.panX || 0}, ${state.canvas?.panY || 0}]} -->\n\n`;
        }

        const noteMap = new Map(state.notes?.entries() || []);
        const edges = Array.from(state.edges?.values() || []);
        
        const adjOut = new Map();
        const inDegree = new Map();
        
        for (const [id, note] of noteMap) {
            adjOut.set(id, []);
            inDegree.set(id, 0);
        }
        
        for (const edge of edges) {
            if (adjOut.has(edge.sourceId) && adjOut.has(edge.targetId)) {
                adjOut.get(edge.sourceId).push(edge);
                inDegree.set(edge.targetId, inDegree.get(edge.targetId) + 1);
            }
        }
        
        const sortNotes = (ns) => {
            return ns.sort((a, b) => {
                if (Math.abs(a.y - b.y) > 10) return a.y - b.y;
                if (Math.abs(a.x - b.x) > 10) return a.x - b.x;
                return a.id.localeCompare(b.id);
            });
        };

        const roots = [];
        for (const [id, count] of inDegree.entries()) {
            if (count === 0) roots.push(noteMap.get(id));
        }
        sortNotes(roots);

        const assigned = new Set();
        let currentMd = '';
        
        const treeEdges = new Set();
        
        const dfs = (note, indentLevel, visitedPath) => {
            if (!note) return;
            assigned.add(note.id);
            currentMd += this.formatNoteBlock(note, includeMeta, true, indentLevel);
            
            const outgoingEdges = adjOut.get(note.id) || [];
            const childTargets = outgoingEdges.map(e => noteMap.get(e.targetId)).filter(Boolean);
            const sortedChildren = sortNotes([...childTargets]);

            for (const childNode of sortedChildren) {
                const edge = outgoingEdges.find(e => e.targetId === childNode.id);
                if (visitedPath.has(childNode.id) || assigned.has(childNode.id)) {
                    continue; // Skip cycles or already assigned nodes in flow
                }
                if (edge) treeEdges.add(edge.id);
                
                const newVisited = new Set(visitedPath);
                newVisited.add(childNode.id);
                dfs(childNode, indentLevel + 1, newVisited);
            }
        };

        // Render rooted trees grouped by frame
        const noteToFrame = this.assignNotesToFrames(state);
        
        const groupRootsByFrame = (rootNodes) => {
            const groups = new Map();
            for (const node of rootNodes) {
                const frame = noteToFrame.get(node.id);
                const frameId = frame ? frame.id : 'ungrouped';
                if (!groups.has(frameId)) {
                    groups.set(frameId, { frame, roots: [] });
                }
                groups.get(frameId).roots.push(node);
            }
            
            return Array.from(groups.values()).sort((a, b) => {
                if (!a.frame && b.frame) return 1;
                if (a.frame && !b.frame) return -1;
                if (!a.frame && !b.frame) return 0;
                if (Math.abs(a.frame.y - b.frame.y) > 10) return a.frame.y - b.frame.y;
                return a.frame.x - b.frame.x;
            });
        };
        
        const rootGroups = groupRootsByFrame(roots);

        for (const group of rootGroups) {
            const unassignedRoots = group.roots.filter(r => !assigned.has(r.id));
            if (unassignedRoots.length === 0) continue;
            
            currentMd += `## ${group.frame ? 'Frame: ' + (group.frame.title || 'Untitled') : 'Ungrouped Flow'}\n\n`;
            
            for (const root of unassignedRoots) {
                if (!assigned.has(root.id)) {
                    dfs(root, 0, new Set([root.id]));
                    currentMd += '\n';
                }
            }
        }
        
        // Render any isolated subgraphs (cycles without roots)
        const unassignedNodes = [];
        for (const [id, note] of noteMap) {
            if (!assigned.has(id)) unassignedNodes.push(note);
        }
        sortNotes(unassignedNodes);
        
        if (unassignedNodes.length > 0) {
            const isolatedGroups = groupRootsByFrame(unassignedNodes);
            currentMd += `## Disconnected Flow\n\n`;
            
            for (const group of isolatedGroups) {
                if (group.frame) {
                    currentMd += `### Frame: ${group.frame.title || 'Untitled'}\n\n`;
                } else {
                    currentMd += `### Ungrouped\n\n`;
                }
                
                for (const node of group.roots) {
                    if (!assigned.has(node.id)) {
                        dfs(node, 0, new Set([node.id]));
                        currentMd += '\n';
                    }
                }
            }
        }
        
        md += currentMd;
        
        // Render leftover edges representing cross-links or cycles
        const leftoverEdges = edges.filter(e => !treeEdges.has(e.id) && noteMap.has(e.sourceId) && noteMap.has(e.targetId));
        if (leftoverEdges.length > 0) {
            md += `## Additional Relations\n\n`;
            for (const edge of leftoverEdges) {
                const source = noteMap.get(edge.sourceId);
                const target = noteMap.get(edge.targetId);
                const safeSource = this.getReadableLabel(source).replace(/\n/g, ' ').substring(0, 50).trim();
                const safeTarget = this.getReadableLabel(target).replace(/\n/g, ' ').substring(0, 50).trim();
                md += `- [${safeSource}](${edge.sourceId}) -> [${safeTarget}](${edge.targetId})\n`;
            }
            md += '\n';
        }

        return { markdown: md.trim() + '\n' };
    }
}
