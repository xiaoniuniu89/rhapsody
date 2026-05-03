import type { AssetIndexService } from "../assets/AssetIndexService";
import { AssetNotFoundError, StagecraftError, type LightingPreset } from "./types";

export class StagecraftService {
  private assetIndex: AssetIndexService;
  constructor(assetIndex: AssetIndexService) {
    this.assetIndex = assetIndex;
  }

  async setSceneMap(ref: { sceneId?: string; query?: string }): Promise<{ scene: any }> {
    // @ts-ignore
    let scene = ref.sceneId ? game.scenes.get(ref.sceneId) : null;

    if (!scene && ref.query) {
      const hits = this.assetIndex.findMap(ref.query, 1);
      if (hits.length === 0) throw new AssetNotFoundError("map", ref.query);
      // @ts-ignore
      scene = game.scenes.get(hits[0].item.id);
    }

    if (!scene) throw new StagecraftError(`Scene not found: ${ref.sceneId || ref.query}`);

    // @ts-ignore
    await scene.activate();
    return { scene };
  }

  async placeToken(actorRef: string, x?: number, y?: number): Promise<{ tokenId: string }> {
    // @ts-ignore
    const activeScene = game.scenes.active;
    if (!activeScene) throw new StagecraftError("No active scene");

    // Resolve actor
    // @ts-ignore
    let actor = game.actors.getName(actorRef) || game.actors.get(actorRef);
    if (!actor) {
      const hits = this.assetIndex.findToken(actorRef, 1);
      if (hits.length > 0) {
        const hit = hits[0].item;
        if (hit.id.startsWith("Compendium.")) {
          // @ts-ignore
          actor = await fromUuid(hit.id);
        } else {
          // @ts-ignore
          actor = game.actors.get(hit.id);
        }
      }
    }

    if (!actor) throw new AssetNotFoundError("token", actorRef);

    // Default position to center of view
    if (x === undefined || y === undefined) {
      // @ts-ignore
      const center = canvas.screenDimensions ? { x: canvas.screenDimensions[0] / 2, y: canvas.screenDimensions[1] / 2 } : { x: 0, y: 0 };
      // @ts-ignore
      const worldPos = canvas.stage.pivot;
      x = x ?? worldPos.x;
      y = y ?? worldPos.y;
    }

    // @ts-ignore
    const tokenData = await actor.getTokenDocument({ x, y });
    // @ts-ignore
    const [tokenDoc] = await activeScene.createEmbeddedDocuments("Token", [tokenData]);
    
    return { tokenId: tokenDoc.id };
  }

  async removeToken(tokenId: string): Promise<void> {
    // @ts-ignore
    const activeScene = game.scenes.active;
    if (!activeScene) throw new StagecraftError("No active scene");

    // @ts-ignore
    const token = activeScene.tokens.get(tokenId) || activeScene.tokens.getName(tokenId);
    if (!token) throw new StagecraftError(`Token not found: ${tokenId}`);
// @ts-ignore
await activeScene.deleteEmbeddedDocuments("Token", [token.id!]);
}

async playAmbient(ref: { trackId?: string; query?: string }): Promise<{ trackId: string }> {

    // @ts-ignore
    let sound = null;
    // @ts-ignore
    let playlist = null;

    if (ref.trackId) {
      // @ts-ignore
      for (const p of game.playlists) {
        sound = p.sounds.get(ref.trackId);
        if (sound) {
          playlist = p;
          break;
        }
      }
    }

    if (!sound && ref.query) {
      const hits = this.assetIndex.findAudio(ref.query, 1);
      if (hits.length === 0) throw new AssetNotFoundError("audio", ref.query);
      
      const hit = hits[0].item;
      // @ts-ignore
      playlist = game.playlists.get(hit.id.split(".")[0]) || game.playlists.contents.find(p => p.sounds.has(hit.id));
      // In AssetIndexService, audio ID is just sound.id. We might need to find which playlist it belongs to.
      // Actually, AssetIndexService uses sound.id as id. Let's find it.
      // @ts-ignore
      for (const p of game.playlists) {
        sound = p.sounds.get(hit.id);
        if (sound) {
          playlist = p;
          break;
        }
      }
    }

    if (!sound || !playlist) throw new StagecraftError(`Audio not found: ${ref.trackId || ref.query}`);

    // v1: stop other sounds first for exclusive feel
    await this.stopAmbient();
    // @ts-ignore
    await playlist.playSound(sound);

    return { trackId: sound.id! };
  }

  async stopAmbient(trackId?: string): Promise<void> {
    if (trackId) {
      // @ts-ignore
      for (const p of game.playlists) {
        const sound = p.sounds.get(trackId);
        if (sound && sound.playing) {
          // @ts-ignore
          await p.stopSound(sound);
          return;
        }
      }
    } else {
      // Stop all
      // @ts-ignore
      const playing = game.playlists.filter(p => p.playing);
      for (const p of playing) {
        // @ts-ignore
        await p.stopAll();
      }
    }
  }

  async setLighting(preset: LightingPreset): Promise<void> {
    // @ts-ignore
    const activeScene = game.scenes.active;
    if (!activeScene) throw new StagecraftError("No active scene");

    let darkness = 0;
    let globalLight = true;

    switch (preset) {
      case "day": darkness = 0; globalLight = true; break;
      case "dusk": darkness = 0.4; globalLight = true; break;
      case "night": darkness = 0.85; globalLight = false; break;
      case "torchlit": darkness = 0.7; globalLight = false; break;
      case "dark": darkness = 1; globalLight = false; break;
    }

    // V14 path: environment.darknessLevel and environment.globalLight.enabled
    await activeScene.update({
      environment: {
        darknessLevel: darkness,
        globalLight: {
          enabled: globalLight
        }
      }
    });
  }

  async panCamera(target: string | { x: number; y: number }): Promise<void> {
    let x, y;

    if (typeof target === "string") {
      // @ts-ignore
      const activeScene = game.scenes.active;
      if (!activeScene) throw new StagecraftError("No active scene");

      // Try token name
      // @ts-ignore
      const token = activeScene.tokens.getName(target);
      if (token) {
        // @ts-ignore
        x = token.x + (token.width * canvas.grid.size) / 2;
        // @ts-ignore
        y = token.y + (token.height * canvas.grid.size) / 2;
      } else {
        // Try scene note label
        // @ts-ignore
        const note = activeScene.notes.find(n => n.text?.includes(target));
        if (note) {
          x = note.x;
          y = note.y;
        }
      }
    } else {
      x = target.x;
      y = target.y;
    }

    if (x === undefined || y === undefined) {
      throw new StagecraftError(`Could not resolve camera target: ${JSON.stringify(target)}`);
    }

    // @ts-ignore
    canvas.animatePan({ x, y, duration: 1000 });
  }
}
