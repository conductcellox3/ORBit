import { extractKeywords } from './textTokens.js';

export class HarvestEngine {
  static getSeeds(state) {
    const textSeeds = [];
    const ocrSeeds = [];

    // Pre-calculate edge map to avoid inner loop over all edges
    const hasEdge = new Set();
    for (const edge of state.edges.values()) {
      hasEdge.add(edge.sourceId);
      hasEdge.add(edge.targetId);
    }

    for (const note of state.notes.values()) {
      if (note.parentFrameId || hasEdge.has(note.id)) {
        continue; // Must be isolated
      }

      if (note.type === 'background-image' || note.type === 'linked-board') {
        continue;
      }

      if (note.type === 'image' || note.isImage) {
        if (note.ocrText && note.ocrText.trim().length > 20) {
          ocrSeeds.push(note);
        }
      } else {
        // Assume text/markdown
        if (note.text && note.text.trim().length > 50) {
          textSeeds.push(note);
        }
      }
    }

    textSeeds.sort((a, b) => b.text.length - a.text.length);
    ocrSeeds.sort((a, b) => b.ocrText.length - a.ocrText.length);

    return { textSeeds, ocrSeeds };
  }

  static getMarkers(state) {
    const groups = {
      action: [],
      question: [],
      risk: [],
      decision: [],
      reference: [],
      other: []
    };

    for (const note of state.notes.values()) {
        if (note.markers && note.markers.length > 0) {
            for (const m of note.markers) {
                const marker = m.toLowerCase();
                if (groups[marker]) {
                    groups[marker].push(note);
                } else {
                    groups.other.push(note);
                }
            }
        }
    }

    return groups;
  }

  static getConnections(state) {
    const nearMisses = [];
    const farConnections = [];

    // Pre-filter valid notes
    const validNotes = [];
    for (const note of state.notes.values()) {
       if (note.type === 'background-image' || note.type === 'linked-board') continue;
       
       let textContent = '';
       if (note.type === 'image' || note.isImage) {
           textContent = note.ocrText || '';
       } else {
           textContent = note.text || '';
       }

       if (textContent.trim().length < 10) continue;

       const w = note.width || 400;
       const h = note.height || 300;
       validNotes.push({
           node: note,
           id: note.id,
           box: { left: note.x, right: note.x + w, top: note.y, bottom: note.y + h },
           keywords: extractKeywords(textContent),
           frame: note.parentFrameId,
           markers: new Set((note.markers || []).map(m => m.toLowerCase()))
       });
    }

    const hasEdgeMap = new Set();
    for (const edge of state.edges.values()) {
        hasEdgeMap.add(`${edge.sourceId}-${edge.targetId}`);
        hasEdgeMap.add(`${edge.targetId}-${edge.sourceId}`);
    }

    for (let i = 0; i < validNotes.length; i++) {
        for (let j = i + 1; j < validNotes.length; j++) {
            const a = validNotes[i];
            const b = validNotes[j];
            
            if (hasEdgeMap.has(`${a.id}-${b.id}`)) continue;
            if (a.frame && b.frame && a.frame === b.frame) continue;

            const dx = Math.max(0, a.box.left - b.box.right, b.box.left - a.box.right);
            const dy = Math.max(0, a.box.top - b.box.bottom, b.box.top - a.box.bottom);
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (dist < 150) {
                 nearMisses.push({
                     noteA: a.node,
                     noteB: b.node,
                     dist: dist,
                     reason: 'Proximate but unlinked'
                 });
                 continue; 
            }

            if (dist > 800) {
                 let sharedWords = 0;
                 const sharedKeywords = [];
                 for (const kw of a.keywords) {
                     if (b.keywords.has(kw)) {
                         sharedWords++;
                         sharedKeywords.push(kw);
                     }
                 }
                 
                 let markerBonus = 0;
                 const sharedMarkers = [];
                 for (const m of a.markers) {
                     if (b.markers.has(m)) {
                         markerBonus++;
                         sharedMarkers.push(m);
                     }
                 }

                 const score = sharedWords + markerBonus * 2;
                 
                 // Require at least 2 strong shared terms OR 1 term + 1 marker
                 if (sharedWords >= 2 || (sharedWords >= 1 && markerBonus > 0)) {
                     let reason = [];
                     const displayKw = sharedKeywords.slice(0, 2);
                     reason.push(`Shared keywords: "${displayKw.join('", "')}"${sharedWords > 2 ? '...' : ''}`);
                     if (markerBonus > 0) reason.push(`Shared marker: [${sharedMarkers[0]}]`);
                     
                     farConnections.push({
                         noteA: a.node,
                         noteB: b.node,
                         score: score,
                         reason: reason.join(' | ')
                     });
                 }
            }
        }
    }

    nearMisses.sort((a, b) => a.dist - b.dist);
    farConnections.sort((a, b) => b.score - a.score);

    return {
        nearMisses: nearMisses.slice(0, 10),
        farConnections: farConnections.slice(0, 5)
    };
  }
}
