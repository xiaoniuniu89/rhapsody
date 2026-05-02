# #8 Reactive world state — clocks + dispositions (v1)

**Status:** in progress
**Last touched:** 2026-05-02 (claude-code)
**Issue:** https://github.com/xiaoniuniu89/rhapsody/issues/8
**Assignee:** claude-code

## Spec

The world has to *change* in response to play. Issue #8 lists six state types (entities, dispositions, clocks, faction state, reputation, open threads). v1 of #8 lands the **mutation engine** end-to-end with two state types — **clocks** and **dispositions** — because they have the clearest GM-move-driven mutation story and prove the pipeline. Entities are largely covered by #4's wiki memory; reputation/threads/faction state can layer onto the same primitives later.

Acceptance criteria:
- `WorldStateService` reads/writes a structured state blob from the existing `rhapsodyState` world setting.
- Clocks: create, advance, list, remove. Each clock has `segments` (int), `filled` (int), optional `label`, and a `history` array of `{ at, delta, reason? }`.
- Dispositions: shift NPC disposition by an integer delta. Value clamped to `[-3, 3]`. Each disposition has `value` and a `history` array of `{ at, delta, reason? }`.
- Moves registered in the dispatcher catalog:
  - `advance_clock(clockName, segments=1, reason?)` — replaces the stub. Auto-creates the clock with default `segments=4` if it doesn't exist (so the model can use it without a separate setup call), but emits a `created: true` flag in the result.
  - `set_clock(clockName, segments, label?)` — explicit creation/reconfiguration. Resets `filled` to 0.
  - `remove_clock(clockName)`.
  - `shift_disposition(npc, delta, reason?)`.
  - `read_state()` — returns the full state blob so the model can inspect clocks/dispositions before deciding to mutate.
- Panel: a "World State" section under "Scene contract":
  - Clocks list with progress bar (`filled / segments`), label, manual ±1 buttons, delete button.
  - Inline create-clock form (name, segments, optional label).
  - Dispositions list with NPC name, value (rendered with a -3..+3 scale), delete button.
  - Inline shift-disposition form (npc, delta, reason).
  - All mutations route through the same service the moves use, so manual edits and AI moves are equivalent.
- `npm run build` passes.

## Design

### Storage: `rhapsodyState` world setting

Already registered at `src/main.ts:36-41` as a world-scoped Object. We use it directly — no JournalEntry, no flags, no folder.

```ts
interface WorldState {
  version: 1;
  clocks: Record<string, Clock>;       // keyed by clock name
  dispositions: Record<string, Disposition>; // keyed by NPC name
}

interface Clock {
  name: string;
  segments: number;
  filled: number;
  label?: string;
  history: HistoryEntry[];
}

interface Disposition {
  npc: string;
  value: number;        // clamped to [-3, 3]
  history: HistoryEntry[];
}

interface HistoryEntry {
  at: number;           // ms epoch
  delta: number;        // segments advanced or disposition shift
  reason?: string;
}
```

Migration: if the loaded blob has no `version`, treat it as empty and overwrite. Cheap because v1 is the first writer.

### Service shape

`WorldStateService` (`src/engine/state/WorldStateService.ts`) — singleton, mirrors the pattern of `MemoryService` / `RulesIndexService`. Owns the in-memory state. Every mutation persists by calling `game.settings.set(moduleId, "rhapsodyState", this.state)`.

Reads are cheap: callers get references into `this.state` (panel + moves). Writes go through methods that produce history entries automatically.

```ts
class WorldStateService {
  init(): void;                                     // load from settings
  snapshot(): WorldState;                           // for read_state move + panel render
  // clocks
  setClock(name, segments, label?): Clock;          // create/reconfigure, resets filled
  advanceClock(name, segments = 1, reason?): Clock; // auto-creates with 4 segments
  removeClock(name): void;
  // dispositions
  shiftDisposition(npc, delta, reason?): Disposition; // clamps to [-3, 3]
  removeDisposition(npc): void;
}
```

### Moves

All five moves registered via `registerStateMoves(registry, state)` in a new `src/engine/moves/state.ts`. The existing `advance_clock` stub in `src/engine/moves/stubs.ts` is removed; `stubs.ts` is deleted if it ends up empty.

Move results follow the existing `MoveResult` shape — `data` includes the mutated clock/disposition + `created` flag where applicable; `log` is the human-readable line for the panel.

System prompt addendum (added to `MoveDispatcher`): *"You can mutate world state by calling advance_clock, set_clock, shift_disposition. Use read_state to inspect before mutating. Do not invent state — use these moves so changes persist."*

### Panel UX

A "World State" section in `public/templates/rhapsody-panel.hbs`, between "Scene contract" and "Rules". Same visual conventions as existing sections (`<section class="rhapsody-section">`, etc.).

- **Clocks** — for each clock: name, label, `[████░░░░] 4/8` style bar, `−` and `+` buttons (advance by ±1), `×` delete. Below: a small form with `name`, `segments`, `label` inputs and a `Create` button.
- **Dispositions** — for each: NPC, value rendered as a 7-cell row (-3..+3) with the current cell highlighted, `×` delete. Below: form with `npc`, `delta`, `reason` and a `Shift` button.

Re-render the panel after every state mutation (the existing scene-contract section already does this — same pattern).

### What's deferred

- **Entities, faction state, reputation, open threads.**
- **Scene-end reconciliation** — #5's contract progress already tracks reveals/exits. A later pass can advance clocks / shift dispositions automatically when a scene ends.
- **Pack-defined clock types** — #3 will add typed clocks (e.g. "Threat Level"). v1 is freeform name+segments.
- **Player-facing state panel.**
- **Undo / history scrubbing UI** — history is recorded but not displayed.
- **Per-scene state** — all state is world-scoped. Per-scene state lands when needed.

## Plan

- [x] `src/engine/state/types.ts` — `WorldState`, `Clock`, `Disposition`, `HistoryEntry`.
- [x] `src/engine/state/WorldStateService.ts` — service per design above.
- [x] `src/engine/moves/state.ts` — register `advance_clock`, `set_clock`, `remove_clock`, `shift_disposition`, `read_state`.
- [x] Remove `advance_clock` stub from `src/engine/moves/stubs.ts` (deleted the file; removed import + call in `main.ts`).
- [x] Wire `worldState` singleton in `main.ts`; init on `ready` after `memory.init()`.
- [x] Extend `MoveDispatcher` system prompt with state-mutation guidance.
- [x] Panel template — "World State" section with clocks + dispositions.
- [x] Panel CSS in `src/styles/rhapsody.css`.
- [x] Panel handlers in `RhapsodyApp.ts` for create-clock, ±/delete, shift-disposition, delete-disposition.
- [x] `npm run build` passes.
- [ ] Manual verify: create a clock from panel, advance via panel, advance via AI turn ("the cult's ritual is closer to completing"), confirm persistence across reload.
- [ ] Manual verify: shift disposition from panel and via AI turn, confirm clamping at ±3.

## Notes

- The `rhapsodyState` setting already exists in `main.ts` — no new setting registration needed.
- Disposition keys use the NPC's display name (case-insensitive matching when looking up; canonical key stored as first-seen). The model passes whatever name it knows; we don't try to resolve to Foundry Actor IDs in v1.
- `advance_clock` auto-creates because the model often knows the *outcome* before it knows it needs a clock. Auto-create with `segments=4` (Blades default) and surface `created: true` so the GM can adjust segments later if 4 is wrong.
- `read_state` returns the whole blob — fine while state is small. If/when state grows, switch to scoped readers.

## Open questions

- **Clock completion side effects** — when `filled === segments`, do we emit a hook / move-result flag the model can react to? v1 just returns the clock; the model can read `filled === segments` itself.
- **Disposition scale** — locked at -3..+3 (7 levels) because it matches PbtA-ish "hates / dislikes / cool / friendly / loves" mental models. Easy to change later.
