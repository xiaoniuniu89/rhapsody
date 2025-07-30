// main.ts
import { id as moduleId } from "../module.json";
import RhapsodyApp from "./apps/rhapsody/rhapsodyApp";
import "./styles/rhapsody.css";

let rhapsodyApp: RhapsodyApp;

/**
 * Initialize and open Rhapsody
 */
Hooks.once("ready", () => {
  console.log(`🎵 Starting Rhapsody ${moduleId}`);

  // Create and immediately open the app
  rhapsodyApp = new RhapsodyApp();
  rhapsodyApp.render({ force: true });

  console.log("🎵 Rhapsody opened!");
});

Hooks.once("init", () => {
  if (!game.settings) {
    return;
  }

  //@ts-ignore
  game.settings.register(moduleId, "deepseekApiKey", {
    name: "DeepSeek API Key",
    hint: "Enter your DeepSeek API key from https://platform.deepseek.com",
    scope: "world",
    config: true,
    type: String,
    default: "",
  });

  //@ts-ignore
  game.settings.register(moduleId, "rhapsodyState", {
    scope: "world",
    config: false,
    type: Object,
    default: {},
  });
});

Hooks.on("renderSidebar", (app, html) => {
  // Find the tabs menu
  const tabsMenu = html.querySelector("nav.tabs menu.flexcol");

  if (tabsMenu) {
    // Create the li element
    const li = document.createElement("li");

    // Create the button element matching the existing structure
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

    // Create the notification pip div
    const notificationPip = document.createElement("div");
    notificationPip.className = "notification-pip";

    // Add button click handler
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      rhapsodyApp.render({ force: true }).then(() => {
        const messagesContainer =
          rhapsodyApp.element?.querySelector(".rhapsody-messages");
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      });
    });

    // Append button and notification pip to li
    li.appendChild(button);
    li.appendChild(notificationPip);

    // Insert before the collapse button (last li)
    const collapseButton = tabsMenu.querySelector("li:last-child");
    tabsMenu.insertBefore(li, collapseButton);
  }
});
