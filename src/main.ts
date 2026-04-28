import { id as moduleId } from "../module.json";
import RhapsodyApp from "./ui/RhapsodyApp";
import { IntrospectionService } from "./engine/IntrospectionService";
import { MemoryService } from "./memory/MemoryService";
import { MoveRegistry } from "./engine/moves/registry";
import { MoveDispatcher } from "./engine/MoveDispatcher";
import { registerMemoryMoves } from "./engine/moves/memory";
import { registerOracleMoves } from "./engine/moves/oracle";
import { registerStubMoves } from "./engine/moves/stubs";
import { OpenAIClient } from "./llm/OpenAIClient";
import "./styles/rhapsody.css";

let rhapsodyApp: RhapsodyApp;
export const introspection = new IntrospectionService();
export const memory = new MemoryService();
export const moveRegistry = new MoveRegistry();
export let moveDispatcher: MoveDispatcher;

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
  game.settings.register(moduleId, "rhapsodyMode", {
    name: "Rhapsody Mode",
    hint: "Play hides bible private sections; Prep shows everything.",
    scope: "world",
    config: true,
    type: String,
    choices: {
      play: "Play (player-facing)",
      prep: "Prep (GM full access)",
    },
    default: "play",
  });
});

Hooks.once("ready", async () => {
  console.log(`🎵 Rhapsody ${moduleId} ready`);
  const brief = introspection.init();
  console.log("🎵 Rhapsody system brief", brief);
  await memory.init();
  console.log("🎵 Rhapsody memory ready", memory.folderIds);

  const client = new OpenAIClient();
  registerMemoryMoves(moveRegistry, memory);
  registerOracleMoves(moveRegistry);
  registerStubMoves(moveRegistry);
  moveDispatcher = new MoveDispatcher(moveRegistry, client);

  rhapsodyApp = new RhapsodyApp();
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
