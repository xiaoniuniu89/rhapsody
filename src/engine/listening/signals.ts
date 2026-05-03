export type Signal =
  | { signal: "intends_to_visit";   entity: string }
  | { signal: "suspects_npc";       entity: string }
  | { signal: "recalls_detail";     entity: string }
  | { signal: "plans_action";       entity: string }
  | { signal: "speculates_world";   entity: string }
  | { signal: "none" };

export type SignalType = Signal["signal"];
