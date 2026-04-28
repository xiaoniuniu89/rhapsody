// src/engine/moves/types.ts

export interface MoveSchema {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
    [key: string]: any;
  };
}

export interface MoveResult {
  ok: boolean;
  data?: unknown;   // returned to the model as tool result content
  log: string;      // human-readable line for the "Moves taken" panel
}

export type MoveHandler = (args: any) => Promise<MoveResult>;

export interface RegisteredMove {
  schema: MoveSchema;
  handler: MoveHandler;
}
