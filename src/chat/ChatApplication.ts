import { MODULE_ID } from '../main';

export class ChatApplication extends foundry.applications.api.ApplicationV2 {
  static override DEFAULT_OPTIONS = {
    id: 'rhapsody-chat',
    tag: 'aside',
    classes: ['rhapsody-chat'],
    window: {
      title: 'Rhapsody AI GM',
      icon: 'fas fa-robot',
      resizable: true,
      positioned: true,
      minimizable: false  // We'll handle our own minimize
    },
    position: {
      width: 400,
      height: 600,
      left: window.innerWidth - 420,  // 20px from right
      top: window.innerHeight - 620   // 20px from bottom
    },
    actions: {
      send: this.#onSendMessage,
      toggleCollapse: this.#onToggleCollapse
    }
  };

  // Chat messages stored in memory for now
  messages: Array<{role: string, content: string}> = [];
  
  // Track collapsed state
  isCollapsed = true;
  
  // Store position when expanded
  expandedPosition = { width: 400, height: 600 };

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

  static #onToggleCollapse(event: Event, target: HTMLElement) {
    event.preventDefault();
    const app = this.app as ChatApplication;
    app.toggleCollapse();
  }

  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
    
    if (this.isCollapsed) {
      this.collapse();
    } else {
      this.expand();
    }
  }

  collapse() {
    const element = this.element;
    if (!element) return;

    // Store current position if expanded
    if (!this.isCollapsed) {
      const bounds = element.getBoundingClientRect();
      this.expandedPosition = {
        width: bounds.width,
        height: bounds.height
      };
    }

    // Animate to button
    gsap.to(element, {
      width: 50,
      height: 50,
      duration: 0.3,
      ease: "power2.inOut",
      onComplete: () => {
        element.classList.add('collapsed');
        element.classList.remove('expanded');
      }
    });
  }

  expand() {
    const element = this.element;
    if (!element) return;

    element.classList.remove('collapsed');
    element.classList.add('expanded');

    // Animate to full size
    gsap.to(element, {
      width: this.expandedPosition.width,
      height: this.expandedPosition.height,
      duration: 0.3,
      ease: "power2.inOut"
    });
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
    
    // Set initial state
    if (this.isCollapsed) {
      element.classList.add('collapsed');
      element.style.width = '50px';
      element.style.height = '50px';
    } else {
      element.classList.add('expanded');
    }
    
    return element;
  }

  protected _replaceHTML(element: HTMLElement, result: HTMLElement, options: any) {
    // Preserve the current size before replacing
    const currentWidth = element.style.width;
    const currentHeight = element.style.height;
    
    // Replace the entire content
    element.innerHTML = result.innerHTML;
    
    // Re-apply any necessary attributes
    for (const attr of result.attributes) {
      element.setAttribute(attr.name, attr.value);
    }
    
    // Restore size
    element.style.width = currentWidth;
    element.style.height = currentHeight;
  }

  protected override _onFirstRender(context: any, options: any) {
    super._onFirstRender(context, options);
    
    // Make the window draggable
    this._makeDraggable();
    
    // Start collapsed
    if (this.isCollapsed) {
      this.collapse();
    }
  }

  private _makeDraggable() {
    const element = this.element;
    if (!element) return;

    const handle = element.querySelector('.window-header') as HTMLElement;
    if (!handle) return;

    let isDragging = false;
    let currentX: number;
    let currentY: number;
    let initialX: number;
    let initialY: number;

    const dragStart = (e: MouseEvent) => {
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
      
      // Clear bottom/right positioning when dragging
      element.style.bottom = 'auto';
      element.style.right = 'auto';
    };

    const dragEnd = () => {
      isDragging = false;
      document.removeEventListener('mousemove', drag);
      document.removeEventListener('mouseup', dragEnd);
    };

    handle.addEventListener('mousedown', dragStart);
  }
}