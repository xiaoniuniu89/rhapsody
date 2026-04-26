import { id as moduleId } from "../module.json";
import RhapsodyApp from "./ui/RhapsodyApp";
import { IntrospectionService } from "./engine/IntrospectionService";
import "./styles/rhapsody.css";

let rhapsodyApp: RhapsodyApp;
export const introspection = new IntrospectionService();

Hooks.once("init", () => {
  if (!game.settings) return;

  // @ts-ignore — foundry-vtt-types coverage is partial
  game.settings.register(moduleId, "rhapsodyState", {
    scope: "world",
    config: false,
    type: Object,
    default: {},
  });
});

Hooks.once("ready", () => {
  console.log(`🎵 Rhapsody ${moduleId} ready`);
  const brief = introspection.init();
  console.log("🎵 Rhapsody system brief", brief);
  rhapsodyApp = new RhapsodyApp();
});

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
    rhapsodyApp.render({ force: true });
  });

  const collapseButton = tabsMenu.querySelector("li:last-child");
  li.appendChild(button);
  tabsMenu.insertBefore(li, collapseButton);
});
