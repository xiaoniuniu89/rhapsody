import type { AssetItem, AssetIndex } from "./types";
import { extractTags } from "./extractTags";

export class AssetIndexService {
  private index: AssetIndex | null = null;
  private readonly FOLDER_NAME = "Rhapsody System";
  private readonly ENTRY_NAME = "Rhapsody Asset Index";

  async init(): Promise<void> {
    this.reload();
  }

  status() {
    this.reload();
    return {
      maps: this.index?.maps.length || 0,
      audio: this.index?.audio.length || 0,
      tokens: this.index?.tokens.length || 0,
      builtAt: this.index?.builtAt || null,
    };
  }

  findMap(query: string, k = 5) {
    this.reload();
    return this.search(this.index?.maps || [], query, k);
  }

  findAudio(query: string, k = 5) {
    this.reload();
    return this.search(this.index?.audio || [], query, k);
  }

  findToken(query: string, k = 5) {
    this.reload();
    return this.search(this.index?.tokens || [], query, k);
  }

  async reindex(): Promise<AssetIndex> {
    const maps: AssetItem[] = [];
    const audio: AssetItem[] = [];
    const tokens: AssetItem[] = [];

    // 1. Maps (Scenes)
    // @ts-ignore
    for (const scene of game.scenes.contents) {
      if (!scene.background.src) continue;
      maps.push({
        id: scene.id as string,
        kind: "map",
        name: scene.name as string,
        path: scene.background.src as string,
        tags: extractTags(scene.name, scene.background.src),
      });
    }

    // 2. Audio (Playlists)
    // @ts-ignore
    for (const playlist of game.playlists.contents) {
      for (const sound of playlist.sounds) {
        audio.push({
          id: sound.id as string,
          kind: "audio",
          name: sound.name as string,
          path: sound.path as string,
          tags: extractTags(playlist.name, sound.name, sound.path),
        });
      }
    }

    // 3. Tokens (Actors)
    // @ts-ignore
    for (const actor of game.actors.contents) {
      // @ts-ignore
      const src = actor.prototypeToken?.texture?.src || actor.img;
      if (!src) continue;
      tokens.push({
        id: actor.id as string,
        kind: "token",
        name: actor.name as string,
        path: src as string,
        tags: extractTags(actor.name, src, actor.type),
      });
    }

    // 4. Compendia (Actors only for tokens in v1)
    // @ts-ignore
    for (const pack of game.packs.contents) {
      if (pack.documentName === "Actor") {
        // @ts-ignore
        const index = (await pack.getIndex({
          fields: ["prototypeToken.texture.src", "img", "type"] as any,
        })) as any[];
        for (const entry of index) {
          const src = entry.prototypeToken?.texture?.src || entry.img;
          if (!src) continue;
          tokens.push({
            id: `Compendium.${pack.collection}.${entry._id}`,
            kind: "token",
            name: entry.name,
            path: src,
            tags: extractTags(entry.name, src, entry.type),
          });
        }
      }
    }

    const newIndex: AssetIndex = {
      version: 1,
      builtAt: Date.now(),
      maps,
      audio,
      tokens,
    };

    await this.saveIndex(newIndex);
    this.index = newIndex;
    return newIndex;
  }

  private search(items: AssetItem[], query: string, k: number) {
    const queryTokens = extractTags(query);
    if (queryTokens.length === 0) return [];

    const results = items
      .map((item) => {
        const matchedTokens = queryTokens.filter((t) => item.tags.includes(t));
        if (matchedTokens.length === 0) return { item, score: 0 };

        const score =
          matchedTokens.length / queryTokens.length +
          0.25 * (matchedTokens.length / item.tags.length);

        return { item, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);

    return results;
  }

  private reload(): void {
    // @ts-ignore
    const folder = game.folders.find(
      (f) => f.name === this.FOLDER_NAME && f.type === "JournalEntry",
    );
    if (!folder) return;

    // @ts-ignore
    const entry = game.journal.find(
      (j) => j.name === this.ENTRY_NAME && j.folder?.id === folder?.id,
    );
    if (!entry) return;

    // @ts-ignore
    const page = entry.pages.find((p) => p.name === "Index");
    if (!page) return;

    try {
      const content = page.text.content || "";
      const match = content.match(
        /<pre id="rhapsody-asset-index">([\s\S]*?)<\/pre>/,
      );
      if (!match) return;
      this.index = JSON.parse(match[1]);
    } catch (e) {
      console.error("🎵 Rhapsody | Failed to parse asset index", e);
    }
  }

  private async saveIndex(index: AssetIndex): Promise<void> {
    // @ts-ignore
    let folder = game.folders.find(
      (f) => f.name === this.FOLDER_NAME && f.type === "JournalEntry",
    );
    if (!folder) {
      // @ts-ignore
      folder = await Folder.create({
        name: this.FOLDER_NAME,
        type: "JournalEntry",
      });
    }

    // @ts-ignore
    let entry = game.journal.find(
      (j) => j.name === this.ENTRY_NAME && j.folder?.id === folder?.id,
    );
    if (!entry) {
      // @ts-ignore
      entry = await JournalEntry.create({
        name: this.ENTRY_NAME,
        folder: folder?.id,
      });
    }

    const json = JSON.stringify(index);
    const content = `<pre id="rhapsody-asset-index">${json}</pre>`;

    // @ts-ignore
    const page = entry.pages.find((p) => p.name === "Index");
    if (page) {
      // @ts-ignore
      await page.update({ "text.content": content });
    } else {
      // @ts-ignore
      await entry.createEmbeddedDocuments("JournalEntryPage", [
        {
          name: "Index",
          type: "text",
          // @ts-ignore
          text: { content, format: 1 },
        },
      ]);
    }
  }
}
