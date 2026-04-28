// src/engine/moves/stubs.ts
import type { MoveRegistry } from "./registry";

const STUB_MOVES = [
  {
    name: "advance_clock",
    description: "Advance a progress clock toward a specific outcome.",
    parameters: {
      type: "object",
      properties: {
        clockName: { type: "string" },
        segments: { type: "number", default: 1 }
      },
      required: ["clockName"]
    }
  }
];

export function registerStubMoves(registry: MoveRegistry) {
  for (const schema of STUB_MOVES) {
    registry.register({
      schema: schema as any,
      handler: async (args, _context) => {
        return {
          ok: true,
          data: { noted: true, ...args },
          log: `Move: ${schema.name} (stub)`
        };
      }
    });
  }
}
