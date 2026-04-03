export class TabManager {
  constructor(elementId, app) {
    this.element = document.getElementById(elementId);
    this.app = app;
  }

  mount() {
    this.render();
  }

  render() {
    this.element.innerHTML = '';
    
    // In Sprint 2 we only render the active default board
    const activeTab = document.createElement('div');
    activeTab.className = 'board-tab is-active';
    activeTab.textContent = 'Main Board';
    
    this.element.appendChild(activeTab);
  }
}
