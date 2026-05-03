# Current work

**Active:** #11 — Model strategy.
**Up next:** #4 — Wiki memory (improvements).

## Workflow (read first when starting a session)

1. Read this file.
2. Read the active spec under `specs/`.
3. `git log -10` and `git status` to see what's actually on disk.
4. Resume at the next unchecked item in the spec's Plan section.
5. When pausing: update the spec (Plan checklist, Notes, Last touched), commit, push.

If the spec disagrees with the code, **the code wins** — update the spec to match reality.

Both Claude Code and Gemini CLI use the same convention. Files + git are the only shared state.

## Recent

- 2026-05-03: completed #9 Prep vs Play modes (gemini-cli). Implemented mode-aware MoveDispatcher with per-mode system prompts and tool filtering. Added `openaiPrepModel` setting. Gated Voice PTT and panel forms by mode. Added mode banner with toggle. Verified by build and MCP smoke test. Fixed gating leak in VoiceSession.handleUtterance.
- 2026-05-03: completed #15 stagecraft moves (gemini-cli). Implemented StagecraftService + 7 GM moves (map, token, audio, lighting, camera) using AssetIndexService for fuzzy resolution. Added manual Stagecraft UI section to the panel with parity for all moves. Updated dispatcher system prompt to guide model in running the table. Verified by build.
- 2026-05-02: completed #10 asset indexing (gemini-cli). AssetIndexService walks Scenes (maps), Playlists (audio), and Actors (tokens) including compendia. Heuristic tag extraction + fuzzy search. Panel UI with status and test query. Fixed #14 VoiceSession build error (erasableSyntaxOnly) to unblock. Verified in Foundry with browser automation.
- 2026-05-02: north-star pivot. Vision is **voice-first, zero-friction, GM runs Foundry stagecraft**. Rewrote epic #1, opened #14 (Voice I/O, PTT + STT + TTS) and #15 (stagecraft moves), re-scoped #10 from "Foundry documents as bible" (now covered by #4/#5/#8) to "asset indexing for stagecraft". Re-scoped #9 (Play surface is voice, not panel). Vision saved to memory.
- 2026-05-02: completed #8 world-state v1 (clocks + dispositions). End-to-end verified in Foundry: panel CRUD, AI moves (`read_state` → `advance_clock` → `shift_disposition`), ±3 clamping, persistence across reload. Bug fix: Vite dev `?t=` cache-bust split RhapsodyApp's dynamic import from Foundry's static load into two `WorldStateService` singletons; service now reloads from setting on every read/write so any instance is always in sync.
- 2026-04-28: completed #7 Rules RAG (gemini-cli). Chunker + Embedder + Indexer + query_rules move. Index persisted in hidden JournalEntry. UI section for pack selection, reindexing, and manual query with citations.
- 2026-04-28: completed #5 scene contract (gemini-cli). Data model + storage in scene flags + editor panel + dispatcher integration with hidden-leak detection. Six narrative moves promoted from stubs to real handlers.
- 2026-04-28: completed #6 GM moves (gemini-cli). Catalog + dispatcher + multi-step tool-call loop. Memory tools + roll_oracle real; seven narrative/state moves stubbed pending #5/#8. Verified end-to-end through the panel.
- 2026-04-28: completed #4 wiki memory (gemini-cli). Service supports list/read/write/append with mode-aware redaction. UI panel wired for all operations. Verified in V14 with browser automation.
- 2026-04-28: #4 wiki memory write+append landed (gemini-cli). `writePage` upserts Public/Private pages; `appendPage` concatenates HTML. Panel has Write form + Journal-append shortcut. Service refuses Private content on journal scope.
- 2026-04-28: started #4 wiki memory — `MemoryService` with folder bootstrap + `listPages`/`readPage`, mode-aware private redaction, panel Read form. Spec landed.
- 2026-04-26: completed #11 LLM provider (slim scaffold). AnthropicClient wired to Test button. Verified by build.
- 2026-04-26: completed #3 introspection. `IntrospectionService` exposes `SystemBrief` and `briefScene()` — verified on Simple World-Building.
- 2026-04-26: completed #12 Scaffold v2. V14 baseline established, ApplicationV2 skeleton ready, verified by user.
- 2026-04-26: opened 12 v2 issues (#1–#12). Locked decisions: stay in Foundry, system-agnostic by introspection (#3), wiki-style memory (#4), greenfield rebuild. Set up this handoff convention.
- 2026-04-26: opened #13 (Foundry V14 spike) — Decided V14 only. Closed.
