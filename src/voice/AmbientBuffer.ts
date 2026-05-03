import type { Signal } from "../engine/listening/signals";

export interface AmbientEntry {
  timestamp: number;
  transcript: string;
  signal?: Signal;
}

export class AmbientBuffer {
  private entries: AmbientEntry[] = [];
  private readonly maxWindowMs = 5 * 60 * 1000; // 5 minutes

  add(transcript: string, signal?: Signal): void {
    this.entries.push({
      timestamp: Date.now(),
      transcript,
      signal,
    });
    this.cleanup();
  }

  forget(seconds: number): void {
    const cutoff = Date.now() - seconds * 1000;
    this.entries = this.entries.filter((e) => e.timestamp < cutoff);
  }

  snapshot(): AmbientEntry[] {
    this.cleanup();
    return [...this.entries];
  }

  getRecentTranscript(seconds: number): string {
    const cutoff = Date.now() - seconds * 1000;
    return this.entries
      .filter((e) => e.timestamp >= cutoff)
      .map((e) => e.transcript)
      .join(" ");
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.maxWindowMs;
    this.entries = this.entries.filter((e) => e.timestamp >= cutoff);
  }
}
