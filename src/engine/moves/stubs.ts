// src/engine/moves/stubs.ts
import type { MoveRegistry } from "./registry";

const STUB_MOVES = [
  {
    name: "reveal_clue",
    description: "Reveal a new clue or piece of information to the player.",
    parameters: {
      type: "object",
      properties: {
        clue: { type: "string" }
      },
      required: ["clue"]
    }
  },
  {
    name: "introduce_threat",
    description: "Introduce a new threat or complication to the scene.",
    parameters: {
      type: "object",
      properties: {
        threat: { type: "string" }
      },
      required: ["threat"]
    }
  },
  {
    name: "offer_hard_choice",
    description: "Offer the player a difficult choice between two undesirable outcomes.",
    parameters: {
      type: "object",
      properties: {
        choiceA: { type: "string" },
        choiceB: { type: "string" }
      },
      required: ["choiceA", "choiceB"]
    }
  },
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
  },
  {
    name: "ask_question",
    description: "Ask the player a provocative question to build the world or their character.",
    parameters: {
      type: "object",
      properties: {
        question: { type: "string" }
      },
      required: ["question"]
    }
  },
  {
    name: "reflect_consequence",
    description: "Show the immediate consequence of a player's previous action.",
    parameters: {
      type: "object",
      properties: {
        consequence: { type: "string" }
      },
      required: ["consequence"]
    }
  },
  {
    name: "cut_to_scene",
    description: "Abruptly transition the action to a new scene or location.",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string" },
        description: { type: "string" }
      },
      required: ["location", "description"]
    }
  }
];

export function registerStubMoves(registry: MoveRegistry) {
  for (const schema of STUB_MOVES) {
    registry.register({
      schema: schema as any,
      handler: async (args) => {
        return {
          ok: true,
          data: { noted: true, ...args },
          log: `Move: ${schema.name} (stub)`
        };
      }
    });
  }
}
