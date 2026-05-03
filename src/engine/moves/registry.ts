// src/engine/moves/registry.ts
import type { RegisteredMove, MoveSchema } from "./types";

export interface OpenAITool {
  type: "function";
  function: MoveSchema;
}

export class MoveRegistry {
  private moves: Map<string, RegisteredMove> = new Map();

  register(move: RegisteredMove): void {
    if (this.moves.has(move.schema.name)) {
      console.warn(
        `🎵 Rhapsody: Move ${move.schema.name} already registered, overwriting.`,
      );
    }
    this.moves.set(move.schema.name, move);
  }

  list(): RegisteredMove[] {
    return Array.from(this.moves.values());
  }

  toolSchemas(): OpenAITool[] {
    return this.list().map((m) => ({
      type: "function",
      function: m.schema,
    }));
  }

  get(name: string): RegisteredMove | null {
    return this.moves.get(name) ?? null;
  }

  has(name: string): boolean {
    return this.moves.has(name);
  }
}
