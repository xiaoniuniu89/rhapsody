import type { SpeechToTextProvider } from "./SpeechToTextProvider";

export type PassiveCaptureListener = (blob: Blob, durationSec: number) => void;

export class PassiveCapture {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private active = false;
  private stt: SpeechToTextProvider;
  private onTranscript: (text: string, durationSec: number) => void;
  private interval: any = null;
  private readonly CHUNK_MS = 30000;

  constructor(
    stt: SpeechToTextProvider,
    onTranscript: (text: string, durationSec: number) => void,
  ) {
    this.stt = stt;
    this.onTranscript = onTranscript;
  }

  async start(): Promise<void> {
    if (this.active) return;
    this.active = true;
    await this.startNewChunk();
    this.interval = setInterval(() => void this.rotate(), this.CHUNK_MS);
  }

  stop(): void {
    this.active = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.stop();
    }
    this.releaseStream();
  }

  private async rotate(): Promise<void> {
    if (!this.active || !this.recorder) return;
    this.recorder.stop();
    await this.startNewChunk();
  }

  private async startNewChunk(): Promise<void> {
    if (!this.active) return;
    try {
      if (!this.stream || !this.stream.active) {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      this.chunks = [];
      const mime = pickMime();
      this.recorder = mime
        ? new MediaRecorder(this.stream, { mimeType: mime })
        : new MediaRecorder(this.stream);
      
      this.recorder.addEventListener("dataavailable", (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) this.chunks.push(ev.data);
      });

      this.recorder.addEventListener("stop", () => {
        const type = this.recorder?.mimeType || "audio/webm";
        const blob = new Blob(this.chunks, { type });
        if (blob.size > 0) {
          void this.processBlob(blob);
        }
      });

      this.recorder.start();
    } catch (err) {
      console.error("🎵 PassiveCapture: failed to start chunk", err);
      this.stop();
    }
  }

  private async processBlob(blob: Blob): Promise<void> {
    try {
      const result = await this.stt.transcribe(blob);
      if (result.text && result.text.trim()) {
        this.onTranscript(result.text.trim(), result.durationSec);
      }
    } catch (err) {
      console.warn("🎵 PassiveCapture: transcription failed", err);
    }
  }

  private releaseStream(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }
}

function pickMime(): string | undefined {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const c of candidates) {
    // @ts-ignore
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(c))
      return c;
  }
  return undefined;
}
