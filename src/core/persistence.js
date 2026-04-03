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
      const stringified = JSON.stringify(snapshot, null, 2);
      
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      await writeTextFile(`${boardDir}/state.json`, stringified, workspaceManager.basePathObj);
      
      // Update touches and title silently
      await workspaceManager.touchBoard(this.state.boardId, this.state.title);
    } catch (e) {
      console.error("Failed to save board data", e);
    }
  }
}
