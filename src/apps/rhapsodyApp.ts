// apps/rhapsodyApp.ts
import { id as moduleId } from "../../module.json";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const Base = HandlebarsApplicationMixin(ApplicationV2);

interface Message {
  id: string;
  sender: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

export default class RhapsodyApp extends Base {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    tag: "form",
    id: "rhapsody-chat",
    // position: { top: 100, left: 100 },
    resizable: true,

    window: {
      title: "🎵 Rhapsody GM",
      // controls: [
      //   {
      //     icon: 'fa-solid fa-refresh',
      //     label: "Refresh Journals",
      //     action: "refreshJournals"
      //   },
      //   {
      //     icon: 'fa-solid fa-folder-open',
      //     label: "Show All Folders",
      //     action: "clearFilter"
      //   }
      // ]
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

  const userMessage: Message = {
    id: foundry.utils.randomID(),
    sender: "user",
    content: input,
    timestamp: new Date()
  };

  this.messages.push(userMessage);
  this.render({ parts: ["messages", "input"] }).then(() => {
    const messagesContainer = this.element?.querySelector('.rhapsody-messages');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  });

  form.reset();

  // Simulate AI response after delay
  setTimeout(() => {
    const aiMessage: Message = {
      id: foundry.utils.randomID(),
      sender: "ai",
      content: RhapsodyApp.simulateAIResponse(input),
      timestamp: new Date()
    };

    this.messages.push(aiMessage);
    this.render({ parts: ["messages"] }).then(() => {
      const messagesContainer = this.element?.querySelector('.rhapsody-messages');
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    });
  }, 800);
}


  static simulateAIResponse(userInput: string): string {
    // Basic dummy logic — replace with real logic later
    const lowered = userInput.toLowerCase();

    if (lowered.includes("hello")) return "Hi there! What would you like to do today?";
    if (lowered.includes("quest")) return "You hear whispers of a treasure hidden in the ruins to the east.";
    if (lowered.includes("help")) return "I'm here to assist. Ask me about the world, characters, or story ideas.";
    if (lowered.includes("who are you")) return "I am Rhapsody, your narrative companion in this adventure.";
    return "That's interesting! Let's explore that idea further.";
  }

  
  
}
