export class Viewport {
  constructor(transformElement) {
    this.element = transformElement;
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.apply();
  }

  apply() {
    this.element.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this.zoom})`;
  }

  pan(dx, dy) {
    this.x += dx;
    this.y += dy;
    this.apply();
  }

  zoomAt(cursorX, cursorY, scaleFactor) {
    const rect = this.element.parentElement.getBoundingClientRect();
    const xRel = cursorX - rect.left;
    const yRel = cursorY - rect.top;
    
    // Math to ensure the point under cursor remains at the same screen coordinates
    const newZoom = Math.max(0.1, Math.min(this.zoom * scaleFactor, 5));
    const factor = newZoom / this.zoom;
    
    this.x = xRel - (xRel - this.x) * factor;
    this.y = yRel - (yRel - this.y) * factor;
    this.zoom = newZoom;
    this.apply();
  }
  
  // Convert screen pixels to canvas coordinates
  screenToCanvas(clientX, clientY) {
    const rect = this.element.parentElement.getBoundingClientRect();
    const xRelative = clientX - rect.left;
    const yRelative = clientY - rect.top;
    return {
      x: (xRelative - this.x) / this.zoom,
      y: (yRelative - this.y) / this.zoom
    };
  }
}
