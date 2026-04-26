// @ts-ignore — foundry global
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class RhapsodyApp extends HandlebarsApplicationMixin(ApplicationV2) {
  lastResponse: string | null = null;

  static DEFAULT_OPTIONS = {
    id: "rhapsody",
    tag: "div",
    window: {
      title: "Rhapsody",
      icon: "fa-solid fa-theater-masks",
      resizable: true,
    },
    position: { width: 600, height: 700 },
    actions: {
      testConnection: RhapsodyApp.#onTestConnection,
    },
  };

  static PARTS = {
    panel: {
      template: "modules/rhapsody/public/templates/rhapsody-panel.hbs",
    },
  };

  // @ts-ignore — AppV2 hook signature
  async _prepareContext() {
    return { lastResponse: this.lastResponse };
  }

  static async #onTestConnection(this: RhapsodyApp) {
    try {
      // Lazy import per spec
      const { OpenAIClient } = await import("../llm/OpenAIClient");
      const client = new OpenAIClient();
      this.lastResponse = await client.sendMessage(
        "Say hello in one short sentence.",
      );
    } catch (err) {
      this.lastResponse = "Error: " + (err as Error).message;
    }
    this.render();
  }
}
