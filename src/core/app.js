import { State } from './state.js';
import { History } from './history.js';
import { Selection } from './selection.js';
import { Persistence } from './persistence.js';

import { workspaceManager } from './workspace.js';

export class App {
  constructor() {
    this.state = new State();
    this.history = new History(this.state);
    this.selection = new Selection();
    this.persistence = new Persistence(this.state, this.history);
  }

  async init() {
    await workspaceManager.init();
    
    // Look for last open board, or null to auto-create
    const lastId = workspaceManager.manifest?.lastOpenedBoardId;
    await this.loadNativeBoard(lastId);
  }

  async save() {
    return await this.persistence.save();
  }

  async loadNativeBoard(boardId) {
    if (this.state.sourceType === 'native' && this.state.boardId === boardId) {
      return;
    }
    
    if (this.state.boardId) {
      try {
        await this.save();
      } catch (e) {
        console.error("Failed to safely save current board, aborting switch", e);
        return;
      }
    }

    this.selection.clear();
    await this.persistence.loadNativeBoard(boardId);
    
    if (this.onBoardChanged) this.onBoardChanged(this.state.boardId);
    if (this.onTitleChanged) this.onTitleChanged(this.state.title);
    if (this.onBoardLoad) this.onBoardLoad(this.state.canvas);
  }

  async loadLegacyBoard(legacySnapshot) {
    // Only block if trying to reload exactly the same board
    if (this.state.sourceType === 'legacy' && this.state.boardId === legacySnapshot.id) {
      return;
    }
    
    if (this.state.boardId) {
      try {
        await this.save();
      } catch (e) {
        console.error("Failed to safely save current board, aborting switch", e);
        return;
      }
    }

    this.selection.clear();
    await this.persistence.loadLegacyBoard(legacySnapshot);
    
    if (this.onBoardChanged) this.onBoardChanged(this.state.boardId);
    if (this.onTitleChanged) this.onTitleChanged(this.state.title);
    if (this.onBoardLoad) this.onBoardLoad(this.state.canvas);
  }

  commitHistory() {
    this.history.commit();
    this.save().catch(e => console.error(e));
  }

  undo() {
    this.history.undo();
    this.selection.clear();
    this.save().catch(e => console.error(e));
  }

  redo() {
    this.history.redo();
    this.selection.clear();
    this.save().catch(e => console.error(e));
  }

  notifyTabTitleChanged(boardId, type, newTitle) {
    if (this.onInactiveTabTitleChanged) {
      this.onInactiveTabTitleChanged(boardId, type, newTitle);
    }
  }
}
