import { ContextMenu } from './contextMenu.js';
import * as layoutCommands from '../core/layoutCommands.js';

export class TopbarManager {
  constructor(elementId, app) {
    this.element = document.getElementById(elementId);
    this.app = app;
  }

  mount() {
    this.render();
  }

  render() {
    this.element.innerHTML = '';
    
    // Sprint 2 placeholder utilities
    const searchBtn = document.createElement('button');
    searchBtn.className = 'utility-button clickable';
    searchBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
    searchBtn.title = 'Search (Ctrl+F / Cmd+F)';
    searchBtn.onclick = () => this.app.toggleSearch();
    
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'utility-button clickable';
    settingsBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
    settingsBtn.title = 'Settings';
    settingsBtn.onclick = (e) => {
       if (this.app.settingsPanel) {
           this.app.settingsPanel.toggle(e.currentTarget);
       }
    };

    const graphBtn = document.createElement('button');
    graphBtn.className = 'utility-button clickable';
    // Small network / share icon
    graphBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>`;
    graphBtn.title = 'Boards Graph View';
    graphBtn.onclick = () => {
       if (this.app.openGraphTab) this.app.openGraphTab();
    };

    const exportBtn = document.createElement('button');
    exportBtn.className = 'utility-button clickable';
    // Printer / Export icon
    exportBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>`;
    exportBtn.title = 'Export & Print (Markdown/PNG/PDF)';
    exportBtn.onclick = (e) => {
       if (this.app.exportPanel) {
           this.app.exportPanel.toggle(e.currentTarget);
       }
    };

    const arrangeBtn = document.createElement('button');
    arrangeBtn.className = 'utility-button clickable';
    // Layout template icon
    arrangeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>`;
    arrangeBtn.title = 'Arrange';
    arrangeBtn.onclick = (e) => {
       const rect = arrangeBtn.getBoundingClientRect();
       
       let eligibleCount = 0;
       for (const id of this.app.selection.selectedIds) {
         if (this.app.state.notes.has(id)) {
           const entity = this.app.state.notes.get(id);
           if (layoutCommands.isLayoutEligibleEntity(entity)) {
             eligibleCount++;
           }
         }
       }

       const isWriteable = this.app.state.sourceType === 'native';
       const alignDisabled = !isWriteable || eligibleCount < 2;
       const distDisabled = !isWriteable || eligibleCount < 3;

       const items = [
         { label: 'Align Left', disabled: alignDisabled, onClick: () => layoutCommands.alignLeft(this.app) },
         { label: 'Align Center', disabled: alignDisabled, onClick: () => layoutCommands.alignCenter(this.app) },
         { label: 'Align Right', disabled: alignDisabled, onClick: () => layoutCommands.alignRight(this.app) },
         { type: 'separator' },
         { label: 'Align Top', disabled: alignDisabled, onClick: () => layoutCommands.alignTop(this.app) },
         { label: 'Align Middle', disabled: alignDisabled, onClick: () => layoutCommands.alignMiddle(this.app) },
         { label: 'Align Bottom', disabled: alignDisabled, onClick: () => layoutCommands.alignBottom(this.app) },
         { type: 'separator' },
         { label: 'Distribute Horizontally', disabled: distDisabled, onClick: () => layoutCommands.distributeHorizontally(this.app) },
         { label: 'Distribute Vertically', disabled: distDisabled, onClick: () => layoutCommands.distributeVertically(this.app) },
         { type: 'separator' },
         { label: 'Same Width', disabled: alignDisabled, onClick: () => layoutCommands.sameWidth(this.app) },
         { label: 'Same Height', disabled: alignDisabled, onClick: () => layoutCommands.sameHeight(this.app) },
         { label: 'Same Size', disabled: alignDisabled, onClick: () => layoutCommands.sameSize(this.app) }
       ];
       
       ContextMenu.show(rect.left, rect.bottom + 4, items);
    };

    const bgBtn = document.createElement('button');
    bgBtn.className = 'utility-button clickable';
    bgBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
    bgBtn.title = 'Insert Background Template';
    bgBtn.onclick = (e) => {
       if (this.app.state.sourceType === 'legacy') {
         alert("Background images cannot be inserted into read-only legacy boards.");
         return;
       }
       if (this.app.backgroundMenu) {
           this.app.backgroundMenu.toggle(e.currentTarget);
       }
    };
    const leftIdentity = document.getElementById('top-left-identity');
    if (leftIdentity) {
        leftIdentity.innerHTML = '';
        leftIdentity.style.display = 'flex';
        leftIdentity.style.gap = '8px';
        leftIdentity.style.alignItems = 'center';

        const dailyBtn = document.createElement('button');
        dailyBtn.className = 'utility-button clickable';
        dailyBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><rect x="8" y="14" width="2" height="2"></rect></svg>`;
        dailyBtn.title = 'Open or Create Daily Board';
        dailyBtn.onclick = () => {
            if (this.app.openOrCreateDailyBoard) this.app.openOrCreateDailyBoard();
        };

        const weeklyBtn = document.createElement('button');
        weeklyBtn.className = 'utility-button clickable';
        weeklyBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><rect x="8" y="14" width="8" height="2"></rect></svg>`;
        weeklyBtn.title = 'Open or Create Weekly Board';
        weeklyBtn.onclick = () => {
            if (this.app.openOrCreateWeeklyBoard) this.app.openOrCreateWeeklyBoard();
        };

        const captureGroup = document.createElement('div');
        captureGroup.style.display = 'flex';
        captureGroup.style.gap = '2px';
        captureGroup.style.alignItems = 'center';

        const captureBtn = document.createElement('button');
        captureBtn.className = 'utility-button clickable';
        // Camera icon
        captureBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`;
        captureBtn.title = 'Capture Screen Region to Image Note';
        captureBtn.onclick = () => {
            if (this.app?.startCaptureSession) {
                this.app.startCaptureSession();
            }
        };

        const captureMenuBtn = document.createElement('button');
        captureMenuBtn.className = 'utility-button clickable';
        captureMenuBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`;
        captureMenuBtn.title = 'Capture Settings';
        captureMenuBtn.onclick = (e) => {
            const rect = captureMenuBtn.getBoundingClientRect();
            ContextMenu.show(rect.left, rect.bottom + 4, [
                {
                    label: 'Capture Interactive Region',
                    onClick: () => {
                        this.app?.startCaptureSession(false);
                    }
                },
                {
                    label: 'Set Custom Area',
                    onClick: () => {
                        this.app?.startCaptureSession(true);
                    }
                },
                {
                    label: 'Clear Fixed Area',
                    disabled: !this.app?.fixedCaptureRect,
                    onClick: () => {
                        if(this.app) this.app.fixedCaptureRect = null;
                        ContextMenu.hide();
                    }
                },
                { type: 'separator' },
                {
                    label: `Auto-Minimize Before Capture: ${this.app?.autoMinimizeCapture ? 'ON' : 'OFF'}`,
                    keepOpen: true,
                    onClick: (ev) => {
                        if(this.app) {
                            this.app.autoMinimizeCapture = !this.app.autoMinimizeCapture;
                            localStorage.setItem('orbit_auto_minimize_capture', this.app.autoMinimizeCapture ? 'true' : 'false');
                        }
                        ContextMenu.hide();
                        setTimeout(() => captureMenuBtn.onclick(e), 50);
                    }
                }
            ]);
        };

        captureGroup.appendChild(captureBtn);
        captureGroup.appendChild(captureMenuBtn);
        
        const chainBtn = document.createElement('button');
        chainBtn.className = 'utility-button clickable';
        if (this.app && this.app.isChainCaptureEnabled) {
            chainBtn.classList.add('active');
        }
        // Link icon
        chainBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;
        chainBtn.title = 'Toggle Chain Capture Mode (Stack consecutive captures vertically)';
        chainBtn.onclick = () => {
            if (this.app) {
                this.app.isChainCaptureEnabled = !this.app.isChainCaptureEnabled;
                if (this.app.isChainCaptureEnabled) {
                    chainBtn.classList.add('active');
                } else {
                    chainBtn.classList.remove('active');
                    this.app.lastCaptureNoteId = null;
                }
            }
        };

        const separator = document.createElement('div');
        separator.style.width = '1px';
        separator.style.height = '16px';
        separator.style.backgroundColor = '#9CA3AF';
        separator.style.margin = '0 6px';

        leftIdentity.appendChild(dailyBtn);
        leftIdentity.appendChild(weeklyBtn);
        leftIdentity.appendChild(separator);
        leftIdentity.appendChild(chainBtn);
        leftIdentity.appendChild(captureGroup);
    }

    const helpBtn = document.createElement('button');
    helpBtn.className = 'utility-button clickable';
    helpBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    helpBtn.title = 'Help & Shortcuts (F1)';
    helpBtn.onclick = () => {
       if (this.app && this.app.shell && this.app.shell.helpUI) {
           this.app.shell.helpUI.toggle();
       }
    };

    this.element.appendChild(bgBtn);
    this.element.appendChild(arrangeBtn);
    this.element.appendChild(exportBtn);
    this.element.appendChild(graphBtn);
    this.element.appendChild(searchBtn);
    this.element.appendChild(settingsBtn);
    this.element.appendChild(helpBtn);
  }
}
