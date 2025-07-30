import { id as moduleId } from "../../../module.json";
import type { Message, Scene, Session } from "./types";
import { ApiService } from "./services/apiService";
import { ContextService } from "./services/contextService";
import { JournalService } from "./services/journalService";
import { SceneService } from "./services/sceneService";
import { StateService } from "./services/stateService";
import { SessionService } from "./services/sessionService";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { DialogV2 } = foundry.applications.api;

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
    sessionControls: {
      template: `modules/${moduleId}/public/templates/rhapsody-session-controls.hbs`,
      classes: ['rhapsody-session-controls']
    },
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

  private currentScene: Scene | null = null;
  private sceneHistory: Scene[] = [];
  private apiService: ApiService;
  private contextService: ContextService;
  private journalService: JournalService;
  private sceneService: SceneService;
  private stateService: StateService;
  private sessionService: SessionService;

  constructor(options: any) {
    super(options);
    const apiKey = game.settings.get(moduleId, 'deepseekApiKey') as string;
    
    this.apiService = new ApiService(apiKey);
    this.contextService = new ContextService(this.apiService);
    this.journalService = new JournalService();
    this.sceneService = new SceneService(this.apiService);
    this.sessionService = new SessionService();
    this.stateService = new StateService();
    
    // Load state including sessions
    const state = this.stateService.loadState();
    this.currentScene = state.currentScene || null;
    this.sceneHistory = state.sceneHistory;
    this.contextService.setContextSummary(state.contextSummary);
    this.sessionService.loadState({
      currentSession: state.currentSession,
      sessionHistory: state.sessionHistory
    });
    
    // Only start a new scene if we have an active session
    if (!this.currentScene && this.sessionService.hasActiveSession()) {
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
      tokenWarning: totalTokens > this.contextService.maxContextTokens * 0.8,
      hasActiveSession: this.sessionService.hasActiveSession()
    };
  }

  async _preparePartContext(partId: string, context: any) {
    switch (partId) {
      case 'sessionControls':
        const session = this.sessionService.getCurrentSession();
        return {
          ...context,
          hasActiveSession: this.sessionService.hasActiveSession(),
          sessionName: session?.name || '',
          sceneCount: session?.sceneCount || 0
        };
      case 'sceneControls':
        return {
          ...context,
          sceneName: this.currentScene?.name || 'New Scene',
          canStartScene: this.sessionService.hasActiveSession()
        };
      case 'messages':
        return {
          ...context,
          emptyMessage: this.sessionService.hasActiveSession() 
            ? "Welcome to Rhapsody! Start chatting with AI..." 
            : "Start a session to begin chatting with the AI GM!"
        };
      case 'input':
        return {
          ...context,
          placeholder: "Ask me anything...",
          disabled: !this.sessionService.hasActiveSession()
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
    // Check if session is active
    if (!this.sessionService.hasActiveSession()) {
      ui.notifications?.warn("Please start a session first!");
      return;
    }

    const input = formData.get("userMessage")?.toString().trim();

    if (!input) {
      ui.notifications?.warn("Please enter a message.");
      return;
    }

    if (!this.apiService.apiKey) {
      ui.notifications?.error("Please set your DeepSeek API key in module settings.");
      return;
    }

    if (!this.currentScene) {
      ui.notifications?.error("No active scene!");
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
    
    // Create AI message that we'll update as streaming progresses
    const aiMessage: Message = {
      id: foundry.utils.randomID(),
      sender: "ai",
      content: '',
      timestamp: new Date(),
      isLoading: true
    };
    this.currentScene.messages.push(aiMessage);
    
    await this.render({ parts: ["messages", "input"] });
    form.reset();

    try {
      const messages = await this.contextService.buildContextMessages(
        this.currentScene.messages.filter(m => m.id !== aiMessage.id),
        this.sceneHistory,
        game.system.title || game.system.id,
        game.world.title,
        canvas.scene?.name || "Unknown Location"
      );
      
      // Use streaming API
      let fullResponse = '';
      for await (const chunk of this.apiService.streamDeepSeekAPI(messages)) {
        fullResponse += chunk;
        
        // Update the message content as it streams
        aiMessage.content = fullResponse;
        aiMessage.isLoading = false;
        
        // Update just the specific message
        await this.updateStreamingMessage(aiMessage.id, fullResponse);
      }
      
      // Final update with token count
      aiMessage.tokenCount = estimateTokens(fullResponse);
      this.saveAllState();
      
      // Final render to ensure everything is in sync
      await this.render({ parts: ["messages", "sceneControls"] });
      
      // Scroll to bottom
      const messagesContainer = this.element?.querySelector('.rhapsody-messages');
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
      
    } catch (error) {
      console.error("DeepSeek API error:", error);
      
      // Remove the AI message on error
      this.currentScene.messages = this.currentScene.messages.filter(msg => msg.id !== aiMessage.id);
      
      const errorMessage: Message = {
        id: foundry.utils.randomID(),
        sender: "ai",
        content: "Sorry, I couldn't get a response. Please check your API key and try again.",
        timestamp: new Date()
      };
      
      this.currentScene.messages.push(errorMessage);
      await this.render({ parts: ["messages"] });
      
      ui.notifications?.error("Failed to get AI response. Check your API key and connection.");
    }
  }

  private async updateStreamingMessage(messageId: string, content: string) {
    const messageElement = this.element?.querySelector(`[data-message-id="${messageId}"] .message-content`);
    if (messageElement) {
      messageElement.textContent = content;
      
      // Auto-scroll to keep the new content visible
      const messagesContainer = this.element?.querySelector('.rhapsody-messages');
      if (messagesContainer) {
        // Only scroll if user is near the bottom (within 100px)
        const isNearBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 100;
        if (isNearBottom) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }
    }
  }

 startNewScene(name?: string, incrementNumber: boolean = false) {
  const session = this.sessionService.getCurrentSession();
  if (!session) {
    ui.notifications?.warn("Please start a session first!");
    return;
  }

  // Only increment scene count if we're moving to a new scene
  if (incrementNumber) {
    this.sessionService.incrementSceneCount();
  }
  
  this.currentScene = this.sceneService.createNewScene(name, session);
  this.contextService.setContextSummary('');
  this.saveAllState();
  this.render();
}

async restartScene() {
  if (!this.currentScene) {
    ui.notifications?.warn("No scene to restart.");
    return;
  }

  // If scene has messages, confirm first
  if (this.currentScene.messages.length > 0) {
  const confirmed = await DialogV2.confirm({
    content: `<p>This will clear all messages in the current scene (${this.currentScene.name}).</p>
              <p>Are you sure you want to restart?</p>`,
    rejectClose: false,
    modal: true
  });

  if (!confirmed) return;
}

  // Clear messages but keep the same scene
  this.currentScene.messages = [];
  this.contextService.setContextSummary('');
  this.saveAllState();
  this.render();
  
  ui.notifications?.info("Scene restarted!");
}

  async endScene() {
  // Check if we have a scene at all
  if (!this.currentScene) {
    ui.notifications?.warn("No scene to end.");
    return;
  }

  // Check for active session
  const session = this.sessionService.getCurrentSession();
  if (!session) {
    ui.notifications?.warn("No active session!");
    return;
  }

  // Handle empty scenes
  if (this.currentScene.messages.length === 0) {
    const confirmed = await DialogV2.confirm({
    content: `<p>Scene ${this.currentScene.number} has no messages.</p>
                <p>Skip to Scene ${(this.currentScene.number || 0) + 1}?</p>`,
    rejectClose: false,
    modal: true
    });

    
    if (confirmed) {
      this.startNewScene(undefined, true); // This will increment the scene number
      ui.notifications?.info(`Skipped empty scene. Now in Scene ${this.currentScene?.number}.`);
    }
    return;
  }

  // Disable buttons during processing
  this.element?.querySelectorAll('[data-action="end-scene"], [data-action="restart-scene"]').forEach(btn => {
    (btn as HTMLButtonElement).disabled = true;
  });

  // Add loading indicator
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
    // Generate scene summary
    const summary = await this.sceneService.generateSceneSummary(this.currentScene.messages);
    
    // Remove loading message
    this.currentScene.messages = this.currentScene.messages.filter(msg => msg.id !== loadingMessage.id);
    await this.render({ parts: ["messages"] });
    
    // Show dialog for editing summary
    const editedSummary = await this.sceneService.showSummaryEditDialog(summary);
    
    if (editedSummary !== null) {
      // Save the summary
      this.currentScene.summary = editedSummary;
      
      // Create journal entry
      await this.journalService.createJournalEntry(this.currentScene, session);
      
      // Archive the scene
      this.sceneHistory.push(this.currentScene);
      if (this.sceneHistory.length > 5) {
        this.sceneHistory.shift(); // Keep only last 5 scenes for context
      }
      
      // Store the completed scene number for the notification
      const completedSceneNumber = this.currentScene.number || 0;
      
      // Start new scene (this increments the scene counter)
      this.startNewScene();
      
      // Clear notification with scene numbers
      ui.notifications?.info(
        `Scene ${completedSceneNumber} saved! Now starting Scene ${this.currentScene?.number || completedSceneNumber + 1}.`
      );
    } else {
      // User cancelled the summary dialog
      ui.notifications?.warn("Scene ending cancelled.");
    }
  } catch (error) {
    console.error("Error ending scene:", error);
    ui.notifications?.error("Failed to generate scene summary. Please try again.");
    
    // Remove loading message on error
    this.currentScene.messages = this.currentScene.messages.filter(msg => msg.id !== loadingMessage.id);
    await this.render({ parts: ["messages"] });
  } finally {
    // Re-enable buttons
    this.element?.querySelectorAll('[data-action="end-scene"], [data-action="restart-scene"]').forEach(btn => {
      (btn as HTMLButtonElement).disabled = false;
    });
  }
}

  // Session management methods
  async startSession() {
    const sessionName = await this.promptForSessionName();
    if (sessionName !== null) {
      this.sessionService.startNewSession(sessionName || undefined);
      this.startNewScene(); // Automatically start first scene
      this.saveAllState();
      this.render();
      ui.notifications?.info("Session started!");
    }
  }

  async endSession() {
    const confirmed = await DialogV2.confirm({
        content: "<p>End the current session? This will finalize all scenes.</p>",
        rejectClose: false,
        modal: true
    });

    if (confirmed) {
      // End current scene if exists
      if (this.currentScene && this.currentScene.messages.length > 0) {
        await this.endScene();
      }

      this.sessionService.endCurrentSession();
      this.currentScene = null;
      this.saveAllState();
      this.render();
      ui.notifications?.info("Session ended!");
    }
  }

  // Helper method to prompt for session name
private async promptForSessionName(): Promise<string | null> {
  return new Promise((resolve) => {
    const dialog = new DialogV2({
      window: {
        title: "Start New Session"
      },
      content: `
        <form>
          <div style="margin-bottom: 10px;">Enter a name for this session (optional):</div>
          <input type="text" name="session-name" placeholder="Session ${this.sessionService.getSessionHistory().length + 1}" style="width: 100%;">
        </form>
      `,
      buttons: [{
        action: "start",
        label: "Start Session",
        icon: "fas fa-play",
        default: true,
        callback: (event, button, dialog) => {
          const input = button.form.elements["session-name"] as HTMLInputElement;
          resolve(input.value || '');
        }
      }, {
        action: "cancel",
        label: "Cancel",
        icon: "fas fa-times",
        callback: () => resolve(null)
      }],
    });

    dialog.render(true);
  });
}



  async _onClickAction(event: PointerEvent, target: HTMLElement) {
  const action = target.dataset.action;
  
  switch (action) {
    case 'start-session':
      await this.startSession();
      break;
    case 'end-session':
      await this.endSession();
      break;
    case 'end-scene':
      await this.endScene();
      break;
    case 'restart-scene':  // New action
      await this.restartScene();
      break;
    case 'toggle-pin':
      const messageId = target.closest('.message')?.dataset.messageId;
      if (messageId) {
        this.togglePinMessage(messageId);
      }
      break;
    case 'clear-history':
      await this.clearAllHistory();
      break;
    case 'reset-session-numbers':
    const resetConfirmed = await DialogV2.confirm({
  title: "Reset Session Numbering",
  content: "<p>Reset session numbers to start from 1 again?</p>",
  rejectClose: false,
  modal: true
});

    
    if (resetConfirmed) {
        this.sessionService.resetSessionNumbering();
        this.saveAllState();
        ui.notifications?.info("Session numbering reset. Next session will be Session 1.");
    }
    break;
  }
}

  private async clearAllHistory() {
  const confirmed = await DialogV2.confirm({
  title: "Clear All History",
  content: `
    <p>This will clear all sessions, scenes, messages, and context. Are you sure?</p>
    <p><strong>This cannot be undone!</strong></p>
    <p><em>Note: Session numbering will continue from ${this.sessionService.getState().highestSessionNumber + 1}</em></p>
  `,
  rejectClose: false,
  modal: true
});


  if (confirmed) {
    // Clear everything
    this.sceneHistory = [];
    this.contextService.setContextSummary('');
    this.sessionService.endCurrentSession();
    
    // Clear session history but keep the highest number
    const currentHighest = this.sessionService.getState().highestSessionNumber;
    this.sessionService.loadState({ 
      currentSession: null, 
      sessionHistory: [],
      highestSessionNumber: currentHighest // Preserve the counter
    });
    
    // Clear current scene
    this.currentScene = null;
    
    // Save the cleared state
    this.saveAllState();
    
    // Render everything fresh
    this.render({ force: true });
    
    ui.notifications?.info("All history cleared. Start a new session to begin!");
  }
}

  private togglePinMessage(messageId: string) {
    if (!this.currentScene) return;
    
    const message = this.currentScene.messages.find(m => m.id === messageId);
    if (message) {
      message.isPinned = !message.isPinned;
      this.saveAllState();
      this.render({ parts: ["messages"] });
    }
  }

  // Update state saving to include sessions
  private saveAllState() {
    const sessionState = this.sessionService.getState();
    this.stateService.saveState(
      this.currentScene,
      this.sceneHistory,
      this.contextService.getContextSummary(),
      sessionState.currentSession,
      sessionState.sessionHistory,
      sessionState.highestSessionNumber
    );
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