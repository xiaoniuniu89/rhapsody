// apps/rhapsodyApp.ts
//@ts-nocheck
import { id as moduleId } from "../../module.json";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const Base = HandlebarsApplicationMixin(ApplicationV2);

interface Message {
  id: string;
  sender: "user" | "ai";
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  isPinned?: boolean;
  tokenCount?: number;
}

interface Scene {
  id: string;
  name: string;
  messages: Message[];
  summary?: string;
  startTime: Date;
}

interface DeepSeekResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// Simple token counter (rough estimate)
function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
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
      closeOnSubmit: false,
    },
    classes: ["rhapsody-app"],
  };

  static PARTS = {
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

  private apiKey: string = "";
  private currentScene: Scene;
  private sceneHistory: Scene[] = [];
  private contextSummary: string = "";
  private maxContextTokens: number = 3000; // Leave room for response

  constructor(options: any) {
    super(options);
    this.apiKey = game.settings.get(moduleId, "deepseekApiKey") as string;
    this.loadState();

    // Start with a default scene if none exists
    if (!this.currentScene) {
      this.startNewScene();
    }
  }

  async _prepareContext(options: any) {
    const totalTokens = this.getCurrentContextSize();

    return {
      messages: this.currentScene?.messages || [],
      isEmpty: !this.currentScene?.messages?.length,
      currentScene: this.currentScene,
      previousSceneExists: this.sceneHistory.length > 0,
      totalTokens,
      tokenWarning: totalTokens > this.maxContextTokens * 0.8,
    };
  }

  async _preparePartContext(partId: string, context: any) {
    switch (partId) {
      case "sceneControls":
        return {
          ...context,
          sceneName: this.currentScene?.name || "New Scene",
        };
      case "messages":
        return {
          ...context,
          emptyMessage: "Welcome to Rhapsody! Start chatting with AI...",
        };
      case "input":
        return {
          ...context,
          placeholder: "Ask me anything...",
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
    const input = formData.get("userMessage")?.toString().trim();

    if (!input) {
      ui.notifications?.warn("Please enter a message.");
      return;
    }

    if (!this.apiKey) {
      ui.notifications?.error(
        "Please set your DeepSeek API key in module settings.",
      );
      return;
    }

    const userMessage: Message = {
      id: foundry.utils.randomID(),
      sender: "user",
      content: input,
      timestamp: new Date(),
      tokenCount: estimateTokens(input),
    };

    this.currentScene.messages.push(userMessage);

    // Check if we need to compress context
    if (this.shouldCompressContext()) {
      await this.compressOlderMessages();
    }

    // Add loading message
    const loadingMessage: Message = {
      id: foundry.utils.randomID(),
      sender: "ai",
      content: "Thinking",
      timestamp: new Date(),
      isLoading: true,
    };
    this.currentScene.messages.push(loadingMessage);

    this.render({ parts: ["messages", "input"] }).then(() => {
      const messagesContainer =
        this.element?.querySelector(".rhapsody-messages");
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    });

    form.reset();

    // Call DeepSeek API with context
    try {
      const aiResponse = await this.callDeepSeekAPI(input);

      // Remove loading message and add real response
      this.currentScene.messages = this.currentScene.messages.filter(
        (msg) => msg.id !== loadingMessage.id,
      );

      const aiMessage: Message = {
        id: foundry.utils.randomID(),
        sender: "ai",
        content: aiResponse,
        timestamp: new Date(),
        tokenCount: estimateTokens(aiResponse),
      };

      this.currentScene.messages.push(aiMessage);
      this.saveState();

      this.render({ parts: ["messages", "sceneControls"] }).then(() => {
        const messagesContainer =
          this.element?.querySelector(".rhapsody-messages");
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      });
    } catch (error) {
      console.error("DeepSeek API error:", error);

      // Remove loading message and show error
      this.currentScene.messages = this.currentScene.messages.filter(
        (msg) => msg.id !== loadingMessage.id,
      );

      const errorMessage: Message = {
        id: foundry.utils.randomID(),
        sender: "ai",
        content:
          "Sorry, I couldn't get a response. Please check your API key and try again.",
        timestamp: new Date(),
      };

      this.currentScene.messages.push(errorMessage);
      this.render({ parts: ["messages"] });

      ui.notifications?.error(
        "Failed to get AI response. Check your API key and connection.",
      );
    }
  }

  private async callDeepSeekAPI(userInput: string): Promise<string> {
    const messages = await this.buildContextMessages();

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data: DeepSeekResponse = await response.json();
    return data.choices[0].message.content;
  }

  private async buildContextMessages(): Promise<any[]> {
    const messages = [];

    // Get game system and world information
    const systemInfo = game.system.title || game.system.id;
    const worldName = game.world.title;
    const currentSceneName = canvas.scene?.name || "Unknown Location";

    // Build system-aware prompt
    messages.push({
      role: "system",
      content: `You are a helpful GM assistant specifically for ${systemInfo}. 
        You are currently helping with the campaign "${worldName}".
        The party is currently at: ${currentSceneName}.
        
        Important: Keep all responses appropriate for ${systemInfo} rules, mechanics, and setting. 
        Use system-specific terminology and follow the game's conventions.
        
        ${this.contextSummary ? `\nContext from earlier in scene: ${this.contextSummary}` : ""}
        ${this.sceneHistory.length > 0 ? `\nPrevious scene summary: ${this.sceneHistory[this.sceneHistory.length - 1].summary}` : ""}`,
    });

    // Get pinned messages
    const pinnedMessages = this.currentScene.messages.filter(
      (m) => m.isPinned && !m.isLoading,
    );

    // Get recent messages (excluding the summary portion)
    const recentMessages = this.getRecentMessages();

    // Add pinned messages first
    for (const msg of pinnedMessages) {
      messages.push({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.content,
      });
    }

    // Add recent messages
    for (const msg of recentMessages) {
      if (!msg.isPinned && !msg.isLoading) {
        messages.push({
          role: msg.sender === "user" ? "user" : "assistant",
          content: msg.content,
        });
      }
    }

    return messages;
  }

  private getRecentMessages(): Message[] {
    // If we have a context summary, only return messages after the summarization point
    const summaryIndex = this.currentScene.messages.findIndex(
      (m) => m.id === "summary-marker",
    );
    if (summaryIndex !== -1) {
      return this.currentScene.messages.slice(summaryIndex + 1);
    }
    return this.currentScene.messages;
  }

  private shouldCompressContext(): boolean {
    const currentSize = this.getCurrentContextSize();
    return currentSize > this.maxContextTokens;
  }

  private getCurrentContextSize(): number {
    let tokens = 0;

    // System prompt tokens
    tokens += estimateTokens(this.contextSummary || "");
    tokens += estimateTokens(
      this.sceneHistory[this.sceneHistory.length - 1]?.summary || "",
    );

    // Message tokens
    const recentMessages = this.getRecentMessages();
    for (const msg of recentMessages) {
      if (!msg.isLoading) {
        tokens += msg.tokenCount || estimateTokens(msg.content);
      }
    }

    return tokens;
  }

  private async compressOlderMessages() {
    const recentMessages = this.getRecentMessages();

    // Keep last 5 messages, compress the rest
    if (recentMessages.length > 5) {
      const toCompress = recentMessages.slice(0, -5);
      const toKeep = recentMessages.slice(-5);

      // Generate summary of older messages
      const summary = await this.generateSummary(toCompress);

      // Update context summary
      this.contextSummary = this.contextSummary
        ? `${this.contextSummary}\n\n${summary}`
        : summary;

      // Mark where we compressed from
      const markerIndex = this.currentScene.messages.findIndex(
        (m) => m.id === toKeep[0].id,
      );
      if (markerIndex > 0) {
        this.currentScene.messages.splice(markerIndex, 0, {
          id: "summary-marker",
          sender: "ai",
          content: "[Context compressed above this point]",
          timestamp: new Date(),
        } as Message);
      }
    }
  }

  private async generateSummary(messages: Message[]): Promise<string> {
    const conversation = messages
      .filter((m) => !m.isLoading && m.id !== "summary-marker")
      .map((m) => `${m.sender === "user" ? "Player" : "GM"}: ${m.content}`)
      .join("\n");

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "user",
            content: `Summarize the key facts, events, and context from this RPG conversation. Focus on information that would be important for continuing the scene:\n\n${conversation}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    const data: DeepSeekResponse = await response.json();
    return data.choices[0].message.content;
  }

  // Scene Management
  startNewScene(name?: string) {
    this.currentScene = {
      id: foundry.utils.randomID(),
      name:
        name ||
        `Scene - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
      messages: [],
      startTime: new Date(),
    };
    this.contextSummary = "";
    this.saveState();
    this.render();
  }

  async endScene() {
    if (!this.currentScene || this.currentScene.messages.length === 0) {
      ui.notifications?.warn("No scene to end.");
      return;
    }

    // Disable buttons and show loading state
    this.element
      ?.querySelectorAll('[data-action="end-scene"], [data-action="new-scene"]')
      .forEach((btn) => {
        (btn as HTMLButtonElement).disabled = true;
      });

    // Add loading indicator
    const loadingMessage: Message = {
      id: foundry.utils.randomID(),
      sender: "ai",
      content: "Generating scene summary",
      timestamp: new Date(),
      isLoading: true,
    };
    this.currentScene.messages.push(loadingMessage);
    await this.render({ parts: ["messages"] });

    try {
      // Generate scene summary
      const summary = await this.generateSceneSummary();

      // Remove loading message
      this.currentScene.messages = this.currentScene.messages.filter(
        (msg) => msg.id !== loadingMessage.id,
      );
      await this.render({ parts: ["messages"] });

      // Show dialog for editing summary
      const editedSummary = await this.showSummaryEditDialog(summary);

      if (editedSummary !== null) {
        this.currentScene.summary = editedSummary;

        // Create journal entry
        await this.createJournalEntry(this.currentScene);

        // Archive scene
        this.sceneHistory.push(this.currentScene);
        if (this.sceneHistory.length > 5) {
          this.sceneHistory.shift(); // Keep only last 5 scenes
        }

        // Start new scene
        this.startNewScene();

        ui.notifications?.info("Scene ended and journal created!");
      }
    } catch (error) {
      console.error("Error ending scene:", error);
      ui.notifications?.error("Failed to generate scene summary.");

      // Remove loading message
      this.currentScene.messages = this.currentScene.messages.filter(
        (msg) => msg.id !== loadingMessage.id,
      );
      await this.render({ parts: ["messages"] });
    } finally {
      // Re-enable buttons
      this.element
        ?.querySelectorAll(
          '[data-action="end-scene"], [data-action="new-scene"]',
        )
        .forEach((btn) => {
          (btn as HTMLButtonElement).disabled = false;
        });
    }
  }

  private async generateSceneSummary(): Promise<string> {
    const systemInfo = game.system.title || game.system.id;

    const allMessages = this.currentScene.messages
      .filter((m) => !m.isLoading && m.id !== "summary-marker")
      .map((m) => `${m.sender === "user" ? "Player" : "GM"}: ${m.content}`)
      .join("\n");

    const prompt = `Create a narrative summary of this ${systemInfo} RPG scene. Include:
    - What happened in the scene
    - Key NPCs introduced or interacted with
    - Important locations mentioned
    - Significant items or clues discovered
    - Any unresolved questions or hooks
    - Any ${systemInfo}-specific mechanics or rules that came up
    
    Format it as an engaging narrative summary that would be fun to read later.
    Keep it appropriate for ${systemInfo}'s tone and setting.
    
    Conversation:
    ${allMessages}`;

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    const data: DeepSeekResponse = await response.json();
    return data.choices[0].message.content;
  }

  private async showSummaryEditDialog(summary: string): Promise<string | null> {
    return new Promise((resolve) => {
      const dialog = new foundry.applications.api.DialogV2({
        window: {
          title: "Edit Scene Summary",
        },
        content: `
          <div style="margin-bottom: 10px;">Review and edit the scene summary before saving:</div>
          <textarea name="scene-summary" style="width: 100%; height: 300px; font-family: inherit;">${summary}</textarea>
        `,
        buttons: [
          {
            action: "save",
            label: "Save",
            icon: "fas fa-save",
            default: true,
            callback: (event, button, dialog) => {
              const textarea = button.form.elements[
                "scene-summary"
              ] as HTMLTextAreaElement;
              resolve(textarea.value);
            },
          },
          {
            action: "cancel",
            label: "Cancel",
            icon: "fas fa-times",
            callback: () => resolve(null),
          },
        ],
        submit: (result) => {
          if (result.action === "save") {
            const form = dialog.element?.querySelector("form");
            const textarea = form?.elements.namedItem(
              "scene-summary",
            ) as HTMLTextAreaElement;
            resolve(textarea?.value || summary);
          } else {
            resolve(null);
          }
        },
        close: () => resolve(null),
      });

      dialog.render(true);
    });
  }

  private async createJournalEntry(scene: Scene) {
    const systemInfo = game.system.title || game.system.id;
    const sceneName = canvas.scene?.name || "Unknown Location";
    const worldName = game.world.title;
    const rhapsodyFolderName = "Rhapsody Sessions";

    // Safer helper that avoids duplicate folders
    const getOrCreateFolder = async (
      name: string,
      parentId: string | null = null,
    ): Promise<Folder> => {
      const folder = game.folders.find(
        (f) => f.name.toLowerCase() === name.toLowerCase(),

        // f.name.toLowerCase() === name.toLowerCase() &&
        // f.type === "JournalEntry" &&
        // (f.folder ?? null) === parentId
      );

      if (folder) return folder;

      const created = await Folder.create({
        name,
        type: "JournalEntry",
        folder: parentId ?? null,
        sorting: "a",
      });

      return created;
    };

    // ✅ Corrected hierarchy
    const topFolder = await getOrCreateFolder(worldName, null); // e.g., "Walking Solo"
    const rhapsodyFolder = await getOrCreateFolder(
      rhapsodyFolderName,
      topFolder.id,
    ); // e.g., "Rhapsody Sessions"

    // Create the journal entry
    await JournalEntry.create({
      name: scene.name,
      folder: rhapsodyFolder.id,
      pages: [
        {
          name: "Summary",
          type: "text",
          text: {
            content: `
          <h2>${scene.name}</h2>
          <p><em>${scene.startTime.toLocaleString()}</em></p>
          <p><strong>System:</strong> ${systemInfo} | <strong>Location:</strong> ${sceneName}</p>
          ${scene.summary ? `<div>${scene.summary}</div>` : ""}
        `,
          },
        },
      ],
    });
  }

  // Event Handlers
  async _onClickAction(event: PointerEvent, target: HTMLElement) {
    const action = target.dataset.action;

    switch (action) {
      case "end-scene":
        await this.endScene();
        break;
      case "new-scene":
        this.startNewScene();
        break;
      case "toggle-pin":
        const messageId = target.closest(".message")?.dataset.messageId;
        if (messageId) {
          this.togglePinMessage(messageId);
        }
        break;
    }
  }

  private togglePinMessage(messageId: string) {
    const message = this.currentScene.messages.find((m) => m.id === messageId);
    if (message) {
      message.isPinned = !message.isPinned;
      this.saveState();
      this.render({ parts: ["messages"] });
    }
  }

  // State Management
  private saveState() {
    const state = {
      currentScene: this.currentScene,
      sceneHistory: this.sceneHistory,
      contextSummary: this.contextSummary,
    };

    game.settings.set(moduleId, "rhapsodyState", state);
  }

  private loadState() {
    try {
      const state = game.settings.get(moduleId, "rhapsodyState") as any;
      console.log("Loaded Rhapsody state:", state);
      if (state) {
        this.currentScene = state.currentScene;
        this.sceneHistory = state.sceneHistory || [];
        this.contextSummary = state.contextSummary || "";
      }
    } catch (e) {
      // No saved state yet
    }
  }
}

// Add this to your module's init hook
Hooks.once("init", () => {
  // Register API key setting
  game.settings.register(moduleId, "deepseekApiKey", {
    name: "DeepSeek API Key",
    hint: "Enter your DeepSeek API key from https://platform.deepseek.com",
    scope: "world",
    config: true,
    type: String,
    default: "",
  });

  // Register state storage
  game.settings.register(moduleId, "rhapsodyState", {
    scope: "world",
    config: false,
    type: Object,
    default: {},
  });
});
