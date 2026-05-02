# #10 Asset indexing — maps, tokens, audio (v1)

**Status:** not started
**Last touched:** 2026-05-02 (claude-code)
**Issue:** https://github.com/xiaoniuniu89/rhapsody/issues/10
**Assignee:** unassigned

## Spec

Index the user's bought assets — maps, tokens, ambient audio — so the stagecraft moves (#15) can resolve queries like "tavern" or "tense combat track" without the model knowing file IDs. Filename heuristics first; embeddings deferred.

Acceptance:
- `AssetIndexService` walks Foundry's asset locations and produces three indexes: maps, audio tracks, tokens.
- Each indexed item has `{ id, name, path, tags[] }`. Tags derived from filename + folder path tokens, lowercased, deduped.
- Query API: `findMap(query)`, `findAudio(query)`, `findToken(query)` — return ranked candidates `{ item, score }`. Scoring is fuzzy match on tags + name. Top-k returned (default 5).
- Index is persisted in a hidden JournalEntry (same pattern as #7 `RulesIndexService`) so it survives reloads.
- Panel exposes a "Reindex assets" button + a status line (`X maps, Y tokens, Z tracks`).
- `npm run build` passes.

## Design

### Sources walked

1. **Maps** — `game.scenes` (existing Foundry Scenes; their `background.src`), plus image files in image-type compendia. v1: skip user-data filesystem scanning (Foundry doesn't expose it cleanly from the client). Users can import-as-Scene any maps they want indexed.
2. **Audio** — `game.playlists` and their `sounds`. Each `PlaylistSound` becomes one indexed item, tags drawn from playlist name + sound name + path.
3. **Tokens** — `game.actors` (their `prototypeToken.texture.src` + actor name), plus actor compendia.

Walking compendia is async (`pack.getDocuments()`); kept behind the explicit "Reindex" action so it doesn't bloat startup.

### Tag extraction

`extractTags(name, path)`:
- Lowercase.
- Split on `/`, `_`, `-`, `.`, whitespace.
- Drop common noise tokens (`webp`, `png`, `jpg`, `mp3`, `ogg`, numeric-only tokens, single-char tokens, the literal `assets` / `modules` / `worlds`).
- Dedupe.

So `"modules/forgotten-adventures/maps/tavern_interior_night.webp"` → `["forgotten", "adventures", "maps", "tavern", "interior", "night"]`.

### Index shape

```ts
interface AssetItem {
  id: string;        // Foundry id (Scene/Actor) or pack-qualified path
  kind: "map" | "audio" | "token";
  name: string;      // human label
  path: string;      // file path or asset ref
  tags: string[];
}

interface AssetIndex {
  version: 1;
  builtAt: number;
  maps: AssetItem[];
  audio: AssetItem[];
  tokens: AssetItem[];
}
```

### Persistence

Hidden `JournalEntry` named `__rhapsody_asset_index__` with a single page whose content is the JSON-stringified index. Same trick as `RulesIndexService`. Folder: same hidden folder that already hosts the rules index, or a sibling `__rhapsody`. (Reuse the existing hidden-folder helper if there is one; introduce one if not.)

### Query

```ts
findMap(query: string, k = 5): { item: AssetItem; score: number }[];
```

Scoring (v1, deliberately simple):
- Tokenize `query` the same way as `extractTags`.
- For each candidate item: `score = (matchedQueryTokens / queryTokens) + 0.25 * (matchedQueryTokens / itemTags)`. Bias toward query coverage; tiny bonus for tag tightness.
- Sort desc; take top-k. Drop items with score 0.

If no hits, return empty — caller (stagecraft move) decides what to do (probably surface "no matching map found" to the model so it falls back).

### Service shape

```ts
class AssetIndexService {
  init(): Promise<void>;            // load from JournalEntry if present
  reindex(): Promise<AssetIndex>;   // walk sources + persist
  status(): { maps: number; audio: number; tokens: number; builtAt: number | null };
  findMap(query: string, k?: number): { item: AssetItem; score: number }[];
  findAudio(query: string, k?: number): { item: AssetItem; score: number }[];
  findToken(query: string, k?: number): { item: AssetItem; score: number }[];
}
```

Singleton in `main.ts`, init on `ready` after `worldState`.

### Panel

Add an "Assets" section to `rhapsody-panel.hbs`, near "Rules":
- One-line status: `Indexed: 12 maps, 47 audio, 31 tokens (built 2m ago)` or `Not indexed`.
- "Reindex" button.
- (Optional, nice-to-have) a small query input for manual sanity checks: type "tavern", see top results. Useful while developing #15.

### What's deferred

- Image-content embeddings (CLIP / OpenAI vision).
- Filesystem walking outside Foundry's document collections.
- Auto-reindex on asset changes (`createScene`, `updatePlaylist` hooks).
- User-editable tags / hand-curated synonyms.
- Per-asset metadata beyond name+path (mood, time-of-day, biome). Defer until heuristic search proves insufficient.
- Localization of stop-words (English only in v1).

## Plan

- [ ] 🤖 `src/engine/assets/types.ts` — `AssetItem`, `AssetIndex`.
- [ ] 🤖 `src/engine/assets/extractTags.ts` — tag extraction with stop-word list.
- [ ] 🤖 `src/engine/assets/AssetIndexService.ts` — walk + persist + query, per design above.
- [ ] 🤖 Wire singleton in `main.ts`; init after `worldState`.
- [ ] 🤖 Panel template — Assets section with status line + reindex button (+ optional debug query input).
- [ ] 🤖 Panel CSS in `src/styles/rhapsody.css`.
- [ ] 🤖 `RhapsodyApp` handler — `reindexAssets` action.
- [ ] 🤖 `npm run build` passes.
- [ ] 🧠 Smoke test via `chrome-devtools-mcp`:
  - `new_page` → Foundry world; `take_snapshot` to confirm Assets section renders.
  - `click` the "Reindex" button; `wait_for` the status line to update; assert non-zero counts via `evaluate_script` reading `assetIndex.status()`.
  - `evaluate_script` calls: `assetIndex.findMap("tavern")`, `findAudio("combat")`, `findToken("goblin")`. Assert top-1 result for each is plausible (name contains the query token or a known synonym).
  - Reload the page; `evaluate_script` to read `assetIndex.status().builtAt` — assert persisted, non-null.
  - `list_console_messages` — assert no errors during reindex.

## Notes

- Walking actor compendia can be slow (hundreds of docs). Show a "Reindexing…" disabled state on the button while the promise is pending.
- Keep `extractTags` pure and exported so the same function tokenizes queries — guarantees parity.
- Don't store the asset *files*, only references. Foundry already serves them.

## Open questions

- Tokens vs portraits — actors often have separate `prototypeToken.texture.src` and `img` (portrait). v1: index `prototypeToken.texture.src` only (the thing actually placed on a scene).
- Scoring bias: should longer query matches outweigh tag tightness more? v1 keeps it simple; tune after #15 lands and we see real model queries.
- Should we include the actor's *type* (e.g. "npc", "character") as an implicit tag? v1: yes, append it to the tag list explicitly.
