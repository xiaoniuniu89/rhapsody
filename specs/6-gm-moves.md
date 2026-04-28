# #6 GM moves as tool calls

**Status:** not started
**Last touched:** 2026-04-28 (claude-code, spec drafted)
**Issue:** https://github.com/xiaoniuniu89/rhapsody/issues/6
**Assignee:** unassigned

## Spec

Replace "be a good GM" vibes-prompting with a generic, system-agnostic catalog of **GM moves**, each implemented as an OpenAI tool call. When the player sends a message, the narration model is given the catalog as tools; it picks 0–N moves and narrates the result. Tool calls do the deterministic state work; narration text is what the player sees.

This issue lands the **catalog + dispatcher + LLM round-trip**. It does *not* land the scene contract (#5) or world-state mutation engine (#8). The first batch of real tools wired in are the memory tools from #4 (`read_page`, `list_pages`, `write_page`, `append_page`) — they exist, they're useful immediately, and they exercise the full pipeline end-to-end. State-mutation moves (advance clock, shift disposition, etc.) are stubs in v1 — they log their intent but don't yet write to a world-state store.

Acceptance criteria:
- A `GMMoves` registry exposes a typed list of moves and their OpenAI tool schemas.
- An `OpenAIClient.sendTurn(message, tools)` returns either narration text, a list of tool calls, or both.
- A `MoveDispatcher` resolves tool calls against the registry, runs them, and feeds results back to the model for the final narration (multi-step tool use loop, capped).
- Memory tools (`read_page`, `list_pages`, `write_page`, `append_page`) are wired and exercised by the panel's "Send turn" flow.
- The remaining catalog moves (reveal clue, introduce threat, advance clock, etc.) exist as registered tools whose handlers log a structured stub and surface in the panel — no state writes yet.
- Panel: a "Player message" textarea + Send button; renders the narration plus a collapsible "Moves taken" list (move name, args, result).
- `npm run build` passes.

## Design

### Move catalog (v1, generic)

Same eight moves as the issue, plus the four memory tools from #4. Memory tools are real; the rest of the moves are stubs in v1 (handler returns a structured "noted" payload that #5/#8 will replace).

| Tool name | Category | v1 handler |
|---|---|---|
| `read_page` | memory | real (#4) |
| `list_pages` | memory | real (#4) |
| `write_page` | memory | real (#4) |
| `append_page` | memory | real (#4) |
| `reveal_clue` | narrative | stub: log + return ack |
| `introduce_threat` | narrative | stub |
| `offer_hard_choice` | narrative | stub |
| `advance_clock` | state | stub (waiting on #8) |
| `ask_question` | narrative | stub |
| `reflect_consequence` | narrative | stub |
| `cut_to_scene` | narrative | stub |
| `roll_oracle` | engine | real (deterministic RNG, returns yes/no/complication) |

`roll_oracle` is real because it's pure — no state, no memory, no Foundry calls — and it lets us validate tool-call plumbing with a side-effect-free move.

### Types

```ts
// src/engine/moves/types.ts
export interface MoveSchema {
  name: string;
  description: string;
  parameters: object; // JSON Schema (OpenAI tool format)
}

export interface MoveResult {
  ok: boolean;
  data?: unknown;   // returned to the model as tool result content
  log: string;      // human-readable line for the "Moves taken" panel
}

export type MoveHandler = (args: any) => Promise<MoveResult>;

export interface RegisteredMove {
  schema: MoveSchema;
  handler: MoveHandler;
}
```

### Registry

```ts
// src/engine/moves/registry.ts
export class MoveRegistry {
  register(move: RegisteredMove): void;
  list(): RegisteredMove[];
  toolSchemas(): OpenAITool[];   // for sending to the model
  get(name: string): RegisteredMove | null;
}
```

`main.ts` constructs a singleton at `ready` and registers all moves. Memory moves bind to the existing `memory` singleton.

### Dispatcher / round-trip loop

```ts
// src/engine/MoveDispatcher.ts
class MoveDispatcher {
  async runTurn(playerMessage: string): Promise<TurnResult>;
}

interface TurnResult {
  narration: string;
  movesTaken: { name: string; args: any; log: string; ok: boolean }[];
}
```

Loop (capped at, say, 4 iterations):
1. Send player message + tool schemas to OpenAI.
2. If response has tool calls, run each handler, append `{ role: "tool", tool_call_id, content }` messages, loop.
3. If response has only assistant text, that's the narration — return.
4. If we hit the cap, return whatever narration we have plus a warning entry in `movesTaken`.

### LLM client extension

`OpenAIClient` currently has `sendMessage(prompt)`. Extend with `sendTurn({ messages, tools })` returning the raw `chat.completion` response so the dispatcher can drive the loop. Keep `sendMessage` as the one-shot path the Test button uses.

### Panel UX (v1)

- Existing: Test connection, Read form, Write form, Append-to-journal.
- New: "Send turn" section — `<textarea name="player-message">` + button.
- New: results — `<div class="rhapsody-narration">` for the prose, `<details class="rhapsody-moves">` listing each move call with name, JSON args, and log line.
- Mode awareness: in `play` mode, write/append memory tools are still exposed to the model (the GM is testing), but the bible-private redaction in `readPage` already prevents leakage in the read direction.

### What's deferred

- Scene contract (#5) — once it lands, the dispatcher passes the contract into the system prompt and uses it to validate which moves are legal this turn.
- World-state mutation backbone (#8) — replaces the stub handlers for `advance_clock`, `introduce_threat`, etc.
- Per-system override moves — generic only in v1 (per the issue).
- Forced moves on player misses, move-cooldowns, turn budgets — the open questions in the issue. Address once we have actual play data.

## Plan

- [ ] `src/engine/moves/types.ts` — schema/handler/result types.
- [ ] `src/engine/moves/registry.ts` — registry + tool-schema serialization.
- [ ] `src/engine/moves/memory.ts` — register the four memory tools, wire to `memory` singleton.
- [ ] `src/engine/moves/oracle.ts` — `roll_oracle` real handler.
- [ ] `src/engine/moves/stubs.ts` — register the seven narrative/state stubs.
- [ ] Extend `OpenAIClient` with `sendTurn({ messages, tools })`.
- [ ] `src/engine/MoveDispatcher.ts` — multi-step tool-call loop (cap = 4).
- [ ] Wire `MoveDispatcher` singleton in `main.ts` `ready` after `memory.init()`.
- [ ] Panel: "Send turn" textarea + button + narration/moves render.
- [ ] Manual verify: send a turn that prompts the model to call `read_page` and then `list_pages`; confirm both fire and the narration references retrieved content.
- [ ] Manual verify: `roll_oracle` returns deterministic-on-seed results.

## Notes

- Move handlers must never throw past the dispatcher — wrap and return `{ ok: false, log: "..." }`. A misbehaving move should not break the turn.
- `MoveResult.data` is what the model sees. Bible-private redaction lives in `MemoryService.readPage`, not in the move handler — keep filtering at the lowest layer.
- Tool schemas live next to their handlers, not in a central JSON file, so adding a move is one file edit.
- The dispatcher loop cap is a guardrail against tool-call infinite loops (model keeps re-calling the same tool). 4 is a guess; tune after first real play.

## Open questions (from the issue)

- Forced moves on player misses (PbtA-style). Probably engine-triggered after #5 lands and we know what a "miss" is structurally. Out of scope here.
- Move-spam prevention. Likely handled by the system prompt + a soft turn budget tracked in the dispatcher. Defer until we see what real model behavior looks like.
- Fallback when no move applies. The model can return narration with zero tool calls — that's the "just looking around" path. No special handling needed.
