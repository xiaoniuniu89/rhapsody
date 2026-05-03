import { id as moduleId } from "../module.json";
import RhapsodyApp from "./ui/RhapsodyApp";
import { IntrospectionService } from "./engine/IntrospectionService";
import { MemoryService } from "./memory/MemoryService";
import { SceneContractService } from "./engine/contract/SceneContractService";
import { RulesIndexService } from "./engine/rules/RulesIndexService";
import { AssetIndexService } from "./engine/assets/AssetIndexService";
import { WorldStateService } from "./engine/state/WorldStateService";
import { MoveRegistry } from "./engine/moves/registry";
import { MoveDispatcher } from "./engine/MoveDispatcher";
import { registerMemoryMoves } from "./engine/moves/memory";
import { registerOracleMoves } from "./engine/moves/oracle";
import { registerContractMoves } from "./engine/moves/contractMoves";
import { registerRulesMoves } from "./engine/moves/rules";
import { registerStateMoves } from "./engine/moves/state";
import { StagecraftService } from "./engine/stagecraft/StagecraftService";
import { registerStagecraftMoves } from "./engine/moves/stagecraft";
import { OpenAIClient } from "./llm/OpenAIClient";
import { PttController } from "./voice/PttController";
import { WhisperSttProvider } from "./voice/WhisperSttProvider";
import { OpenAITtsProvider } from "./voice/OpenAITtsProvider";
import { AudioPlayer } from "./voice/AudioPlayer";
import { VoiceSession } from "./voice/VoiceSession";
import "./styles/rhapsody.css";

let rhapsodyApp: RhapsodyApp;
export const introspection = new IntrospectionService();
export const memory = new MemoryService();
export const contract = new SceneContractService();
const client = new OpenAIClient();
export const rulesIndex = new RulesIndexService(client);
export const assetIndex = new AssetIndexService();
export const stagecraft = new StagecraftService(assetIndex);
export const worldState = new WorldStateService();
export const moveRegistry = new MoveRegistry();

registerMemoryMoves(moveRegistry, memory);
registerOracleMoves(moveRegistry);
registerContractMoves(moveRegistry);
registerRulesMoves(moveRegistry, rulesIndex);
registerStateMoves(moveRegistry, worldState);
registerStagecraftMoves(moveRegistry, stagecraft);
export const moveDispatcher = new MoveDispatcher(
  moveRegistry,
  client,
  contract,
  rulesIndex,
);

const pttController = new PttController();
const sttProvider = new WhisperSttProvider();
const ttsProvider = new OpenAITtsProvider();
const audioPlayer = new AudioPlayer();
export const voiceSession = new VoiceSession(
  pttController,
  sttProvider,
  ttsProvider,
  audioPlayer,
  moveDispatcher,
);

Hooks.once("init", () => {
  if (!game.settings) return;

  // @ts-ignore — foundry-vtt-types coverage is partial
  game.settings.register(moduleId, "rhapsodyState", {
    scope: "world",
    config: false,
    type: Object,
    default: {},
  });

  // @ts-ignore
  game.settings.register(moduleId, "openaiApiKey", {
    name: "OpenAI API Key",
    hint: "Your key from https://platform.openai.com/api-keys",
    scope: "world",
    config: true,
    type: String,
    default: "",
  });

  // @ts-ignore
  game.settings.register(moduleId, "openaiModel", {
    name: "OpenAI Model",
    hint: "Model id, e.g. gpt-4o-mini, gpt-4o",
    scope: "world",
    config: true,
    type: String,
    default: "gpt-4o-mini",
  });

  // @ts-ignore
  game.settings.register(moduleId, "rulesPacks", {
    name: "Rules Packs",
    hint: "Compendium pack IDs to index for rules retrieval.",
    scope: "world",
    config: false,
    type: Object,
    default: [],
  });

  // @ts-ignore
  game.settings.register(moduleId, "openaiTtsModel", {
    name: "OpenAI TTS Model",
    hint: "OpenAI TTS model id, e.g. tts-1.",
    scope: "world",
    config: true,
    type: String,
    default: "tts-1",
  });

  // @ts-ignore
  game.settings.register(moduleId, "openaiTtsVoice", {
    name: "OpenAI TTS Voice",
    hint: "Voice id: alloy, echo, fable, onyx, nova, shimmer.",
    scope: "world",
    config: true,
    type: String,
    default: "alloy",
  });

  // @ts-ignore
  game.keybindings.register(moduleId, "talkToRhapsody", {
    name: "Talk to Rhapsody",
    hint: "Hold to speak to the Rhapsody GM.",
    editable: [{ key: "Backquote" }],
    onDown: () => {
      void voiceSession.startListening();
      return true;
    },
    onUp: () => {
      voiceSession.stopListening();
      return true;
    },
  });
});

Hooks.once("ready", async () => {
  console.log(`🎵 Rhapsody ${moduleId} ready`);
  const brief = introspection.init();
  console.log("🎵 Rhapsody system brief", brief);
  await memory.init();
  console.log("🎵 Rhapsody memory ready", memory.folderIds);
  await rulesIndex.init();
  console.log("🎵 Rhapsody rules index ready", rulesIndex.status());
  await assetIndex.init();
  console.log("🎵 Rhapsody asset index ready", assetIndex.status());
  worldState.init();
  console.log("🎵 Rhapsody world state ready", worldState.snapshot());

  rhapsodyApp = new RhapsodyApp();
});

window.addEventListener("beforeunload", () => {
  if (voiceSession) voiceSession.logCostTelemetry();
});

// @ts-ignore
Handlebars.registerHelper("json", (obj) => JSON.stringify(obj, null, 2));

// @ts-ignore
Hooks.on("renderSidebar", (_app, html) => {
  const tabsMenu = html.querySelector("nav.tabs menu.flexcol");
  if (!tabsMenu) return;

  const li = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ui-control plain icon fa-solid fa-theater-masks";
  button.setAttribute("data-action", "tab");
  button.setAttribute("data-tab", "rhapsody");
  button.setAttribute("role", "tab");
  button.setAttribute("aria-pressed", "false");
  button.setAttribute("data-group", "primary");
  button.setAttribute("aria-label", "Rhapsody");
  button.setAttribute("aria-controls", "rhapsody");
  button.setAttribute("data-tooltip", "");

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (rhapsodyApp) {
      rhapsodyApp.render({ force: true });
    } else {
      ui.notifications?.warn("Rhapsody is still initializing...");
    }
  });

  const collapseButton = tabsMenu.querySelector("li:last-child");
  li.appendChild(button);
  tabsMenu.insertBefore(li, collapseButton);
});
