# #12 Scaffold v2

**Status:** ready for implementation
**Last touched:** 2026-04-26 (claude-code, spec hardened for handoff)
**Issue:** https://github.com/xiaoniuniu89/rhapsody/issues/12
**Assignee:** gemini-cli

## Spec

Wipe `src/` and stand up the v2 skeleton on Foundry **V14**. No legacy folder, no archive tag — personal project, no users to preserve compatibility for (per #2 D3).

Acceptance criteria:
- Loads in Foundry V14 with a Rhapsody sidebar button.
- Clicking the sidebar button renders an empty Rhapsody panel (ApplicationV2 + HandlebarsApplicationMixin).
- No v1 code remains under `src/`.
- `npm run build` succeeds with zero TS errors.
- Empty panel renders manually in a running Foundry V14 world.

This issue blocks all other v2 implementation work.

## Plan

Work through these in order, committing each meaningful step. Tick the box on completion.

### 1. Manifest + types + tsconfig (V14 baseline)

- [x] Update `module.json`:
  - [x] `"version": "2.0.0-dev"`
  - [x] `"compatibility": { "minimum": "14", "verified": "14" }`
  - [x] Keep `"esmodules": ["src/main.ts"]` for now (build path is handled by Vite lib mode; do not touch).
- [x] Update `package.json`:
  - [x] Bump `@league-of-foundry-developers/foundry-vtt-types` to the latest V14-compatible version (check `npm view @league-of-foundry-developers/foundry-vtt-types versions` and pick the newest stable that targets Foundry 14.x).
  - [x] Remove `marked` from `dependencies`.
  - [x] Remove `interactjs` from `dependencies`.
  - [x] Remove `@types/marked` from `devDependencies`.
  - [x] Do **not** add `@anthropic-ai/sdk` yet — that lands in #11.
  - [x] Run `npm install` after edits.
- [x] Update `tsconfig.json` so `compilerOptions.moduleResolution` is `"bundler"` (if not already). Leave the rest of the strict flags alone.

### 2. Wipe v1

Delete:
- [x] `src/main.ts`
- [x] `src/apps/` (entire directory)
- [x] `src/globals.d.ts`
- [x] `src/typescript.svg`

Keep (do not touch):
- `src/lang/en.json`
- `src/styles/rhapsody.css`
- `src/vite-env.d.ts`
- `public/` (templates dir will be repopulated below)

If `public/templates/` contains v1 `.hbs` files, delete them (we'll write a fresh one).
- [x] `public/templates/*.hbs` wiped.

### 3. Create v2 directory layout

Create empty directories with a `.gitkeep` in each (so git tracks them):
- [x] `src/engine/.gitkeep`
- [x] `src/memory/.gitkeep`
- [x] `src/llm/.gitkeep`
- [x] `src/ui/` (will get `RhapsodyApp.ts` below — no `.gitkeep` needed)

### 4. Write `src/main.ts`

Create `src/main.ts` with exactly this content (port of v1's working sidebar injection, stripped of v1 app wiring):

- [x] `src/main.ts` created.

...

### 5. Write `src/ui/RhapsodyApp.ts`

- [x] `src/ui/RhapsodyApp.ts` created.

...

### 6. Write `public/templates/rhapsody-panel.hbs`

- [x] `public/templates/rhapsody-panel.hbs` created.

...

### 7. Trim `src/styles/rhapsody.css`

Wipe the file's contents and replace with a single placeholder rule so it still imports cleanly:

- [x] `src/styles/rhapsody.css` trimmed.


(v1 styles will be reintroduced in later issues as the UI grows.)

### 8. Build + manual test

- [ ] `npm run build` — must succeed with zero TS errors.
- [ ] Start Foundry V14 locally on port 8080. `npm run dev`. Open the world.
- [ ] Confirm: theater-masks icon appears in the left sidebar tab strip.
- [ ] Click it: empty Rhapsody panel renders with the placeholder text.

### 9. Update docs

- [ ] In `CLAUDE.md` and `GEMINI.md`: replace any v1 architecture description with a short v2 summary. The "v1 to be replaced" section in `CLAUDE.md` should be removed entirely. Keep workflow + locked decisions sections.
- [ ] Update `WORK.md`: active → next ticket (likely #11 LLM provider or #4 wiki memory — leave as TBD for the user to decide, but note #12 is done).

### 10. Commit + close

- [ ] Single commit per logical step is fine. Final commit message: `feat: scaffold v2 skeleton on Foundry V14 (closes #12)`.
- [ ] Push.

## Notes / decisions made along the way

- **Foundry V14 baseline** — per #13 spike. Targeting V14 only.
- **AppV2 standard** — V14's `ApplicationV2` is mature and no-jQuery by default; v1 was already DOM-native so no migration cost.
- **Module entry stays `src/main.ts`** — Vite lib mode handles the build output. Don't switch `module.json` to point at `dist/` until we hit a Foundry-side problem.

## Open questions for the user

- (none — proceed)
