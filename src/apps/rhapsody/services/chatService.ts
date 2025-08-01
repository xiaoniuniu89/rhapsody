export class ChatService {
  /**
   * Validate chat prerequisites
   */
  validateChatRequirements(
    hasActiveSession: boolean,
    apiKey: string | undefined,
    currentScene: Scene | null,
    input: string,
  ): { valid: boolean; error?: string } {
    if (!hasActiveSession) {
      return { valid: false, error: "Please start a session first!" };
    }

    if (!input?.trim()) {
      return { valid: false, error: "Please enter a message." };
    }

    if (!apiKey) {
      return {
        valid: false,
        error: "Please set your DeepSeek API key in module settings.",
      };
    }

    if (!currentScene) {
      return { valid: false, error: "No active scene!" };
    }

    return { valid: true };
  }
}
