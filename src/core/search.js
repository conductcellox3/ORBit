import { workspaceManager } from './workspace.js';
import { readTextFile, exists } from '@tauri-apps/plugin-fs';

export class SearchEngine {
  constructor(app) {
    this.app = app;
    this.allBoardsCache = new Map(); // boardId -> { timestamp, data: [{id, type, text, caption, title}] }
  }

  // --- This Board Search ---
  async searchThisBoard(query) {
    if (!query || query.trim() === '') return [];
    const q = query.toLowerCase().trim();
    const results = [];
    const state = this.app.state;

    // Search Notes
    for (const [id, note] of state.notes.entries()) {
      const isImage = note.type === 'image' || note.isImage;
      if (isImage) {
        if (note.caption && note.caption.toLowerCase().includes(q)) {
          results.push({
            type: 'image',
            id: note.id,
            boardId: state.boardId,
            boardTitle: state.title,
            matchField: 'caption',
            snippet: this.generateSnippet(note.caption, q),
            sourceType: state.sourceType
          });
        }
      } else {
        if (note.text && note.text.toLowerCase().includes(q)) {
          results.push({
            type: 'note',
            id: note.id,
            boardId: state.boardId,
            boardTitle: state.title,
            matchField: 'text',
            snippet: this.generateSnippet(note.text, q),
            sourceType: state.sourceType
          });
        }
      }
    }

    // Search Frames
    for (const [id, frame] of state.frames.entries()) {
      if (frame.title && frame.title.toLowerCase().includes(q)) {
        results.push({
          type: 'frame',
          id: frame.id,
          boardId: state.boardId,
          boardTitle: state.title,
          matchField: 'title',
          snippet: this.generateSnippet(frame.title, q),
          sourceType: state.sourceType
        });
      }
    }

    return results;
  }

  // --- All Boards Search ---
  async searchAllBoards(query) {
    if (!query || query.trim() === '') return [];
    if (!workspaceManager.manifest) return [];

    const q = query.toLowerCase().trim();
    const results = [];

    // Ensure we gather promises so they resolve in parallel, but cache heavily.
    const boardPromises = workspaceManager.manifest.boards.map(async (boardEntry) => {
      // Direct Board Metadata Search
      let boardMatched = false;
      if (boardEntry.title && boardEntry.title.toLowerCase().includes(q)) {
        results.push({
          type: 'board',
          id: null,
          boardId: boardEntry.id,
          boardTitle: boardEntry.title,
          matchField: 'title',
          snippet: this.generateSnippet(boardEntry.title, q),
          sourceType: boardEntry.type || 'native'
        });
        boardMatched = true;
      }
      if (boardEntry.topic && boardEntry.topic.toLowerCase().includes(q)) {
        results.push({
          type: 'board',
          id: null,
          boardId: boardEntry.id,
          boardTitle: boardEntry.title,
          matchField: 'topic',
          snippet: this.generateSnippet(boardEntry.topic, q),
          sourceType: boardEntry.type || 'native'
        });
        boardMatched = true;
      }

      // Check Cache or extract
      const cacheEntry = this.allBoardsCache.get(boardEntry.id);
      let items = [];
      if (cacheEntry && cacheEntry.timestamp === boardEntry.updatedAt) {
        items = cacheEntry.data;
      } else {
        // Must extract
        items = await this.extractBoardContent(boardEntry);
        this.allBoardsCache.set(boardEntry.id, {
          timestamp: boardEntry.updatedAt,
          data: items
        });
      }

      // Filter items
      for (const item of items) {
        if (item.text && item.text.toLowerCase().includes(q)) {
          results.push({
            type: item.type,
            id: item.id,
            boardId: boardEntry.id,
            boardTitle: boardEntry.title,
            matchField: item.matchField,
            snippet: this.generateSnippet(item.text, q),
            sourceType: boardEntry.type || 'native'
          });
        }
      }
    });

    await Promise.all(boardPromises);
    return results;
  }

  async extractBoardContent(boardEntry) {
    const items = [];
    if (boardEntry.type === 'legacy') {
      // For legacy, it might be too heavy to read raw XML for text search right now, 
      // but let's do a naive string search if possible, or just skip content for MVP.
      // User requested basic inclusion, so we'll skip legacy content parsing for speed in this sprint unless explicitly needed.
      return items; 
    }

    // Native Board Extraction
    try {
      const dirName = boardEntry.dirName || boardEntry.id;
      const statePath = `${workspaceManager.workspaceDirName}/boards/${dirName}/state.json`;
      
      if (await exists(statePath, workspaceManager.basePathObj)) {
        const stateContents = await readTextFile(statePath, workspaceManager.basePathObj);
        const state = JSON.parse(stateContents);
        
        if (state.notes && Array.isArray(state.notes)) {
          state.notes.forEach(([id, note]) => {
            if (!note) return;
            const isImg = note.type === 'image' || note.isImage;
            if (isImg && note.caption) {
              items.push({ id: note.id, type: 'image', text: note.caption, matchField: 'caption' });
            } else if (!isImg && note.text) {
              items.push({ id: note.id, type: 'note', text: note.text, matchField: 'text' });
            }
          });
        }
        if (state.frames && Array.isArray(state.frames)) {
          state.frames.forEach(([id, frame]) => {
            if (frame && frame.title) {
              items.push({ id: frame.id, type: 'frame', text: frame.title, matchField: 'title' });
            }
          });
        }
      }
    } catch (e) {
      console.warn("Failed to extract board content for search cache", boardEntry.id, e);
    }
    
    return items;
  }

  generateSnippet(text, query) {
    if (!text) return '';
    const qLower = query.toLowerCase();
    const idx = text.toLowerCase().indexOf(qLower);
    if (idx === -1) return text.substring(0, 50) + '...';

    const start = Math.max(0, idx - 20);
    const end = Math.min(text.length, idx + query.length + 20);
    
    let snippet = text.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet += '...';
    
    // We can just return plain text and let the UI formatter highlight it securely
    return snippet;
  }
}
