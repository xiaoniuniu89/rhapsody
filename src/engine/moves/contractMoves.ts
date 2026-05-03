// src/engine/moves/contractMoves.ts
import type { MoveRegistry } from "./registry";

export function registerContractMoves(registry: MoveRegistry) {
  registry.register({
    schema: {
      name: "reveal_clue",
      description:
        "Reveal a new clue or piece of information to the player that was marked as 'on offer' in the scene contract.",
      parameters: {
        type: "object",
        properties: {
          clue: {
            type: "string",
            description: "The text or ID of the clue to reveal.",
          },
        },
        required: ["clue"],
      },
    },
    handler: async (args, context) => {
      const { contract } = context;
      if (!contract.active || !contract.sceneId) {
        return { ok: false, log: "No active scene contract." };
      }

      const clue = args.clue;
      const match = contract.active.onOffer.find(
        (c) => c.text === clue || c.id === clue,
      );

      if (!match) {
        return {
          ok: false,
          log: `Clue "${clue}" is not available in the current scene contract.`,
        };
      }

      if (contract.active.progress.cluesRevealed.includes(match.id)) {
        return {
          ok: true,
          log: `Clue already revealed: ${match.text}`,
          data: { alreadyRevealed: true, clue: match.text },
        };
      }

      await contract.recordProgress({
        cluesRevealed: [...contract.active.progress.cluesRevealed, match.id],
      });

      return {
        ok: true,
        log: `Revealed clue: ${match.text}`,
        data: { clue: match.text },
      };
    },
  });

  registry.register({
    schema: {
      name: "introduce_threat",
      description:
        "Introduce a specific complication or threat that was listed in the scene contract.",
      parameters: {
        type: "object",
        properties: {
          threat: {
            type: "string",
            description: "The text or ID of the threat to introduce.",
          },
        },
        required: ["threat"],
      },
    },
    handler: async (args, context) => {
      const { contract } = context;
      if (!contract.active || !contract.sceneId) {
        return { ok: false, log: "No active scene contract." };
      }

      const threat = args.threat;
      const match = contract.active.complications.find(
        (c) => c.text === threat || c.id === threat,
      );

      if (!match) {
        return {
          ok: false,
          log: `Threat "${threat}" is not in the scene contract complications.`,
        };
      }

      await contract.recordProgress({
        complicationsTriggered: [
          ...contract.active.progress.complicationsTriggered,
          match.id,
        ],
      });

      return {
        ok: true,
        log: `Introduced threat: ${match.text}`,
        data: { threat: match.text },
      };
    },
  });

  registry.register({
    schema: {
      name: "offer_hard_choice",
      description:
        "Offer the player a difficult choice between two undesirable outcomes.",
      parameters: {
        type: "object",
        properties: {
          choice: {
            type: "string",
            description: "The hard choice being offered.",
          },
        },
        required: ["choice"],
      },
    },
    handler: async (args, context) => {
      const { contract } = context;
      if (contract.active) {
        await contract.recordProgress({
          freeform: [
            ...contract.active.progress.freeform,
            {
              type: "hard_choice",
              text: args.choice,
              at: Date.now(),
            },
          ],
        });
      }
      return {
        ok: true,
        data: { noted: true },
        log: `Offered hard choice: ${args.choice}`,
      };
    },
  });

  registry.register({
    schema: {
      name: "ask_question",
      description:
        "Ask the player a provocative question to build the world or their character.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string" },
        },
        required: ["question"],
      },
    },
    handler: async (args, context) => {
      const { contract } = context;
      if (contract.active) {
        await contract.recordProgress({
          freeform: [
            ...contract.active.progress.freeform,
            {
              type: "ask_question",
              text: args.question,
              at: Date.now(),
            },
          ],
        });
      }
      return {
        ok: true,
        data: { noted: true },
        log: `Asked question: ${args.question}`,
      };
    },
  });

  registry.register({
    schema: {
      name: "reflect_consequence",
      description:
        "Show the immediate consequence of a player's previous action.",
      parameters: {
        type: "object",
        properties: {
          consequence: { type: "string" },
        },
        required: ["consequence"],
      },
    },
    handler: async (args, context) => {
      const { contract } = context;
      if (contract.active) {
        await contract.recordProgress({
          freeform: [
            ...contract.active.progress.freeform,
            {
              type: "reflect_consequence",
              text: args.consequence,
              at: Date.now(),
            },
          ],
        });
      }
      return {
        ok: true,
        data: { noted: true },
        log: `Reflected consequence: ${args.consequence}`,
      };
    },
  });

  registry.register({
    schema: {
      name: "cut_to_scene",
      description: "Abruptly transition the action to a new scene or location.",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "The name of the location to cut to.",
          },
          description: {
            type: "string",
            description: "Brief description of the cut.",
          },
        },
        required: ["location", "description"],
      },
    },
    handler: async (args, context) => {
      const { contract } = context;
      if (contract.active && contract.active.exits.length > 0) {
        const isValid = contract.active.exits.some(
          (e) => e.toLowerCase() === args.location.toLowerCase(),
        );
        if (!isValid) {
          return {
            ok: false,
            log: `Location "${args.location}" is not a valid exit for this scene.`,
          };
        }
      }

      return {
        ok: true,
        data: { noted: true },
        log: `Cut to: ${args.location}`,
      };
    },
  });
}
