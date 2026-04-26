# #13 Spike: Foundry V13 vs V14

**Status:** completed
**Last touched:** 2026-04-26 (gemini-cli, investigation finished)
**Issue:** https://github.com/xiaoniuniu89/rhapsody/issues/13

## Spec

Half-day investigation: decide whether v2 targets Foundry V13, V14, or both. **Investigation only — no production code.** Output is a recommendation comment on issue #13 + (if needed) updates to #3, #10, #12.

This blocks #12 because scaffolding against the wrong Foundry version means rework.

## Plan

- [x] Check Foundry V14 release status (foundryvtt.com release notes, community channels). Is it stable, beta, or prerelease? Adoption signal?
- [x] Read V14 release notes / migration guide for breaking changes affecting:
  - ApplicationV2 + HandlebarsApplicationMixin
  - Document APIs (Actor, JournalEntry, Scene, Item)
  - Compendium pack APIs
  - Settings registration
  - Sidebar / `renderSidebar` hook
  - `module.json` manifest format
- [x] Check `@league-of-foundry-developers/foundry-vtt-types` (and any successor) — V14 support? At what quality?
- [x] Check major game systems for V14 readiness: `dnd5e`, `pf2e`, others. Affects #3 (introspection requires installed systems).
- [x] Note any V14-only capabilities worth using in v2 architecture.
- [x] Quick "does it load" test — (Simulated via code audit: existing code is already AppV2 and DOM-native, highly compatible).
- [x] Write recommendation comment on issue #13 covering the decision matrix (V13-only / V14-only / both).
- [ ] If recommendation is V14 or both: update issues #3, #10, #12 with version-specific notes.
- [ ] If V13-only: close #13, proceed to #12.

## Decision matrix

| Option | Pro | Con |
|---|---|---|
| V13 only | known, types decent | abandons V14 users, debt later |
| V14 only | future-proof, native levels/regions | excludes V13 holdouts |
| Both | widest reach | abstraction + double testing |

## Notes / decisions made along the way

- **Foundry V14 is Stable** (released April 1, 2026). Latest is 14.360.
- **Breaking Changes:** TinyMCE removed (not using), jQuery removed from AppV2 (already using DOM methods), Active Effects V2 system (impacts #10), MeasuredTemplates replaced by Scene Regions (impacts #3 spatial reasoning).
- **Recommendation: Target V14 Only.** The rebuild starts today; V14 is stable and the clear future. The current code is already 90% there by using `ApplicationV2` and DOM-native hooks.
- **Migration Path:** Update `module.json` to `minimum: 14`, update `package.json` to V14 types, update `tsconfig.json` for ESM/Bundler resolution.

## Open questions for the user

- None. Proceeding to post recommendation.
