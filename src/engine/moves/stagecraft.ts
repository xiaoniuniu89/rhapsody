import type { MoveRegistry } from "./registry";
import type { StagecraftService } from "../stagecraft/StagecraftService";

export function registerStagecraftMoves(
  registry: MoveRegistry,
  stagecraft: StagecraftService,
) {
  registry.register({
    schema: {
      name: "set_scene_map",
      description: "Switch to a different map by description (e.g. 'tavern interior') or specific scene id.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          sceneId: { type: "string" },
        },
      },
    },
    handler: async (args) => {
      try {
        const r = await stagecraft.setSceneMap(args);
        return { ok: true, log: `set_scene_map: Switched to "${r.scene.name}"`, data: { sceneId: r.scene.id } };
      } catch (e) {
        return { ok: false, log: `set_scene_map: ${(e as Error).message}` };
      }
    },
  });

  registry.register({
    schema: {
      name: "place_token",
      description: "Place a token on the active scene by actor name or id. Coords x/y are optional; defaults to camera center.",
      parameters: {
        type: "object",
        properties: {
          actor: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
        },
        required: ["actor"],
      },
    },
    handler: async (args) => {
      try {
        const r = await stagecraft.placeToken(args.actor, args.x, args.y);
        return { ok: true, log: `place_token: Placed "${args.actor}" (id: ${r.tokenId})`, data: r };
      } catch (e) {
        return { ok: false, log: `place_token: ${(e as Error).message}` };
      }
    },
  });

  registry.register({
    schema: {
      name: "remove_token",
      description: "Remove a token from the active scene by its tokenId or exact name.",
      parameters: {
        type: "object",
        properties: {
          tokenId: { type: "string" },
        },
        required: ["tokenId"],
      },
    },
    handler: async (args) => {
      try {
        await stagecraft.removeToken(args.tokenId);
        return { ok: true, log: `remove_token: Removed "${args.tokenId}"` };
      } catch (e) {
        return { ok: false, log: `remove_token: ${(e as Error).message}` };
      }
    },
  });

  registry.register({
    schema: {
      name: "play_ambient",
      description: "Play ambient music or sound effects by description or track id. Stops existing ambient sounds.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          trackId: { type: "string" },
        },
      },
    },
    handler: async (args) => {
      try {
        const r = await stagecraft.playAmbient(args);
        return { ok: true, log: `play_ambient: Playing track (id: ${r.trackId})`, data: r };
      } catch (e) {
        return { ok: false, log: `play_ambient: ${(e as Error).message}` };
      }
    },
  });

  registry.register({
    schema: {
      name: "stop_ambient",
      description: "Stop a specific track or all playing music.",
      parameters: {
        type: "object",
        properties: {
          trackId: { type: "string" },
        },
      },
    },
    handler: async (args) => {
      try {
        await stagecraft.stopAmbient(args.trackId);
        return { ok: true, log: args.trackId ? `stop_ambient: Stopped "${args.trackId}"` : "stop_ambient: Stopped all music" };
      } catch (e) {
        return { ok: false, log: `stop_ambient: ${(e as Error).message}` };
      }
    },
  });

  registry.register({
    schema: {
      name: "set_lighting",
      description: "Change the scene's lighting mood.",
      parameters: {
        type: "object",
        properties: {
          preset: {
            type: "string",
            enum: ["day", "dusk", "night", "torchlit", "dark"],
          },
        },
        required: ["preset"],
      },
    },
    handler: async (args) => {
      try {
        await stagecraft.setLighting(args.preset);
        return { ok: true, log: `set_lighting: Set to "${args.preset}"` };
      } catch (e) {
        return { ok: false, log: `set_lighting: ${(e as Error).message}` };
      }
    },
  });

  registry.register({
    schema: {
      name: "pan_camera",
      description: "Focus the camera on a token, a coordinate {x,y}, or a named scene note.",
      parameters: {
        type: "object",
        properties: {
          target: {
            oneOf: [
              { type: "string", description: "Token name or scene note label" },
              {
                type: "object",
                properties: {
                  x: { type: "number" },
                  y: { type: "number" },
                },
                required: ["x", "y"],
              },
            ],
          },
        },
        required: ["target"],
      },
    },
    handler: async (args) => {
      try {
        await stagecraft.panCamera(args.target);
        const targetStr = typeof args.target === "string" ? `"${args.target}"` : `{x:${args.target.x}, y:${args.target.y}}`;
        return { ok: true, log: `pan_camera: Focused on ${targetStr}` };
      } catch (e) {
        return { ok: false, log: `pan_camera: ${(e as Error).message}` };
      }
    },
  });
}
