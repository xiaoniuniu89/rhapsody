# #9 Prep vs Play modes (v1, re-scoped 2026-05-02)

**Status:** not started — blocked by #14 (voice) and #15 (stagecraft)
**Last touched:** 2026-05-02 (claude-code)
**Issue:** https://github.com/xiaoniuniu89/rhapsody/issues/9
**Assignee:** unassigned

## Spec

After the north-star pivot (#1, D4–D7 in #2), Play is the **voice surface** and Prep is the **typed authoring surface**. They aren't symmetric two halves of one panel anymore — they're different physical interactions with different goals.

- **Play (voice).** Player speaks via PTT (#14). GM responds with TTS. GM never invents major world facts; falls back to `roll_oracle` or asks a clarifying question. Cannot write to the bible. Bible Private content is redacted in everything Play reads.
- **Prep (typed, panel-driven).** GM (the user) writes, designs, and curates: bible pages, scene contracts, foreshadowing, asset organization. Full bible visibility. Generative moves (`write_page`, `append_page`) are available. Cheaper, slower, more capable model OK because latency doesn't matter at the desk.

The `rhapsodyMode` setting and `MemoryService.getMode()` redaction already exist. v1 of #9 makes the *behavioral* split real:

Acceptance:
- Mode toggle is visible at the top of the Rhapsody panel, switchable with one click. Current mode renders as a banner.
- `MoveDispatcher` builds a different system prompt per mode and exposes a different move subset:
  - **Play**: catalog excludes `write_page` / `append_page`; prompt forbids inventing world facts; instructs `roll_oracle` / clarifying-question fallback.
  - **Prep**: full catalog; prompt invites questions, proposals, bible commits.
- Per-mode model: new `openaiPrepModel` setting (default `gpt-4o`) used in Prep; existing `openaiModel` (default `gpt-4o-mini`) stays for Play. `OpenAIClient.chat()` takes an explicit model override.
- Voice (#14) is **only enabled in Play**. PTT key in Prep does nothing (or is unbound). Transcript pane in Prep collapses.
- Panel shows the Memory "Write" form **only in Prep**.
- `npm run build` passes.

## Design

### Mode source of truth

Setting `rhapsodyMode` stays the single source. New helper `getMode()` exported from `src/engine/mode.ts` reads the setting on each call (no caching — avoids the cross-singleton drift seen in #8).

Helper also exposes:
- `getPlayModel()` → `game.settings.get(moduleId, "openaiModel")`.
- `getPrepModel()` → `game.settings.get(moduleId, "openaiPrepModel")`.

### Panel toggle

Top-of-panel mode banner with two pill buttons (Play / Prep). Click handler sets the setting and re-renders. Existing `mode` variable in `_prepareContext` already flows to the template.

### Dispatcher mode-awareness

`MoveDispatcher.runTurn()`:
```ts
const mode = getMode();
const tools = this.registry.toolSchemas({ mode });
const systemPrompt = buildSystemPrompt({ mode, contract, rulesStatus });
const model = mode === "prep" ? getPrepModel() : getPlayModel();
const response = await this.client.chat({ messages, tools, model });
```

`MoveRegistry.toolSchemas(opts?)` filters by an optional `availableIn?: RhapsodyMode[]` field on each `MoveDefinition`. Default `["play", "prep"]`. v1 tagging:
- **prep-only:** `write_page`, `append_page`.
- **both:** everything else (reads, oracle, rules, contract, world state, stagecraft).

Defense in depth: dispatch-time guard rejects tool calls whose move is not available in current mode, returning `{ ok: false, log: "mode_disallowed: <name> not available in <mode>" }` so the model self-corrects.

### Voice gating

`VoiceSession` (from #14) checks `getMode()` on PTT-down. If mode is `prep`, ignore the press (or display "Voice is Play-only"). The transcript pane in the panel hides when `mode === "prep"`.

### Per-mode model

New world setting `openaiPrepModel` (default `gpt-4o`). `OpenAIClient.chat({ model? })` accepts an override and uses it when present; embeddings / TTS / Whisper unaffected.

### Panel section gating

In `rhapsody-panel.hbs`:
- Memory "Write page" form: render only when `mode === "prep"`.
- "Read page" form: always render.
- Voice section (transcript, mic indicator, interrupt): render only when `mode === "play"`.
- Stagecraft, World State, Scene Contract, Rules, Assets sections: always render — useful in both modes.

### What's deferred

- Mid-session "pause to prep" UX (open question in #9).
- Third "recap / between-sessions" mode.
- Reveal-action transitions (explicit play → reveal → play with audit logging).
- Prep clarifying-question UX (multi-turn chat thread vs single-shot).
- Prep sign-off / dry-run before bible commits.
- Per-mode temperature / extended-thinking config (#11 follow-up).

## Plan

- [ ] 🤖 `src/engine/mode.ts` — `getMode`, `getPlayModel`, `getPrepModel` helpers.
- [ ] 🤖 Register `openaiPrepModel` setting in `main.ts`.
- [ ] 🤖 `OpenAIClient.chat()` — accept optional `model` override.
- [ ] 🤖 `MoveDefinition` type — add optional `availableIn?: RhapsodyMode[]`.
- [ ] 🤖 `MoveRegistry.toolSchemas({ mode })` filter; `MoveRegistry.has(name, mode)` helper for the runtime guard.
- [ ] 🤖 Tag `write_page` / `append_page` as prep-only in `registerMemoryMoves`.
- [ ] 🤖 `MoveDispatcher.runTurn()` — read mode, build mode-specific prompt, filter tools, select model, runtime-guard tool calls.
- [ ] 🤖 `VoiceSession` — ignore PTT when mode is prep.
- [ ] 🤖 Panel template — mode banner + toggle at top; conditional rendering of Memory Write form and Voice section.
- [ ] 🤖 `RhapsodyApp` handler — `setMode(mode)` action.
- [ ] 🤖 Panel CSS for mode banner.
- [ ] 🤖 `npm run build` passes.
- [ ] 🧠 Manual verify: Toggle Prep, write a bible page via AI ("draft a one-paragraph profile of the cult leader"). Toggle Play, confirm AI refuses to invent and uses `roll_oracle` / clarifying-question fallback; confirm `write_page` is not in the tool list (console). PTT does nothing in Prep; works in Play.

## Notes

- All mode-aware behavior reads the *current* setting per turn / per PTT press — no caching.
- Panel-side Write form being hidden in Play is cosmetic; the underlying `MemoryService.writePage` still works if some other code path called it. The AI side is gated via `availableIn`; the user-side gate is just the form.
- Prep model defaulting to `gpt-4o` rather than `o1` / extended-thinking is intentional — Anthropic-with-thinking is the #11 follow-up.

## Open questions

- Should toggling mode mid-turn take effect on the next iteration of the dispatcher tool-call loop, or only on the next turn? v1 = next turn only (mode read once at `runTurn` entry).
- Audit log of mode switches? v1 skips.
- Should Play `read_page` refuse outright on private pages, or keep the current redaction behavior? v1 keeps redaction (`MemoryService` already does it).
