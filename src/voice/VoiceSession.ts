import type { MoveDispatcher } from "../engine/MoveDispatcher";
import type { SpeechToTextProvider } from "./SpeechToTextProvider";
import type { TextToSpeechProvider } from "./TextToSpeechProvider";
import type { AudioPlayer } from "./AudioPlayer";
import type { PttController } from "./PttController";
import type { AmbientBuffer } from "./AmbientBuffer";
import { PassiveCapture } from "./PassiveCapture";
import type { Classifier } from "../engine/listening/Classifier";
import type { EscalationRule } from "../engine/listening/EscalationRule";
import type { BackgroundGm } from "../engine/listening/BackgroundGm";
import type { PendingStagecraft } from "../engine/listening/PendingStagecraft";
import type { Session } from "../engine/session/Session";

export type VoiceStatus =
  | "idle"
  | "listening"
  | "transcribing"
  | "thinking"
  | "gm-speaking"
  | "muted"
  | "error";

export type MicState = "active" | "passive" | "mute";

export interface TranscriptEntry {
  role: "user" | "gm" | "system";
  text: string;
  movesTaken?: { name: string; ok: boolean }[];
  ts: number;
}

type Listener = () => void;

export class VoiceSession {
  status: VoiceStatus = "idle";
  micState: MicState = "mute";
  transcript: TranscriptEntry[] = [];
  
  // Telemetry
  audioSecondsIn = 0;
  ttsCharsOut = 0;
  passiveMinutes = 0;
  classifierCalls = 0;
  classifierCost = 0;
  backgroundTicks = 0;

  private listeners = new Set<Listener>();

  private ptt: PttController;
  private stt: SpeechToTextProvider;
  private tts: TextToSpeechProvider;
  private player: AudioPlayer;
  private dispatcher: MoveDispatcher;
  private ambient: AmbientBuffer;
  private classifier: Classifier;
  private escalation: EscalationRule;
  private backgroundGm: BackgroundGm;
  private pending: PendingStagecraft;
  private session: Session;
  private passiveCapture: PassiveCapture;

  constructor(
    ptt: PttController,
    stt: SpeechToTextProvider,
    tts: TextToSpeechProvider,
    player: AudioPlayer,
    dispatcher: MoveDispatcher,
    ambient: AmbientBuffer,
    classifier: Classifier,
    escalation: EscalationRule,
    backgroundGm: BackgroundGm,
    pending: PendingStagecraft,
    session: Session,
  ) {
    this.ptt = ptt;
    this.stt = stt;
    this.tts = tts;
    this.player = player;
    this.dispatcher = dispatcher;
    this.ambient = ambient;
    this.classifier = classifier;
    this.escalation = escalation;
    this.backgroundGm = backgroundGm;
    this.pending = pending;
    this.session = session;

    this.passiveCapture = new PassiveCapture(this.stt, (text, dur) => 
      void this.handlePassiveTranscript(text, dur)
    );

    this.ptt.onCapture((blob) => void this.handleAudio(blob));
    this.ptt.onError((err) =>
      this.appendSystem(`⚠️ Mic error: ${err.message}`),
    );
    this.player.onChange(() => {
      if (this.status === "gm-speaking" && !this.player.playing) {
        this.updateStatus();
      }
    });
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  get isInSession(): boolean {
    return this.session.state === "in-session";
  }

  async beginSession(): Promise<void> {
    if (this.isInSession) return;
    this.setStatus("thinking");
    try {
      const { narration } = await this.session.begin();
      this.transcript.push({
        role: "gm",
        text: narration,
        ts: Date.now(),
      });
      this.micState = "passive";
      await this.passiveCapture.start();
      this.notify();
      await this.speak(narration);
    } catch (err) {
      this.appendSystem(`⚠️ Session start failed: ${(err as Error).message}`);
      this.setStatus("error");
    }
  }

  async endSession(): Promise<void> {
    if (!this.isInSession) return;
    const log = this.transcript
      .map((e) => `<p><strong>${e.role}:</strong> ${e.text}</p>`)
      .join("\n");
    await this.session.end(log);
    this.passiveCapture.stop();
    this.micState = "mute";
    this.setStatus("idle");
    this.logCostTelemetry();
  }

  async startListening(): Promise<void> {
    if (!this.isInSession) return;
    if (this.player.playing) this.player.interrupt();
    this.micState = "active";
    this.setStatus("listening");
    await this.ptt.start();
    this.session.touch();
  }

  stopListening(): void {
    if (!this.ptt.isRecording) return;
    this.ptt.stop();
    this.setStatus("transcribing");
  }

  toggleMute(): void {
    if (this.micState === "mute") {
      this.micState = "passive";
      if (this.isInSession) void this.passiveCapture.start();
    } else {
      this.micState = "mute";
      this.passiveCapture.stop();
    }
    this.updateStatus();
    this.notify();
  }

  forget60s(): void {
    this.ambient.forget(60);
    this.appendSystem("Forgot last 60s of ambient buffer.");
  }

  interrupt(): void {
    this.player.interrupt();
    if (this.status === "gm-speaking") this.updateStatus();
  }

  async handleUtterance(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) {
      this.updateStatus();
      return;
    }
    this.session.touch();
    this.transcript.push({ role: "user", text: trimmed, ts: Date.now() });
    this.setStatus("thinking");
    try {
      const result = await this.dispatcher.runTurn(trimmed);
      
      // Drain pending stagecraft from background ticks
      const pendingMoves = this.pending.drain();
      if (pendingMoves.length > 0) {
        this.appendSystem(`Applying ${pendingMoves.length} background world changes...`);
        // In v1 we don't have a perfect way to re-run these through stagecraft service easily 
        // without mapping them. Let's do it.
        const { stagecraft } = await import("../main");
        for (const move of pendingMoves) {
          try {
            if (move.kind === "set_scene_map") await stagecraft.setSceneMap(move.args);
            else if (move.kind === "play_ambient") await stagecraft.playAmbient(move.args);
            else if (move.kind === "set_lighting") await stagecraft.setLighting(move.args.preset);
          } catch (e) {
            console.warn(`🎵 VoiceSession: failed to apply pending ${move.kind}`, e);
          }
        }
      }

      this.transcript.push({
        role: "gm",
        text: result.narration,
        movesTaken: result.movesTaken.map((m) => ({ name: m.name, ok: m.ok })),
        ts: Date.now(),
      });
      this.notify();
      await this.speak(result.narration);
    } catch (err) {
      this.appendSystem(`⚠️ GM turn failed: ${(err as Error).message}`);
      this.setStatus("error");
    }
  }

  logCostTelemetry(): void {
    const audioCostUsd = (this.audioSecondsIn / 60) * 0.006;
    const ttsCostUsd = (this.ttsCharsOut / 1_000_000) * 15;
    const totalEst = audioCostUsd + ttsCostUsd + this.classifierCost;
    
    console.info(
      `🎵 Rhapsody Session Telemetry:
- Audio In: ${this.audioSecondsIn.toFixed(1)}s (~$${audioCostUsd.toFixed(4)})
- TTS Out: ${this.ttsCharsOut} chars (~$${ttsCostUsd.toFixed(4)})
- Passive: ${this.passiveMinutes.toFixed(1)} min
- Classifier: ${this.classifierCalls} calls (~$${this.classifierCost.toFixed(4)})
- Background Ticks: ${this.backgroundTicks}
- Estimated Total Cost: ~$${totalEst.toFixed(4)}`
    );
  }

  private async handlePassiveTranscript(text: string, durationSec: number): Promise<void> {
    this.audioSecondsIn += durationSec;
    this.passiveMinutes += durationSec / 60;
    this.session.touch();

    const signal = await this.classifier.classify(text);
    this.classifierCalls++;
    this.classifierCost += 0.0001; // Rough est for gpt-4o-mini classification

    this.ambient.add(text, signal);

    if (this.escalation.process(signal)) {
      this.backgroundTicks++;
      const context = this.ambient.getRecentTranscript(180); // 3 mins
      const mutationCount = await this.backgroundGm.tick(signal, context);
      if (mutationCount > 0) {
        // Pulse/notify UI
        const entityName = signal.signal !== "none" ? signal.entity : "the world";
        this.appendSystem(`✨ The world shifts as you consider ${entityName}...`);
      }
    }
  }

  private async handleAudio(blob: Blob): Promise<void> {
    this.setStatus("transcribing");
    try {
      const result = await this.stt.transcribe(blob);
      this.audioSecondsIn += result.durationSec;
      if (!result.text) {
        this.micState = "passive";
        this.updateStatus();
        return;
      }
      await this.handleUtterance(result.text);
      this.micState = "passive";
    } catch (err) {
      this.appendSystem(`⚠️ Transcription failed: ${(err as Error).message}`);
      this.setStatus("error");
      this.micState = "passive";
    }
  }

  private async speak(text: string): Promise<void> {
    if (!text) {
      this.updateStatus();
      return;
    }
    this.setStatus("gm-speaking");
    try {
      this.ttsCharsOut += text.length;
      const buffer = await this.tts.synthesize(text);
      this.player.enqueue(buffer);
    } catch (err) {
      this.appendSystem(`⚠️ TTS failed: ${(err as Error).message}`);
      this.setStatus("error");
    }
  }

  private appendSystem(text: string): void {
    this.transcript.push({ role: "system", text, ts: Date.now() });
    this.notify();
  }

  private setStatus(s: VoiceStatus): void {
    if (this.status === s) return;
    this.status = s;
    this.notify();
  }

  private updateStatus(): void {
    if (this.player.playing) {
      this.setStatus("gm-speaking");
    } else if (this.micState === "mute") {
      this.setStatus("muted");
    } else if (this.session.state === "idle") {
      this.setStatus("idle");
    } else {
      this.setStatus("idle"); // This will be labelled "Listening" or "Passive" in UI context
    }
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }
}
