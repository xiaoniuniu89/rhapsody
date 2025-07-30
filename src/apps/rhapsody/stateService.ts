// src/apps/rhapsody/stateService.ts
import type { Scene, Session } from "./types";
import { id as moduleId } from "../../../module.json";

export class StateService {
  saveState(
    currentScene: Scene, 
    sceneHistory: Scene[], 
    contextSummary: string,
    currentSession: Session | null,
    sessionHistory: Session[]
  ): void {
    const state = {
      currentScene,
      sceneHistory,
      contextSummary,
      currentSession,
      sessionHistory
    };
    game.settings.set(moduleId, 'rhapsodyState', state);
  }

  loadState(): { 
    currentScene?: Scene, 
    sceneHistory: Scene[], 
    contextSummary: string,
    currentSession?: Session | null,
    sessionHistory: Session[]
  } {
    try {
      const state = game.settings.get(moduleId, 'rhapsodyState') as any;
      if (state) {
        return {
          currentScene: state.currentScene,
          sceneHistory: state.sceneHistory || [],
          contextSummary: state.contextSummary || '',
          currentSession: state.currentSession || null,
          sessionHistory: state.sessionHistory || []
        };
      }
    } catch (e) {
      console.error("Error loading state:", e);
    }
    return { 
      sceneHistory: [], 
      contextSummary: '',
      currentSession: null,
      sessionHistory: []
    };
  }
}