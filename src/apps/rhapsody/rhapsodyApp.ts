import { id as moduleId } from "../../../module.json";
import type { Scene } from "./types";
import { ApiService } from "./services/apiService";
import { ContextService } from "./services/contextService";
import { JournalService } from "./services/journalService";
import { SceneService } from "./services/sceneService";
import { StateService } from "./services/stateService";
import { SessionService } from "./services/sessionService";
import { UIService } from "./services/UIService";
import { MessageService } from "./services/messageService";
import { ChatService } from "./services/chatService";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const Base = HandlebarsApplicationMixin(ApplicationV2);

export default class RhapsodyApp extends Base {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    tag: "form",
    id: "rhapsody-chat",
    resizable: true,
    window: {
      title: "Rhapsody GM",
    },
    form: {
      handler: RhapsodyApp.submitForm,
      submitOnChange: false,
      closeOnSubmit: false,
    },
    classes: ["rhapsody-app"],
  };

  static PARTS = {
    sessionControls: {
      template: `modules/${moduleId}/public/templates/rhapsody-session-controls.hbs`,
      classes: ["rhapsody-session-controls"],
    },
    sceneControls: {
      template: `modules/${moduleId}/public/templates/rhapsody-scene-controls.hbs`,
      classes: ["rhapsody-scene-controls"],
    },
    messages: {
      template: `modules/${moduleId}/public/templates/rhapsody-messages.hbs`,
      classes: ["rhapsody-messages"],
    },
    input: {
      template: `modules/${moduleId}/public/templates/rhapsody-input.hbs`,
      classes: ["rhapsody-input"],
    },
  };

  private currentScene: Scene | null = null;
  private sceneHistory: Scene[] = [];
  private apiService: ApiService;
  private contextService: ContextService;
  private journalService: JournalService;
  private sceneService: SceneService;
  private stateService: StateService;
  private sessionService: SessionService;
  private uiService: UIService;
  private messageService: MessageService;
  private chatService: ChatService;

  constructor(options?: any) {
    super(options);
    // @ts-ignore
    const apiKey = game?.settings?.get(moduleId, "deepseekApiKey") as string;

    // Initialize services
    this.apiService = new ApiService(apiKey);
    this.contextService = new ContextService(this.apiService);
    this.journalService = new JournalService();
    this.sceneService = new SceneService(this.apiService);
    this.sessionService = new SessionService();
    this.stateService = new StateService();
    this.uiService = new UIService();
    this.messageService = new MessageService();
    this.chatService = new ChatService(
      this.apiService,
      this.contextService,
      this.messageService,
    );

    // Load state including sessions
    const state = this.stateService.loadState();
    this.currentScene = state.currentScene || null;
    this.sceneHistory = state.sceneHistory;
    this.contextService.setContextSummary(state.contextSummary);
    this.sessionService.loadState({
      currentSession: state.currentSession,
      sessionHistory: state.sessionHistory,
    });

    // Only start a new scene if we have an active session
    if (!this.currentScene && this.sessionService.hasActiveSession()) {
      this.startNewScene();
    }
  }

  // @ts-ignore
  async _prepareContext(options?: any) {
    const totalTokens = this.contextService.getCurrentContextSize(
      this.currentScene?.messages || [],
      this.sceneHistory,
    );

    return {
      messages: this.currentScene?.messages || [],
      isEmpty: !this.currentScene?.messages?.length,
      currentScene: this.currentScene,
      previousSceneExists: this.sceneHistory.length > 0,
      totalTokens,
      tokenWarning: totalTokens > this.contextService.maxContextTokens * 0.8,
      hasActiveSession: this.sessionService.hasActiveSession(),
    };
  }

  async _preparePartContext(partId: string, context: any) {
    switch (partId) {
      case "sessionControls":
        const session = this.sessionService.getCurrentSession();
        return {
          ...context,
          hasActiveSession: this.sessionService.hasActiveSession(),
          sessionName: session?.name || "",
          sceneCount: session?.sceneCount || 0,
        };
      case "sceneControls":
        return {
          ...context,
          sceneName: this.currentScene?.name || "New Scene",
          canStartScene: this.sessionService.hasActiveSession(),
        };
      case "messages":
        return {
          ...context,
          emptyMessage: this.sessionService.hasActiveSession()
            ? "Welcome to Rhapsody! Start chatting with AI..."
            : "Start a session to begin chatting with the AI GM!",
        };
      case "input":
        return {
          ...context,
          placeholder: "Ask me anything...",
          disabled: !this.sessionService.hasActiveSession(),
        };
      default:
        return context;
    }
  }

  static async submitForm(
    this: RhapsodyApp,
    event: SubmitEvent,
    form: HTMLFormElement,
    formData: FormDataExtended,
  ) {
    console.log("submit event", event);

    const input = formData.get("userMessage")?.toString().trim() || "";

    // Validate requirements
    const validation = this.chatService.validateChatRequirements(
      this.sessionService.hasActiveSession(),
      this.apiService.apiKey,
      this.currentScene,
      input,
    );

    if (!validation.valid) {
      ui.notifications?.warn(validation.error!);
      return;
    }

    // Create and add user message
    const userMessage = this.messageService.createUserMessage(input);
    this.messageService.addMessageToScene(this.currentScene!, userMessage);

    // Reset form and render to show user message immediately
    form.reset();
    await this.render({ parts: ["messages", "input"] });

    // Scroll to show new user message
    const container = this.element?.querySelector(".rhapsody-messages");
    this.messageService.scrollToBottom(container);

    try {
      // Process context compression if needed
      if (
        this.contextService.shouldCompressContext(
          this.currentScene!.messages,
          this.sceneHistory,
        )
      ) {
        const { updatedMessages, summary } =
          await this.contextService.compressOlderMessages(
            this.currentScene!.messages,
          );
        this.currentScene!.messages = updatedMessages;

        const existingSummary = this.contextService.getContextSummary();
        this.contextService.setContextSummary(
          existingSummary ? `${existingSummary}\n\n${summary}` : summary,
        );
      }

      // Create AI message for streaming
      const aiMessage = this.messageService.createAIMessage();
      this.messageService.addMessageToScene(this.currentScene!, aiMessage);

      // Render to show AI message placeholder
      await this.render({ parts: ["messages"] });

      // Build context for AI
      const contextMessages = await this.contextService.buildContextMessages(
        this.currentScene!.messages.filter((m) => m.id !== aiMessage.id),
        this.sceneHistory,
        game?.system?.title || game?.system?.id || "Unknown System",
        game?.world?.title || "Unknown World",
        canvas?.scene?.name || "Unknown Location",
      );

      // Stream response with real-time updates
      let fullMarkdown = "";

      for await (const chunk of this.apiService.streamDeepSeekAPI(
        contextMessages,
      )) {
        fullMarkdown += chunk;

        // Update message with streaming content
        this.messageService.updateStreamingMessage(
          aiMessage,
          fullMarkdown,
          false,
        );

        // Update DOM directly for smooth streaming
        this.messageService.updateStreamingDOM(
          this.element,
          aiMessage.id,
          aiMessage.content,
        );

        // Auto-scroll during streaming
        const container = this.element?.querySelector(".rhapsody-messages");
        this.messageService.autoScrollMessages(container);
      }

      // Final update with complete content
      this.messageService.updateStreamingMessage(aiMessage, fullMarkdown, true);

      // Save state after successful message
      this.saveAllState();

      // Final UI update to ensure everything is in sync
      await this.render({ parts: ["messages", "sceneControls"] });

      // Final scroll to bottom
      const finalContainer = this.element?.querySelector(".rhapsody-messages");
      this.messageService.scrollToBottom(finalContainer);
    } catch (error) {
      console.error("Chat error:", error);

      // Find and remove the AI message that failed
      const aiMessages = this.currentScene!.messages.filter(
        (m) => m.sender === "ai" && m.isLoading,
      );
      aiMessages.forEach((msg) => {
        this.messageService.removeMessageFromScene(this.currentScene!, msg.id);
      });

      // Add error message
      const errorMessage = this.messageService.createErrorMessage(
        "Sorry, I couldn't get a response. Please check your API key and try again.",
      );
      this.messageService.addMessageToScene(this.currentScene!, errorMessage);

      await this.render({ parts: ["messages"] });
      ui.notifications?.error(
        "Failed to get AI response. Check your API key and connection.",
      );
    }
  }

  startNewScene(name?: string, incrementNumber: boolean = true) {
    console.log(
      "Starting new scene:",
      name,
      "incrementNumber:",
      incrementNumber,
    );
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
    this.contextService.setContextSummary("");
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
      const modalContent = `<p>This will clear all messages in the current scene (${this.currentScene.name}).</p>
              <p>Are you sure you want to restart?</p>`;

      const confirmed = await this.uiService.confirmModal(modalContent);

      if (!confirmed) return;
    }

    // Clear messages but keep the same scene
    this.currentScene.messages = [];
    this.contextService.setContextSummary("");
    this.saveAllState();
    this.render();

    ui.notifications?.info("Scene restarted!");
  }

  async endScene() {
    if (!this.currentScene) {
      ui.notifications?.warn("No scene to end.");
      return;
    }

    const session = this.sessionService.getCurrentSession();
    if (!session) {
      ui.notifications?.warn("No active session!");
      return;
    }

    // Handle empty scenes
    if (this.currentScene.messages.length === 0) {
      const confirmed = await Dialog.confirm({
        title: "Skip Empty Scene?",
        content: `<p>Scene ${this.currentScene.number} has no messages.</p>
                  <p>Skip to Scene ${(this.currentScene.number || 0) + 1}?</p>`,
        yes: () => true,
        no: () => false,
        defaultYes: true,
      });

      if (confirmed) {
        this.startNewScene("", true);
        ui.notifications?.info(
          `Skipped empty scene. Now in Scene ${this.currentScene?.number}.`,
        );
      }
      return;
    }

    // Disable buttons
    this.setSceneButtonsEnabled(false);

    // Add loading message
    const loadingMessage = this.messageService.createLoadingMessage(
      "Generating scene summary...",
    );
    this.messageService.addMessageToScene(this.currentScene, loadingMessage);
    await this.render({ parts: ["messages"] });

    try {
      // Generate summary
      const summary = await this.sceneService.generateSceneSummary(
        this.currentScene.messages,
      );

      // Remove loading message
      this.messageService.removeMessageFromScene(
        this.currentScene,
        loadingMessage.id,
      );
      await this.render({ parts: ["messages"] });

      // Save summary and create journal
      this.currentScene.summary = summary;
      const journal = await this.journalService.createJournalEntry(
        this.currentScene,
        session,
      );

      // Archive scene
      const completedSceneNumber = this.currentScene.number || 0;
      this.archiveCurrentScene();

      // Start new scene
      this.startNewScene();

      // Notify and open journal
      ui.notifications?.info(
        `Scene ${completedSceneNumber} saved! Now starting Scene ${this.currentScene?.number || completedSceneNumber + 1}.`,
      );

      if (journal) {
        journal.sheet?.render(true);
      }
    } catch (error) {
      console.error("Error ending scene:", error);
      this.messageService.removeMessageFromScene(
        this.currentScene,
        loadingMessage.id,
      );
      await this.render({ parts: ["messages"] });
      ui.notifications?.error(
        "Failed to generate scene summary. Please try again.",
      );
    } finally {
      this.setSceneButtonsEnabled(true);
    }
  }

  // Session management methods
  async startSession() {
    const sessionName = await this.uiService.promptForSessionName(
      this.sessionService.getSessionHistory().length + 1,
    );
    if (sessionName !== null) {
      this.sessionService.startNewSession(sessionName || undefined);
      this.startNewScene(undefined, false); // Automatically start first scene
      this.saveAllState();
      this.render();
      ui.notifications?.info("Session started!");
    }
  }

  async endSession() {
    const modalContent = `<p>End the current session? This will finalize all scenes.</p>`;
    const confirmed = await this.uiService.confirmModal(modalContent);

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

  async _onClickAction(event: PointerEvent, target: HTMLElement) {
    console.log("event", event);
    const action = target.dataset.action;

    switch (action) {
      case "start-session":
        await this.startSession();
        break;
      case "end-session":
        await this.endSession();
        break;
      case "end-scene":
        await this.endScene();
        break;
      case "restart-scene":
        await this.restartScene();
        break;
      case "toggle-pin":
        // @ts-ignore
        const messageId = target.closest(".message")?.dataset.messageId;
        if (messageId) {
          this.togglePinMessage(messageId);
        }
        break;
      case "clear-history":
        await this.clearAllHistory();
        break;
      case "reset-session-numbers":
        const modalTitle = "Reset Session Numbering";
        const modalContent =
          "<p>Reset session numbers to start from 1 again?</p>";
        const resetConfirmed = await this.uiService.confirmModal(
          modalContent,
          modalTitle,
        );

        if (resetConfirmed) {
          this.sessionService.resetSessionNumbering();
          this.saveAllState();
          ui.notifications?.info(
            "Session numbering reset. Next session will be Session 1.",
          );
        }
        break;
    }
  }

  private async clearAllHistory() {
    const modalTitle = "Clear All History";
    const modalContent = `<p>This will clear all sessions, scenes, messages, and context. Are you sure?</p> 
    <p><strong>This cannot be undone!</strong></p>`;
    const confirmed = await this.uiService.confirmModal(
      modalContent,
      modalTitle,
    );

    if (confirmed) {
      // Clear everything
      this.sceneHistory = [];
      this.contextService.setContextSummary("");
      this.sessionService.endCurrentSession();

      // Clear session history but keep the highest number
      const currentHighest =
        this.sessionService.getState().highestSessionNumber;
      this.sessionService.loadState({
        currentSession: null,
        sessionHistory: [],
        highestSessionNumber: currentHighest, // Preserve the counter
      });

      // Clear current scene
      this.currentScene = null;

      // Save the cleared state
      this.saveAllState();

      // Render everything fresh
      this.render({ force: true });

      ui.notifications?.info(
        "All history cleared. Start a new session to begin!",
      );
    }
  }

  private togglePinMessage(messageId: string) {
    if (!this.currentScene) return;

    const success = this.messageService.togglePinMessage(
      this.currentScene,
      messageId,
    );
    if (success) {
      this.saveAllState();
      this.render({ parts: ["messages"] });
    }
  }

  // Helper methods
  private setSceneButtonsEnabled(enabled: boolean) {
    this.element
      ?.querySelectorAll(
        '[data-action="end-scene"], [data-action="restart-scene"]',
      )
      .forEach((btn) => {
        (btn as HTMLButtonElement).disabled = !enabled;
      });
  }

  private archiveCurrentScene() {
    if (!this.currentScene) return;

    this.sceneHistory.push(this.currentScene);
    if (this.sceneHistory.length > 5) {
      this.sceneHistory.shift();
    }
  }

  // Update state saving to include sessions
  private saveAllState() {
    const sessionState = this.sessionService.getState();
    this.stateService.saveState(
      this.currentScene as Scene,
      this.sceneHistory,
      this.contextService.getContextSummary(),
      sessionState.currentSession,
      sessionState.sessionHistory,
      sessionState.highestSessionNumber,
    );
  }
}
