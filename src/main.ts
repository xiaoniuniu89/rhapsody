/**
 * Rhapsody - A Solo GM Tool for Foundry VTT
 */

import { RhapsodySettings } from './settings/RhapsodySettings';
import { RhapsodyPanel } from './ui/RhapsodyPanel';
import './styles/rhapsody.css';

// Module ID constant
export const MODULE_ID = 'rhapsody';

// Global module state
class Rhapsody {
  static ID = MODULE_ID;
  static panel: RhapsodyPanel | null = null;

  static log(...args: any[]) {
    console.log(`${this.ID} |`, ...args);
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

  // Only create panel for GMs
  if (game.user?.isGM) {
    // Check if panel already exists
    if (!Rhapsody.panel) {
      Rhapsody.panel = new RhapsodyPanel();
    }
  }
});