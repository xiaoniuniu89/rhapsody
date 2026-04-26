# #3 System adaptation by Foundry introspection

**Status:** ready for implementation
**Last touched:** 2026-04-26 (gemini-cli, created from issue)
**Issue:** https://github.com/xiaoniuniu89/rhapsody/issues/3
**Assignee:** (unassigned)

## Spec

The engine becomes system-agnostic by reading whatever Foundry game system is loaded at startup. It introspects actor schemas, item types, and scene primitives (Regions/Levels) to build a mental model of the world without requiring per-system configuration files.

Acceptance criteria:
- Engine boots and logs detected system ID/Title.
- Introspects and logs available Actor types and their basic data structures.
- Introspects and logs available Item types.
- Introspects and logs available Compendium packs (to identify rules sources).
- V14 specific: Exposes Scene Regions and Levels as first-class spatial primitives.

## Plan

### 1. Create Introspection Service
- [ ] Create `src/engine/IntrospectionService.ts`.
- [ ] Implement `init()` to capture `game.system`.
- [ ] Implement methods to map Actor/Item templates.
- [ ] Implement V14 Region/Level discovery.

### 2. Integration
- [ ] Wire `IntrospectionService` into `src/main.ts`.
- [ ] Log the "System Brief" to the console on startup.

### 3. Verification
- [ ] `npm run build` succeeds.
- [ ] Manual check in V14 console: confirm system metadata is correctly captured.

## Notes
- V14 native Scene Regions replace the need for bespoke spatial math for simple "who is where" queries.
- Defer per-system prompt tuning; focus on raw metadata discovery.
