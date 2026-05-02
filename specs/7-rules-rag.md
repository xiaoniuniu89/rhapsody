# #7 Rules retrieval (RAG) per system pack

**Status:** completed
**Last touched:** 2026-04-28 (gemini-cli)
**Issue:** https://github.com/xiaoniuniu89/rhapsody/issues/7
**Assignee:** gemini-cli

## Spec

Rules questions ("how does grappling work?") and internal rules checks ("what does a partial success grant?") cannot trust the model's training-data knowledge of any TTRPG. Per #3, we don't ship a rules corpus — we point at one or more Foundry Compendium packs the user already has installed, index those for retrieval, and answer with cited excerpts.

This issue lands the **indexer + retriever + a `query_rules` move** wired into the dispatcher. Citations are emitted as `@UUID[...]{label}` so Foundry renders them as clickable links into the source compendium. If the user has no rules pack selected, rules questions degrade gracefully — the engine adds a system note and answers anyway.

Acceptance criteria:
- A world setting `rulesPacks` lists compendium pack ids (e.g. `dnd5e.rules`, `pf2e.rules`) the user has selected for indexing.
- `RulesIndexService.reindex()` walks every JournalEntry page in the configured packs, chunks by heading, embeds via OpenAI `text-embedding-3-small`, and writes the index to a hidden `JournalEntry` named `Rhapsody Rules Index` (folder: `Rhapsody System`, see Notes).
- `RulesIndexService.query(text, k=5)` returns the top-k chunks with metadata.
- A `query_rules` move is registered in the dispatcher catalog. Args: `{ question: string, k?: number }`. Returns chunks + a structured citation block the model uses to compose its answer.
- Panel: a "Rules" section with a pack-selection multiselect (sourced from `game.packs`), a Reindex button (with progress count), a query textarea + Run button, and a results render with citations as clickable Foundry links.
- Graceful degrade: if `rulesPacks` is empty, `query_rules` returns `{ ok: true, data: { chunks: [], note: "no rules packs configured" } }` and the model is told to answer with a caveat.
- `npm run build` passes.

## Design

### Embedding model

OpenAI `text-embedding-3-small` (1536 dims). Locked for v1.
- Same provider as narration, reuses the existing `openaiApiKey` setting.
- ~$0.02 per 1M tokens — full SRD reindex is single-digit cents.
- A future `embeddingProvider` setting can add `local` (transformers.js) without changing the index schema.

### Persistence: hidden JournalEntry

The index lives in a `JournalEntry` named `Rhapsody Rules Index` under a new folder `Rhapsody System` (separate from the user-facing `Rhapsody Bible` and `Rhapsody Journal` so the GM doesn't see it in normal browsing). Locked for v1.

Schema written into a single page named `Index` as JSON-in-HTML (a `<pre>` tag containing a JSON blob — Foundry's editor leaves `<pre>` content alone and we reparse on read):

```ts
interface IndexFile {
  version: 1;
  embeddingModel: "text-embedding-3-small";
  builtAt: number;          // ms epoch
  packs: string[];          // pack ids included
  chunks: IndexedChunk[];
}

interface IndexedChunk {
  id: string;               // sha1(packId + entryId + pageId + headingPath)
  packId: string;           // e.g. "dnd5e.rules"
  entryUuid: string;        // Compendium.<pack>.JournalEntry.<id>
  entryName: string;        // for display
  pageId: string;
  pageName: string;
  headingPath: string[];    // ["Combat", "Grappling"]
  text: string;             // raw chunk text (HTML-stripped)
  embedding: number[];      // 1536 floats
}
```

Storage cost: SRD is ~5MB of chunks + ~30MB of embeddings as JSON. Foundry handles multi-MB JournalEntry pages, but if we hit limits we can split across multiple pages later. Out of scope for v1.

### Chunking

Walk each JournalEntry page's text content. Parse the HTML, split on heading tags (`h1`–`h4`), and create one chunk per heading section with:
- `text` = stripped innerText of that section, capped at ~1500 chars (split into multiple chunks if longer, sharing `headingPath`).
- `headingPath` = ancestor heading chain.

Pages with no headings → one chunk per page, capped/split as above.

### Retrieval

`query(text, k)`:
1. Embed `text` via the same model.
2. Cosine-similarity scan against `chunks` in memory (loaded once on `init` and cached). 1500 chunks × 1536 dims = 2.3M floats — under 10ms on any modern machine; no need for ANN structures yet.
3. Return top-k with similarity score.

The cache is invalidated and reloaded after `reindex` completes.

### `query_rules` move

```ts
{
  name: "query_rules",
  description: "Retrieve relevant rules excerpts from indexed compendia. Use this whenever the user asks how a rule works or you need to resolve an action mechanically.",
  parameters: {
    type: "object",
    properties: {
      question: { type: "string" },
      k: { type: "number", default: 5 },
    },
    required: ["question"],
  },
}
```

Handler returns:
```ts
{
  ok: true,
  log: `query_rules: "${question}" → ${chunks.length} hits`,
  data: {
    chunks: [{
      excerpt: string,                  // the chunk text
      citation: string,                 // "@UUID[Compendium.dnd5e.rules.JournalEntry.<id>.JournalEntryPage.<id>]{Combat › Grappling}"
      similarity: number,
    }],
    note?: string,                      // present only when no packs configured
  },
}
```

The dispatcher's system prompt is extended with: *"When you cite a rule in your narration, include the citation string from the tool result verbatim. Foundry will render it as a clickable link."*

### Panel UX

A "Rules" section below "Scene contract":

- **Packs**: a multiselect populated from `[...game.packs].filter(p => p.documentName === "JournalEntry")`. Renders as a checkbox list with pack id and label. Save button → updates `rulesPacks` setting.
- **Index status**: shows `builtAt` (relative time), `chunks.length`, `packs` if an index exists; otherwise "No index built."
- **Reindex** button: kicks off `reindex()`, disables during run, shows "Indexed N chunks…" progress text. When done, refreshes status.
- **Query**: textarea + Run button → calls `query` directly (not via the dispatcher) and renders top-5 with `headingPath` breadcrumb and similarity score. Citation links use Foundry's `enrichHTML` so they render clickable.

### What's deferred

- **Local embeddings** (transformers.js) — schema-compatible add-on, separate issue.
- **Auto-reindex** on compendium version change — manual button only in v1.
- **House rules** (point at a JournalEntry folder, weight higher) — index plumbing supports it, but UI/weighting is a follow-up.
- **Player-facing rules questions UI** — v1 is GM-only via the panel; player-facing flow lands when chat integration does.
- **Mixed-content packs** (rules + monsters + spells) — we index everything; tagging by content type can be added later via a per-pack `kind` field.
- **Cross-encoder reranking** — premature.

## Plan

- [x] `src/engine/rules/types.ts` — `IndexedChunk`, `IndexFile`, `QueryHit`.
- [x] Register `rulesPacks` world setting (string array, JSON-encoded since Foundry settings don't natively store arrays cleanly — type: `Object`, default: `[]`).
- [x] `src/engine/rules/chunker.ts` — HTML-to-chunks by heading.
- [x] Extend `OpenAIClient` with `embed(input: string | string[]): Promise<number[][]>` calling the embeddings endpoint with `text-embedding-3-small`. Keep batch size sane (input array up to ~100).
- [x] `src/engine/rules/RulesIndexService.ts`:
  - [x] `init()` — load index from the hidden JournalEntry into memory cache (or no-op if missing).
  - [x] `reindex(onProgress?)` — walk packs, chunk, embed in batches, write JournalEntry, refresh cache.
  - [x] `query(text, k)` — embed + cosine top-k.
  - [x] `status()` — `{ builtAt, chunkCount, packs } | null`.
- [x] Wire `rulesIndex` singleton in `main.ts`, call `init()` on `ready` after `memory.init()`.
- [x] Register `query_rules` move in `src/engine/moves/rules.ts`. Wire into the registry in `main.ts`.
- [x] Dispatcher system-prompt addition: instruct the model to call `query_rules` for rules questions and to include the returned `citation` string verbatim in narration.
- [x] Panel: "Rules" section — pack selector, status, Reindex, query form with citation rendering via Foundry `enrichHTML`.
- [x] Manual verify: select an SRD-shaped pack, reindex, query "how does grappling work", confirm sensible top hits and clickable citations.
- [x] Manual verify: empty `rulesPacks`, `query_rules` returns the no-packs note, narration falls back gracefully.

## Notes

- The `Rhapsody System` folder is distinct from `Rhapsody Bible` / `Rhapsody Journal` so the index entry doesn't pollute the user-facing wiki. `MemoryService.init()` does not touch this folder; `RulesIndexService` find-or-creates it independently.
- Foundry Compendium walking: `await pack.getDocuments()` loads all entries; for big packs this is slow. Show a per-pack progress count.
- HTML-strip lib: keep it tiny — a regex pass for tags is enough for v1. Pages with embedded `@UUID[...]` references should keep the bracketed UUID intact (so chunk text retains references) but strip the surrounding tags.
- Cosine similarity: `dot(a, b) / (|a| * |b|)`. Precompute `|a|` per chunk at load time so query is one dot product per chunk.
- The OpenAI embeddings endpoint accepts arrays — batch ~50 chunks per request to keep request size reasonable. Surface progress as `${done}/${total}`.
- Index file size: 1500 chunks × 1536 floats × ~10 chars per float-as-JSON ≈ 23MB JSON. If V14 chokes on a single page that big, split into multiple pages keyed by chunk-id-hash buckets — but try one page first.
- Citations: the Foundry UUID format for compendium pages is `Compendium.<packId>.JournalEntry.<entryId>.JournalEntryPage.<pageId>`. Verify on a real V14 install before locking the format string.
- The dispatcher injects the citation instruction only when an index exists — no point telling the model about citations it can't produce.

## Open questions

- **Token cost on long pages**: capping chunks at 1500 chars is a guess. May need tuning once we see real retrieval quality.
- **Re-embedding when chunks haven't changed**: v1 reindexes everything; an incremental path (hash chunks, only re-embed new) is a clear follow-up but not v1.
- **Rate limiting**: OpenAI embeddings have generous limits but bulk SRD might brush them. If we hit `429`s, add exponential backoff in the embed batcher. Not pre-emptively coded.
