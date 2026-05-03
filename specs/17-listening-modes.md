# #17 Listening modes — Mute / Passive / Active + ambient GM context

**Status:** spec locked, implementation pending
**Last touched:** 2026-05-03 (gemini-cli)
**Issue:** https://github.com/xiaoniuniu89/rhapsody/issues/17
**Assignee:** unassigned

## Why

PTT (#14) is friction for solo play — your hands are on dice, character sheet, drawing, miniatures. The deeper opportunity: with a hot mic in passive mode the GM can quietly *listen* to the player think out loud, build memory, and prep reactions in the background — like a real GM who hears 100 things and acts on 2.

Solo RPG tool, low-friction, target $1–3 per ~4hr session.

## Session model

Sessions are the unit of play, not modes.

- **Idle** — Rhapsody panel just shows a single **Begin session** button. Mic off. No background ticks.
- **In session** — clicking Begin triggers:
  1. GM reads recent memory (last session log, world state, active clocks) + generates a short "where we left off" recap **plus one piece of forward motion** (an event, a person showing up, a clock ticking).
  2. Narrates it via TTS, drops first transcript line.
  3. Mic enters **Passive** by default.
- **Session ends** automatically:
  - On Foundry close / page refresh (`beforeunload` flush).
  - After ~15 min of no Active turns and no non-empty Passive chunks.
  - Or via an optional "End session" button hidden behind the Debug `<details>`.
- On end: telemetry logged, ambient summary persisted to memory as a single session-log journal page, world state already saved (it's mutated live).

## In-session mic states

| State | Mic | Behavior |
|---|---|---|
| **Active** | recording on hold/click | utterance is a player turn — Whisper → MoveDispatcher.runTurn() → narration + stagecraft + memory |
| **Passive** (default) | hot, 30s fixed chunks | each chunk → Whisper → ambient buffer → cheap-model gate → maybe escalate |
| **Mute** | off | no capture, no gate, no ticks |

**Active input:** PTT key (default backquote, from #14) **or** click-toggle button on the panel. No VAD, no wake-word.

**Passive capture:** dumb 30s tumbling chunks. Empty/silent transcripts dropped. No silence detection. Whisper at $0.006/min ≈ $1.44 / 4hr — comfortably inside the budget.

## Background pipeline

```
Mic ─PTT/toggle─▶ Active utterance ──▶ MoveDispatcher (existing path, no change)
        │
        └─Passive 30s chunk──▶ Whisper ──▶ AmbientBuffer
                                              │
                                              ▼
                                  Cheap-model classifier
                                  (structured signal labeler)
                                              │
                                              ▼
                                  Deterministic escalation rule
                                              │
                                              ▼ (rare)
                                  Main-model background tick
                                  (mutation only, no narration)
                                              │
                                              ▼
                                  MemoryService / WorldStateService
```

### Cheap-model classifier

Per chunk, cheap model (gpt-4o-mini or similar) emits **one structured label** from a hardcoded taxonomy:

```ts
type Signal =
  | { signal: "intends_to_visit";   entity: string }
  | { signal: "suspects_npc";       entity: string }
  | { signal: "recalls_detail";     entity: string }
  | { signal: "plans_action";       entity: string }
  | { signal: "speculates_world";   entity: string }
  | { signal: "none" };
```

Labeler, not judge. No "is this interesting" prompts — just classification. Reliable, cheap, ~$0.20 / 4hr session.

Hardcoded in `src/engine/listening/signals.ts`. Genre-specific extensions deferred.

### Escalation rule (v1)

Deterministic, no AI opinion:

> Same `(signal, entity)` pair fires **3 times within a rolling 5-minute window** → escalate.

Counter resets on escalation. This is the entire rule for MVP. Chaos counter + random event rolls (Mythic-style) layer on top later.

### Background tick (the escalation)

When the rule fires, call the main GM model with:

- The triggering signal + entity.
- Recent ambient summary (cheap-model rolling summary of the last ~2–3 min).
- Current world state, recent memory pages relevant to the entity.
- A **mutation-only system prompt**: "You are the GM thinking between scenes. The player has been [signal] about [entity]. Decide if this changes anything in the world. If yes, call memory/world-state/scene-prep tools. **Do not produce narration.** If nothing meaningful changes, return no tool calls."

Tool surface available to the background tick:
- `write_page`, `append_page` (memory)
- `advance_clock`, `shift_disposition` (world state)
- `set_scene_map`, `play_ambient`, `set_lighting` *queueing only* (queued for the next active turn — do not actually mutate Foundry mid-passive). Implementation detail: a `pendingStagecraft` list the next active turn drains.

**Hard guardrail:** the tick produces no `narrate` / `say` output. Enforced prompt-side and by tool-availability. If the model returns text, it's discarded.

Expected fire rate: a handful per session. Each call ~$0.01–0.05. Total: pennies.

### Two-stage upgrade (planned, not v1)

The MVP gate is single-stage: cheap classifies, deterministic rule escalates, main model acts.

Planned v2 upgrade: cheap model proposes a *candidate adjustment*; main model evaluates whether it's better than the current plan; only commits if yes. Same pipeline — gate becomes proposer/evaluator instead of classifier-then-rule.

## UI

Default panel state when idle: **Begin session** button + minimal status pill. That's it.

In-session collapsed pill shows:
- Current state — `Listening` / `Recording` / `Transcribing` / `GM thinking` / `GM speaking` / `Muted`.
- Subtle pulse when a background tick mutates state (the world just shifted, you should know).
- Mute toggle.
- Active mode click-toggle (alternative to PTT).
- Interrupt button (only when GM speaking).

Expandable disclosure for: live transcript, ambient buffer (debug), Forget-last-60s button, End session.

Everything else (manual forms from #16) lives in the existing Debug `<details>`.

## Costs (target $1–3 / 4hr session)

| Item | Estimate / 4hr |
|---|---|
| Whisper (passive 30s chunks) | ~$1.44 |
| Whisper (active utterances) | ~$0.10 |
| Cheap-model classifier (480 chunks × ~600 tokens) | ~$0.20 |
| Main GM (active turns) | ~$0.30–1.00 |
| Main GM background ticks (rare) | ~$0.05–0.20 |
| TTS (`tts-1` at $15/M chars, ~5k chars/session) | ~$0.08 |
| **Total** | **~$2.20–3.00** |

If we slip above, the levers are: drop passive Whisper to longer chunks (60s), or add a simple session-cost auto-mute.

## Acceptance

- Idle state: panel shows only **Begin session** button.
- Begin: TTS narrates resume + hook, mic enters Passive.
- Passive: 30s chunks transcribed, classified into signals, rule fires only on `3x same signal+entity in 5min`.
- Background tick mutates memory / world state / queued stagecraft. Never narrates.
- Active turn picks up queued stagecraft seamlessly.
- Mute and Forget-60s both work.
- Auto-end on Foundry close + 15 min idle.
- Session log persists as a single journal page on end.
- UI clearly signals all activity states (Listening / Transcribing / GM thinking / GM speaking / world pulse / Muted).
- `npm run build` passes; MCP smoke test passes; cost on a real 1hr test session ≤ $1.

## Plan

- [x] 🤖 `src/engine/listening/signals.ts` — hardcoded signal taxonomy + types.
- [x] 🤖 `src/voice/AmbientBuffer.ts` — 30s chunk store with rolling 5-min window.
- [x] 🤖 `src/voice/PassiveCapture.ts` — 30s tumbling MediaRecorder loop, Whisper per chunk, drops empty.
- [x] 🤖 `src/engine/listening/Classifier.ts` — cheap-model labeler, structured output.
- [x] 🤖 `src/engine/listening/EscalationRule.ts` — `3x signal+entity in 5min` counter.
- [x] 🤖 `src/engine/listening/BackgroundGm.ts` — main-model tick, mutation-only prompt, tool subset, no-narration enforcement.
- [x] 🤖 `src/engine/listening/PendingStagecraft.ts` — queue drained by next Active turn.
- [x] 🤖 `src/engine/session/Session.ts` — Idle/InSession state, Begin/End lifecycle, beforeunload + idle auto-end, session-log persistence.
- [x] 🤖 `src/voice/VoiceSession.ts` — extend with mic-state machine (Active/Passive/Mute), PTT + click-toggle for Active, Forget-60s.
- [x] 🤖 `src/ui/RhapsodyApp.ts` + panel template — Idle (Begin button) and InSession (status pill + minimal controls) views; keep #16 Debug disclosure for transcript + manual forms + End session.
- [x] 🤖 Telemetry — extend #14 counters with passive minutes, classifier cost, background-tick count, total session cost.
- [x] 🤖 `npm run build` passes.
- [ ] 🧠 MCP smoke test (chrome-devtools-mcp).
- [ ] 🧠 Hands-on session (cannot automate): real microphone, Begin → ramble passively about an NPC 3+ times → confirm a background memory-write fires → Active turn → confirm queued stagecraft applies. Measure actual session cost.

## Deferred / out of scope

- Two-stage gate (proposer/evaluator).
- Chaos counter + random event rolls.
- VAD, wake-word, speaker diarization.
- Genre-specific signal taxonomies (user-editable).
- Local Whisper.
- Cross-session ambient persistence beyond the session log.
- Cost auto-mute (revisit if real sessions exceed budget).

## Notes

- 2026-05-03: implemented all robotic plan items. Session lifecycle (Idle/InSession), mic state machine (Mute/Passive/Active), ambient buffer, signal classification, escalation rules, and background GM ticks all landed. UI updated to show session pill when active and Begin button when idle. Telemetry extended to track passive minutes and classifier costs. Build passes. (gemini-cli)
