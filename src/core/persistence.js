import { BaseDirectory, readTextFile, writeTextFile, exists, mkdir } from '@tauri-apps/plugin-fs';

export class Persistence {
  constructor(state, history) {
    this.state = state;
    this.history = history;
    this.filename = 'board.json';
  }

  async load() {
    try {
      const isExist = await exists(this.filename, { baseDir: BaseDirectory.AppLocalData });
      if (isExist) {
        const contents = await readTextFile(this.filename, { baseDir: BaseDirectory.AppLocalData });
        const snapshot = JSON.parse(contents);
        this.state.restoreSnapshot(snapshot);
        // Clear history on fresh load
        this.history.undoStack = [];
        this.history.redoStack = [];
        this.history.commit();
      } else {
        await this.save(); // save default empty board
      }
    } catch (e) {
      console.error("Failed to load board data", e);
    }
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

    try {
      const snapshot = this.state.getSnapshot();
      const stringified = JSON.stringify(snapshot, null, 2);
      
      // Ensure directory exists
      const dirExist = await exists('', { baseDir: BaseDirectory.AppLocalData });
      if (!dirExist) {
        await mkdir('', { baseDir: BaseDirectory.AppLocalData, recursive: true });
      }

      await writeTextFile(this.filename, stringified, { baseDir: BaseDirectory.AppLocalData });
    } catch (e) {
      console.error("Failed to save board data", e);
    }
  }
}
