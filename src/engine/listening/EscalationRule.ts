import type { Signal } from "./signals";

interface SignalEvent {
  at: number;
  signal: string;
  entity: string;
}

export class EscalationRule {
  private history: SignalEvent[] = [];
  private readonly WINDOW_MS = 5 * 60 * 1000;
  private readonly THRESHOLD = 3;

  /**
   * Processes a signal. Returns true if it should escalate.
   */
  process(signal: Signal): boolean {
    if (signal.signal === "none") return false;

    const now = Date.now();
    this.history.push({ at: now, signal: signal.signal, entity: signal.entity });
    this.cleanup(now);

    const count = this.history.filter(
      (h) => h.signal === signal.signal && h.entity === signal.entity,
    ).length;

    if (count >= this.THRESHOLD) {
      // Reset counter for this pair on fire
      this.history = this.history.filter(
        (h) => !(h.signal === signal.signal && h.entity === signal.entity),
      );
      return true;
    }

    return false;
  }

  private cleanup(now: number): void {
    const cutoff = now - this.WINDOW_MS;
    this.history = this.history.filter((h) => h.at >= cutoff);
  }
}
