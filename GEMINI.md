# GEMINI.md

This file provides context to Gemini CLI when working in this repository. The project is collaboratively edited by Claude Code and Gemini CLI; both tools follow the same workflow so either can pick up work mid-stream.

## Project

Rhapsody is a Foundry VTT V14 module: an AI-powered solo Game Master tool. It's currently being **rebuilt from scratch as v2**. Issue #12 (Scaffold v2) has landed, establishing the V14-only baseline.

The v2 vision is a reactive AI GM with secrets, long-term wiki-style memory, GM moves as tool calls, and rules retrieval — system-agnostic by introspecting whatever Foundry game system is loaded. Full vision: GitHub issue #1 (epic).

## Workflow — read first

This repo uses a lightweight handoff convention so Claude Code and Gemini CLI can swap in/out cleanly:

1. **Read `WORK.md`** at the repo root — single-file pointer to the active issue and active spec file.
2. **Read the active spec** under `specs/<issue>-<slug>.md` — contains Spec, Plan checklist, Notes/decisions, Open questions.
3. **`git log -10` and `git status`** to see what's actually on disk.
4. **Resume at the next unchecked item** in the spec's Plan section.

When pausing or finishing a chunk:
- Update the spec: tick completed Plan items, add to Notes, refresh "Last touched".
- Commit (each meaningful checklist item ≈ one commit). Push.
- If the active issue changed, update `WORK.md`.

If the spec disagrees with the code on disk, **the code wins** — update the spec to match reality before continuing.

## Issue tracker

GitHub issues live at `xiaoniuniu89/rhapsody`. The v2 work is tracked under issues #1–#12 with labels `v2`, `epic`, `decision`, `architecture`, `chore`. View an issue: `gh issue view <n> --repo xiaoniuniu89/rhapsody`.

Locked decisions (see issue #2):
- **Foundry V14 module** — stays in Foundry; native Actor/JournalEntry/Scene as world bible storage. (V14 chosen per #13 spike on 2026-04-26.)
- **System-agnostic by Foundry introspection** — per-system pack format deferred to #3.
- **Wiki-style memory** — bible/journal are Foundry JournalEntries accessed via explicit read/write tools (Karpathy "second brain" model), not vector RAG. RAG is reserved for rules retrieval (#7) only.
- **Greenfield rebuild** — no legacy folder, no archive tag.

## Build / dev commands

- `npm run dev` — Vite dev server on port 3001. Proxies non-`/modules/rhapsody` to `http://localhost:8080` (a running Foundry server) and `/socket.io` over WebSocket. **Requires Foundry running locally on 8080.**
- `npm run build` — `tsc && vite build`. Library mode, bundles to `dist/main.js`.
- `npm run preview` — preview the built bundle.
- `npm run prettier` — format `src/**/*.{ts,js,html,css}`.

No test or lint script is configured. TypeScript is strict.

## Architecture (v2)

Entry point is `src/main.ts`. It registers three Foundry hooks:
- `init` — registers the `rhapsodyState` world setting.
- `ready` — instantiates `RhapsodyApp` (a singleton).
- `renderSidebar` — injects a theater-masks button into Foundry's left sidebar tab strip.

`RhapsodyApp` (`src/ui/RhapsodyApp.ts`) extends Foundry's `HandlebarsApplicationMixin(ApplicationV2)`. It renders a single `panel` part using `public/templates/rhapsody-panel.hbs`.

## Conventions

- Module id is `rhapsody` (in `module.json`). Import as `import { id as moduleId } from "../module.json"` rather than hardcoding.
- Templates go in `public/templates/`, served by Foundry at `modules/rhapsody/public/templates/...`.
- Foundry globals (`game`, `ui`, `canvas`, `Hooks`, `Dialog`) often need `// @ts-ignore` — types from `@league-of-foundry-developers/foundry-vtt-types` are partial.
- Don't write to GitHub (issues, PRs, force pushes) without explicit user confirmation.
