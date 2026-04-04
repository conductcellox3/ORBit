export class ImageViewer {
  constructor(app) {
    this.app = app;
    this.overlay = null;
    this.img = null;
    this.noteId = null;
    this.scale = 1;
    this.transX = 0;
    this.transY = 0;

    this.isDragging = false;
    this.wasDragged = false;
    this.startX = 0;
    this.startY = 0;
    this.startTransX = 0;
    this.startTransY = 0;

    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  open(note) {
    if (this.overlay) this.close();

    this.noteId = note.id;
    this.noteSrc = note.src;
    this.scale = 1;
    this.transX = 0;
    this.transY = 0;

    this.overlay = document.createElement('div');
    this.overlay.className = 'orbit-image-viewer-overlay';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'orbit-image-viewer-close';
    closeBtn.textContent = '✕';
    closeBtn.title = 'Close';
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      this.close();
    };

    const jumpBtn = document.createElement('button');
    jumpBtn.className = 'orbit-image-viewer-jump';
    jumpBtn.textContent = 'Jump to Board Position';
    jumpBtn.onclick = (e) => {
      e.stopPropagation();
      this.close();
      this.app.jumpToNoteCenter(this.noteId);
    };

    const container = document.createElement('div');
    container.className = 'orbit-image-viewer-container';

    this.img = document.createElement('img');
    this.img.className = 'orbit-image-viewer-content';
    this.img.src = this.app.imageViewerSrc; // We will pass this in notes.js as a property or resolve it here
    this.img.draggable = false;

    container.appendChild(this.img);
    this.overlay.appendChild(container);
    this.overlay.appendChild(closeBtn);
    this.overlay.appendChild(jumpBtn);

    if (this.app.state.sourceType === 'native') {
      const folderBtn = document.createElement('button');
      folderBtn.className = 'orbit-image-viewer-folder';
      folderBtn.textContent = '📁 Open Folder';
      folderBtn.onclick = async (e) => {
        e.stopPropagation();
        try {
          const { workspaceManager } = await import('../core/workspace.js');
          const absolutePath = await workspaceManager.getAbsoluteAssetPath(this.app.state.boardId, this.noteSrc);
          if (absolutePath) {
            const { revealItemInDir, openPath } = await import('@tauri-apps/plugin-opener');
            try {
              await revealItemInDir(absolutePath);
            } catch (err1) {
              console.warn("revealItemInDir failed, trying openPath...", err1);
              const folderPath = await workspaceManager.getAssetFolderPath(this.app.state.boardId);
              await openPath(folderPath);
            }
          } else {
            console.warn("No absolute path resolvable for", this.noteSrc);
          }
        } catch (err) {
          console.error("Failed to open folder/asset", err);
          // Let's pop up an alert as fallback debugging for the user!
          alert("Error opening folder: " + err.message);
        }
      };
      this.overlay.appendChild(folderBtn);
    }

    document.body.appendChild(this.overlay);
    this.applyTransform();

    this.overlay.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(0.5, Math.min(10, this.scale * zoomFactor));

      const rect = this.img.getBoundingClientRect();
      const originX = rect.left + rect.width / 2;
      const originY = rect.top + rect.height / 2;

      const deltaX = (e.clientX - originX);
      const deltaY = (e.clientY - originY);

      this.transX -= deltaX * (newScale / this.scale - 1);
      this.transY -= deltaY * (newScale / this.scale - 1);

      this.scale = newScale;
      this.applyTransform();
    }, { passive: false });

    this.overlay.addEventListener('pointerdown', (e) => {
      // Find folderBtn dynamically since it was conditionally added
      const folderBtn = this.overlay.querySelector('.orbit-image-viewer-folder');
      if (e.target === closeBtn || e.target === jumpBtn || e.target === folderBtn) return;
      
      this.isDragging = true;
      this.wasDragged = false;
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.startTransX = this.transX;
      this.startTransY = this.transY;

      this.overlay.setPointerCapture(e.pointerId);
    });

    this.overlay.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      
      const dx = e.clientX - this.startX;
      const dy = e.clientY - this.startY;
      
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        this.wasDragged = true;
      }
      
      this.transX = this.startTransX + dx;
      this.transY = this.startTransY + dy;
      this.applyTransform();
    });

    const cleanup = (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      try {
        this.overlay.releasePointerCapture(e.pointerId);
      } catch (err) {
        // Ignore if element is removed or pointer lost
      }
    };

    this.overlay.addEventListener('pointerup', (e) => {
      cleanup(e);
      // Close only if it was a simple click on the container backdrop, not the image itself
      if (!this.wasDragged && (e.target === this.overlay || e.target === container)) {
        this.close();
      }
    });

    this.overlay.addEventListener('pointercancel', cleanup);
    this.overlay.addEventListener('lostpointercapture', cleanup);

    document.addEventListener('keydown', this.handleKeyDown);
  }

  applyTransform() {
    if (!this.img) return;
    this.img.style.transform = `translate(${this.transX}px, ${this.transY}px) scale(${this.scale})`;
  }

  handleKeyDown(e) {
    if (e.key === 'Escape') {
      this.close();
    }
  }

  close() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
      this.img = null;
    }
    document.removeEventListener('keydown', this.handleKeyDown);
  }
}
