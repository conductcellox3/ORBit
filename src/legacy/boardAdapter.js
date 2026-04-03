export class BoardAdapter {
  constructor() {}

  adapt(legacyMeta, legacyState) {
    const boardId = legacyMeta.id;
    const notesArray = [];
    const framesArray = [];
    
    // Parse Notes, Frames, Images
    if (legacyState.notes && Array.isArray(legacyState.notes)) {
      for (const item of legacyState.notes) {
        if (!item.id) continue;
        
        const type = item.type || 'note';
        
        if (type === 'frame') {
          framesArray.push([
            item.id,
            {
              id: item.id,
              title: item.title || 'Frame',
              x: item.x || 0,
              y: item.y || 0,
              width: item.w || 400,
              height: item.h || 300
            }
          ]);
        } else if (type === 'image') {
          notesArray.push([
            item.id,
            {
              id: item.id,
              isImage: true,
              src: item.src,
              caption: item.caption || '',
              x: item.x || 0,
              y: item.y || 0,
              width: item.w || 200,
              height: item.h || 200
            }
          ]);
        } else {
          // Default: note
          notesArray.push([
            item.id,
            {
              id: item.id,
              text: item.text || '',
              x: item.x || 0,
              y: item.y || 0,
              width: item.w, // Can be undefined in v2
              height: item.h
            }
          ]);
        }
      }
    }

    const edgesArray = [];
    if (legacyState.edges && Array.isArray(legacyState.edges)) {
      for (const edge of legacyState.edges) {
        if (!edge.id) edge.id = crypto.randomUUID();
        edgesArray.push([
          edge.id,
          {
            id: edge.id,
            sourceId: edge.from,
            targetId: edge.to
          }
        ]);
      }
    }
    
    // Canvas pan/zoom
    const canvas = legacyState.canvas || { panX: 0, panY: 0, zoom: 1 };

    return {
      boardId,
      sourceType: 'legacy',
      notes: notesArray,
      frames: framesArray,
      edges: edgesArray,
      canvas: canvas
    };
  }
}

export const legacyAdapter = new BoardAdapter();
