/**
 * Rhapsody - A Solo GM Tool for Foundry VTT
 */

import { RhapsodySettings } from './settings/RhapsodySettings';
import { ChatApplication } from './chat/ChatApplication';
import './styles/rhapsody.css';

// Module ID constant
export const MODULE_ID = 'rhapsody';

// Global module state
class Rhapsody {
  static ID = MODULE_ID;
  static chatApp: ChatApplication | null = null;

  static log(...args: any[]) {
    console.log(`${this.ID} |`, ...args);
  }

  static openChat() {
    if (!this.chatApp) {
      this.chatApp = new ChatApplication();
    }
    this.chatApp.render({ force: true });
  }
}

// Make Rhapsody available globally
declare global {
  interface Window {
    Rhapsody: typeof Rhapsody;
  }
}
window.Rhapsody = Rhapsody;

// Initialize the module
Hooks.once('init', () => {
  Rhapsody.log('Initializing Rhapsody module');
  
  // Register module settings
  RhapsodySettings.registerSettings();
});

// When the game is ready
Hooks.once('ready', () => {
  Rhapsody.log('Rhapsody module ready');
  
  // Verify we're on a compatible version
  if (!game.release || game.release.generation < 13) {
    ui.notifications?.error('Rhapsody requires Foundry VTT V13 or higher');
    return;
  }

  // Only show for GMs
  if (game.user?.isGM) {
    // Auto-create and render the chat app
    Rhapsody.chatApp = new ChatApplication();
    Rhapsody.chatApp.render({ force: true });
  }
});