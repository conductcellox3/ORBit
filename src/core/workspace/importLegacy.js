import { readTextFile, writeTextFile, exists, mkdir, copyFile, readDir, BaseDirectory, readFile, writeFile } from '@tauri-apps/plugin-fs';
import { legacyAdapter } from '../../legacy/boardAdapter.js';
import { workspaceManager } from '../workspace.js';

/**
 * Preflights a legacy folder path to ensure it's importable.
 */
export async function preflightLegacyBoard(sourcePath) {
  const metaPath = `${sourcePath}\\meta.json`.replace(/\\/g, '/');
  const statePath = `${sourcePath}\\state.json`.replace(/\\/g, '/');
  
  if (!(await exists(metaPath)) || !(await exists(statePath))) {
    return {
      valid: false,
      errorMessage: "Invalid legacy board: Missing meta.json or state.json."
    };
  }

  let meta;
  let state;
  try {
    const metaContents = await readTextFile(metaPath);
    const stateContents = await readTextFile(statePath);
    meta = JSON.parse(metaContents);
    state = JSON.parse(stateContents);
  } catch (e) {
    return {
      valid: false,
      errorMessage: `Malformed JSON in board files: ${e.message}`
    };
  }

  if (typeof meta !== 'object' || meta === null || typeof state !== 'object' || state === null) {
    return {
      valid: false,
      errorMessage: "Unreadable core shape: meta or state is not a JSON object."
    };
  }

  // Count items
  const stats = {
    noteCount: 0,
    frameCount: 0,
    imageCount: 0,
    edgeCount: (state.edges && Array.isArray(state.edges)) ? state.edges.length : 0
  };

  const warnings = [];

  if (state.notes && Array.isArray(state.notes)) {
    for (const n of state.notes) {
      if (n.type === 'frame') stats.frameCount++;
      else if (n.type === 'image') stats.imageCount++;
      else if (!n.type || n.type === 'note') stats.noteCount++;
      else {
         warnings.push(`Unsupported note type found: ${n.type}`);
      }
    }
  } else {
    warnings.push('Legacy state has no standard notes array.');
  }

  return {
    valid: true,
    titleCandidate: meta.title || meta.slug || "Legacy Board",
    topicCandidate: meta.topic || "",
    warningMessages: [...new Set(warnings)], // Deduplicate warnings
    stats
  };
}

/**
 * Generates a safe folder name locally so we can write out the new board
 */
const getSafeDirName = (id, title) => {
  const safeTitle = (title || 'Untitled').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim().replace(/\s+/g, '_');
  return `${id}__${safeTitle}`.substring(0, 200);
};

/**
 * Executes the actual import
 */
export async function executeImport(sourcePath, formData) {
  // 1. Read legacy data
  const metaPath = `${sourcePath}\\meta.json`.replace(/\\/g, '/');
  const statePath = `${sourcePath}\\state.json`.replace(/\\/g, '/');
  
  const metaContents = await readTextFile(metaPath);
  const stateContents = await readTextFile(statePath);
  const legacyMeta = JSON.parse(metaContents);
  const legacyState = JSON.parse(stateContents);

  // 2. Generate Native Board Identity
  const newBoardId = crypto.randomUUID();
  const newBoardDirName = getSafeDirName(newBoardId, formData.title);
  const workspaceRootOpts = workspaceManager.basePathObj || {}; 
  const newBoardDirPath = `${workspaceManager.workspaceDirName}/boards/${newBoardDirName}`;

  // 3. Adapt legacy object into native structure snapshot
  const snapshot = legacyAdapter.adapt({ slug: legacyMeta.slug }, legacyMeta, legacyState);

  // Build final native meta
  const nativeMeta = {
    version: 2,
    id: newBoardId,
    title: formData.title,
    topic: formData.topic,
    slug: newBoardDirName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    viewMode: 'board',
    importedFrom: 'legacy',
    legacySourcePath: sourcePath
  };

  const finalState = {
    boardId: newBoardId,
    title: formData.title,
    slug: newBoardDirName,
    sourceType: 'native',
    notes: snapshot.notes || [],
    frames: snapshot.frames || [],
    edges: snapshot.edges || [],
    canvas: snapshot.canvas || { panX: 0, panY: 0, zoom: 1 }
  };

  // Ensure target folder exists
  await mkdir(newBoardDirPath, { ...workspaceRootOpts, recursive: true });

  // 4. Temporary Write Phase: write files inside the new native directory
  await writeTextFile(`${newBoardDirPath}/meta.json`, JSON.stringify(nativeMeta, null, 2), workspaceRootOpts);
  await writeTextFile(`${newBoardDirPath}/state.json`, JSON.stringify(finalState, null, 2), workspaceRootOpts);

  // 5. Assets copying (Recursive)
  const sourceAssetsPath = `${sourcePath}\\assets`.replace(/\\/g, '/');
  
  const copyDirRecursive = async (srcAbsObj, dstRel, opts) => {
    const srcAbs = srcAbsObj; // string path
    
    if (!(await exists(dstRel, opts))) {
      await mkdir(dstRel, { ...opts, recursive: true });
    }
    try {
      const entries = await readDir(srcAbs);
      for (const entry of entries) {
        const sPath = `${srcAbs}/${entry.name}`;
        const dPath = `${dstRel}/${entry.name}`;
        
        const isDir = typeof entry.isDirectory === 'function' ? entry.isDirectory() : entry.isDirectory;
        const isFil = typeof entry.isFile === 'function' ? entry.isFile() : entry.isFile;
        
        // Fallback if both are undefined (just in case API returns snake_case or we need to guess)
        const fallbackIsDir = isDir === undefined && entry.children !== undefined;
        
        if (isDir || fallbackIsDir) {
          await copyDirRecursive(sPath, dPath, opts);
        } else if (isFil || (!isDir && !fallbackIsDir && entry.name)) {
          try {
            const fileData = await readFile(sPath);
            await writeFile(dPath, fileData, opts);
          } catch(e) {
            console.warn(`Failed to copy asset file ${entry.name}`, e);
          }
        }
      }
    } catch(e) {
      console.warn(`Failed to copy dir ${srcAbs}`, e);
    }
  };

  if (await exists(sourceAssetsPath)) {
    await copyDirRecursive(sourceAssetsPath, `${newBoardDirPath}/assets`, workspaceRootOpts);
  }

  const boardEntry = {
    id: nativeMeta.id,
    dirName: newBoardDirName,
    title: nativeMeta.title,
    topic: nativeMeta.topic,
    folderId: formData.folderId === 'inbox' ? null : (formData.folderId || null),
    createdAt: nativeMeta.createdAt,
    updatedAt: nativeMeta.updatedAt,
    lastOpenedAt: nativeMeta.createdAt
  };
  
  if (!workspaceManager.manifest) await workspaceManager.init();
  
  // ensure no duplicate before push
  const existingIdx = workspaceManager.manifest.boards.findIndex(b => b.id === boardEntry.id);
  if (existingIdx !== -1) {
    workspaceManager.manifest.boards[existingIdx] = boardEntry;
  } else {
    workspaceManager.manifest.boards.push(boardEntry);
  }
  
  workspaceManager.manifest.lastOpenedBoardId = boardEntry.id;
  if(typeof workspaceManager.updateRecentBoards === 'function') {
     workspaceManager.updateRecentBoards(boardEntry.id);
  }
  await workspaceManager.saveManifest();
  
  return newBoardId;
}
