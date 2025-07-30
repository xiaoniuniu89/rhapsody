// apps/rhapsodyApp.ts
import { id as moduleId } from "../../../module.json";
import type { Message, Scene } from "./types";
import { ApiService } from "./apiService";
import { ContextService } from "./contextService";
import { JournalService } from "./journalService";
import { SceneService } from "./sceneService";
import { StateService } from "./stateService";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const Base = HandlebarsApplicationMixin(ApplicationV2);

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
    sceneControls: {
      template: `modules/${moduleId}/public/templates/rhapsody-scene-controls.hbs`,
      classes: ['rhapsody-scene-controls']
    },
    messages: {
      template: `modules/${moduleId}/public/templates/rhapsody-messages.hbs`,
      classes: ['rhapsody-messages']
    },
    input: {
      template: `modules/${moduleId}/public/templates/rhapsody-input.hbs`,
      classes: ['rhapsody-input']
    }
  };

  private currentScene: Scene;
  private sceneHistory: Scene[] = [];
  private apiService: ApiService;
  private contextService: ContextService;
  private journalService: JournalService;
  private sceneService: SceneService;
  private stateService: StateService;

  constructor(options: any) {
    super(options);
    const apiKey = game.settings.get(moduleId, 'deepseekApiKey') as string;
    
    this.apiService = new ApiService(apiKey);
    this.contextService = new ContextService(this.apiService);
    this.journalService = new JournalService();
    this.sceneService = new SceneService(this.apiService);
    this.stateService = new StateService();
    
    const { currentScene, sceneHistory, contextSummary } = this.stateService.loadState();
    this.currentScene = currentScene;
    this.sceneHistory = sceneHistory;
    this.contextService.setContextSummary(contextSummary);
    
    if (!this.currentScene) {
      this.startNewScene();
    }
  }

  async _prepareContext(options: any) {
    const totalTokens = this.contextService.getCurrentContextSize(
      this.currentScene?.messages || [],
      this.sceneHistory
    );
    
    return {
      messages: this.currentScene?.messages || [],
      isEmpty: !this.currentScene?.messages?.length,
      currentScene: this.currentScene,
      previousSceneExists: this.sceneHistory.length > 0,
      totalTokens,
      tokenWarning: totalTokens > this.contextService.maxContextTokens * 0.8
    };
  }

  async _preparePartContext(partId: string, context: any) {
    switch (partId) {
      case 'sceneControls':
        return {
          ...context,
          sceneName: this.currentScene?.name || 'New Scene'
        };
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

    if (!this.apiService.apiKey) {
      ui.notifications?.error("Please set your DeepSeek API key in module settings.");
      return;
    }

    const userMessage: Message = {
      id: foundry.utils.randomID(),
      sender: "user",
      content: input,
      timestamp: new Date(),
      tokenCount: estimateTokens(input)
    };

    this.currentScene.messages.push(userMessage);
    
    if (this.contextService.shouldCompressContext(this.currentScene.messages, this.sceneHistory)) {
      const { updatedMessages, summary } = await this.contextService.compressOlderMessages(this.currentScene.messages);
      this.currentScene.messages = updatedMessages;
      this.contextService.setContextSummary(
        this.contextService.getContextSummary() 
          ? `${this.contextService.getContextSummary()}\n\n${summary}`
          : summary
      );
    }
    
    const loadingMessage: Message = {
      id: foundry.utils.randomID(),
      sender: "ai",
      content: 'Thinking',
      timestamp: new Date(),
      isLoading: true
    };
    this.currentScene.messages.push(loadingMessage);
    
    this.render({ parts: ["messages", "input"] }).then(() => {
      const messagesContainer = this.element?.querySelector('.rhapsody-messages');
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    });

    form.reset();

    try {
      const messages = await this.contextService.buildContextMessages(
        this.currentScene.messages,
        this.sceneHistory,
        game.system.title || game.system.id,
        game.world.title,
        canvas.scene?.name || "Unknown Location"
      );
      
      const aiResponse = await this.apiService.callDeepSeekAPI(input, messages);
      
      this.currentScene.messages = this.currentScene.messages.filter(msg => msg.id !== loadingMessage.id);
      
      const aiMessage: Message = {
        id: foundry.utils.randomID(),
        sender: "ai",
        content: aiResponse,
        timestamp: new Date(),
        tokenCount: estimateTokens(aiResponse)
      };

      this.currentScene.messages.push(aiMessage);
      this.stateService.saveState(this.currentScene, this.sceneHistory, this.contextService.getContextSummary());
      
      this.render({ parts: ["messages", "sceneControls"] }).then(() => {
        const messagesContainer = this.element?.querySelector('.rhapsody-messages');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      });
    } catch (error) {
      console.error("DeepSeek API error:", error);
      
      this.currentScene.messages = this.currentScene.messages.filter(msg => msg.id !== loadingMessage.id);
      
      const errorMessage: Message = {
        id: foundry.utils.randomID(),
        sender: "ai",
        content: "Sorry, I couldn't get a response. Please check your API key and try again.",
        timestamp: new Date()
      };
      
      this.currentScene.messages.push(errorMessage);
      this.render({ parts: ["messages"] });
      
      ui.notifications?.error("Failed to get AI response. Check your API key and connection.");
    }
  }

  startNewScene(name?: string) {
    this.currentScene = this.sceneService.createNewScene(name);
    this.contextService.setContextSummary('');
    this.stateService.saveState(this.currentScene, this.sceneHistory, this.contextService.getContextSummary());
    this.render();
  }

  async endScene() {
    if (!this.currentScene || this.currentScene.messages.length === 0) {
      ui.notifications?.warn("No scene to end.");
      return;
    }

    this.element?.querySelectorAll('[data-action="end-scene"], [data-action="new-scene"]').forEach(btn => {
      (btn as HTMLButtonElement).disabled = true;
    });

    const loadingMessage: Message = {
      id: foundry.utils.randomID(),
      sender: "ai",
      content: 'Generating scene summary',
      timestamp: new Date(),
      isLoading: true
    };
    this.currentScene.messages.push(loadingMessage);
    await this.render({ parts: ["messages"] });

    try {
      const summary = await this.sceneService.generateSceneSummary(this.currentScene.messages);
      this.currentScene.messages = this.currentScene.messages.filter(msg => msg.id !== loadingMessage.id);
      await this.render({ parts: ["messages"] });
      
      const editedSummary = await this.sceneService.showSummaryEditDialog(summary);
      
      if (editedSummary !== null) {
        this.currentScene.summary = editedSummary;
        await this.journalService.createJournalEntry(this.currentScene);
        
        this.sceneHistory.push(this.currentScene);
        if (this.sceneHistory.length > 5) {
          this.sceneHistory.shift();
        }
        
        this.startNewScene();
        ui.notifications?.info("Scene ended and journal created!");
      }
    } catch (error) {
      console.error("Error ending scene:", error);
      ui.notifications?.error("Failed to generate scene summary.");
      this.currentScene.messages = this.currentScene.messages.filter(msg => msg.id !== loadingMessage.id);
      await this.render({ parts: ["messages"] });
    } finally {
      this.element?.querySelectorAll('[data-action="end-scene"], [data-action="new-scene"]').forEach(btn => {
        (btn as HTMLButtonElement).disabled = false;
      });
    }
  }

  async _onClickAction(event: PointerEvent, target: HTMLElement) {
    const action = target.dataset.action;
    
    switch (action) {
      case 'end-scene':
        await this.endScene();
        break;
      case 'new-scene':
        this.startNewScene();
        break;
      case 'toggle-pin':
        const messageId = target.closest('.message')?.dataset.messageId;
        if (messageId) {
          this.togglePinMessage(messageId);
        }
        break;
    }
  }

  private togglePinMessage(messageId: string) {
    const message = this.currentScene.messages.find(m => m.id === messageId);
    if (message) {
      message.isPinned = !message.isPinned;
      this.stateService.saveState(this.currentScene, this.sceneHistory, this.contextService.getContextSummary());
      this.render({ parts: ["messages"] });
    }
  }
}

Hooks.once('init', () => {
  game.settings.register(moduleId, 'deepseekApiKey', {
    name: 'DeepSeek API Key',
    hint: 'Enter your DeepSeek API key from https://platform.deepseek.com',
    scope: 'world',
    config: true,
    type: String,
    default: ''
  });
  
  game.settings.register(moduleId, 'rhapsodyState', {
    scope: 'world',
    config: false,
    type: Object,
    default: {}
  });
});

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}