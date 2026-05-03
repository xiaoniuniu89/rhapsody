import type { MoveDispatcher } from "../engine/MoveDispatcher";
import type { SpeechToTextProvider } from "./SpeechToTextProvider";
import type { TextToSpeechProvider } from "./TextToSpeechProvider";
import type { AudioPlayer } from "./AudioPlayer";
import type { PttController } from "./PttController";
import { getMode } from "../engine/mode";

export type VoiceStatus =
  | "idle"
  | "listening"
  | "transcribing"
  | "thinking"
  | "gm-speaking"
  | "error";

export interface TranscriptEntry {
  role: "user" | "gm" | "system";
  text: string;
  movesTaken?: { name: string; ok: boolean }[];
  ts: number;
}

type Listener = () => void;

export class VoiceSession {
  status: VoiceStatus = "idle";
  transcript: TranscriptEntry[] = [];
  audioSecondsIn = 0;
  ttsCharsOut = 0;

  private listeners = new Set<Listener>();

  private ptt: PttController;
  private stt: SpeechToTextProvider;
  private tts: TextToSpeechProvider;
  private player: AudioPlayer;
  private dispatcher: MoveDispatcher;

  constructor(
    ptt: PttController,
    stt: SpeechToTextProvider,
    tts: TextToSpeechProvider,
    player: AudioPlayer,
    dispatcher: MoveDispatcher,
  ) {
    this.ptt = ptt;
    this.stt = stt;
    this.tts = tts;
    this.player = player;
    this.dispatcher = dispatcher;
    this.ptt.onCapture((blob) => void this.handleAudio(blob));
    this.ptt.onError((err) =>
      this.appendSystem(`⚠️ Mic error: ${err.message}`),
    );
    this.player.onChange(() => {
      if (this.status === "gm-speaking" && !this.player.playing) {
        this.setStatus("idle");
      }
    });
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  async startListening(): Promise<void> {
    if (getMode() === "prep") return;
    if (this.player.playing) this.player.interrupt();
    this.setStatus("listening");
    await this.ptt.start();
  }

  stopListening(): void {
    if (!this.ptt.isRecording) return;
    this.ptt.stop();
    this.setStatus("transcribing");
  }

  interrupt(): void {
    this.player.interrupt();
    if (this.status === "gm-speaking") this.setStatus("idle");
  }

  async handleUtterance(text: string): Promise<void> {
    if (getMode() === "prep") return;
    const trimmed = text.trim();
    if (!trimmed) return;
    this.transcript.push({ role: "user", text: trimmed, ts: Date.now() });
    this.setStatus("thinking");
    try {
      const result = await this.dispatcher.runTurn(trimmed);
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
    console.info(
      `🎵 Rhapsody voice telemetry — audio in: ${this.audioSecondsIn.toFixed(1)}s (~$${audioCostUsd.toFixed(4)} whisper), tts out: ${this.ttsCharsOut} chars (~$${ttsCostUsd.toFixed(4)} tts-1)`,
    );
  }

  private async handleAudio(blob: Blob): Promise<void> {
    this.setStatus("transcribing");
    try {
      const result = await this.stt.transcribe(blob);
      this.audioSecondsIn += result.durationSec;
      if (!result.text) {
        this.setStatus("idle");
        return;
      }
      await this.handleUtterance(result.text);
    } catch (err) {
      this.appendSystem(`⚠️ Transcription failed: ${(err as Error).message}`);
      this.setStatus("error");
    }
  }

  private async speak(text: string): Promise<void> {
    if (!text) {
      this.setStatus("idle");
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

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }
}
