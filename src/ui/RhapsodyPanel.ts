import { RhapsodySettings } from '../settings/RhapsodySettings';

export class RhapsodyPanel {
  private element: HTMLElement | null = null;
  private isCollapsed = true;
  private expandDirection: 'down' | 'up' = 'down';
  private messages: Array<{ role: string, content: string }> = [];
  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };

  private readonly collapsedWidth = 300;
  private readonly collapsedHeight = 60;
  private readonly expandedWidth = 480;
  private readonly expandedHeight = 600;

  constructor() {
    this.create();
  }

  private create() {
    const existing = document.getElementById('rhapsody-panel');
    if (existing) existing.remove();

    this.element = document.createElement('div');
    this.element.id = 'rhapsody-panel';
    this.element.className = 'rhapsody-panel collapsed';

    const initialTop = window.innerHeight / 2 - this.collapsedHeight / 2;
    this.element.style.position = 'fixed';
    this.element.style.top = `${initialTop}px`;
    this.element.style.left = `${window.innerWidth - this.collapsedWidth - 20}px`;
    this.element.style.width = `${this.collapsedWidth}px`;
    this.element.style.height = `${this.collapsedHeight}px`;
    this.element.style.zIndex = '1000';

    this.render();
    document.body.appendChild(this.element);

    this.element.addEventListener('click', this.handleClick.bind(this));
    this.element.addEventListener('submit', this.handleSubmit.bind(this));
    this.element.addEventListener('mousedown', this.handleDragStart.bind(this));
  }

  private render() {
    if (!this.element) return;
    const hasApiKey = !!RhapsodySettings.getApiKey();
    this.element.className = `rhapsody-panel ${this.isCollapsed ? 'collapsed' : 'expanded'}`;

    this.element.innerHTML = `
      <div class="rhapsody-header">
        <span>Rhapsody GM</span>
        <button class="minimize-btn" aria-label="${this.isCollapsed ? 'Expand' : 'Collapse'} panel">
          <i class="fas ${this.isCollapsed ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>
        </button>
      </div>
      ${this.isCollapsed ? '' : `
        <div class="rhapsody-content">
          ${!hasApiKey ? `
            <div class="api-key-warning">
              <i class="fas fa-exclamation-triangle"></i>
              <p>No API key configured in settings</p>
            </div>
          ` : ''}
          <div class="messages">
            ${this.messages.map(msg => `
              <div class="message ${msg.role}">
                <strong>${msg.role === 'user' ? 'You' : 'AI GM'}:</strong>
                <p>${msg.content}</p>
              </div>
            `).join('')}
          </div>
          <form class="input-form">
            <input type="text" name="message" placeholder="Ask the AI GM..." ${!hasApiKey ? 'disabled' : ''}>
            <button type="submit" ${!hasApiKey ? 'disabled' : ''}>
              <i class="fas fa-paper-plane"></i>
            </button>
          </form>
        </div>
      `}
    `;

    if (!this.isCollapsed) {
      const messagesEl = this.element.querySelector('.messages');
      if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }

  private handleClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const isToggleBtn = target.closest('.minimize-btn');
    if (!isToggleBtn) return;
    this.toggle();
  }

  private toggle() {
    if (!this.element) return;
    const rect = this.element.getBoundingClientRect();

    if (this.isCollapsed) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      this.expandDirection = spaceBelow >= this.expandedHeight
        ? 'down'
        : (spaceAbove >= this.expandedHeight ? 'up' : 'down');

      // Clamp top so expanded panel stays in viewport
      if (this.expandDirection === 'down') {
        let top = rect.top;
        const maxTop = window.innerHeight - this.expandedHeight - 20;
        top = Math.min(top, maxTop);
        this.element.style.top = `${top}px`;
        this.element.style.bottom = 'auto';
      } else {
        let bottom = window.innerHeight - rect.bottom;
        const maxBottom = window.innerHeight - 20;
        bottom = Math.min(bottom, maxBottom - this.expandedHeight);
        this.element.style.bottom = `${bottom}px`;
        this.element.style.top = 'auto';
      }

      this.element.style.height = `${this.expandedHeight}px`;
      this.element.style.width = `${this.expandedWidth}px`;
    } else {
      if (this.expandDirection === 'up') {
        const bottom = this.element.style.bottom || `${window.innerHeight - rect.bottom}px`;
        this.element.style.bottom = bottom;
        this.element.style.top = 'auto';
      } else {
        const top = this.element.style.top || `${rect.top}px`;
        this.element.style.top = top;
        this.element.style.bottom = 'auto';
      }

      this.element.style.height = `${this.collapsedHeight}px`;
      this.element.style.width = `${this.collapsedWidth}px`;
    }

    this.isCollapsed = !this.isCollapsed;
    this.render();
  }

  private handleSubmit(e: Event) {
    e.preventDefault();
    if (!this.element) return;

    const form = e.target as HTMLFormElement;
    const input = form.querySelector('input[name="message"]') as HTMLInputElement;
    const message = input.value.trim();
    if (!message) return;

    this.messages.push({ role: 'user', content: message });
    input.value = '';
    this.render();

    setTimeout(() => {
      this.messages.push({ role: 'assistant', content: `Echo: ${message}` });
      this.render();
    }, 500);
  }

  private handleDragStart(e: MouseEvent) {
    if (!this.element) return;
    const target = e.target as HTMLElement;
    if (!target.closest('.rhapsody-header')) return;

    this.isDragging = true;
    this.element.classList.add('dragging');

    const rect = this.element.getBoundingClientRect();
    this.dragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    document.addEventListener('mousemove', this.handleDrag);
    document.addEventListener('mouseup', this.handleDragEnd);
    e.preventDefault();
  }

  private handleDrag = (e: MouseEvent) => {
    if (!this.isDragging || !this.element) return;

    let newLeft = e.clientX - this.dragOffset.x;
    let newTop = e.clientY - this.dragOffset.y;

    newLeft = Math.max(0, Math.min(window.innerWidth - this.element.offsetWidth, newLeft));
    newTop = Math.max(0, Math.min(window.innerHeight - this.element.offsetHeight, newTop));

    this.element.style.left = `${newLeft}px`;
    this.element.style.top = `${newTop}px`;
    this.element.style.bottom = 'auto';
    this.element.style.right = 'auto';
  };

  private handleDragEnd = () => {
    this.isDragging = false;
    this.element?.classList.remove('dragging');
    document.removeEventListener('mousemove', this.handleDrag);
    document.removeEventListener('mouseup', this.handleDragEnd);
  };

  public destroy() {
    this.element?.remove();
    this.element = null;
  }
}
