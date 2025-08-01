// services/messageService.ts
import type { Message, Scene } from "../types";
import { MarkdownService } from "./markdownService";

export class MessageService {
  /**
   * Create a user message
   */
  createUserMessage(content: string): Message {
    return {
      id: foundry.utils.randomID(),
      sender: "user",
      content: MarkdownService.escapeHtml(content),
      timestamp: new Date(),
      tokenCount: this.estimateTokens(content),
    };
  }

  /**
   * Create an AI message (for streaming)
   */
  createAIMessage(): Message {
    return {
      id: foundry.utils.randomID(),
      sender: "ai",
      content: "",
      rawContent: "",
      timestamp: new Date(),
      isLoading: true,
    };
  }

  /**
   * Create a loading message
   */
  createLoadingMessage(content: string): Message {
    return {
      id: foundry.utils.randomID(),
      sender: "ai",
      content: MarkdownService.convertToHTML(content),
      timestamp: new Date(),
      isLoading: true,
    };
  }

  /**
   * Create an error message
   */
  createErrorMessage(error: string): Message {
    return {
      id: foundry.utils.randomID(),
      sender: "ai",
      content: MarkdownService.escapeHtml(error),
      timestamp: new Date(),
    };
  }

  /**
   * Update a streaming message with new content
   */
  updateStreamingMessage(
    message: Message,
    markdownContent: string,
    isComplete: boolean = false,
  ): void {
    message.rawContent = markdownContent;

    if (isComplete) {
      message.content = MarkdownService.convertToHTML(markdownContent);
      message.tokenCount = this.estimateTokens(markdownContent);
      message.isLoading = false;
    } else {
      message.content = MarkdownService.convertStreamingChunk(markdownContent);
      message.isLoading = false;
    }
  }

  /**
   * Add a message to a scene
   */
  addMessageToScene(scene: Scene, message: Message): void {
    scene.messages.push(message);
  }

  /**
   * Remove a message from a scene
   */
  removeMessageFromScene(scene: Scene, messageId: string): void {
    scene.messages = scene.messages.filter((msg) => msg.id !== messageId);
  }

  /**
   * Toggle pin status on a message
   */
  togglePinMessage(scene: Scene, messageId: string): boolean {
    const message = scene.messages.find((m) => m.id === messageId);
    if (message) {
      message.isPinned = !message.isPinned;
      return true;
    }
    return false;
  }

  /**
   * Get all messages except loading ones
   */
  getNonLoadingMessages(messages: Message[]): Message[] {
    return messages.filter((m) => !m.isLoading && m.id !== "summary-marker");
  }

  /**
   * Estimate token count for text
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Update DOM element with streaming content
   * Returns true if update was successful
   */
  updateStreamingDOM(
    element: Element | null,
    messageId: string,
    htmlContent: string,
  ): boolean {
    if (!element) return false;

    const messageElement = element.querySelector(
      `[data-message-id="${messageId}"] .message-content`,
    );

    if (messageElement) {
      messageElement.innerHTML = htmlContent;
      return true;
    }

    return false;
  }

  /**
   * Auto-scroll messages container if near bottom
   */
  autoScrollMessages(container: Element | null): void {
    if (!container) return;

    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      100;

    if (isNearBottom) {
      container.scrollTop = container.scrollHeight;
    }
  }

  /**
   * Scroll to bottom of messages container
   */
  scrollToBottom(container: Element | null): void {
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }
}
