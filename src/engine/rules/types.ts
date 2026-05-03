export interface IndexedChunk {
  id: string; // sha1(packId + entryId + pageId + headingPath)
  packId: string; // e.g. "dnd5e.rules"
  entryUuid: string; // Compendium.<pack>.JournalEntry.<id>
  entryName: string; // for display
  pageId: string;
  pageName: string;
  headingPath: string[]; // ["Combat", "Grappling"]
  text: string; // raw chunk text (HTML-stripped)
  embedding: number[]; // 1536 floats
}

export interface IndexFile {
  version: 1;
  embeddingModel: "text-embedding-3-small";
  builtAt: number; // ms epoch
  packs: string[]; // pack ids included
  chunks: IndexedChunk[];
}

export interface QueryHit {
  chunk: IndexedChunk;
  similarity: number;
}
