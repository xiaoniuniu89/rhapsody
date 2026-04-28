import type { MemoryScope, PageContent, RhapsodyMode } from "../memory/types";
import type { TurnResult } from "../engine/MoveDispatcher";
import { id as moduleId } from "../../module.json";

// @ts-ignore — foundry global
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class RhapsodyApp extends HandlebarsApplicationMixin(ApplicationV2) {
  lastResponse: string | null = null;
  lastPage: PageContent | null = null;
  lastPageError: string | null = null;
  lastPageSuccess: string | null = null;
  turnResult: TurnResult | null = null;

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
      writePage: RhapsodyApp.#onWritePage,
      appendJournal: RhapsodyApp.#onAppendJournal,
      sendTurn: RhapsodyApp.#onSendTurn,
      saveContract: RhapsodyApp.#onSaveContract,
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
    // @ts-ignore
    const activeScene = game.scenes.viewed;
    let contractData = null;

    if (activeScene) {
      const { contract } = await import("../main");
      contractData = contract.read(activeScene.id);
      if (!contractData) {
        contractData = {
          question: "",
          onOffer: [],
          hidden: [],
          complications: [],
          exits: [],
          progress: {
            cluesRevealed: [],
            complicationsTriggered: [],
            freeform: [],
            hiddenLeaks: []
          }
        };
      }
    }

    return {
      lastResponse: this.lastResponse,
      lastPage: this.lastPage,
      lastPageError: this.lastPageError,
      lastPageSuccess: this.lastPageSuccess,
      turnResult: this.turnResult,
      mode,
      activeScene,
      contract: contractData,
    };
  }

  static async #onSaveContract(this: RhapsodyApp) {
    // @ts-ignore
    const activeScene = game.scenes.viewed;
    if (!activeScene) return;

    // @ts-ignore
    const root: HTMLElement = this.element;
    const question = root.querySelector<HTMLInputElement>('[name="contract-question"]')?.value ?? "";
    const onOfferRaw = root.querySelector<HTMLTextAreaElement>('[name="contract-onOffer"]')?.value ?? "";
    const hiddenRaw = root.querySelector<HTMLTextAreaElement>('[name="contract-hidden"]')?.value ?? "";
    const complicationsRaw = root.querySelector<HTMLTextAreaElement>('[name="contract-complications"]')?.value ?? "";
    const exitsRaw = root.querySelector<HTMLTextAreaElement>('[name="contract-exits"]')?.value ?? "";

    const parseList = (raw: string) => raw.split("\n").map(s => s.trim()).filter(s => s.length > 0);
    const parseItems = (raw: string) => parseList(raw).map(text => ({
      text,
      // Simple slug/id generation
      id: text.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 20)
    }));

    try {
      const { contract } = await import("../main");
      const existing = contract.read(activeScene.id);
      
      const newContract = {
        question,
        onOffer: parseItems(onOfferRaw),
        hidden: parseList(hiddenRaw),
        complications: parseItems(complicationsRaw),
        exits: parseList(exitsRaw),
        progress: existing?.progress ?? {
          cluesRevealed: [],
          complicationsTriggered: [],
          freeform: [],
          hiddenLeaks: []
        }
      };

      await contract.write(activeScene.id, newContract);
      this.lastPageSuccess = "Contract saved.";
    } catch (err) {
      this.lastPageError = "Error saving contract: " + (err as Error).message;
    }
    this.render();
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

  static async #onSendTurn(this: RhapsodyApp) {
    // @ts-ignore — AppV2 element
    const root: HTMLElement = this.element;
    const playerMessage =
      root.querySelector<HTMLTextAreaElement>('[name="player-message"]')?.value.trim() ?? "";

    if (!playerMessage) return;

    try {
      const { moveDispatcher } = await import("../main");
      this.turnResult = await moveDispatcher.runTurn(playerMessage);
      this.lastPageError = null;
    } catch (err) {
      this.lastPageError = "Error: " + (err as Error).message;
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

  static async #onWritePage(this: RhapsodyApp) {
    // @ts-ignore — AppV2 element
    const root: HTMLElement = this.element;
    const scope = (
      root.querySelector<HTMLSelectElement>('[name="write-scope"]')?.value ?? "bible"
    ) as MemoryScope;
    const name =
      root.querySelector<HTMLInputElement>('[name="write-name"]')?.value.trim() ?? "";
    const publicContent =
      root.querySelector<HTMLTextAreaElement>('[name="write-public"]')?.value ?? "";
    const privateContent =
      root.querySelector<HTMLTextAreaElement>('[name="write-private"]')?.value ?? "";

    if (!name) {
      this.lastPageError = "Enter a page name.";
      this.lastPageSuccess = null;
      this.render();
      return;
    }

    try {
      const { memory } = await import("../main");
      await memory.writePage(scope, name, {
        public: publicContent,
        private: scope === "bible" ? privateContent : undefined,
      });
      this.lastPageSuccess = `Saved page: ${name}`;
      this.lastPageError = null;
      // Refresh read view if we just wrote to it
      const readName =
        root.querySelector<HTMLInputElement>('[name="memory-name"]')?.value.trim();
      if (readName === name) {
        this.lastPage = memory.readPage(scope, name);
      }
    } catch (err) {
      this.lastPageError = "Error: " + (err as Error).message;
      this.lastPageSuccess = null;
    }
    this.render();
  }

  static async #onAppendJournal(this: RhapsodyApp) {
    // @ts-ignore — AppV2 element
    const root: HTMLElement = this.element;
    const name =
      root.querySelector<HTMLInputElement>('[name="append-name"]')?.value.trim() ?? "";
    const html =
      root.querySelector<HTMLTextAreaElement>('[name="append-html"]')?.value ?? "";

    if (!name || !html) {
      this.lastPageError = "Enter name and content to append.";
      this.lastPageSuccess = null;
      this.render();
      return;
    }

    try {
      const { memory } = await import("../main");
      await memory.appendPage("journal", name, "Public", html);
      this.lastPageSuccess = `Appended to ${name}`;
      this.lastPageError = null;
      // Clear the append input
      const appendInput = root.querySelector<HTMLTextAreaElement>('[name="append-html"]');
      if (appendInput) appendInput.value = "";
    } catch (err) {
      this.lastPageError = "Error: " + (err as Error).message;
      this.lastPageSuccess = null;
    }
    this.render();
  }
}
