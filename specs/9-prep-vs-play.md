# #9 Prep vs Play modes (v1, re-scoped 2026-05-02)

**Status:** superseded by #16
**Last touched:** 2026-05-03 (gemini-cli)
**Issue:** https://github.com/xiaoniuniu89/rhapsody/issues/9
**Assignee:** gemini-cli

> **Note:** This mode gating was removed in #16 to favor a voice-first, zero-friction AI GM that writes memory continuously.

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

- [x] 🤖 `src/engine/mode.ts` — `getMode`, `getPlayModel`, `getPrepModel` helpers.
- [x] 🤖 Register `openaiPrepModel` setting in `main.ts`.
- [x] 🤖 `OpenAIClient.chat()` — accept optional `model` override.
- [x] 🤖 `MoveDefinition` type — add optional `availableIn?: RhapsodyMode[]`.
- [x] 🤖 `MoveRegistry.toolSchemas({ mode })` filter; `MoveRegistry.has(name, mode)` helper for the runtime guard.
- [x] 🤖 Tag `write_page` / `append_page` as prep-only in `registerMemoryMoves`.
- [x] 🤖 `MoveDispatcher.runTurn()` — read mode, build mode-specific prompt, filter tools, select model, runtime-guard tool calls.
- [x] 🤖 `VoiceSession` — ignore PTT when mode is prep.
- [x] 🤖 Panel template — mode banner + toggle at top; conditional rendering of Memory Write form and Voice section.
- [x] 🤖 `RhapsodyApp` handler — `setMode(mode)` action.
- [x] 🤖 Panel CSS for mode banner.
- [x] 🤖 `npm run build` passes.
- [x] 🧠 Smoke test via `chrome-devtools-mcp`:
  - `new_page` → Foundry world.
  - `click` mode banner → Prep. `evaluate_script` reads `getMode()` → `"prep"`.
  - `evaluate_script` reads `moveRegistry.toolSchemas({ mode: "prep" })` — assert `write_page` is present.
  - `evaluate_script` reads `moveRegistry.toolSchemas({ mode: "play" })` — assert `write_page` is **absent**.
  - `evaluate_script` to call `moveDispatcher.runTurn("draft a one-paragraph profile of the cult leader")` in Prep — assert at least one `write_page` move in `movesTaken` and `ok: true`.
  - `click` mode banner → Play. `evaluate_script` reads `getMode()` → `"play"`.
  - `evaluate_script` to attempt forcing a `write_page` tool call (simulate misbehaving model by calling the dispatcher's tool-call handler directly with `{ name: "write_page", args: ... }`) — assert it returns `{ ok: false, log: /mode_disallowed/ }`.
  - `take_snapshot` in each mode to confirm conditional sections render correctly (Memory Write form hidden in Play; Voice section hidden in Prep).
  - `list_console_messages` — assert no errors across the toggle sequence.

## Notes

- All mode-aware behavior reads the *current* setting per turn / per PTT press — no caching.
- Panel-side Write form being hidden in Play is cosmetic; the underlying `MemoryService.writePage` still works if some other code path called it. The AI side is gated via `availableIn`; the user-side gate is just the form.
- Prep model defaulting to `gpt-4o` rather than `o1` / extended-thinking is intentional — Anthropic-with-thinking is the #11 follow-up.
- **2026-05-03:** Implementation completed. Smoke test completed (gemini-cli).
  - Verified mode banner and toggle.
  - Verified Voice section and Memory Write form conditional rendering.
  - Verified `MoveRegistry.toolSchemas` correctly filters moves by mode.
  - Verified `MoveDispatcher` runtime guard rejects unauthorized moves in Play mode.
  - Verified per-mode model override (`gpt-4o-mini` for Play, `gpt-4o` for Prep).
  - Verified end-to-end AI turn in Prep can write to bible, while Play is restricted.
  - **Fixed:** Added a mode gate to `VoiceSession.handleUtterance` to ensure voice-triggered turns are strictly Play-only, matching PTT behavior.
