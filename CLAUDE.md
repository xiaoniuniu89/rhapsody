# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. The project is collaboratively edited by Claude Code and Gemini CLI; both tools follow the same workflow so either can pick up work mid-stream. (Gemini's equivalent is `GEMINI.md`.)

## Workflow — read first

This repo uses a lightweight handoff convention so Claude Code and Gemini CLI can swap cleanly:

1. **Read `WORK.md`** at the repo root — single-file pointer to the active issue and active spec file.
2. **Read the active spec** under `specs/<issue>-<slug>.md` — contains Spec, Plan checklist, Notes/decisions, Open questions.
3. **`git log -10` and `git status`** to see what's actually on disk.
4. **Resume at the next unchecked item** in the spec's Plan section.

When pausing or finishing a chunk:
- Update the spec: tick completed Plan items, add to Notes, refresh "Last touched".
- Commit (each meaningful checklist item ≈ one commit). Push.
- If the active issue changed, update `WORK.md`.

If the spec disagrees with the code on disk, **the code wins** — update the spec to match reality before continuing.

## Status

The project is being **rebuilt from scratch as v2**. Issue #12 (Scaffold v2) has landed, establishing the V14-only baseline.

v2 vision: reactive AI GM with secrets, wiki-style long-term memory (Karpathy second-brain model), GM moves as tool calls, system-agnostic by Foundry introspection. Tracked across GitHub issues #1–#12 (`xiaoniuniu89/rhapsody`).

Locked decisions (see issue #2):
- Foundry V14 module — stays in Foundry; native Actor/JournalEntry/Scene as world bible storage. (V14 chosen per #13 spike on 2026-04-26.)
- System-agnostic by Foundry introspection — per-system pack format deferred to #3.
- Wiki-style memory — bible/journal are Foundry JournalEntries accessed via explicit read/write tools, not vector RAG. RAG is reserved for rules retrieval (#7) only.
- Greenfield rebuild — no legacy folder, no archive tag.

## Commands

- `npm run dev` — Vite dev server on port 3001. The dev server proxies everything outside `/modules/rhapsody` to `http://localhost:8080` (a running Foundry server), and proxies `/socket.io` over WebSocket. So you must have Foundry running locally on 8080 to test.
- `npm run build` — `tsc && vite build`. Vite is configured in **library mode** (`build.lib`) producing a single ES module at `dist/main.js` from `src/main.ts`. The base path is `/modules/rhapsody/`.
- `npm run preview` — preview the built bundle.
- `npm run prettier` — format `src/**/*.{ts,js,html,css}`.

There is no test runner and no lint script configured. TypeScript is strict (`noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax`).

## Architecture (v2)

- Entry point: `src/main.ts` (registers hooks, world settings for `openaiApiKey`, `openaiModel`).
- UI: `src/ui/RhapsodyApp.ts` (extends `ApplicationV2`, lazy-loads LLM client).
- LLM: `src/llm/OpenAIClient.ts` (thin wrapper for OpenAI SDK, reads world settings).
- Introspection: `src/engine/IntrospectionService.ts` (system discovery).

### App structure

`RhapsodyApp` (`src/ui/RhapsodyApp.ts`) extends Foundry's `HandlebarsApplicationMixin(ApplicationV2)`. It renders a single `panel` part using `public/templates/rhapsody-panel.hbs`.

### Directory layout

- `src/ui/` — ApplicationV2 classes and UI logic.
- `src/engine/` — GM-craft logic and orchestration.
- `src/memory/` — Foundry Journal/Bible access tools.
- `src/llm/` — LLM provider clients.
- `src/lang/` — Localization.
- `src/styles/` — Global and app-specific CSS.

## Conventions

- The codebase uses `// @ts-ignore` on Foundry globals (`game`, `ui`, `canvas`, `Hooks`, `Dialog`) where types are incomplete.
- Module id is imported from `module.json` (`import { id as moduleId } from "../module.json"`) — keep these in sync rather than hardcoding "rhapsody".
- Use `ApplicationV2` patterns for all new UI components.
