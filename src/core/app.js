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

  save() {
    this.persistence.save();
  }

  async loadNativeBoard(boardId) {
    this.selection.clear();
    await this.persistence.loadNativeBoard(boardId);
    
    // We notify listeners of a full reset so canvas knows to sync viewport
    if (this.onBoardLoad) {
      this.onBoardLoad(this.state.canvas);
    }
  }

  async loadLegacyBoard(legacySnapshot) {
    this.selection.clear();
    await this.persistence.loadLegacyBoard(legacySnapshot);
    
    // We notify listeners of a full reset so canvas knows to sync viewport
    if (this.onBoardLoad) {
      this.onBoardLoad(this.state.canvas);
    }
  }

  commitHistory() {
    this.history.commit();
    this.save();
  }

  undo() {
    this.history.undo();
    this.selection.clear();
    this.save();
  }

  redo() {
    this.history.redo();
    this.selection.clear();
    this.save();
  }
}
