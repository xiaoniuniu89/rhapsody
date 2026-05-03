type CaptureListener = (blob: Blob) => void;
type ErrorListener = (err: Error) => void;

export class PttController {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private active = false;
  private captureListeners = new Set<CaptureListener>();
  private errorListeners = new Set<ErrorListener>();

  get isRecording(): boolean {
    return this.active;
  }

  onCapture(fn: CaptureListener): () => void {
    this.captureListeners.add(fn);
    return () => this.captureListeners.delete(fn);
  }

  onError(fn: ErrorListener): () => void {
    this.errorListeners.add(fn);
    return () => this.errorListeners.delete(fn);
  }

  async start(): Promise<void> {
    if (this.active) return;
    this.active = true;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        this.releaseStream();
        this.chunks = [];
        this.recorder = null;
        if (blob.size > 0) {
          this.captureListeners.forEach((fn) => fn(blob));
        }
      });
      this.recorder.start();
    } catch (err) {
      this.active = false;
      this.releaseStream();
      this.errorListeners.forEach((fn) => fn(err as Error));
    }
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.stop();
    } else {
      this.releaseStream();
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
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported?.(c)
    )
      return c;
  }
  return undefined;
}
