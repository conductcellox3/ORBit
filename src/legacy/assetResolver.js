import { convertFileSrc } from '@tauri-apps/api/core';
import { workspaceLoader } from './workspaceLoader';

export class AssetResolver {
  constructor() {
    this.currentBoardId = null;
    this.currentSlug = null;
  }

  setContext(boardId, slug) {
    this.currentBoardId = boardId;
    this.currentSlug = slug;
  }

  async resolveImage(relativeSrc) {
    if (!relativeSrc) return null;
    if (relativeSrc.startsWith('http')) return relativeSrc; // External URL
    if (relativeSrc.startsWith('data:')) return relativeSrc; // Base64 inline

    // We assume relativeSrc is like "assets/images/something.png"
    const basePath = await workspaceLoader.resolvePath();
    const boardDirBase = basePath ? `${basePath}/boards` : 'boards'; // If using AppData
    
    // Convert to absolute local path if running natively
    // Note: convertFileSrc expects an absolute path on Windows (e.g., C:\...)
    // If basePath is not populated yet, we might need to resolve AppData absolute path.
    // However, if the Dev Override is working, it will return D:/Antigravity/...
    
    let absolutePath = '';
    
    if (basePath && basePath.includes(':')) {
      // Dev Override absolute path
      absolutePath = `${basePath}/boards/${this.currentBoardId}__${this.currentSlug}/${relativeSrc}`;
      return convertFileSrc(absolutePath);
    } else {
      // TODO: If relying on AppLocalData, we need `await appLocalDataDir()` from @tauri-apps/api/path
      // to resolve the absolute prefix safely before passing it to convertFileSrc.
      // For Sprint 3, the DEV OVERRIDE handles the primary use case.
      console.warn("Asset resolver fallback for non-absolute base path is not fully implemented yet.");
      return relativeSrc; // Fallback
    }
  }
}

export const assetResolver = new AssetResolver();
