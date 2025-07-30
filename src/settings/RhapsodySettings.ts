import { MODULE_ID } from "../main";

export class RhapsodySettings {
  static OPENAI_API_KEY = "openaiApiKey";
  static CHAT_VISIBILITY = "chatVisibility";

  static registerSettings() {
    if (!game.settings) return;

    // OpenAI API Key
    game.settings.register(MODULE_ID, this.OPENAI_API_KEY, {
      name: "OpenAI API Key",
      hint: "Enter your OpenAI API key. This will be stored securely in your browser.",
      scope: "client",
      config: true,
      type: String,
      default: "",
      restricted: true, // Only GM can set this
    });

    // Chat visibility setting
    game.settings.register(MODULE_ID, this.CHAT_VISIBILITY, {
      name: "Chat Visibility",
      hint: "Who can see the AI GM responses?",
      scope: "world",
      config: true,
      type: String,
      choices: {
        all: "All Players",
        gm: "GM Only",
        whisper: "Whisper to Active Player",
      },
      default: "all",
      restricted: true,
    });
  }

  static getApiKey(): string {
    if (!game.settings) return "";
    return game.settings.get(MODULE_ID, this.OPENAI_API_KEY) as string;
  }

  static getChatVisibility(): string {
    if (!game.settings) return "all";
    return game.settings.get(MODULE_ID, this.CHAT_VISIBILITY) as string;
  }
}
