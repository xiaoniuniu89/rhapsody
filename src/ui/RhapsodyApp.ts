import type { MemoryScope, PageContent, RhapsodyMode } from "../memory/types";
import { id as moduleId } from "../../module.json";

// @ts-ignore — foundry global
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class RhapsodyApp extends HandlebarsApplicationMixin(ApplicationV2) {
  lastResponse: string | null = null;
  lastPage: PageContent | null = null;
  lastPageError: string | null = null;

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
      readPage: RhapsodyApp.#onReadPage,
    },
  };

  static PARTS = {
    panel: {
      template: "modules/rhapsody/public/templates/rhapsody-panel.hbs",
    },
  };

  // @ts-ignore — AppV2 hook signature
  async _prepareContext() {
    // @ts-ignore — foundry global
    const mode = game.settings.get(moduleId, "rhapsodyMode") as RhapsodyMode;
    return {
      lastResponse: this.lastResponse,
      lastPage: this.lastPage,
      lastPageError: this.lastPageError,
      mode,
    };
  }

  static async #onTestConnection(this: RhapsodyApp) {
    try {
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

  static async #onReadPage(this: RhapsodyApp) {
    // @ts-ignore — AppV2 element
    const root: HTMLElement = this.element;
    const scope = (
      root.querySelector<HTMLSelectElement>('[name="memory-scope"]')?.value ??
      "bible"
    ) as MemoryScope;
    const name =
      root.querySelector<HTMLInputElement>('[name="memory-name"]')?.value.trim() ?? "";

    if (!name) {
      this.lastPageError = "Enter a page name.";
      this.lastPage = null;
      this.render();
      return;
    }

    try {
      const { memory } = await import("../main");
      const page = memory.readPage(scope, name);
      if (!page) {
        this.lastPageError = `Page not found: ${name}`;
        this.lastPage = null;
      } else {
        this.lastPage = page;
        this.lastPageError = null;
      }
    } catch (err) {
      this.lastPageError = "Error: " + (err as Error).message;
      this.lastPage = null;
    }
    this.render();
  }
}
