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

The project is being **rebuilt from scratch as v2**. The existing `src/` below is v1 — a chat-with-summaries prototype — and will be wiped as part of issue #12. Once #12 lands, the v1 architecture section below should be replaced.

v2 vision: reactive AI GM with secrets, wiki-style long-term memory (Karpathy second-brain model), GM moves as tool calls, system-agnostic by Foundry introspection. Tracked across GitHub issues #1–#12 (`xiaoniuniu89/rhapsody`).

Locked decisions (see issue #2):
- Foundry V14 module — stays in Foundry; native Actor/JournalEntry/Scene as world bible storage. (V14 chosen per #13 spike on 2026-04-26.)
- System-agnostic by Foundry introspection — no per-system pack format in v1.
- Wiki-style memory — bible/journal are Foundry JournalEntries accessed via explicit read/write tools, not vector RAG. RAG is reserved for rules retrieval (#7) only.
- Greenfield rebuild — no legacy folder, no archive tag.

## Project (v1 — to be replaced by #12)

Rhapsody is a **Foundry VTT V13 module** (v1) — v2 targets V14 only. v1 acts as an AI-powered solo GM tool. It exposes a chat UI inside Foundry that talks to the **DeepSeek** chat completions API (`https://api.deepseek.com/chat/completions`, model `deepseek-chat`) — note the architecture doc references OpenAI but the actual implementation uses DeepSeek. The user's API key is stored in Foundry's world settings under the module id `rhapsody`.

## Commands

- `npm run dev` — Vite dev server on port 3001. The dev server proxies everything outside `/modules/rhapsody` to `http://localhost:8080` (a running Foundry server), and proxies `/socket.io` over WebSocket. So you must have Foundry running locally on 8080 to test.
- `npm run build` — `tsc && vite build`. Vite is configured in **library mode** (`build.lib`) producing a single ES module at `dist/main.js` from `src/main.ts`. The base path is `/modules/rhapsody/`.
- `npm run preview` — preview the built bundle.
- `npm run prettier` — format `src/**/*.{ts,js,html,css}`.

There is no test runner and no lint script configured. TypeScript is strict (`noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax`).

## Architecture

Entry point is `src/main.ts`. It registers two Foundry hooks:
- `init` — registers world settings (`deepseekApiKey`, `rhapsodyState`).
- `ready` — instantiates and renders `RhapsodyApp` (a singleton).
- `renderSidebar` — injects a tab button into Foundry's sidebar that opens the app.

`module.json` declares `src/main.ts` as the ES module entry — but the **built** artifact is `dist/main.js`. When deploying as a Foundry module the `module.json` likely needs updating (or symlinked) to point at the built file.

Templates live in `public/templates/*.hbs` and are referenced at runtime by the path `modules/rhapsody/public/templates/...` — Foundry serves them from the module install location.

### App structure

`RhapsodyApp` (`src/apps/rhapsody/rhapsodyApp.ts`) extends Foundry's `HandlebarsApplicationMixin(ApplicationV2)`. It renders four parts: `sessionControls`, `sceneControls`, `messages`, `input`. Form submission is handled by the static `submitForm` method, which is the main chat loop. UI actions (start/end session, end/restart scene, pin, clear history, reset session numbers) flow through `_onClickAction` keyed off `data-action` attributes on buttons in the templates.

### Domain model (`src/apps/rhapsody/types.ts`)

`Session` → has many `Scene` → has many `Message`. Messages store **HTML** in `content` (rendered from markdown via `marked`); the original markdown is in `rawContent`. When sending to the AI, content is stripped back to plain text via `MarkdownService.stripHTML`.

### Services (`src/apps/rhapsody/services/`)

The app delegates almost all logic to single-responsibility services, all instantiated in the `RhapsodyApp` constructor:

- **`apiService`** — DeepSeek API client. `streamDeepSeekAPI` is an async generator that parses SSE `data:` lines for streaming chat. `callDeepSeekAPI`, `generateSummary`, and `generateSceneSummary` are non-streaming.
- **`contextService`** — builds the `messages[]` array sent to DeepSeek. Combines a system prompt (with system/world/scene info), a rolling `contextSummary`, the previous scene's summary, all pinned messages, and recent messages after the `summary-marker`. Auto-compresses when estimated tokens exceed `maxContextTokens` (3000) by summarizing all but the last 5 recent messages and injecting a `summary-marker` message. Token estimation is `length/4`.
- **`sessionService`** — session lifecycle, scene counter, session numbering. Tracks `highestSessionNumber` separately so it survives a "clear history".
- **`sceneService`** — creates scenes and generates per-scene narrative summaries via `apiService.generateSceneSummary`.
- **`journalService`** — persists ended scenes as Foundry `JournalEntry` documents.
- **`stateService`** — reads/writes the `rhapsodyState` world setting (currentScene, sceneHistory, contextSummary, currentSession, sessionHistory, highestSessionNumber). All persistent state goes through here. `sceneHistory` is capped at 5 entries.
- **`messageService`** — message CRUD, pinning, scroll/streaming DOM updates.
- **`markdownService`** — markdown↔HTML conversion (uses `marked`) and `stripHTML` for AI input.
- **`uiService`** — confirm modals and prompts.
- **`chatService`** — chat-flow validation only.

### Streaming flow (`submitForm`)

1. Validate (session active + API key + non-empty input).
2. Append user message → re-render `messages`/`input` parts.
3. If `shouldCompressContext`, run `compressOlderMessages` and merge the returned summary into `contextSummary`.
4. Append a placeholder AI message and re-render.
5. Build context messages and consume `streamDeepSeekAPI` chunk-by-chunk, updating both the message model and the DOM directly via `messageService.updateStreamingDOM` for smooth streaming without a full re-render.
6. On error, remove the loading AI message and inject an error message.
7. `saveAllState()` after success.

### Scene/session lifecycle

- `startSession` prompts for a name → `sessionService.startNewSession` → auto-creates scene 1 (without incrementing scene counter).
- `endScene` generates a narrative summary, creates a `JournalEntry`, archives the scene to `sceneHistory` (capped at 5), and starts the next scene. Empty scenes are skipped via a confirm dialog.
- `endSession` ends the current scene first if non-empty, then closes the session.
- `clearAllHistory` wipes everything except `highestSessionNumber` (preserved so future session numbers stay monotonic).

## Conventions / gotchas

- The codebase uses `// @ts-ignore` liberally on Foundry globals (`game`, `ui`, `canvas`, `Hooks`, `Dialog`). Foundry types come from `@league-of-foundry-developers/foundry-vtt-types` but coverage is partial.
- Module id is imported from `module.json` (`import { id as moduleId } from "../module.json"`) — keep these in sync rather than hardcoding "rhapsody".
- Messages stored as HTML; always `stripHTML` before sending to the AI or generating summaries.
- The `summary-marker` message id is a sentinel — `getRecentMessages` slices after it to determine the live context window.
- DeepSeek API errors should bubble up to the `submitForm` catch block, which removes any loading AI message and shows an error message + ui.notification.
