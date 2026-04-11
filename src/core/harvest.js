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
}
