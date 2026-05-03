# #16 Strip panel to voice-first; remove Play/Prep gating

**Status:** in-progress
**Last touched:** 2026-05-03 (gemini-cli)
**Issue:** https://github.com/xiaoniuniu89/rhapsody/issues/16
**Assignee:** gemini-cli

## Spec

Rhapsody is a solo RPG tool. The north-star (#1) is voice-first, zero-friction: user holds a key, speaks, AI GM narrates and runs Foundry stagecraft. The current panel is a leftover from when the panel was the product — it carries 13 manual sections (mode banner, scene contract editor, world state CRUD, memory read/write, rules RAG controls, stagecraft sub-forms, asset reindex, test buttons, send-turn form, raw response dump) that don't belong in the user-facing product.

#9 (Play vs Prep) added a mode toggle to gate memory writes. With AI-as-GM, that gate is unnecessary friction — the GM should be writing session memory continuously as part of being the GM, not behind a human-flipped switch. Memory writes need visibility (surfaced in the transcript), not a gate.

World construction, scene/cache, knowledge-base UX is deferred to a later design pass — that conversation hasn't happened yet, so we don't delete the manual forms, we just hide them behind a single collapsed `<details>` 'Debug' disclosure.

### What's removed (Play/Prep, end-to-end)

- `src/engine/mode.ts` — delete.
- `rhapsodyMode` and `openaiPrepModel` settings in `src/main.ts`.
- Mode branches in `MoveDispatcher` (system prompt + `toolSchemas({ mode })` filter).
- `availableIn` field on `RegisteredMove`; mode filter in `MoveRegistry`.
- `availableIn: ["prep"]` tags on `write_page` / `append_page`.
- Mode early-returns in `VoiceSession.startListening` / `handleUtterance`.
- `setMode` action and `isPlay` / `isPrep` context fields in `RhapsodyApp`.
- `getMode()`-based redaction in `MemoryService` (solo tool, single user — no redaction needed).
- `.mode-banner` CSS.

### What's kept (behind a collapsed `<details>` debug disclosure)

All existing manual forms — scene contract editor, world state CRUD, memory read/write, rules RAG controls, stagecraft manual forms, asset reindex, test connection, raw last-response dump, send-turn form. Handlers stay wired; only the UI surface is hidden.

### New panel surface

1. **Header status row** — current scene name + asset-index health summary (e.g. "12 maps · 34 audio · 8 tokens"). One line.
2. **Voice section** — mic status, interrupt button, transcript pane (drop telemetry button, log on session-end).
3. **Debug `<details>`** — collapsed by default, wraps everything else.

## Plan

- [x] 🤖 Delete `src/engine/mode.ts`.
- [x] 🤖 `src/main.ts`: remove `rhapsodyMode` and `openaiPrepModel` settings.
- [x] 🤖 `src/engine/moves/types.ts`: remove `availableIn` from `RegisteredMove`.
- [x] 🤖 `src/engine/moves/registry.ts`: remove mode filtering logic.
- [x] 🤖 `src/engine/moves/memory.ts`: remove `availableIn: ["prep"]` tags.
- [x] 🤖 `src/engine/MoveDispatcher.ts`: remove mode-based prompt/model/tool logic.
- [x] 🤖 `src/voice/VoiceSession.ts`: remove mode gates.
- [x] 🤖 `src/memory/MemoryService.ts`: remove `getMode()` and private redaction logic.
- [x] 🤖 `src/ui/RhapsodyApp.ts`: remove mode-related context/actions.
- [x] 🤖 `public/templates/rhapsody-panel.hbs`: rewrite UI with header, voice, and debug disclosure.
- [x] 🤖 `src/styles/rhapsody.css`: remove mode styles; add debug disclosure styles.
- [x] 🤖 `npm run build` passes.
- [ ] 🧠 (Optional) Smoke test if environment allows.

## Notes

- `openaiPrepModel` is removed. Only `openaiModel` remains.
- The `logVoiceTelemetry` action is removed from UI but we should ensure `VoiceSession` logs it eventually.
