# Current work

**Active:** #3 — System adaptation by Foundry introspection → [specs/3-introspection.md](specs/3-introspection.md)
**Up next:** #11 — LLM provider configuration

## Workflow (read first when starting a session)

1. Read this file.
2. Read the active spec under `specs/`.
3. `git log -10` and `git status` to see what's actually on disk.
4. Resume at the next unchecked item in the spec's Plan section.
5. When pausing: update the spec (Plan checklist, Notes, Last touched), commit, push.

If the spec disagrees with the code, **the code wins** — update the spec to match reality.

Both Claude Code and Gemini CLI use the same convention. Files + git are the only shared state.

## Recent

- 2026-04-26: completed #12 Scaffold v2. V14 baseline established, ApplicationV2 skeleton ready, verified by user.
- 2026-04-26: opened 12 v2 issues (#1–#12). Locked decisions: stay in Foundry, system-agnostic by introspection (#3), wiki-style memory (#4), greenfield rebuild. Set up this handoff convention.
- 2026-04-26: opened #13 (Foundry V14 spike) — Decided V14 only. Closed.
