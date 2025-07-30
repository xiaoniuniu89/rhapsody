// services/stateService.ts
import type { Scene } from "./types";
import { id as moduleId } from "../../../module.json";

export class StateService {
  saveState(currentScene: Scene, sceneHistory: Scene[], contextSummary: string): void {
    const state = {
      currentScene,
      sceneHistory,
      contextSummary
    };
    game.settings.set(moduleId, 'rhapsodyState', state);
  }

  loadState(): { currentScene?: Scene, sceneHistory: Scene[], contextSummary: string } {
    try {
      const state = game.settings.get(moduleId, 'rhapsodyState') as any;
      if (state) {
        return {
          currentScene: state.currentScene,
          sceneHistory: state.sceneHistory || [],
          contextSummary: state.contextSummary || ''
        };
      }
    } catch (e) {
      console.error("Error loading state:", e);
    }
    return { sceneHistory: [], contextSummary: '' };
  }
}