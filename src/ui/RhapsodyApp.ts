import type { PageContent } from "../memory/types";
import type { TurnResult } from "../engine/MoveDispatcher";
import type { VoiceSession } from "../voice/VoiceSession";
import { id as moduleId } from "../../module.json";

// @ts-ignore — foundry global
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class RhapsodyApp extends HandlebarsApplicationMixin(
  ApplicationV2,
) {
  lastResponse: string | null = null;
  lastPage: PageContent | null = null;
  lastPageError: string | null = null;
  lastPageSuccess: string | null = null;
  turnResult: TurnResult | null = null;
  rulesQueryResults: any[] | null = null;
  reindexProgress: string | null = null;
  assetQueryResults: any[] | null = null;
  assetReindexing = false;
  private voiceUnsubscribe: (() => void) | null = null;

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
      beginSession: RhapsodyApp.#onBeginSession,
      endSession: RhapsodyApp.#onEndSession,
      toggleMute: RhapsodyApp.#onToggleMute,
      forget60s: RhapsodyApp.#onForget60s,
      testConnection: RhapsodyApp.#onTestConnection,
      readPage: RhapsodyApp.#onReadPage,
      writePage: RhapsodyApp.#onWritePage,
      appendJournal: RhapsodyApp.#onAppendJournal,
      sendTurn: RhapsodyApp.#onSendTurn,
      saveContract: RhapsodyApp.#onSaveContract,
      saveRulesSettings: RhapsodyApp.#onSaveRulesSettings,
      reindexRules: RhapsodyApp.#onReindexRules,
      queryRules: RhapsodyApp.#onQueryRules,
      reindexAssets: RhapsodyApp.#onReindexAssets,
      queryAssets: RhapsodyApp.#onQueryAssets,
      setMap: RhapsodyApp.#onSetMap,
      playAudio: RhapsodyApp.#onPlayAudio,
      stopAudio: RhapsodyApp.#onStopAudio,
      setLighting: RhapsodyApp.#onSetLighting,
      panCamera: RhapsodyApp.#onPanCamera,
      placeToken: RhapsodyApp.#onPlaceToken,
      interruptTts: RhapsodyApp.#onInterruptTts,
      createClock: RhapsodyApp.#onCreateClock,
      advanceClock: RhapsodyApp.#onAdvanceClock,
      removeClock: RhapsodyApp.#onRemoveClock,
      shiftDisposition: RhapsodyApp.#onShiftDisposition,
      removeDisposition: RhapsodyApp.#onRemoveDisposition,
    },
  };

  static PARTS = {
    panel: {
      template: "modules/rhapsody/public/templates/rhapsody-panel.hbs",
    },
  };

  // @ts-ignore — AppV2 hook signature
  async _prepareContext() {
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
            hiddenLeaks: [],
          },
        };
      }
    }

    const { rulesIndex } = await import("../main");
    // @ts-ignore
    const selectedPacks = game.settings.get(moduleId, "rulesPacks") as string[];
    // @ts-ignore
    const allPacks = Array.from(game.packs)
      .filter((p) => p.documentName === "JournalEntry")
      .map((p) => ({
        id: p.collection,
        label: p.metadata.label,
        // @ts-ignore
        selected: selectedPacks.includes(p.collection),
      }));

    const rulesStatus = rulesIndex.status();

    const { assetIndex, voiceSession } = await import("../main");
    const assetStatus = assetIndex.status();
    const builtAtDate = assetStatus.builtAt
      ? new Date(assetStatus.builtAt).toLocaleString()
      : null;

    if (!this.voiceUnsubscribe) {
      this.voiceUnsubscribe = voiceSession.onChange(() => this.render());
    }
    const voiceStatusLabel: Record<VoiceSession["status"], string> = {
      idle: voiceSession.micState === "passive" ? "Passive listening…" : "Idle",
      listening: "Active listening…",
      transcribing: "Transcribing…",
      thinking: "GM thinking…",
      "gm-speaking": "GM speaking…",
      muted: "Muted",
      error: "Error — see transcript",
    };
    const voiceView = {
      isInSession: voiceSession.isInSession,
      status: voiceSession.status,
      micState: voiceSession.micState,
      statusLabel: voiceStatusLabel[voiceSession.status],
      speaking: voiceSession.status === "gm-speaking",
      isMuted: voiceSession.micState === "mute",
      transcript: voiceSession.transcript.map((e) => ({
        role: e.role,
        text: e.text,
        isUser: e.role === "user",
        isGm: e.role === "gm",
        isSystem: e.role === "system",
      })),
      audioSecondsIn: voiceSession.audioSecondsIn.toFixed(1),
      ttsCharsOut: voiceSession.ttsCharsOut,
    };

    const { worldState } = await import("../main");
    const snap = worldState.snapshot();
    const stateView = {
      clocks: Object.values(snap.clocks).map((c) => ({
        ...c,
        cells: Array.from({ length: c.segments }, (_, i) => i < c.filled),
      })),
      dispositions: Object.values(snap.dispositions).map((d) => {
        const labels = ["−3", "−2", "−1", "0", "+1", "+2", "+3"];
        return {
          ...d,
          cells: labels.map((label, i) => {
            const v = i - 3;
            return {
              label,
              active: v === d.value,
              tone: v < 0 ? "neg" : v > 0 ? "pos" : "zero",
            };
          }),
        };
      }),
    };

    return {
      lastResponse: this.lastResponse,
      lastPage: this.lastPage,
      lastPageError: this.lastPageError,
      lastPageSuccess: this.lastPageSuccess,
      turnResult: this.turnResult,
      activeScene,
      contract: contractData,
      rules: {
        allPacks,
        status: rulesStatus,
        queryResults: this.rulesQueryResults,
        reindexProgress: this.reindexProgress,
      },
      assets: {
        status: assetStatus,
        builtAtDate,
        queryResults: this.assetQueryResults,
        reindexing: this.assetReindexing,
      },
      state: stateView,
      voice: voiceView,
    };
  }

  static async #onBeginSession(this: RhapsodyApp) {
    const { voiceSession } = await import("../main");
    await voiceSession.beginSession();
    this.render();
  }

  static async #onEndSession(this: RhapsodyApp) {
    const { voiceSession } = await import("../main");
    await voiceSession.endSession();
    this.render();
  }

  static async #onToggleMute(this: RhapsodyApp) {
    const { voiceSession } = await import("../main");
    voiceSession.toggleMute();
    this.render();
  }

  static async #onForget60s(this: RhapsodyApp) {
    const { voiceSession } = await import("../main");
    voiceSession.forget60s();
    this.render();
  }

  static async #onInterruptTts(this: RhapsodyApp) {
    const { voiceSession } = await import("../main");
    voiceSession.interrupt();
    this.render();
  }

  static async #onSetMap(this: RhapsodyApp) {
    // @ts-ignore
    const root: HTMLElement = this.element;
    const query = root.querySelector<HTMLInputElement>('[name="map-query"]')?.value.trim();
    if (!query) return;
    try {
      const { stagecraft } = await import("../main");
      await stagecraft.setSceneMap({ query });
      this.lastPageSuccess = `Scene activated matching "${query}"`;
    } catch (err) {
      this.lastPageError = (err as Error).message;
    }
    this.render();
  }

  static async #onPlayAudio(this: RhapsodyApp) {
    // @ts-ignore
    const root: HTMLElement = this.element;
    const query = root.querySelector<HTMLInputElement>('[name="audio-query"]')?.value.trim();
    if (!query) return;
    try {
      const { stagecraft } = await import("../main");
      await stagecraft.playAmbient({ query });
      this.lastPageSuccess = `Playing audio matching "${query}"`;
    } catch (err) {
      this.lastPageError = (err as Error).message;
    }
    this.render();
  }

  static async #onStopAudio(this: RhapsodyApp) {
    try {
      const { stagecraft } = await import("../main");
      await stagecraft.stopAmbient();
      this.lastPageSuccess = "Stopped all ambient audio";
    } catch (err) {
      this.lastPageError = (err as Error).message;
    }
    this.render();
  }

  static async #onSetLighting(this: RhapsodyApp, _event: Event, target: HTMLElement) {
    const preset = target.dataset.preset as any;
    if (!preset) return;
    try {
      const { stagecraft } = await import("../main");
      await stagecraft.setLighting(preset);
      this.lastPageSuccess = `Lighting set to ${preset}`;
    } catch (err) {
      this.lastPageError = (err as Error).message;
    }
    this.render();
  }

  static async #onPanCamera(this: RhapsodyApp) {
    // @ts-ignore
    const root: HTMLElement = this.element;
    const target = root.querySelector<HTMLInputElement>('[name="camera-target"]')?.value.trim();
    if (!target) return;
    try {
      const { stagecraft } = await import("../main");
      if (target.includes(",")) {
        const [x, y] = target.split(",").map(n => parseFloat(n.trim()));
        await stagecraft.panCamera({ x, y });
      } else {
        await stagecraft.panCamera(target);
      }
      this.lastPageSuccess = `Panned camera to ${target}`;
    } catch (err) {
      this.lastPageError = (err as Error).message;
    }
    this.render();
  }

  static async #onPlaceToken(this: RhapsodyApp) {
    // @ts-ignore
    const root: HTMLElement = this.element;
    const actor = root.querySelector<HTMLInputElement>('[name="token-actor"]')?.value.trim();
    const coordsRaw = root.querySelector<HTMLInputElement>('[name="token-coords"]')?.value.trim();
    if (!actor) return;
    try {
      const { stagecraft } = await import("../main");
      let x, y;
      if (coordsRaw && coordsRaw.includes(",")) {
        [x, y] = coordsRaw.split(",").map(n => parseFloat(n.trim()));
      }
      await stagecraft.placeToken(actor, x, y);
      this.lastPageSuccess = `Placed token for ${actor}`;
    } catch (err) {
      this.lastPageError = (err as Error).message;
    }
    this.render();
  }

  static async #onReindexAssets(this: RhapsodyApp) {
    this.assetReindexing = true;
    this.render();

    try {
      const { assetIndex } = await import("../main");
      await assetIndex.reindex();
      this.lastPageSuccess = "Asset reindex complete.";
    } catch (err) {
      this.lastPageError = "Asset reindex error: " + (err as Error).message;
    } finally {
      this.assetReindexing = false;
      this.render();
    }
  }

  static async #onQueryAssets(this: RhapsodyApp) {
    // @ts-ignore
    const root: HTMLElement = this.element;
    const query =
      root
        .querySelector<HTMLInputElement>('[name="assets-query"]')
        ?.value.trim() ?? "";
    const kind =
      root.querySelector<HTMLSelectElement>('[name="assets-kind"]')?.value ??
      "map";
    if (!query) return;

    try {
      const { assetIndex } = await import("../main");
      let hits: any[] = [];
      if (kind === "map") hits = assetIndex.findMap(query);
      else if (kind === "audio") hits = assetIndex.findAudio(query);
      else if (kind === "token") hits = assetIndex.findToken(query);

      this.assetQueryResults = hits.map((h) => ({
        item: h.item,
        score: Math.round(h.score * 100) / 100,
      }));
    } catch (err) {
      this.lastPageError = "Asset query error: " + (err as Error).message;
    }
    this.render();
  }

  static async #onSaveRulesSettings(this: RhapsodyApp) {
    // @ts-ignore
    const root: HTMLElement = this.element;
    const checkboxes = root.querySelectorAll<HTMLInputElement>(
      'input[name="rules-pack"]:checked',
    );
    const selectedPacks = Array.from(checkboxes).map((cb) => cb.value);

    try {
      // @ts-ignore
      await game.settings.set(moduleId, "rulesPacks", selectedPacks);
      this.lastPageSuccess = "Rules settings saved.";
    } catch (err) {
      this.lastPageError =
        "Error saving rules settings: " + (err as Error).message;
    }
    this.render();
  }

  static async #onReindexRules(this: RhapsodyApp) {
    this.reindexProgress = "Initializing...";
    this.render();

    try {
      const { rulesIndex } = await import("../main");
      await rulesIndex.reindex((msg) => {
        this.reindexProgress = msg;
        this.render();
      });
      this.reindexProgress = null;
      this.lastPageSuccess = "Reindex complete.";
    } catch (err) {
      this.reindexProgress = null;
      this.lastPageError = "Reindex error: " + (err as Error).message;
    }
    this.render();
  }

  static async #onQueryRules(this: RhapsodyApp) {
    // @ts-ignore
    const root: HTMLElement = this.element;
    const query =
      root
        .querySelector<HTMLTextAreaElement>('[name="rules-query"]')
        ?.value.trim() ?? "";
    if (!query) return;

    try {
      const { rulesIndex } = await import("../main");
      const hits = await rulesIndex.query(query);
      this.rulesQueryResults = hits.map((h) => ({
        excerpt: h.chunk.text,
        similarity: Math.round(h.similarity * 100),
        // @ts-ignore
        citation: TextEditor.enrichHTML(
          `@UUID[${h.chunk.entryUuid}.JournalEntryPage.${h.chunk.pageId}]{${h.chunk.entryName} › ${h.chunk.headingPath.join(" › ") || h.chunk.pageName}}`,
        ),
      }));
    } catch (err) {
      this.lastPageError = "Query error: " + (err as Error).message;
    }
    this.render();
  }

  static async #onSaveContract(this: RhapsodyApp) {
    // @ts-ignore
    const activeScene = game.scenes.viewed;
    if (!activeScene) return;

    // @ts-ignore
    const root: HTMLElement = this.element;
    const question =
      root.querySelector<HTMLInputElement>('[name="contract-question"]')
        ?.value ?? "";
    const onOfferRaw =
      root.querySelector<HTMLTextAreaElement>('[name="contract-onOffer"]')
        ?.value ?? "";
    const hiddenRaw =
      root.querySelector<HTMLTextAreaElement>('[name="contract-hidden"]')
        ?.value ?? "";
    const complicationsRaw =
      root.querySelector<HTMLTextAreaElement>('[name="contract-complications"]')
        ?.value ?? "";
    const exitsRaw =
      root.querySelector<HTMLTextAreaElement>('[name="contract-exits"]')
        ?.value ?? "";

    const parseList = (raw: string) =>
      raw
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    const parseItems = (raw: string) =>
      parseList(raw).map((text) => ({
        text,
        // Simple slug/id generation
        id: text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .substring(0, 20),
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
          hiddenLeaks: [],
        },
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
      root
        .querySelector<HTMLTextAreaElement>('[name="player-message"]')
        ?.value.trim() ?? "";

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
    // @ts-ignore
    const scope = (root.querySelector<HTMLSelectElement>(
      '[name="memory-scope"]',
    )?.value ?? "bible") as any;
    const name =
      root
        .querySelector<HTMLInputElement>('[name="memory-name"]')
        ?.value.trim() ?? "";

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
    // @ts-ignore
    const scope = (root.querySelector<HTMLSelectElement>('[name="write-scope"]')
      ?.value ?? "bible") as any;
    const name =
      root
        .querySelector<HTMLInputElement>('[name="write-name"]')
        ?.value.trim() ?? "";
    const publicContent =
      root.querySelector<HTMLTextAreaElement>('[name="write-public"]')?.value ??
      "";
    const privateContent =
      root.querySelector<HTMLTextAreaElement>('[name="write-private"]')
        ?.value ?? "";

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
      const readName = root
        .querySelector<HTMLInputElement>('[name="memory-name"]')
        ?.value.trim();
      if (readName === name) {
        this.lastPage = memory.readPage(scope, name);
      }
    } catch (err) {
      this.lastPageError = "Error: " + (err as Error).message;
      this.lastPageSuccess = null;
    }
    this.render();
  }

  static async #onCreateClock(this: RhapsodyApp) {
    // @ts-ignore
    const root: HTMLElement = this.element;
    const name =
      root
        .querySelector<HTMLInputElement>('[name="clock-name"]')
        ?.value.trim() ?? "";
    const segments = parseInt(
      root.querySelector<HTMLInputElement>('[name="clock-segments"]')?.value ??
        "4",
      10,
    );
    const label =
      root
        .querySelector<HTMLInputElement>('[name="clock-label"]')
        ?.value.trim() || undefined;
    if (!name) {
      this.lastPageError = "Enter a clock name.";
      this.render();
      return;
    }
    try {
      const { worldState } = await import("../main");
      await worldState.setClock(name, segments, label);
      const form = root.querySelector<HTMLFormElement>(".state-clock-form");
      form
        ?.querySelectorAll<HTMLInputElement>('input[type="text"]')
        .forEach((i) => (i.value = ""));
    } catch (err) {
      this.lastPageError = "Clock error: " + (err as Error).message;
    }
    this.render();
  }

  static async #onAdvanceClock(
    this: RhapsodyApp,
    _event: Event,
    target: HTMLElement,
  ) {
    const name = target.dataset.clock ?? "";
    const delta = parseInt(target.dataset.delta ?? "1", 10);
    if (!name) return;
    try {
      const { worldState } = await import("../main");
      await worldState.advanceClock(name, delta, "manual");
    } catch (err) {
      this.lastPageError = "Advance error: " + (err as Error).message;
    }
    this.render();
  }

  static async #onRemoveClock(
    this: RhapsodyApp,
    _event: Event,
    target: HTMLElement,
  ) {
    const name = target.dataset.clock ?? "";
    if (!name) return;
    try {
      const { worldState } = await import("../main");
      await worldState.removeClock(name);
    } catch (err) {
      this.lastPageError = "Remove error: " + (err as Error).message;
    }
    this.render();
  }

  static async #onShiftDisposition(this: RhapsodyApp) {
    // @ts-ignore
    const root: HTMLElement = this.element;
    const npc =
      root.querySelector<HTMLInputElement>('[name="disp-npc"]')?.value.trim() ??
      "";
    const delta = parseInt(
      root.querySelector<HTMLInputElement>('[name="disp-delta"]')?.value ?? "1",
      10,
    );
    const reason =
      root
        .querySelector<HTMLInputElement>('[name="disp-reason"]')
        ?.value.trim() || undefined;
    if (!npc) {
      this.lastPageError = "Enter an NPC name.";
      this.render();
      return;
    }
    try {
      const { worldState } = await import("../main");
      await worldState.shiftDisposition(npc, delta, reason);
      const form = root.querySelector<HTMLFormElement>(".state-disp-form");
      form
        ?.querySelectorAll<HTMLInputElement>('input[type="text"]')
        .forEach((i) => (i.value = ""));
    } catch (err) {
      this.lastPageError = "Disposition error: " + (err as Error).message;
    }
    this.render();
  }

  static async #onRemoveDisposition(
    this: RhapsodyApp,
    _event: Event,
    target: HTMLElement,
  ) {
    const npc = target.dataset.npc ?? "";
    if (!npc) return;
    try {
      const { worldState } = await import("../main");
      await worldState.removeDisposition(npc);
    } catch (err) {
      this.lastPageError = "Remove error: " + (err as Error).message;
    }
    this.render();
  }

  static async #onAppendJournal(this: RhapsodyApp) {
    // @ts-ignore — AppV2 element
    const root: HTMLElement = this.element;
    const name =
      root
        .querySelector<HTMLInputElement>('[name="append-name"]')
        ?.value.trim() ?? "";
    const html =
      root.querySelector<HTMLTextAreaElement>('[name="append-html"]')?.value ??
      "";

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
      const appendInput = root.querySelector<HTMLTextAreaElement>(
        '[name="append-html"]',
      );
      if (appendInput) appendInput.value = "";
    } catch (err) {
      this.lastPageError = "Error: " + (err as Error).message;
      this.lastPageSuccess = null;
    }
    this.render();
  }
}
