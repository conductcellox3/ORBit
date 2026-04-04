import { workspaceManager } from './workspace.js';
import { readTextFile, exists } from '@tauri-apps/plugin-fs';

export class SearchEngine {
  constructor(app) {
    this.app = app;
    this.allBoardsCache = new Map(); // boardId -> { timestamp, data: [{id, type, text, caption, title}] }
  }

  // --- This Board Search ---
  async searchThisBoard(query, filters = { type: 'all', marker: 'all' }) {
    const q = query ? query.toLowerCase().trim() : '';
    const results = [];
    const state = this.app.state;

    const passesFilters = (itemType, markers) => {
      if (filters.type !== 'all' && itemType !== filters.type) return false;
      if (filters.marker !== 'all') {
        if (!markers || !markers.includes(filters.marker)) return false;
      }
      return true;
    };

    // Search Notes
    for (const [id, note] of state.notes.entries()) {
      let typeStr = note.type === 'calc' ? 'calc' : 'note';
      if (note.type === 'image' || note.isImage) typeStr = 'image';
      
      if (!passesFilters(typeStr, note.markers)) continue;

      const searchableText = typeStr === 'image' ? note.caption : note.text;
      
      if (!q) {
        results.push({
          type: typeStr,
          id: note.id,
          boardId: state.boardId,
          boardTitle: state.title,
          matchField: filters.marker !== 'all' ? 'marker' : 'filter',
          matchedMarker: filters.marker !== 'all' ? filters.marker : null,
          snippet: this.generateSnippet(searchableText || '', ''),
          sourceType: state.sourceType
        });
      } else if (searchableText && searchableText.toLowerCase().includes(q)) {
        results.push({
          type: typeStr,
          id: note.id,
          boardId: state.boardId,
          boardTitle: state.title,
          matchField: typeStr === 'image' ? 'caption' : 'text',
          matchedMarker: filters.marker !== 'all' ? filters.marker : null,
          snippet: this.generateSnippet(searchableText, q),
          sourceType: state.sourceType
        });
      }
    }

    // Search Frames
    for (const [id, frame] of state.frames.entries()) {
      if (!passesFilters('frame', [])) continue;

      if (!q) {
        results.push({
          type: 'frame',
          id: frame.id,
          boardId: state.boardId,
          boardTitle: state.title,
          matchField: 'filter',
          snippet: this.generateSnippet(frame.title || '', ''),
          sourceType: state.sourceType
        });
      } else if (frame.title && frame.title.toLowerCase().includes(q)) {
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
  async searchAllBoards(query, filters = { type: 'all', marker: 'all' }) {
    if (!workspaceManager.manifest) return [];

    const q = query ? query.toLowerCase().trim() : '';
    const results = [];

    const passesFilters = (itemType, markers) => {
      if (filters.type !== 'all' && itemType !== filters.type) return false;
      if (filters.marker !== 'all') {
        if (!markers || !markers.includes(filters.marker)) return false;
      }
      return true;
    };

    const boardPromises = workspaceManager.manifest.boards.map(async (boardEntry) => {
      const isNative = boardEntry.type !== 'legacy';
      const folderNameStr = isNative ? workspaceManager.resolveFolderName(boardEntry.folderId) : null;

      // Direct Board Metadata Search (only if no restrictive note-level filters exist, or if explicitly asked)
      // For simplicity, if we are filtering by marker or note type, we skip board-level matches.
      if (filters.type === 'all' && filters.marker === 'all' && q) {
        let boardMatched = false;
        if (boardEntry.title && boardEntry.title.toLowerCase().includes(q)) {
          results.push({
            type: 'board',
            id: null,
            boardId: boardEntry.id,
            boardTitle: boardEntry.title,
            matchField: 'title',
            snippet: this.generateSnippet(boardEntry.title, q),
            folderName: folderNameStr,
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
            folderName: folderNameStr,
            sourceType: boardEntry.type || 'native'
          });
          boardMatched = true;
        }
        if (isNative && folderNameStr && folderNameStr.toLowerCase().includes(q) && !boardMatched) {
          results.push({
            type: 'board',
            id: null,
            boardId: boardEntry.id,
            boardTitle: boardEntry.title,
            matchField: 'folder',
            snippet: this.generateSnippet(boardEntry.title, ''),
            folderName: folderNameStr,
            sourceType: boardEntry.type || 'native'
          });
          boardMatched = true;
        }
      }

      // Check Cache or extract
      const cacheEntry = this.allBoardsCache.get(boardEntry.id);
      let items = [];
      if (cacheEntry && cacheEntry.timestamp === boardEntry.updatedAt) {
        items = cacheEntry.data;
      } else {
        items = await this.extractBoardContent(boardEntry);
        this.allBoardsCache.set(boardEntry.id, {
          timestamp: boardEntry.updatedAt,
          data: items
        });
      }

      // Filter items
      for (const item of items) {
        if (!passesFilters(item.type, item.markers)) continue;
        
        if (!q) {
          results.push({
            type: item.type,
            id: item.id,
            boardId: boardEntry.id,
            boardTitle: boardEntry.title,
            matchField: filters.marker !== 'all' ? 'marker' : 'filter',
            matchedMarker: filters.marker !== 'all' ? filters.marker : null,
            snippet: this.generateSnippet(item.text || '', ''),
            folderName: folderNameStr,
            sourceType: boardEntry.type || 'native'
          });
        } else if (item.text && item.text.toLowerCase().includes(q)) {
          results.push({
            type: item.type,
            id: item.id,
            boardId: boardEntry.id,
            boardTitle: boardEntry.title,
            matchField: item.matchField,
            matchedMarker: filters.marker !== 'all' ? filters.marker : null,
            snippet: this.generateSnippet(item.text, q),
            folderName: folderNameStr,
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
              items.push({ id: note.id, type: 'image', text: note.caption, matchField: 'caption', markers: note.markers || [] });
            } else if (!isImg && note.text) {
              const typeStr = note.type === 'calc' ? 'calc' : 'note';
              items.push({ id: note.id, type: typeStr, text: note.text, matchField: 'text', markers: note.markers || [] });
            }
          });
        }
        if (state.frames && Array.isArray(state.frames)) {
          state.frames.forEach(([id, frame]) => {
            if (frame && frame.title) {
              items.push({ id: frame.id, type: 'frame', text: frame.title, matchField: 'title', markers: [] });
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
    if (!query) return text.substring(0, 70); // Just return first chunk for filter-only
    const qLower = query.toLowerCase();
    const idx = text.toLowerCase().indexOf(qLower);
    if (idx === -1) return text.substring(0, 70) + '...';

    const start = Math.max(0, idx - 30);
    const end = Math.min(text.length, idx + query.length + 30);
    
    let snippet = text.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet += '...';
    
    return snippet;
  }
}
