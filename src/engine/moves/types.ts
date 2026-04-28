// src/engine/moves/types.ts
import type { SceneContract, ContractProgress } from "../contract/types";

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

export interface MoveContext {
  contract: {
    active: SceneContract | null;
    sceneId: string | null;
    recordProgress: (patch: Partial<ContractProgress>) => Promise<void>;
  };
}

export type MoveHandler = (args: any, context: MoveContext) => Promise<MoveResult>;

export interface RegisteredMove {
  schema: MoveSchema;
  handler: MoveHandler;
}
