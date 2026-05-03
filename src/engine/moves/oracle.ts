// src/engine/moves/oracle.ts
import type { MoveRegistry } from "./registry";

export function registerOracleMoves(registry: MoveRegistry) {
  registry.register({
    schema: {
      name: "roll_oracle",
      description:
        "Ask a yes/no question to a deterministic oracle. Returns yes, no, or a complication.",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "The yes/no question to ask.",
          },
        },
        required: ["question"],
      },
    },
    handler: async (args, _context) => {
      const roll = Math.random();
      let result = "no";
      if (roll > 0.6) result = "yes";
      else if (roll > 0.4) result = "yes, but with a complication";
      else if (roll > 0.1) result = "no, but with a silver lining";

      return {
        ok: true,
        data: {
          question: args.question,
          result: result,
        },
        log: `Oracle: ${args.question} -> ${result}`,
      };
    },
  });
}
