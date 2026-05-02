import { id as moduleId } from "../../../module.json";
import {
  emptyState,
  DEFAULT_CLOCK_SEGMENTS,
  DISPOSITION_MAX,
  DISPOSITION_MIN,
  type Clock,
  type Disposition,
  type WorldState,
} from "./types";

const SETTING_KEY = "rhapsodyState";

export class WorldStateService {
  private state: WorldState = emptyState();

  init(): void {
    this.reload();
  }

  snapshot(): WorldState {
    this.reload();
    return this.state;
  }

  private reload(): void {
    // @ts-ignore — foundry global
    const raw = game.settings.get(moduleId, SETTING_KEY) as Partial<WorldState> | undefined;
    if (raw && (raw as any).version === 1) {
      this.state = {
        version: 1,
        clocks: raw.clocks ?? {},
        dispositions: raw.dispositions ?? {},
      };
    } else {
      this.state = emptyState();
    }
  }

  async setClock(name: string, segments: number, label?: string): Promise<Clock> {
    this.reload();
    const key = name.trim();
    if (!key) throw new Error("Clock name required");
    if (!Number.isFinite(segments) || segments < 1) {
      throw new Error("Clock segments must be >= 1");
    }
    const clock: Clock = {
      name: key,
      segments: Math.floor(segments),
      filled: 0,
      label,
      history: [{ at: Date.now(), delta: 0, reason: "created" }],
    };
    this.state.clocks[key] = clock;
    await this.persist();
    return clock;
  }

  async advanceClock(
    name: string,
    segments: number = 1,
    reason?: string,
  ): Promise<{ clock: Clock; created: boolean }> {
    this.reload();
    const key = name.trim();
    if (!key) throw new Error("Clock name required");
    let clock = this.state.clocks[key];
    let created = false;
    if (!clock) {
      clock = {
        name: key,
        segments: DEFAULT_CLOCK_SEGMENTS,
        filled: 0,
        history: [{ at: Date.now(), delta: 0, reason: "auto-created" }],
      };
      this.state.clocks[key] = clock;
      created = true;
    }
    const delta = Math.floor(segments);
    clock.filled = Math.max(0, Math.min(clock.segments, clock.filled + delta));
    clock.history.push({ at: Date.now(), delta, reason });
    await this.persist();
    return { clock, created };
  }

  async removeClock(name: string): Promise<void> {
    this.reload();
    delete this.state.clocks[name];
    await this.persist();
  }

  async shiftDisposition(
    npc: string,
    delta: number,
    reason?: string,
  ): Promise<Disposition> {
    this.reload();
    const key = npc.trim();
    if (!key) throw new Error("NPC name required");
    const existingKey = Object.keys(this.state.dispositions).find(
      k => k.toLowerCase() === key.toLowerCase(),
    );
    const canonicalKey = existingKey ?? key;
    let disp = this.state.dispositions[canonicalKey];
    if (!disp) {
      disp = { npc: canonicalKey, value: 0, history: [] };
      this.state.dispositions[canonicalKey] = disp;
    }
    const d = Math.floor(delta);
    disp.value = Math.max(DISPOSITION_MIN, Math.min(DISPOSITION_MAX, disp.value + d));
    disp.history.push({ at: Date.now(), delta: d, reason });
    await this.persist();
    return disp;
  }

  async removeDisposition(npc: string): Promise<void> {
    this.reload();
    const key = Object.keys(this.state.dispositions).find(
      k => k.toLowerCase() === npc.toLowerCase(),
    );
    if (key) {
      delete this.state.dispositions[key];
      await this.persist();
    }
  }

  private async persist(): Promise<void> {
    // @ts-ignore — foundry global
    await game.settings.set(moduleId, SETTING_KEY, this.state);
  }
}
