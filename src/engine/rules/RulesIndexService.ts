import { id as moduleId } from "../../../module.json";
import type { IndexedChunk, IndexFile, QueryHit } from "./types";
import { chunkPage } from "./chunker";
import type { OpenAIClient } from "../../llm/OpenAIClient";

export class RulesIndexService {
  private index: IndexFile | null = null;
  private client: OpenAIClient;

  constructor(client: OpenAIClient) {
    this.client = client;
  }

  async init(): Promise<void> {
    this.index = await this.loadIndex();
  }

  status() {
    if (!this.index) return null;
    return {
      builtAt: this.index.builtAt,
      chunkCount: this.index.chunks.length,
      packs: this.index.packs,
    };
  }

  async query(text: string, k = 5): Promise<QueryHit[]> {
    if (!this.index || this.index.chunks.length === 0) {
      return [];
    }

    const [queryEmbedding] = await this.client.embed(text);
    const hits: QueryHit[] = this.index.chunks.map((chunk) => {
      const similarity = this.dotProduct(queryEmbedding, chunk.embedding);
      return { chunk, similarity };
    });

    return hits.sort((a, b) => b.similarity - a.similarity).slice(0, k);
  }

  async reindex(onProgress?: (msg: string) => void): Promise<void> {
    // @ts-ignore
    const packIds = game.settings.get(moduleId, "rulesPacks") as string[];
    if (!packIds.length) {
      throw new Error("No rules packs selected for indexing.");
    }

    onProgress?.("Collecting documents...");
    const allChunks: Partial<IndexedChunk>[] = [];

    for (const packId of packIds) {
      // @ts-ignore
      const pack = game.packs.get(packId);
      if (!pack) continue;
      if (pack.documentName !== "JournalEntry") continue;

      const entries = await pack.getDocuments();
      onProgress?.(
        `Chunking ${pack.metadata.label} (${entries.length} entries)...`,
      );

      for (const entry of entries) {
        // @ts-ignore
        for (const page of entry.pages) {
          if (page.type !== "text") continue;
          const chunks = chunkPage(page.text.content || "", {
            packId,
            entryUuid: entry.uuid,
            entryName: entry.name || "Untitled",
            pageId: page.id,
            pageName: page.name || "Untitled",
          });
          allChunks.push(...chunks);
        }
      }
    }

    onProgress?.(`Embedding ${allChunks.length} chunks in batches...`);
    const finalChunks: IndexedChunk[] = [];
    const batchSize = 50;

    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, i + batchSize);
      onProgress?.(
        `Embedding chunks ${i + 1} to ${Math.min(i + batchSize, allChunks.length)} of ${allChunks.length}...`,
      );

      const texts = batch.map((c) => c.text!);
      const embeddings = await this.client.embed(texts);

      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        const embedding = embeddings[j];
        const id = await this.generateId(chunk);
        finalChunks.push({
          ...chunk,
          id,
          embedding,
        } as IndexedChunk);
      }
    }

    const indexFile: IndexFile = {
      version: 1,
      embeddingModel: "text-embedding-3-small",
      builtAt: Date.now(),
      packs: packIds,
      chunks: finalChunks,
    };

    onProgress?.("Saving index to Foundry...");
    await this.saveIndex(indexFile);
    this.index = indexFile;
    onProgress?.("Reindex complete.");
  }

  private dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }

  private async generateId(chunk: Partial<IndexedChunk>): Promise<string> {
    const data = `${chunk.packId}|${chunk.entryUuid}|${chunk.pageId}|${chunk.headingPath?.join(">")}`;
    const msgUint8 = new TextEncoder().encode(data);
    const hashBuffer = await crypto.subtle.digest("SHA-1", msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  private async loadIndex(): Promise<IndexFile | null> {
    // @ts-ignore
    const folder = game.folders.find(
      (f) => f.name === "Rhapsody System" && f.type === "JournalEntry",
    );
    if (!folder) return null;

    // @ts-ignore
    const entry = game.journal.find(
      (j) => j.name === "Rhapsody Rules Index" && j.folder?.id === folder?.id,
    );
    if (!entry) return null;

    // @ts-ignore
    const page = entry.pages.find((p) => p.name === "Index");
    if (!page) return null;

    try {
      const content = page.text.content || "";
      const match = content.match(/<pre id="rhapsody-index">([\s\S]*?)<\/pre>/);
      if (!match) return null;
      return JSON.parse(match[1]);
    } catch (e) {
      console.error("🎵 Rhapsody | Failed to parse rules index", e);
      return null;
    }
  }

  private async saveIndex(index: IndexFile): Promise<void> {
    // @ts-ignore
    let folder = game.folders.find(
      (f) => f.name === "Rhapsody System" && f.type === "JournalEntry",
    );
    if (!folder) {
      // @ts-ignore
      folder = await Folder.create({
        name: "Rhapsody System",
        type: "JournalEntry",
      });
    }

    // @ts-ignore
    let entry = game.journal.find(
      (j) => j.name === "Rhapsody Rules Index" && j.folder?.id === folder?.id,
    );
    if (!entry) {
      // @ts-ignore
      entry = await JournalEntry.create({
        name: "Rhapsody Rules Index",
        folder: folder?.id,
      });
    }

    const json = JSON.stringify(index);
    const content = `<pre id="rhapsody-index">${json}</pre>`;

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
