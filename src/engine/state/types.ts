export interface HistoryEntry {
  at: number;
  delta: number;
  reason?: string;
}

export interface Clock {
  name: string;
  segments: number;
  filled: number;
  label?: string;
  history: HistoryEntry[];
}

export interface Disposition {
  npc: string;
  value: number;
  history: HistoryEntry[];
}

export interface WorldState {
  version: 1;
  clocks: Record<string, Clock>;
  dispositions: Record<string, Disposition>;
}

export const DISPOSITION_MIN = -3;
export const DISPOSITION_MAX = 3;
export const DEFAULT_CLOCK_SEGMENTS = 4;

export function emptyState(): WorldState {
  return { version: 1, clocks: {}, dispositions: {} };
}
