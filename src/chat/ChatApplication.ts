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
      minimizable: true
    },
    position: {
      width: 400,
      height: 600,
      left: 100,
      top: 100
    },
    actions: {
      send: this.#onSendMessage
    }
  };

  // Chat messages stored in memory for now
  messages: Array<{role: string, content: string}> = [];

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

  override async _prepareContext(options: any = {}) {
    const context = await super._prepareContext(options);
    
    return {
      ...context,
      messages: this.messages,
      hasApiKey: !!game.settings?.get(MODULE_ID, 'openaiApiKey')
    };
  }

  protected async _renderHTML(context: any, options: any): Promise<HTMLElement> {
    const template = 'modules/rhapsody/public/templates/chat-window.hbs';
    const html = await renderTemplate(template, context);
    
    // Convert string to HTMLElement
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return doc.body.firstElementChild as HTMLElement;
  }

  protected _replaceHTML(element: HTMLElement, result: HTMLElement, options: any) {
    // Replace the entire content
    element.innerHTML = result.innerHTML;
    
    // Re-apply any necessary attributes
    for (const attr of result.attributes) {
      element.setAttribute(attr.name, attr.value);
    }
  }
}