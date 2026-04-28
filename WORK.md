# Current work

**Active:** _none — pick #5 (scene contract) or #7 (rules RAG) next._
**Up next:** #5 (unblocks the seven stubbed narrative moves) and #7 (rules retrieval) are both ready to start.

## Workflow (read first when starting a session)

1. Read this file.
2. Read the active spec under `specs/`.
3. `git log -10` and `git status` to see what's actually on disk.
4. Resume at the next unchecked item in the spec's Plan section.
5. When pausing: update the spec (Plan checklist, Notes, Last touched), commit, push.

If the spec disagrees with the code, **the code wins** — update the spec to match reality.

Both Claude Code and Gemini CLI use the same convention. Files + git are the only shared state.

## Recent

- 2026-04-28: completed #6 GM moves (gemini-cli). Catalog + dispatcher + multi-step tool-call loop. Memory tools + roll_oracle real; seven narrative/state moves stubbed pending #5/#8. Verified end-to-end through the panel.
- 2026-04-28: completed #4 wiki memory (gemini-cli). Service supports list/read/write/append with mode-aware redaction. UI panel wired for all operations. Verified in V14 with browser automation.
- 2026-04-28: #4 wiki memory write+append landed (gemini-cli). `writePage` upserts Public/Private pages; `appendPage` concatenates HTML. Panel has Write form + Journal-append shortcut. Service refuses Private content on journal scope.
- 2026-04-28: started #4 wiki memory — `MemoryService` with folder bootstrap + `listPages`/`readPage`, mode-aware private redaction, panel Read form. Spec landed.
- 2026-04-26: completed #11 LLM provider (slim scaffold). AnthropicClient wired to Test button. Verified by build.
- 2026-04-26: completed #3 introspection. `IntrospectionService` exposes `SystemBrief` and `briefScene()` — verified on Simple World-Building.
- 2026-04-26: completed #12 Scaffold v2. V14 baseline established, ApplicationV2 skeleton ready, verified by user.
- 2026-04-26: opened 12 v2 issues (#1–#12). Locked decisions: stay in Foundry, system-agnostic by introspection (#3), wiki-style memory (#4), greenfield rebuild. Set up this handoff convention.
- 2026-04-26: opened #13 (Foundry V14 spike) — Decided V14 only. Closed.
