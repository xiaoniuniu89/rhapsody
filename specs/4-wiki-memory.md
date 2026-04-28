# #4 Wiki-style memory (bible + journal)

**Status:** in progress
**Last touched:** 2026-04-28 (claude-code, spec + read tool)
**Issue:** https://github.com/xiaoniuniu89/rhapsody/issues/4
**Assignee:** claude-code

## Spec

Long-term memory is wiki-style, not vector RAG. Two folders of `JournalEntry` documents act as the world's second brain:

- **Rhapsody Bible** — canonical world facts. Each entry has a `Public` page (player-safe summary) and an optional `Private` page (GM-only secrets, foreshadowing, hidden motivations).
- **Rhapsody Journal** — session log of what has actually happened. Public-only.

The engine reads/writes pages by **name lookup**, not vector similarity. The LLM will eventually call these as tools (`read_page`, `write_page`, `append_page`, `list_pages`) — see #6.

Mode gating:
- `play` mode hides bible `Private` pages even from the LLM.
- `prep` mode exposes everything.

RAG is reserved for rules retrieval (#7), not narrative memory.

Acceptance criteria:
- `MemoryService.init()` finds-or-creates the two folders at the world root.
- `listPages(scope)` and `readPage(scope, name)` work for both scopes.
- `readPage("bible", ...)` returns `private: null` when mode is `play`.
- A write path exists for both creating new pages and appending to existing ones.
- The panel UI exposes read/write so the GM can verify behavior without the LLM in the loop.
- `npm run build` passes.

## Design

### Storage

Both folders sit at the world root (`folder == null`), `type: "JournalEntry"`. Each entry is one wiki page, named by the subject (`"Lord Vance"`, `"The Black Library"`, `"Session 3"`).

Sub-pages inside an entry:
- Bible entries: `Public` (always) + `Private` (optional, GM-only).
- Journal entries: `Public` only.

We use Foundry's native `JournalEntry.pages` collection rather than a single blob so the GM can edit private content directly in the Foundry UI without seeing it leak.

### Types

```ts
export type MemoryScope = "bible" | "journal";
export type RhapsodyMode = "play" | "prep";

export interface PageSummary {
  id: string;
  name: string;
  hasPrivate: boolean;
}

export interface PageContent {
  name: string;
  public: string;
  private: string | null; // null in play mode or when absent
}
```

### API surface

```ts
class MemoryService {
  init(): Promise<void>;
  listPages(scope): PageSummary[];
  readPage(scope, name): PageContent | null;
  // not yet:
  writePage(scope, name, { public, private? }): Promise<PageSummary>;
  appendPage(scope, name, section, html): Promise<void>;
}
```

### LLM exposure (deferred to #6)

`read_page` / `list_pages` always exposed. `write_page` / `append_page` gated on a setting once #6 lands tool-call routing. Bible private content is filtered at the `MemoryService` boundary so a misbehaving LLM cannot read it in `play` mode.

## Plan

- [x] Add `MemoryScope` / `RhapsodyMode` / `PageSummary` / `PageContent` types.
- [x] Register `rhapsodyMode` world setting (`play` / `prep`).
- [x] `MemoryService.init()` finds-or-creates the two folders.
- [x] `listPages(scope)` and `readPage(scope, name)` with private-page redaction in `play` mode.
- [x] Wire a Read form into `RhapsodyApp` panel (scope select + name input + result render).
- [x] Use the `memory` singleton in `main.ts` from the panel (no per-click reinit).
- [ ] `writePage(scope, name, { public, private? })` — creates the entry if missing, replaces named sub-pages.
- [ ] `appendPage(scope, name, section, html)` — appends HTML to a named sub-page; creates it if missing.
- [ ] Panel "Write" form (scope + name + textareas for public/private).
- [ ] Panel "Append to journal" shortcut for fast session logging.
- [ ] Refuse writing `Private` to journal scope at the service boundary.
- [ ] Manual verify: V14 world, both modes, create+read+append round-trips.

## Notes

- Folder lookup matches on `name`, `type === "JournalEntry"`, and `folder == null` so a renamed sub-folder elsewhere can't shadow ours.
- `findSubPage` matches on page `name` (case-sensitive). Convention: `Public` and `Private`. We do not coerce case — if a GM renames a page in Foundry, our lookup misses, by design.
- `readPage` returns `private: null` in play mode rather than throwing, so the same code path serves both modes and the LLM never sees a "you don't have permission" signal it could try to route around.
- Mode is a world setting, not a per-user flag — GM toggles it. Player clients never run the LLM directly in v2.

## Open questions

- Linking between pages: Foundry has `@UUID[...]{label}` references. Should `writePage` accept a markdown-ish form and convert, or pass HTML straight through? Defer until the LLM is actually writing — see #6.
- Versioning / history: not in scope. Foundry has no built-in journal history; if we want diff/undo, that's a separate issue.
- Conflict handling when two writes race: out of scope (single-GM module).
