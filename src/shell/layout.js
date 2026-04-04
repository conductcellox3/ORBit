import { SidePane } from './panes.js';
import { IconRail } from './rail.js';
import { TabManager } from './tabs.js';
import { TopbarManager } from './topbar.js';
import { Explorer } from './explorer.js';

export class ShellLayout {
  constructor(app) {
    this.app = app;
    
    // In Sprint 2, assume single default workspace for persistence namespacing
    this.workspaceId = 'default';
    
    this.leftPane = new SidePane('left-pane', `orbit:${this.workspaceId}:leftPane`, 250);
    this.rightPane = new SidePane('right-pane', `orbit:${this.workspaceId}:rightPane`, 340);
    
    this.leftRail = new IconRail('left-rail', 'left', this.leftPane);
    this.rightRail = new IconRail('right-rail', 'right', this.rightPane);
    
    this.tabs = new TabManager('top-center-tabs', app);
    this.topbar = new TopbarManager('top-right-utils', app);
    
    this.explorer = new Explorer(app, 'left-pane');
    
    this.peekBanner = null;
    this.app.onPeekStateChange = (peekState) => this.updatePeekBanner(peekState);
  }

  updatePeekBanner(peekState) {
    if (!this.peekBanner) {
      this.peekBanner = document.createElement('div');
      this.peekBanner.className = 'orbit-peek-banner';
      this.peekBanner.style.position = 'fixed';
      this.peekBanner.style.top = '64px';
      this.peekBanner.style.left = '50%';
      this.peekBanner.style.transform = 'translate(-50%, -10px)';
      this.peekBanner.style.background = 'var(--color-bg-primary, #ffffff)';
      this.peekBanner.style.color = 'var(--color-text-main, #202124)';
      this.peekBanner.style.border = '1px solid var(--border-color, #e0e0e0)';
      this.peekBanner.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
      this.peekBanner.style.padding = '6px 12px';
      this.peekBanner.style.borderRadius = '16px';
      this.peekBanner.style.fontSize = '12px';
      this.peekBanner.style.fontWeight = '500';
      this.peekBanner.style.cursor = 'pointer';
      this.peekBanner.style.zIndex = '10000';
      this.peekBanner.style.display = 'flex';
      this.peekBanner.style.alignItems = 'center';
      this.peekBanner.style.gap = '8px';
      this.peekBanner.style.opacity = '0';
      this.peekBanner.style.pointerEvents = 'none';
      this.peekBanner.style.transition = 'all 0.15s ease-out';
      
      this.peekBanner.addEventListener('click', () => {
         this.app.returnFromPeek();
      });
      
      this.peekBanner.addEventListener('mouseenter', () => {
         this.peekBanner.style.background = 'var(--bg-layer-2, #f5f5f5)';
      });
      this.peekBanner.addEventListener('mouseleave', () => {
         this.peekBanner.style.background = 'var(--color-bg-primary, #ffffff)';
      });
      
      document.body.appendChild(this.peekBanner);
    }
    
    if (peekState) {
      this.peekBanner.innerHTML = `<span>←</span> Return to ${peekState.originTitle} <span style="opacity: 0.5; font-size: 10px; margin-left: 6px;">Esc</span>`;
      this.peekBanner.style.opacity = '1';
      this.peekBanner.style.pointerEvents = 'auto';
      this.peekBanner.style.transform = 'translate(-50%, 0)';
    } else {
      this.peekBanner.style.opacity = '0';
      this.peekBanner.style.pointerEvents = 'none';
      this.peekBanner.style.transform = 'translate(-50%, -10px)';
    }
  }

  mount() {
    this.leftPane.mount();
    this.rightPane.mount();
    this.leftRail.mount();
    this.rightRail.mount();
    
    this.tabs.mount();
    this.topbar.mount();
    
    this.explorer.mount();
  }
}
