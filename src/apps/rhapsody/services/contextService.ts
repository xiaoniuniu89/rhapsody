// services/contextService.ts
import type { Message, Scene } from "../types";
import { ApiService } from "./apiService";
import { MarkdownService } from "./markdownService";

export class ContextService {
  private contextSummary: string = "";
  public readonly maxContextTokens: number = 3000;
  private apiService: ApiService;

  constructor(apiService: ApiService) {
    this.apiService = apiService;
  }

  getContextSummary(): string {
    return this.contextSummary;
  }

  setContextSummary(summary: string): void {
    this.contextSummary = summary;
  }

  async buildContextMessages(
    messages: Message[],
    sceneHistory: Scene[],
    systemInfo: string,
    worldName: string,
    currentSceneName: string,
  ): Promise<any[]> {
    const contextMessages = [];

    contextMessages.push({
      role: "system",
      content: `You are a helpful GM assistant specifically for ${systemInfo}. 
        You are currently helping with the campaign "${worldName}".
        The party is currently at: ${currentSceneName}.
        
        Important: Keep all responses appropriate for ${systemInfo} rules, mechanics, and setting. 
        Use system-specific terminology and follow the game's conventions.
        
        ${this.contextSummary ? `\nContext from earlier in scene: ${this.contextSummary}` : ""}
        ${sceneHistory.length > 0 ? `\nPrevious scene summary: ${MarkdownService.stripHTML(sceneHistory[sceneHistory.length - 1].summary || "")}` : ""}`,
    });

    const pinnedMessages = messages.filter((m) => m.isPinned && !m.isLoading);
    const recentMessages = this.getRecentMessages(messages);

    // Strip HTML when sending to AI
    for (const msg of pinnedMessages) {
      contextMessages.push({
        role: msg.sender === "user" ? "user" : "assistant",
        content: MarkdownService.stripHTML(msg.content),
      });
    }

    for (const msg of recentMessages) {
      if (!msg.isPinned && !msg.isLoading) {
        contextMessages.push({
          role: msg.sender === "user" ? "user" : "assistant",
          content: MarkdownService.stripHTML(msg.content),
        });
      }
    }

    return contextMessages;
  }

  getRecentMessages(messages: Message[]): Message[] {
    const summaryIndex = messages.findIndex((m) => m.id === "summary-marker");
    if (summaryIndex !== -1) {
      return messages.slice(summaryIndex + 1);
    }
    return messages;
  }

  shouldCompressContext(messages: Message[], sceneHistory: Scene[]): boolean {
    return (
      this.getCurrentContextSize(messages, sceneHistory) > this.maxContextTokens
    );
  }

  getCurrentContextSize(messages: Message[], sceneHistory: Scene[]): number {
    let tokens = 0;
    tokens += this.estimateTokens(this.contextSummary || "");
    tokens += this.estimateTokens(
      sceneHistory[sceneHistory.length - 1]?.summary || "",
    );

    const recentMessages = this.getRecentMessages(messages);
    for (const msg of recentMessages) {
      if (!msg.isLoading) {
        tokens += msg.tokenCount || this.estimateTokens(msg.content);
      }
    }

    return tokens;
  }

  async compressOlderMessages(
    messages: Message[],
  ): Promise<{ updatedMessages: Message[]; summary: string }> {
    const recentMessages = this.getRecentMessages(messages);

    if (recentMessages.length > 5) {
      const toCompress = recentMessages.slice(0, -5);
      const toKeep = recentMessages.slice(-5);

      const summary = await this.apiService.generateSummary(toCompress);

      const updatedMessages = [...messages];
      const markerIndex = updatedMessages.findIndex(
        (m) => m.id === toKeep[0].id,
      );

      if (markerIndex > 0) {
        updatedMessages.splice(markerIndex, 0, {
          id: "summary-marker",
          sender: "ai",
          content: "[Context compressed above this point]",
          timestamp: new Date(),
        } as Message);
      }

      return { updatedMessages, summary };
    }

    return { updatedMessages: messages, summary: "" };
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
