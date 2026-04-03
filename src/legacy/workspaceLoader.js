import { readTextFile, exists, BaseDirectory } from '@tauri-apps/plugin-fs';
import { assetResolver } from './assetResolver.js';

export class WorkspaceLoader {
  constructor() {
    this.DEV_OVERRIDE_PATH = 'D:/Antigravity/ORBit/BoardSample/workspace';
    this.basePath = null;
    this.manifest = null;
  }

  async resolvePath() {
    if (this.basePath) return this.basePath;

    // 1. Dev override check
    try {
      // Trying to check if dev override exists
      // In Tauri v2 with explicit scope, we can check absolute paths
      const devManifest = `${this.DEV_OVERRIDE_PATH}/boards.json`;
      const devExist = await exists(devManifest);
      if (devExist) {
        this.basePath = this.DEV_OVERRIDE_PATH;
        return this.basePath;
      }
    } catch(e) {
      // Scope exception or not found
    }

    // 2. Executable adjacent and 3. AppLocalData fallbacks can be handled here later
    // but for now, we rely on dev path or AppLocalData.
    this.basePath = ''; // fallback relative to AppLocalData if needed
    return this.basePath;
  }

  async loadManifest() {
    const basePath = await this.resolvePath();
    const manifestPath = basePath ? `${basePath}/boards.json` : 'boards.json';
    
    try {
      const contents = await readTextFile(manifestPath, basePath ? {} : { baseDir: BaseDirectory.AppLocalData });
      this.manifest = JSON.parse(contents);
      return this.manifest;
    } catch (e) {
      console.warn("Could not load legacy boards.json manifest:", e);
      return null;
    }
  }

  async loadBoardState(id, slug) {
    const basePath = await this.resolvePath();
    const boardDir = basePath ? `${basePath}/boards/${id}__${slug}` : `boards/${id}__${slug}`;
    
    // Set asset resolver context mapping
    assetResolver.setContext(id, slug);
    
    try {
      const metaPath = `${boardDir}/meta.json`;
      const statePath = `${boardDir}/state.json`;
      
      const metaContents = await readTextFile(metaPath, basePath ? {} : { baseDir: BaseDirectory.AppLocalData });
      const stateContents = await readTextFile(statePath, basePath ? {} : { baseDir: BaseDirectory.AppLocalData });
      
      return {
        meta: JSON.parse(metaContents),
        state: JSON.parse(stateContents),
        boardDir
      };
    } catch (e) {
      console.error(`Failed to load board state for ${id}__${slug}:`, e);
      return null;
    }
  }

  async resolveBoardPath(id, slug) {
    const { resolve, appLocalDataDir } = await import('@tauri-apps/api/path');
    const basePath = await this.resolvePath();
    const boardDirName = `boards/${id}__${slug}`;
    
    if (basePath) {
      return await resolve(basePath, boardDirName);
    } else {
      return await resolve(await appLocalDataDir(), boardDirName);
    }
  }
}

export const workspaceLoader = new WorkspaceLoader();
