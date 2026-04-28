# #5 Scene contracts

**Status:** completed
**Last touched:** 2026-04-28 (gemini-cli, implementation landed)
**Issue:** https://github.com/xiaoniuniu89/rhapsody/issues/5
**Assignee:** unassigned

## Spec

A scene contract is a structured per-scene checklist the narration model is given on every turn so it knows what to offer, what to withhold, and what complications it can pull. It is the structural defense against info-dumping: with the contract in context, "don't reveal X yet" is data the model checks against, not a vibe in the system prompt.

This issue lands the **contract data model + storage + editor + dispatcher integration**, and turns six of the seven narrative move stubs from #6 into real handlers that consume the contract. It does *not* land:

- Auto-draft of a contract from world state (deferred — needs a prep-mode flow, see #9).
- Scene-end reconciliation that commits revealed info to the journal (deferred — that's a #8 / state-mutation concern).
- Hard rewrite of model output that violates the contract (deferred — v1 logs violations only).

Acceptance criteria:
- `SceneContract` lives as a flag on Foundry's `Scene` document at `scene.flags.rhapsody.contract`.
- `SceneContractService` reads/writes the active contract for `game.scenes.viewed`.
- A panel section edits the active contract (question / on-offer / hidden / complications / exits) and saves to the scene flag.
- `MoveDispatcher.runTurn` reads the active contract and threads it into the system prompt.
- Six stubbed moves become real, each consuming/marking the contract:
  - `reveal_clue` — args: `{ clue: string }`. Validates the clue is in `onOffer`, marks it consumed.
  - `introduce_threat` — args: `{ threat: string }`. Marks a complication as triggered.
  - `offer_hard_choice` — args: `{ choice: string }`. Free-form, recorded on contract progress.
  - `ask_question` — args: `{ question: string }`. Free-form, recorded.
  - `reflect_consequence` — args: `{ consequence: string }`. Free-form, recorded.
  - `cut_to_scene` — args: `{ next: string }`. Validates `next` is in `exits` if exits is non-empty.
- `advance_clock` stays stubbed (waits on #8).
- Soft validation: if model narration text mentions a string from `hidden`, the dispatcher logs a warning move-event but does not rewrite.
- `npm run build` passes.

## Design

### Storage: Scene flag

```ts
scene.flags.rhapsody.contract: SceneContract
```

Locked decision. Considered alternatives:
- **A JournalEntry per scene** (structured pages): more editable in Foundry's native UI, but contracts are inherently scene-scoped and lookup-by-scene becomes a folder-walk. Rejected.
- **A new sub-document type**: out of proportion for the data shape and would fight Foundry's V14 type system.

Scene flag is the standard Foundry module pattern, supports per-user permissions out of the box, and `scene.update({ "flags.rhapsody.contract": ... })` is one call.

### Types

```ts
// src/engine/contract/types.ts
export interface SceneContract {
  question: string;            // "Does the player learn the merchant is lying?"
  onOffer: ContractItem[];     // info/items/leads available
  hidden: string[];            // strings explicitly off-limits this scene
  complications: ContractItem[]; // turns the GM can pull
  exits: string[];             // candidate next-scene names
  progress: ContractProgress;  // mutated as moves fire
}

export interface ContractItem {
  id: string;       // stable id within the contract (slug)
  text: string;     // human-readable
}

export interface ContractProgress {
  cluesRevealed: string[];        // ContractItem ids
  complicationsTriggered: string[];
  freeform: { type: string; text: string; at: number }[]; // hard_choice, ask_question, reflect_consequence
  hiddenLeaks: string[];          // strings from hidden[] that appeared in narration
}
```

`progress` is the mutable part; everything else is set at scene start and edited by the GM.

### Service

```ts
// src/engine/contract/SceneContractService.ts
class SceneContractService {
  active(): { sceneId: string; contract: SceneContract } | null;
  read(sceneId: string): SceneContract | null;
  write(sceneId: string, contract: SceneContract): Promise<void>;
  patch(sceneId: string, patch: Partial<SceneContract>): Promise<void>;
  recordProgress(sceneId: string, patch: Partial<ContractProgress>): Promise<void>;
}
```

`active()` resolves to `game.scenes.viewed`. If no scene is viewed, returns `null` and the dispatcher runs without a contract (degraded mode — log a warning).

### Dispatcher integration

In `MoveDispatcher.runTurn`:

1. Resolve `contract.active()`. If present, prepend a system message with the contract serialized as a structured block (question + on-offer + hidden + exits — `progress` is for handlers, not the model).
2. Pass `contract` and `recordProgress` callback through to move handlers.
3. After each model narration message, run a cheap substring scan: any string from `hidden[]` appearing case-insensitively in narration → push `hiddenLeaks` entry via `recordProgress`. No rewrite in v1.

### Move handlers (real now)

Each consumes the active contract and calls `recordProgress`. Handler signature stays `(args) => Promise<MoveResult>`; the contract is captured at construction time via the registry-binding pattern already used for memory moves.

`reveal_clue` is the most opinionated:

```ts
async function revealClue({ clue }: { clue: string }): Promise<MoveResult> {
  const active = contract.active();
  if (!active) return { ok: false, log: "no active scene contract" };
  const match = active.contract.onOffer.find(c => c.text === clue || c.id === clue);
  if (!match) {
    return { ok: false, log: `clue "${clue}" not in onOffer` };
  }
  if (active.contract.progress.cluesRevealed.includes(match.id)) {
    return { ok: true, log: `clue already revealed: ${match.text}`, data: { alreadyRevealed: true } };
  }
  await contract.recordProgress(active.sceneId, {
    cluesRevealed: [...active.contract.progress.cluesRevealed, match.id],
  });
  return { ok: true, log: `revealed clue: ${match.text}`, data: { clue: match.text } };
}
```

The free-form moves (`offer_hard_choice`, `ask_question`, `reflect_consequence`) are append-only to `progress.freeform`. `cut_to_scene` validates against `exits` if `exits.length > 0`; otherwise allows any scene name (some sessions don't pre-author exits).

### Panel UX

A "Scene contract" section, visible when a scene is viewed:

- Banner showing scene name + "no contract" or "contract saved".
- Form fields: question (text), onOffer (repeatable text list with id auto-generated), hidden (text list), complications (repeatable list), exits (text list).
- Save button → `service.write`.
- A read-only "Progress" panel showing `cluesRevealed`, `complicationsTriggered`, `freeform`, `hiddenLeaks` count — refreshes when a turn runs.

### What's deferred

- **Auto-draft from world state** (#9 prep mode) — manual contract editing only in v1.
- **Scene-end reconciliation** — needs the state-mutation backbone (#8). For now `progress` accumulates and the GM can read it; commit-to-journal happens in a later issue.
- **Hard rewrite on hidden-leak** — v1 logs only.
- **Player-facing contract metadata** ("this scene has unresolved threads") — UI work, low priority.
- **Player-driven scene creation** — for now the GM writes a new contract; the "I want to break into the warehouse" → on-the-fly contract flow lands later.

## Plan

- [x] `src/engine/contract/types.ts` — `SceneContract`, `ContractItem`, `ContractProgress`.
- [x] `src/engine/contract/SceneContractService.ts` — read/write/patch/recordProgress against `scene.flags.rhapsody.contract`.
- [x] Wire a `contract` singleton in `main.ts` (no init needed — flags are read on demand).
- [x] Extend `MoveDispatcher`:
  - [x] Inject contract into system prompt when present.
  - [x] Pass contract + `recordProgress` to handlers via a context object.
  - [x] Hidden-leak substring scan on each narration message.
- [x] Replace stubs with real handlers (one commit per move is fine):
  - [x] `reveal_clue`
  - [x] `introduce_threat`
  - [x] `offer_hard_choice`
  - [x] `ask_question`
  - [x] `reflect_consequence`
  - [x] `cut_to_scene`
- [x] Panel: "Scene contract" editor section.
- [x] Panel: read-only "Progress" subpanel.
- [x] Manual verify: V14 world, viewed scene, write a contract, send a turn whose narration triggers `reveal_clue` against an `onOffer` item, check progress updates.
- [x] Manual verify: model mentions a `hidden[]` string in narration → `hiddenLeaks` entry appears in progress.

## Notes

- Contracts are GM-private. Foundry's flag scoping (per-user perms) handles that — non-GM users won't see the contract via the dispatcher because only the GM client runs the LLM in v2.
- `ContractItem.id` is generated via slug-of-text + short hash to keep stable across edits to wording. If the GM rewords an `onOffer` item, the id stays so any in-flight `cluesRevealed` reference still resolves.
- The hidden-leak scan is intentionally cheap (substring, case-insensitive). False positives are acceptable — it's instrumentation, not enforcement, in v1.
- Move handlers should fail closed: missing contract or scope violation → `ok: false` with a log line, never throw past dispatcher.
- When no scene is viewed, the dispatcher runs without a contract and logs a warning move-event so the GM sees it in the panel.

## Open questions (from the issue)

- **Mid-scene contract rewrites** — the editor handles this (GM saves a new contract; in-flight `progress` is preserved unless explicitly cleared). What we don't have is a model-triggered rewrite ("the player did something I didn't plan for"). Defer until we see whether GMs actually want it.
- **Player-visible contract hints** — out of scope for v1. Could ship later as a per-field `playerVisible: boolean`.
- **On-the-fly contracts for player-driven scenes** — out of scope. The "create new contract" path is the same flow whether the scene was planned or not.
