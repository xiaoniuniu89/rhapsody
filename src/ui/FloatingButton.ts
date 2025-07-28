export class FloatingButton {
  static create() {
    // Create the floating button
    const button = document.createElement('button');
    button.id = 'rhapsody-floating-button';
    button.className = 'rhapsody-floating-button';
    button.title = 'Open Rhapsody AI GM';
    button.innerHTML = '<i class="fas fa-robot"></i>';
    
    // Add to the UI
    document.body.appendChild(button);
    
    // Add click handler
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.Rhapsody.openChat();
    });
    
    // Make it draggable (optional)
    this.makeDraggable(button);
  }
  
  static makeDraggable(button: HTMLElement) {
    let isDragging = false;
    let currentX: number;
    let currentY: number;
    let initialX: number;
    let initialY: number;
    
    button.addEventListener('mousedown', dragStart);
    
    function dragStart(e: MouseEvent) {
      // Only drag with right mouse button or with Shift key
      if (e.button !== 2 && !e.shiftKey) return;
      
      isDragging = true;
      initialX = e.clientX - button.offsetLeft;
      initialY = e.clientY - button.offsetTop;
      
      document.addEventListener('mousemove', drag);
      document.addEventListener('mouseup', dragEnd);
      
      e.preventDefault();
    }
    
    function drag(e: MouseEvent) {
      if (!isDragging) return;
      
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      
      button.style.left = currentX + 'px';
      button.style.top = currentY + 'px';
      button.style.right = 'auto';
      button.style.bottom = 'auto';
    }
    
    function dragEnd() {
      isDragging = false;
      document.removeEventListener('mousemove', drag);
      document.removeEventListener('mouseup', dragEnd);
    }
  }
}