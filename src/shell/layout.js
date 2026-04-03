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
    this.rightPane = new SidePane('right-pane', `orbit:${this.workspaceId}:rightPane`, 300);
    
    this.leftRail = new IconRail('left-rail', 'left', this.leftPane);
    this.rightRail = new IconRail('right-rail', 'right', this.rightPane);
    
    this.tabs = new TabManager('top-center-tabs', app);
    this.topbar = new TopbarManager('top-right-utils', app);
    
    this.explorer = new Explorer(app, 'left-pane');
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
