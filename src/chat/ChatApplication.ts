import { MODULE_ID } from '../main';

export class ChatApplication extends foundry.applications.api.ApplicationV2 {
  static override DEFAULT_OPTIONS = {
    id: 'rhapsody-chat',
    tag: 'div',
    classes: ['rhapsody-chat'],
    window: false, // No window decoration
    position: {
      left: window.innerWidth - 370,
      top: window.innerHeight - 520
    },
    actions: {
      send: this.#onSendMessage,
      toggle: this.#onToggle
    }
  };

  // Chat messages stored in memory for now
  messages: Array<{role: string, content: string}> = [];
  
  // Track collapsed state
  isCollapsed = false; // Start expanded

  static #onSendMessage(event: Event, target: HTMLElement) {
    event.preventDefault();
    const form = target.closest('form') as HTMLFormElement;
    const input = form.querySelector('input[name="message"]') as HTMLInputElement;
    const message = input.value.trim();
    
    if (!message) return;

    // Get the app instance
    const app = this.app as ChatApplication;
    
    // Add user message
    app.messages.push({ role: 'user', content: message });
    
    // Clear input
    input.value = '';
    
    // Re-render to show new message
    app.render();
    
    // TODO: Send to OpenAI API
    ui.notifications?.info('AI response coming soon! (OpenAI integration pending)');
  }

  static #onToggle(event: Event, target: HTMLElement) {
    event.preventDefault();
    event.stopPropagation(); // Prevent event bubbling
    const app = this.app as ChatApplication;
    app.isCollapsed = !app.isCollapsed;
    app.render();
  }

  override async _prepareContext(options: any = {}) {
    const context = await super._prepareContext(options);
    
    return {
      ...context,
      messages: this.messages,
      hasApiKey: !!game.settings?.get(MODULE_ID, 'openaiApiKey'),
      isCollapsed: this.isCollapsed
    };
  }

  protected async _renderHTML(context: any, options: any): Promise<HTMLElement> {
    const template = 'modules/rhapsody/public/templates/chat-window.hbs';
    const html = await renderTemplate(template, context);
    
    // Convert string to HTMLElement
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const element = doc.body.firstElementChild as HTMLElement;
    
    return element;
  }

  protected _replaceHTML(element: HTMLElement, result: HTMLElement, options: any) {
    element.innerHTML = result.innerHTML;
    
    // Re-apply classes
    element.className = result.className;
  }

  protected override _onFirstRender(context: any, options: any) {
    super._onFirstRender(context, options);
    
    // Make draggable
    this._makeDraggable();
  }
  
  protected override _onRender(context: any, options: any) {
    super._onRender(context, options);
    
    // Re-apply draggable after each render
    this._makeDraggable();
  }

  private _makeDraggable() {
    const element = this.element;
    if (!element) return;

    let isDragging = false;
    let currentX: number;
    let currentY: number;
    let initialX: number;
    let initialY: number;

    const dragStart = (e: MouseEvent) => {
      // Only drag with button area or header
      const target = e.target as HTMLElement;
      if (!target.closest('.rhapsody-button') && !target.closest('.rhapsody-header')) return;
      
      isDragging = true;
      
      const rect = element.getBoundingClientRect();
      initialX = e.clientX - rect.left;
      initialY = e.clientY - rect.top;

      document.addEventListener('mousemove', drag);
      document.addEventListener('mouseup', dragEnd);
      
      e.preventDefault();
    };

    const drag = (e: MouseEvent) => {
      if (!isDragging) return;

      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;

      element.style.left = currentX + 'px';
      element.style.top = currentY + 'px';
    };

    const dragEnd = () => {
      isDragging = false;
      document.removeEventListener('mousemove', drag);
      document.removeEventListener('mouseup', dragEnd);
    };

    element.addEventListener('mousedown', dragStart);
  }
}