import { workspaceManager } from './workspace.js';

export class Persistence {
  constructor(state, history) {
    this.state = state;
    this.history = history;
  }

  async loadNativeBoard(boardId) {
    // Clear history on fresh load
    this.history.undoStack = [];
    this.history.redoStack = [];
    
    if (boardId) {
      const data = await workspaceManager.loadBoardState(boardId);
      if (data && data.state) {
        this.state.restoreSnapshot(data.state);
        this.state.sourceType = 'native';
        this.state.boardId = boardId;
        this.state.title = data.meta.title;
        this.history.commit();
        await workspaceManager.touchBoard(boardId, this.state.title);
        return;
      }
    }
    
    // If no boardId or failed to load, try an existing board
    if (workspaceManager.manifest && workspaceManager.manifest.boards.length > 0) {
      const recentId = workspaceManager.manifest.recentBoardIds[0] || workspaceManager.manifest.boards[0].id;
      const fallbackData = await workspaceManager.loadBoardState(recentId);
      if (fallbackData && fallbackData.state) {
        this.state.restoreSnapshot(fallbackData.state);
        this.state.sourceType = 'native';
        this.state.boardId = recentId;
        this.state.title = fallbackData.meta.title;
        this.history.commit();
        await workspaceManager.touchBoard(recentId, this.state.title);
        return;
      }
    }

    // Only create a new Main Board if absolutely no other boards exist
    const newBoard = await workspaceManager.createBoard("Main Board");
    this.state.restoreSnapshot(newBoard.state);
    this.state.sourceType = 'native';
    this.state.boardId = newBoard.id;
    this.state.title = newBoard.meta.title;
    this.history.commit();
  }

  async loadLegacyBoard(legacySnapshot) {
    if (legacySnapshot.sourceType === 'legacy') {
      this.state.sourceType = 'legacy'; // tag session
    }
    this.state.restoreSnapshot(legacySnapshot);
    // Clear history
    this.history.undoStack = [];
    this.history.redoStack = [];
    this.history.commit();
  }

  async save() {
    if (this.state.sourceType === 'legacy') {
      console.warn("Save blocked: Legacy boards are opened as read-only to preserve data integrity.");
      return;
    }

    if (!this.state.boardId) {
      console.error("Cannot save: No boardId specified.");
      return;
    }

    try {
      const snapshot = this.state.getSnapshot();
      
      const dirName = workspaceManager.getBoardDirName(this.state.boardId);
      const boardDir = `${workspaceManager.workspaceDirName}/boards/${dirName}`;
      
      await workspaceManager.ensureDir(boardDir);
      
      const stringified = JSON.stringify(snapshot, null, 2);
      
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      await writeTextFile(`${boardDir}/state.json`, stringified, workspaceManager.basePathObj);
      
      // Update touches and title silently
      await workspaceManager.touchBoard(this.state.boardId, this.state.title);
    } catch (e) {
      console.error("Failed to save board data", e);
    }
  }
  async silentTargetedOcrUpdate(targetBoardId, noteId, ocrData) {
    if (this.state.sourceType === 'legacy') return;

    if (this.state.boardId === targetBoardId) {
      const note = this.state.notes.get(noteId);
      if (note) {
         // Prevent older requests from overwriting newer manually refreshed requests
         if (ocrData.ocrRequestId && note.ocrRequestId && note.ocrUpdatedAt) {
            if (ocrData.ocrUpdatedAt < note.ocrUpdatedAt) return;
         }
         Object.assign(note, ocrData);
         await this.save();
      }
    } else {
      try {
        const data = await workspaceManager.loadBoardState(targetBoardId);
        if (data && data.state && data.state.notes) {
          const noteIndex = data.state.notes.findIndex(n => n[0] === noteId);
          if (noteIndex !== -1) {
              const note = data.state.notes[noteIndex][1];
              if (ocrData.ocrRequestId && note.ocrRequestId && note.ocrUpdatedAt) {
                 if (ocrData.ocrUpdatedAt < note.ocrUpdatedAt) return;
              }
              Object.assign(note, ocrData);
              
              const dirName = workspaceManager.getBoardDirName(targetBoardId);
              const boardDir = `${workspaceManager.workspaceDirName}/boards/${dirName}`;
              const stringified = JSON.stringify(data.state, null, 2);
              
              const { writeTextFile } = await import('@tauri-apps/plugin-fs');
              await writeTextFile(`${boardDir}/state.json`, stringified, workspaceManager.basePathObj);
          }
        }
      } catch (e) {
        console.error("Failed silent background OCR save", e);
      }
    }
  }
}
