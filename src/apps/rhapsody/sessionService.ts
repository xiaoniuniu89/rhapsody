// src/apps/rhapsody/sessionService.ts
import type { Session, Scene } from "./types";
import { id as moduleId } from "../../../module.json";

export class SessionService {
  private currentSession: Session | null = null;
  private sessionHistory: Session[] = [];

  getCurrentSession(): Session | null {
    return this.currentSession;
  }

  getSessionHistory(): Session[] {
    return this.sessionHistory;
  }

  startNewSession(name?: string): Session {
    // End current session if exists
    if (this.currentSession && !this.currentSession.endTime) {
      this.endCurrentSession();
    }

    const sessionNumber = this.sessionHistory.length + 1;
    
    this.currentSession = {
      id: foundry.utils.randomID(),
      number: sessionNumber,
      name: name || `Session ${sessionNumber} - ${new Date().toLocaleDateString()}`,
      startTime: new Date(),
      sceneCount: 0
    };

    return this.currentSession;
  }

  endCurrentSession(): Session | null {
    if (!this.currentSession) {
      return null;
    }

    this.currentSession.endTime = new Date();
    this.sessionHistory.push(this.currentSession);
    
    const endedSession = this.currentSession;
    this.currentSession = null;
    
    return endedSession;
  }

  incrementSceneCount(): void {
    if (this.currentSession) {
      this.currentSession.sceneCount++;
    }
  }

  getNextSceneNumber(): number {
    return this.currentSession ? this.currentSession.sceneCount + 1 : 1;
  }

  hasActiveSession(): boolean {
    return this.currentSession !== null;
  }

  loadState(state: any): void {
    if (state) {
      this.currentSession = state.currentSession || null;
      this.sessionHistory = state.sessionHistory || [];
    }
  }

  getState(): { currentSession: Session | null, sessionHistory: Session[] } {
    return {
      currentSession: this.currentSession,
      sessionHistory: this.sessionHistory
    };
  }
}