// apps/rhapsodyApp.ts
import { id as moduleId } from "../../module.json";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const Base = HandlebarsApplicationMixin(ApplicationV2);

interface Message {
  id: string;
  sender: 'user' | 'ai';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

interface DeepSeekResponse {
  choices: Array<{
    message: {
      content: string;
    }
  }>;
}

export default class RhapsodyApp extends Base {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    tag: "form",
    id: "rhapsody-chat",
    resizable: true,
    window: {
      title: "🎵 Rhapsody GM",
    },
    form: {
      handler: RhapsodyApp.submitForm,
      submitOnChange: false,
      closeOnSubmit: false
    },
    classes: ["rhapsody-app"]
  };

  static PARTS = {
    messages: {
      template: `modules/${moduleId}/public/templates/rhapsody-messages.hbs`,
      classes: ['rhapsody-messages']
    },
    input: {
      template: `modules/${moduleId}/public/templates/rhapsody-input.hbs`,
      classes: ['rhapsody-input']
    }
  };

  private messages: Message[] = [];
  private apiKey: string = '';

  constructor(options: any) {
    super(options);
    // Get API key from Foundry settings
    this.apiKey = game.settings.get(moduleId, 'deepseekApiKey') as string;
  }

  async _prepareContext(options: any) {
    return {
      messages: this.messages,
      isEmpty: this.messages.length === 0
    };
  }

  async _preparePartContext(partId: string, context: any) {
    switch (partId) {
      case 'messages':
        return {
          ...context,
          emptyMessage: "Welcome to Rhapsody! Start chatting with AI..."
        };
      case 'input':
        return {
          ...context,
          placeholder: "Ask me anything..."
        };
      default:
        return context;
    }
  }

  static async submitForm(
    this: RhapsodyApp,
    event: SubmitEvent,
    form: HTMLFormElement,
    formData: FormDataExtended
  ) {
    const input = formData.get("userMessage")?.toString().trim();

    if (!input) {
      ui.notifications?.warn("Please enter a message.");
      return;
    }

    if (!this.apiKey) {
      ui.notifications?.error("Please set your DeepSeek API key in module settings.");
      return;
    }

    const userMessage: Message = {
      id: foundry.utils.randomID(),
      sender: "user",
      content: input,
      timestamp: new Date()
    };

    this.messages.push(userMessage);
    
    // Add loading message
    const loadingMessage: Message = {
      id: foundry.utils.randomID(),
      sender: "ai",
      content: 'Thinking',
      timestamp: new Date(),
      isLoading: true
    };
    this.messages.push(loadingMessage);
    
    this.render({ parts: ["messages", "input"] }).then(() => {
      const messagesContainer = this.element?.querySelector('.rhapsody-messages');
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    });

    form.reset();

    // Call DeepSeek API
    try {
      const aiResponse = await this.callDeepSeekAPI(input);
      
      // Remove loading message and add real response
      this.messages = this.messages.filter(msg => msg.id !== loadingMessage.id);
      
      const aiMessage: Message = {
        id: foundry.utils.randomID(),
        sender: "ai",
        content: aiResponse,
        timestamp: new Date()
      };

      this.messages.push(aiMessage);
      this.render({ parts: ["messages"] }).then(() => {
        const messagesContainer = this.element?.querySelector('.rhapsody-messages');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      });
    } catch (error) {
      console.error("DeepSeek API error:", error);
      
      // Remove loading message and show error
      this.messages = this.messages.filter(msg => msg.id !== loadingMessage.id);
      
      const errorMessage: Message = {
        id: foundry.utils.randomID(),
        sender: "ai",
        content: "Sorry, I couldn't get a response. Please check your API key and try again.",
        timestamp: new Date()
      };
      
      this.messages.push(errorMessage);
      this.render({ parts: ["messages"] });
      
      ui.notifications?.error("Failed to get AI response. Check your API key and connection.");
    }
  }

  private async callDeepSeekAPI(userInput: string): Promise<string> {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful GM assistant for tabletop RPGs. Keep responses concise and creative.'
          },
          {
            role: 'user',
            content: userInput
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data: DeepSeekResponse = await response.json();
    return data.choices[0].message.content;
  }
}

// Add this to your module's init hook
Hooks.once('init', () => {
  // Register API key setting
  game.settings.register(moduleId, 'deepseekApiKey', {
    name: 'DeepSeek API Key',
    hint: 'Enter your DeepSeek API key from https://platform.deepseek.com',
    scope: 'world',
    config: true,
    type: String,
    default: ''
  });
});