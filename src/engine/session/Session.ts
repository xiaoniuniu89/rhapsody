import type { MoveDispatcher } from "../MoveDispatcher";
import type { MemoryService } from "../../memory/MemoryService";

export type SessionState = "idle" | "in-session";

export class Session {
  state: SessionState = "idle";
  private lastActivity: number = Date.now();
  private dispatcher: MoveDispatcher;
  private memory: MemoryService;
  private idleTimer: any = null;
  private readonly IDLE_LIMIT_MS = 15 * 60 * 1000;
  public onIdleTimeout?: () => void;

  constructor(dispatcher: MoveDispatcher, memory: MemoryService, onIdleTimeout?: () => void) {
    this.dispatcher = dispatcher;
    this.memory = memory;
    this.onIdleTimeout = onIdleTimeout;
  }

  async begin(): Promise<{ narration: string }> {
    if (this.state === "in-session") return { narration: "" };
    this.state = "in-session";
    this.touch();

    // Recap + hook turn
    const seed = "The player is beginning a new session. Provide a short 'where we left off' recap based on recent memory and world state, and then provide one piece of forward motion (an event, an NPC appearing, or a clock ticking).";
    const result = await this.dispatcher.runTurn(seed);
    
    this.startIdleTimer();
    return { narration: result.narration };
  }

  async end(transcriptLog: string): Promise<void> {
    if (this.state === "idle") return;
    this.state = "idle";
    this.stopIdleTimer();

    if (transcriptLog.trim()) {
      const date = new Date().toLocaleString();
      const entry = `<h2>Session Log ${date}</h2>\n${transcriptLog}`;
      await this.memory.appendPage("journal", "Session Logs", "Public", entry);
    }
  }

  touch(): void {
    this.lastActivity = Date.now();
  }

  private startIdleTimer(): void {
    this.stopIdleTimer();
    this.idleTimer = setInterval(() => {
      if (Date.now() - this.lastActivity > this.IDLE_LIMIT_MS) {
        if (this.onIdleTimeout) {
          this.onIdleTimeout();
        } else {
          this.state = "idle";
          this.stopIdleTimer();
        }
      }
    }, 60000);
  }

  private stopIdleTimer(): void {
    if (this.idleTimer) {
      clearInterval(this.idleTimer);
      this.idleTimer = null;
    }
  }
}
