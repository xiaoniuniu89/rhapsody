# #14 Voice I/O — PTT, STT, TTS (v1)

**Status:** services + UI landed; awaiting MCP smoke test + hands-on mic verify
**Last touched:** 2026-05-03 (claude-code)
**Issue:** https://github.com/xiaoniuniu89/rhapsody/issues/14
**Assignee:** unassigned

## Spec

The user-facing layer of the north-star vision (#1). The user holds a key, speaks to the GM, releases. Audio → text → existing `MoveDispatcher.runTurn()` → narration → TTS audio out. No typing required during play.

Acceptance:
- Holding the bound PTT key (default: space) starts mic capture; releasing ends the utterance and submits it.
- Captured audio is transcribed via Whisper API and the transcript is rendered into the panel.
- Transcript is fed to `MoveDispatcher.runTurn()` unchanged — voice is just an alternate input.
- GM narration is converted to speech via OpenAI `tts-1` and played through the user's default audio output.
- Panel shows mic state (idle / listening / transcribing / GM-speaking) and a rolling transcript pane (player utterances + GM replies).
- An "Interrupt" button cuts current TTS playback.
- Mic is **off** when the PTT key is not held — verified by listening with key up and seeing nothing land in the transcript.
- A simple cost telemetry counter (audio seconds in, chars out) logs to console at end of session, so we can sanity-check the ~$2–3 / 4hr budget.
- `npm run build` passes.

## Design

### Architecture

Three new services, each behind an interface so the impl can be swapped:

```
src/voice/
  PttController.ts          // keybinding + MediaRecorder lifecycle
  SpeechToTextProvider.ts   // interface
  WhisperSttProvider.ts     // OpenAI Whisper impl
  TextToSpeechProvider.ts   // interface
  OpenAITtsProvider.ts      // OpenAI tts-1 impl
  AudioPlayer.ts            // queued HTML5 audio playback w/ interrupt
  VoiceSession.ts           // glues PTT → STT → dispatcher → TTS → player
```

`main.ts` instantiates the providers and a single `VoiceSession`. The session is the only thing the panel talks to.

### PTT

Foundry's `game.keybindings.register` registers a "Talk to Rhapsody" binding (default: `Space`, with onDown/onUp handlers). The handler calls `pttController.start()` / `pttController.stop()`. Settings let the user rebind via Foundry's standard keybinding UI.

`PttController` owns a `MediaRecorder` instance. On `start()`: request mic permission if needed, begin recording into a `Blob[]`. On `stop()`: finalize the blob (webm/opus), emit `utteranceCaptured(blob)`. Mic stream is released between utterances so the OS-level mic indicator turns off.

Repeat-key suppression: holding the key fires `keydown` repeatedly on most browsers — only the first triggers `start()`.

### STT

`WhisperSttProvider.transcribe(blob): Promise<string>` POSTs the blob to `https://api.openai.com/v1/audio/transcriptions` with model `whisper-1`. Reuses the existing `openaiApiKey` setting. Returns plain text. No streaming in v1 (Whisper API doesn't offer it; turn-based is fine for a held-key utterance pattern).

Failure modes: network error → `MoveResult`-shaped error in the transcript pane ("⚠️ Transcription failed"). Empty transcription → silently drop (user pressed and released without speaking).

### Dispatcher integration

`VoiceSession.handleUtterance(text)`:
1. Append `{ role: "user", text }` to the transcript.
2. Call `moveDispatcher.runTurn(text)` (existing).
3. Append `{ role: "gm", text: result.narration, moves: result.movesTaken }` to the transcript.
4. Hand `result.narration` to `TextToSpeechProvider.speak()`.

No new state shape — `MoveDispatcher` already returns `TurnResult` and that's all we need.

### TTS

`OpenAITtsProvider.synthesize(text): Promise<ArrayBuffer>` POSTs to `https://api.openai.com/v1/audio/speech` with model `tts-1`, voice `alloy` (configurable later), format `mp3`. Returns the audio bytes.

`AudioPlayer.enqueue(buffer)` plays via `HTMLAudioElement` + `URL.createObjectURL`. Maintains a queue so back-to-back narrations don't overlap. `interrupt()` stops current playback, drains the queue, and revokes object URLs. The panel's interrupt button calls this.

Long narration: in v1, send the whole narration at once. Streaming TTS / sentence-chunked playback is a follow-up.

### Panel

Add a `voice` section to `rhapsody-panel.hbs`, above the existing "Last response" panel:

- **Status row:** mic icon + state label ("Idle — hold space to talk", "Listening…", "Transcribing…", "GM speaking…").
- **Transcript pane:** scrollable list of `{ role, text }`, newest at bottom. Auto-scrolls. Distinct styling for `user` vs `gm`.
- **Interrupt button:** visible only while GM-speaking.

`VoiceSession` exposes a small reactive state (`status`, `transcript`) that the panel re-reads on each render. Panel re-renders on state-change events from the session.

### Settings

New world settings registered in `main.ts`:
- `openaiTtsModel` (default `tts-1`).
- `openaiTtsVoice` (default `alloy`).

Existing `openaiApiKey` covers Whisper and TTS too.

### Cost telemetry

`VoiceSession` keeps simple counters:
- `audioSecondsIn` (sum of recorded utterance durations).
- `ttsCharsOut` (sum of narration chars sent to TTS).
- Logged at session end (or on demand via a panel button) as `console.info`. Pricing math kept in a comment for sanity-checking, not displayed in UI.

## What's deferred

- Streaming TTS / sentence-by-sentence playback.
- Local Whisper (whisper.cpp via Node child process, or a WASM build). Seam is in place; impl later.
- Multiple voices, voice selection UI, voice cloning, ElevenLabs.
- VAD / noise gate / barge-in (interrupting the GM by talking over it).
- Voice in Prep mode.
- Realtime API.
- Persistent transcript across sessions (in-memory only for v1).

## Plan

- [x] 🤖 `src/voice/SpeechToTextProvider.ts` — interface (`transcribe(blob): Promise<string>`).
- [x] 🤖 `src/voice/WhisperSttProvider.ts` — Whisper API client using existing `openaiApiKey`.
- [x] 🤖 `src/voice/TextToSpeechProvider.ts` — interface (`synthesize(text): Promise<ArrayBuffer>`).
- [x] 🤖 `src/voice/OpenAITtsProvider.ts` — OpenAI tts-1 client.
- [x] 🤖 `src/voice/AudioPlayer.ts` — queued playback with `interrupt()`.
- [x] 🤖 `src/voice/PttController.ts` — `MediaRecorder` lifecycle, repeat-key suppression, mic stream release between utterances.
- [x] 🤖 `src/voice/VoiceSession.ts` — wires PTT → STT → dispatcher → TTS → player; exposes `{ status, transcript }`; counters.
- [x] 🤖 Register `openaiTtsModel` and `openaiTtsVoice` settings in `main.ts`.
- [x] 🤖 Register Foundry keybinding "Talk to Rhapsody" (default `Space`) wired to `PttController`.
- [x] 🤖 Instantiate `VoiceSession` in `main.ts` on `ready`.
- [x] 🤖 Panel template — voice section (status row, transcript pane, interrupt button).
- [x] 🤖 Panel CSS for voice section in `src/styles/rhapsody.css`.
- [x] 🤖 `RhapsodyApp` handlers — `interruptTts` action; subscribe to `VoiceSession` status changes to re-render.
- [x] 🤖 `npm run build` passes.
- [ ] 🧠 Smoke test via `chrome-devtools-mcp`:
  - `new_page` → Foundry world URL; `take_snapshot` to confirm Rhapsody panel renders the voice section.
  - `evaluate_script` to call `voiceSession.handleUtterance("open the door")` directly (bypasses mic perms which MCP can't grant). Assert: transcript pane shows the utterance, GM reply lands, console logs the cost telemetry line.
  - `list_console_messages` after the turn — assert no errors, expected `🎵` log lines present.
  - `evaluate_script` to call `voiceSession.interrupt()` mid-TTS; assert audio element is paused/cleared.
  - Assert `voiceSession.status` transitions through expected states (`idle → transcribing → gm-speaking → idle`).
- [ ] 🧠 Hands-on verify (cannot be automated): hold space and actually speak; confirm mic indicator behavior, aside-speech privacy, audible TTS playback.

## Notes

- 2026-05-03: services + main.ts wiring + panel section landed (claude-code). `npm run build` passes. Default PTT key is `Backquote` (the `Space` default would conflict with Foundry scene panning). Whisper duration estimation is best-effort via `<audio>` metadata (webm/opus container → may report Infinity in some browsers; falls back to 0). MCP smoke test + hands-on mic verify still outstanding.
- **Smoke testing convention.** Every spec from the north-star pivot forward includes a `chrome-devtools-mcp` smoke-test step in its plan. Spec acceptance is "build passes + MCP smoke test passes"; pure hands-on verification (mic, audible TTS, real asset libraries) is called out separately where it can't be automated. The MCP tools live behind the `chrome-devtools-mcp:chrome-devtools` skill.
- Foundry runs in a browser context — `MediaRecorder` and Web Audio are available without a polyfill.
- `Space` as default may conflict with Foundry's own bindings (it's used in some scenes). If so, fall back to a less-conflicting default like `Backquote` and document it. The user can rebind anyway via Foundry's UI.
- Keep `VoiceSession` UI-state reactive but trivial — no real state-management library; panel re-render is cheap.

## Open questions

- Should the PTT key release auto-submit, or require a brief gate to avoid premature cut-offs (last syllable clipped)? v1 = immediate submit; revisit if clipping is real.
- Mic permission UX — do we proactively request on `ready`, or lazily on first PTT press? v1 = lazy (first press). Less intrusive.
- Concurrent presses while GM is speaking — interrupt TTS automatically? v1 = yes, pressing PTT auto-interrupts in-flight TTS so the user can talk over the GM.
