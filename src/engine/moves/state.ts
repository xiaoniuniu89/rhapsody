import type { MoveRegistry } from "./registry";
import type { WorldStateService } from "../state/WorldStateService";

export function registerStateMoves(
  registry: MoveRegistry,
  state: WorldStateService,
) {
  registry.register({
    schema: {
      name: "advance_clock",
      description:
        "Advance a progress clock by N segments. Auto-creates the clock with 4 segments if it doesn't exist. Use for Blades-style countdowns (cult ritual, alarm raised, time to dawn).",
      parameters: {
        type: "object",
        properties: {
          clockName: { type: "string" },
          segments: { type: "number", default: 1 },
          reason: { type: "string" },
        },
        required: ["clockName"],
      },
    },
    handler: async (args) => {
      const { clock, created } = await state.advanceClock(
        args.clockName,
        args.segments ?? 1,
        args.reason,
      );
      const verb = created ? "created+advanced" : "advanced";
      return {
        ok: true,
        data: { clock, created },
        log: `advance_clock: ${verb} "${clock.name}" → ${clock.filled}/${clock.segments}`,
      };
    },
  });

  registry.register({
    schema: {
      name: "set_clock",
      description:
        "Create or reconfigure a clock. Resets filled to 0. Use when you know the clock's intended size up front.",
      parameters: {
        type: "object",
        properties: {
          clockName: { type: "string" },
          segments: { type: "number" },
          label: { type: "string" },
        },
        required: ["clockName", "segments"],
      },
    },
    handler: async (args) => {
      const clock = await state.setClock(
        args.clockName,
        args.segments,
        args.label,
      );
      return {
        ok: true,
        data: { clock },
        log: `set_clock: "${clock.name}" (${clock.segments} segments)`,
      };
    },
  });

  registry.register({
    schema: {
      name: "remove_clock",
      description:
        "Remove a clock that's no longer relevant (resolved, abandoned).",
      parameters: {
        type: "object",
        properties: { clockName: { type: "string" } },
        required: ["clockName"],
      },
    },
    handler: async (args) => {
      await state.removeClock(args.clockName);
      return {
        ok: true,
        data: { removed: args.clockName },
        log: `remove_clock: "${args.clockName}"`,
      };
    },
  });

  registry.register({
    schema: {
      name: "shift_disposition",
      description:
        "Shift an NPC's disposition toward the player by an integer delta. Value is clamped to [-3, +3] (hates → loves). Use after the player helps, threatens, lies to, or impresses an NPC.",
      parameters: {
        type: "object",
        properties: {
          npc: { type: "string" },
          delta: { type: "number" },
          reason: { type: "string" },
        },
        required: ["npc", "delta"],
      },
    },
    handler: async (args) => {
      const disp = await state.shiftDisposition(
        args.npc,
        args.delta,
        args.reason,
      );
      return {
        ok: true,
        data: { disposition: disp },
        log: `shift_disposition: ${disp.npc} → ${disp.value >= 0 ? "+" : ""}${disp.value}`,
      };
    },
  });

  registry.register({
    schema: {
      name: "read_state",
      description:
        "Read the current world state (clocks and NPC dispositions). Call this before mutating to check for existing entries you should advance/shift instead of creating duplicates.",
      parameters: { type: "object", properties: {} },
    },
    handler: async () => {
      const snap = state.snapshot();
      return {
        ok: true,
        data: { clocks: snap.clocks, dispositions: snap.dispositions },
        log: `read_state: ${Object.keys(snap.clocks).length} clocks, ${Object.keys(snap.dispositions).length} dispositions`,
      };
    },
  });
}
