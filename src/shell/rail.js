export class IconRail {
  constructor(elementId, side, boundsPane) {
    this.element = document.getElementById(elementId);
    this.side = side;
    this.boundsPane = boundsPane;
  }

  mount() {
    // Add a simple collapse/expand button top the rail
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'rail-button';
    // Use simple ascii or svg for toggle for sprint 2
    toggleBtn.innerHTML = this.side === 'left' ? '≡' : '⚙'; 
    toggleBtn.title = `Toggle ${this.side} pane`;
    
    toggleBtn.addEventListener('click', () => {
      this.boundsPane.toggle();
    });
    
    this.element.appendChild(toggleBtn);
  }
}
