# #3 System adaptation by Foundry introspection

**Status:** complete
**Last touched:** 2026-04-26 (claude-code, design + implementation)
**Issue:** https://github.com/xiaoniuniu89/rhapsody/issues/3
**Assignee:** claude-code

## Spec

The engine becomes system-agnostic by reading whatever Foundry game system is loaded at startup. It introspects actor schemas, item types, compendium packs, and (per scene) V14 Scene Regions to build a `SystemBrief` and `SceneBrief` the rest of the engine consumes — replacing per-system pack format files.

This is the **discovery layer only**. It does not interpret what it finds (no prompt seasoning, no rules retrieval). Downstream issues (#4 memory, #6 GM moves, #7 RAG) consume these briefs.

Acceptance criteria:
- `IntrospectionService.init()` returns a `SystemBrief` populated from the loaded Foundry world.
- `IntrospectionService.briefScene()` returns a `SceneBrief` for the active (or named) scene, including V14 Scene Regions.
- The brief is logged to console on `ready` for debugging.
- `npm run build` passes; no new TS errors.
- Manual: load a V14 world (any system), open the console, see the brief — system id/title/version present, actor/item types listed, packs counted, scene regions reflected.

## Design

### `SystemBrief` (world-level, immutable per session)

```ts
export interface SystemBrief {
  id: string;          // game.system.id, e.g. "dnd5e"
  title: string;       // game.system.title
  version: string;     // game.system.version
  actorTypes: string[]; // e.g. ["character", "npc", "vehicle"]
  itemTypes: string[];  // e.g. ["weapon", "spell", "feat", "background"]
  packs: PackSummary[]; // installed compendia
}

export interface PackSummary {
  id: string;     // pack.collection, e.g. "dnd5e.spells"
  label: string;  // human-readable
  type: string;   // "Item" | "Actor" | "JournalEntry" | "RollTable" | "Scene" | ...
  size: number;   // number of indexed entries
}
```

### `SceneBrief` (per-scene, queried on demand)

```ts
export interface SceneBrief {
  id: string;
  name: string;
  active: boolean;
  regions: RegionSummary[]; // V14 Scene Regions
}

export interface RegionSummary {
  id: string;
  name: string;
  shapeCount: number;
  behaviorCount: number;
}
```

V14 Scene Levels are intentionally *not* exposed yet — the public API surface is murky and we have no consumer for it. Add when #1's spatial reasoning needs it.

### Service shape

```ts
export class IntrospectionService {
  private _system: SystemBrief | null = null;

  init(): SystemBrief;            // call from `ready` hook
  get system(): SystemBrief | null;
  briefScene(sceneId?: string): SceneBrief | null; // defaults to active scene
}
```

## Plan

### 1. Create the service
- [x] Write `src/engine/IntrospectionService.ts` with the interfaces and class above.
- [x] Use `// @ts-ignore` on Foundry globals (`game.system`, `game.model`, `game.packs`, `game.scenes`) — types are V13 and partial.
- [x] Pull actor/item types from `game.model.Actor` / `game.model.Item` keys (V14-stable location).

### 2. Wire into main.ts
- [x] Import and instantiate `IntrospectionService` in the `ready` hook, before `RhapsodyApp`.
- [x] Call `init()` and log the brief: `console.log("🎵 Rhapsody system brief", brief)`.
- [x] Export a module-scope reference so other services can access it later.

### 3. Verification
- [x] `npm run build` — zero TS errors.
- [x] Manual in Foundry V14: confirmed on Simple World-Building — id/title/version/actorTypes/itemTypes populated; packs empty (system has none, expected).

### 4. Cleanup
- [x] Delete `src/engine/.gitkeep` once the real file lands.
- [x] Update `WORK.md` "Recent" log when complete.

## Notes / decisions made along the way

- **No per-system tuning** — this layer is system-blind. Downstream consumers can branch on `brief.id` if they want, but introspection itself stays generic.
- **V13 types vs V14 runtime** — `game.system`, `game.model`, `game.packs`, `game.scenes` exist in both major versions, and the field set we read is stable. `// @ts-ignore` covers the type gap.
- **Scene Levels deferred** — the V14 API for levels is in flux; nothing consumes it yet.
- **`init()` is synchronous and called from `ready`** — at that point Foundry has hydrated `game.system`, `game.model`, and `game.packs.index`. No async warmup needed.
- **`'base'` filtered out of actor/item types** — Foundry includes a `base` abstract type for every system; not useful to downstream consumers.

## Open questions for the user

- (none — proceed)
