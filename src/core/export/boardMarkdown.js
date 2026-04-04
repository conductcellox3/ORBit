export class BoardMarkdown {
    /**
     * Serializes the board state into markdown.
     * Returns an object { markdown: string, assets: Array<{id: string, src: string, suggestedFilename: string}> }
     */
    static serialize(state, options = {}) {
        const includeMeta = options.includeMeta !== false;
        const assetsToExport = [];
        let md = `# ${state.title}\n\n`;
        
        if (includeMeta) {
            md += `<!-- EXPORT_META: {"sourceType": "${state.sourceType}", "zoom": ${state.canvas.zoom}, "pan": [${state.canvas.panX}, ${state.canvas.panY}]} -->\n\n`;
        }

        // 1. Structure items
        const frameMap = new Map(state.frames.entries());
        const noteMap = new Map(state.notes.entries());
        const placedNoteIds = new Set();
        
        // Group notes by frame based on ID mapping first, then geometric fallback
        const frameGroups = new Map(); // frameId -> [note1, note2, ...]
        
        for (const [frameId, frame] of frameMap) {
            frameGroups.set(frameId, {
                frame,
                notes: []
            });
        }
        
        // Helper to check geometric containment
        const contains = (f, n) => {
            const nw = n.width || 120;
            const nh = n.height || 56;
            return n.x >= f.x && (n.x + nw) <= (f.x + f.width) &&
                   n.y >= f.y && (n.y + nh) <= (f.y + f.height);
        };

        // First pass: parentFrameId & childIds
        for (const [noteId, note] of noteMap) {
            if (note.parentFrameId && frameGroups.has(note.parentFrameId)) {
                frameGroups.get(note.parentFrameId).notes.push(note);
                placedNoteIds.add(noteId);
            }
        }
        
        // Second pass: Geometric fallback for remaining notes
        for (const [noteId, note] of noteMap) {
            if (!placedNoteIds.has(noteId)) {
                // Find matching frame
                let foundFrameId = null;
                for (const [frameId, group] of frameGroups) {
                    if (contains(group.frame, note)) {
                        foundFrameId = frameId;
                        break; // Assign to first matching frame
                    }
                }
                
                if (foundFrameId) {
                    frameGroups.get(foundFrameId).notes.push(note);
                    placedNoteIds.add(noteId);
                }
            }
        }
        
        // Ungrouped notes
        const ungroupedNotes = [];
        for (const [noteId, note] of noteMap) {
            if (!placedNoteIds.has(noteId)) {
                ungroupedNotes.push(note);
            }
        }
        
        // 2. Sort Frames Spatially (y asc, x asc)
        const sortedFrames = Array.from(frameGroups.values()).sort((a, b) => {
            if (Math.abs(a.frame.y - b.frame.y) > 10) return a.frame.y - b.frame.y;
            return a.frame.x - b.frame.x;
        });
        
        // Sort notes spatially within array
        const sortNotes = (nodes) => {
            return nodes.sort((a, b) => {
                if (Math.abs(a.y - b.y) > 10) return a.y - b.y;
                return a.x - b.x;
            });
        };
        
        let imageCounter = 1;
        const formatNote = (note) => {
            let output = '';
            
            if (includeMeta) {
                // Metadata comment
                const meta = { id: note.id, coords: [Math.round(note.x), Math.round(note.y)] };
                if (note.colorKey) meta.color = note.colorKey;
                output += `<!-- EXPORT_META: ${JSON.stringify(meta)} -->\n`;
            }
            
            // Markers
            if (note.markers && note.markers.length > 0) {
                output += note.markers.map(m => `[${m}]`).join(' ') + ' ';
            }
            
            // Content
            if (note.type === 'image' || note.isImage) {
                const extMatch = note.src ? note.src.match(/\.([a-zA-Z0-9]+)$/) : null;
                const ext = extMatch ? extMatch[1] : 'png';
                const filename = `image_${String(imageCounter).padStart(3, '0')}.${ext}`;
                imageCounter++;
                
                assetsToExport.push({
                    id: note.id,
                    src: note.src,
                    suggestedFilename: filename
                });
                
                const caption = note.caption ? note.caption.trim() : '';
                output += `![${caption}](./${state.slug || 'board'}.assets/${filename})\n`;
                if (caption) output += `*${caption}*\n`;
            } else if (note.url) {
                // Linked note
                output += `[${note.title || note.text}](${note.url})\n`;
                if (note.description) output += `> ${note.description.replace(/\n/g, '\n> ')}\n`;
            } else {
                // Text note
                output += `${note.text || ''}\n`;
            }
            return output + '\n';
        };

        // 3. Serialize Frames
        for (const group of sortedFrames) {
            md += `## Frame: ${group.frame.title || 'Untitled'}\n`;
            
            if (includeMeta) {
                const frameMeta = { id: group.frame.id, coords: [Math.round(group.frame.x), Math.round(group.frame.y)] };
                if (group.frame.colorKey) frameMeta.color = group.frame.colorKey;
                md += `<!-- EXPORT_META: ${JSON.stringify(frameMeta)} -->\n\n`;
            } else {
                md += '\n'; // Keep vertical spacing consistent
            }
            
            const sortedNodes = sortNotes(group.notes);
            for (const note of sortedNodes) {
                md += formatNote(note);
            }
        }
        
        // 4. Serialize Ungrouped
        if (ungroupedNotes.length > 0) {
            md += `## Ungrouped\n\n`;
            const sortedUngrouped = sortNotes(ungroupedNotes);
            for (const note of sortedUngrouped) {
                md += formatNote(note);
            }
        }
        
        // 5. Relations Appendix
        if (state.edges && state.edges.size > 0) {
            md += `## Relations\n\n`;
            for (const edge of state.edges.values()) {
                const source = noteMap.get(edge.sourceId);
                const target = noteMap.get(edge.targetId);
                if (source && target) {
                    const sourceText = source.title || source.text || (source.type === 'image' ? 'Image' : 'Node');
                    const targetText = target.title || target.text || (target.type === 'image' ? 'Image' : 'Node');
                    
                    const safeSource = sourceText.replace(/\n/g, ' ').substring(0, 40).trim();
                    const safeTarget = targetText.replace(/\n/g, ' ').substring(0, 40).trim();
                    
                    md += `- [${safeSource}](${edge.sourceId}) -> [${safeTarget}](${edge.targetId})\n`;
                }
            }
            md += '\n';
        }

        return {
            markdown: md.trim() + '\n',
            assets: assetsToExport
        };
    }
}
