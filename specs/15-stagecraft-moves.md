# #15 Stagecraft moves — map, token, audio, lighting, camera (v1)

**Status:** spec sharpened, ready for impl
**Last touched:** 2026-05-03 (claude-code)
**Issue:** https://github.com/xiaoniuniu89/rhapsody/issues/15
**Assignee:** unassigned

## Spec

The GM runs Foundry, not just text. New GM moves let the model push maps, drop tokens, play music, change lighting, and pan the camera as part of a single dispatcher turn. Per #1 north star: *the user just plays.*

Acceptance:
- Seven new moves registered in the dispatcher catalog (#6), all consuming the asset index (#10) for query-form resolution:
  - `set_scene_map(query | sceneId)`
  - `place_token(actor, x?, y?)`
  - `remove_token(tokenId)`
  - `play_ambient(query | trackId)`
  - `stop_ambient(trackId?)`
  - `set_lighting(preset)`  — `day | dusk | night | torchlit | dark`
  - `pan_camera(target)`    — token name, `{ x, y }`, or named scene-note label
- Each move is also exposed as a manual button/form in the panel (parity with #8: AI moves and manual GM moves run the same code path).
- AI turn: a single message like *"you push open the tavern door"* can produce `set_scene_map("tavern") + play_ambient("tavern") + set_lighting("torchlit")` via the existing tool-call loop.
- Failures (asset not found, no active scene, unknown token) come back as `MoveResult.ok=false` with a useful `log`, and the model self-corrects on the next loop iteration.
- `npm run build` passes.

## Design

### Service: `StagecraftService`

`src/engine/stagecraft/StagecraftService.ts`. Thin wrapper around Foundry APIs so the moves stay declarative and the panel can reuse the same methods. Methods correspond 1:1 with the moves.

```ts
class StagecraftService {
  setSceneMap(ref: { sceneId?: string; query?: string }): Promise<{ scene: Scene }>;
  placeToken(actorRef: string, x?: number, y?: number): Promise<{ tokenId: string }>;
  removeToken(tokenId: string): Promise<void>;
  playAmbient(ref: { trackId?: string; query?: string }): Promise<{ trackId: string }>;
  stopAmbient(trackId?: string): Promise<void>;
  setLighting(preset: LightingPreset): Promise<void>;
  panCamera(target: string | { x: number; y: number }): Promise<void>;
}
```

Resolution flow for query forms:
1. Caller passes `{ query: "tavern" }`.
2. Service calls `assetIndex.findMap("tavern")`.
3. If 0 hits → throw `AssetNotFoundError` (the move catches it and returns `ok: false`).
4. If ≥1 hit → take top result and proceed. Top-k > 1 with similar scores: log all candidates in the move result so the model can pick differently next turn if needed.

### Foundry API mapping

- **`setSceneMap`**: if the matched item is a `Scene`, call `scene.activate()`. If it's a raw image, update the active scene's `background.src` via `scene.update({ "background.src": path })`.
- **`placeToken`**: resolve `actorRef` via `assetIndex.findToken` (or direct `game.actors.getName(...)`). Get the active scene's canvas; default position = current view center if `x`/`y` omitted. Call `scene.createEmbeddedDocuments("Token", [tokenData])`.
- **`removeToken`**: `scene.deleteEmbeddedDocuments("Token", [tokenId])`.
- **`playAmbient`**: resolve to a `PlaylistSound` via `assetIndex.findAudio`. Call `playlist.playSound(sound)` (Foundry's built-in single-sound play). Stops other sounds on the same playlist if its mode is `MULTIPLE` — fine for v1.
- **`stopAmbient`**: track-specific stop, or stop all currently-playing playlists (`game.playlists.filter(p => p.playing).forEach(p => p.stopAll())`).
- **`setLighting`**: map preset → `scene.update({ environment: { darknessLevel: N, globalLight: { enabled: bool } } })`. v1 mapping:
  - `day` → `darkness=0, globalLight=true`
  - `dusk` → `darkness=0.4, globalLight=true`
  - `night` → `darkness=0.85, globalLight=false`
  - `torchlit` → `darkness=0.7, globalLight=false`
  - `dark` → `darkness=1, globalLight=false`
  (V14 path; verify against current data model when implementing.)
- **`panCamera`**: accept token name (resolve to token.center on active scene), `{ x, y }`, or scene-note label (resolve via `scene.notes.find(n => n.text.includes(label))`). Then `canvas.animatePan({ x, y, scale? })`.

### Move definitions

`src/engine/moves/stagecraft.ts`, registered via `registerStagecraftMoves(registry, stagecraft)`. Each move follows the existing registered-move shape (see `src/engine/moves/types.ts` and the pattern in `src/engine/moves/state.ts`):

```ts
registry.register({
  schema: {
    name: "set_scene_map",
    description:
      "Switch to a different map by description (e.g. 'tavern interior') or specific scene id.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        sceneId: { type: "string" },
      },
    },
  },
  handler: async (args) => {
    try {
      const r = await stagecraft.setSceneMap(args);
      return { ok: true, log: `Switched scene to "${r.scene.name}"`, data: { sceneId: r.scene.id } };
    } catch (e) {
      return { ok: false, log: (e as Error).message };
    }
  },
});
```

Same shape for the other six. There is no `availableIn` field on registered moves today — Play/Prep gating is deferred to #9.

### System prompt addendum

Append to `MoveDispatcher`'s system prompt:

> You can run the table — switch maps, place tokens, play music, change lighting, and pan the camera using set_scene_map, place_token, play_ambient, set_lighting, pan_camera. When the narrative shifts location or mood, do this *as part of the same turn* as your narration so the player sees and hears the change. Use natural-language queries ("tavern interior", "tense combat"); the engine resolves them to specific assets.

### Panel UX (manual parity)

A "Stagecraft" section in `rhapsody-panel.hbs`, after "World State". One small form per move group:
- **Map**: dropdown of scenes + "Activate" button; or text input + "Find map" → resolves through the index, shows top match, "Apply".
- **Audio**: text input + "Play"; "Stop all".
- **Lighting**: five preset buttons.
- **Camera**: input (token name / `x,y`) + "Pan".
- **Token placement**: actor input + optional coords + "Place".

All buttons call `StagecraftService` directly — same code path as the AI moves.

### What's deferred

- Combat encounter automation (turn order, initiative).
- Procedural map generation.
- Weather / FX overlays.
- Token AI / movement pathing.
- Cinematic multi-step cuts (`then`/`afterDelay`).
- Cross-fade audio (Foundry supports it; v1 uses hard cuts).
- Per-token vision adjustments.

## Plan

- [ ] 🤖 `src/engine/stagecraft/types.ts` — `LightingPreset`, error types.
- [ ] 🤖 `src/engine/stagecraft/StagecraftService.ts` — service per design above.
- [ ] 🤖 `src/engine/moves/stagecraft.ts` — register all 7 moves; route through service.
- [ ] 🤖 Wire singleton in `main.ts` after `assetIndex.init()`; pass to `registerStagecraftMoves`.
- [ ] 🤖 Extend `MoveDispatcher` system prompt with stagecraft guidance.
- [ ] 🤖 Panel template — Stagecraft section with five sub-forms.
- [ ] 🤖 Panel CSS in `src/styles/rhapsody.css`.
- [ ] 🤖 `RhapsodyApp` handlers — `setMap`, `placeToken`, `removeToken`, `playAmbient`, `stopAmbient`, `setLighting`, `panCamera`.
- [ ] 🤖 `npm run build` passes.
- [ ] 🧠 Smoke test via `chrome-devtools-mcp`:
  - `new_page` → Foundry world (asset index pre-built from #10 smoke test).
  - `evaluate_script` calls per move, asserting Foundry state changes:
    - `stagecraft.setSceneMap({ query: "tavern" })` → `game.scenes.viewed.name` matches a tavern asset.
    - `stagecraft.playAmbient({ query: "tavern" })` → `game.playlists.find(p => p.playing)` is non-null.
    - `stagecraft.setLighting("torchlit")` → `game.scenes.viewed.environment.darknessLevel` ≈ 0.7.
    - `stagecraft.placeToken("Goblin")` → token count on the active scene increments by 1.
    - `stagecraft.panCamera({ x: 1000, y: 1000 })` → `canvas.stage.pivot` updates.
  - End-to-end AI turn: `evaluate_script` to call `moveDispatcher.runTurn("you push open the tavern door")`. Assert `result.movesTaken` includes `set_scene_map` + `play_ambient` + `set_lighting`, all `ok: true`.
  - Failure path: `stagecraft.setSceneMap({ query: "thisDoesNotExist__" })` should return `ok: false` with an `AssetNotFoundError`-shaped log; `list_console_messages` shows no uncaught exception.
  - `take_screenshot` after each major step for the test artifact.

## Notes

- v1 is firmly **single active scene**. If the user has more than one scene viewer (multi-screen GM), we don't try to coordinate.
- `place_token` defaults to the canvas view center when coords are omitted; this is forgiving for the model and "good enough" for solo play.
- Foundry V14 environment/lighting fields may have moved between versions — pin against current V14 docs at implementation time. The mapping above is intent, not API verbatim.

## Open questions

- Should `set_scene_map` create a new Scene if the matched asset is a raw image with no Scene yet? v1: no — only switches to existing scenes. Keeps the user in control of scene curation.
- `place_token` actor resolution priority: world actors before compendia? v1: world first (instant placement); compendia as fallback (would need an `importFromCompendium` step).
- Should `play_ambient` be exclusive (stop other ambient first) by default? v1: yes — call `stopAmbient()` before `playAmbient` so we don't pile up tracks.
