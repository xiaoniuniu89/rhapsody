type Listener = () => void;

export class AudioPlayer {
  private queue: ArrayBuffer[] = [];
  private currentUrl: string | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private listeners = new Set<Listener>();
  private _playing = false;

  get playing(): boolean {
    return this._playing;
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  enqueue(buffer: ArrayBuffer): void {
    this.queue.push(buffer);
    if (!this._playing) void this.playNext();
  }

  interrupt(): void {
    this.queue = [];
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.src = "";
    }
    this.releaseCurrentUrl();
    this.currentAudio = null;
    this.setPlaying(false);
  }

  private async playNext(): Promise<void> {
    const next = this.queue.shift();
    if (!next) {
      this.setPlaying(false);
      return;
    }
    this.setPlaying(true);
    this.releaseCurrentUrl();
    const blob = new Blob([next], { type: "audio/mpeg" });
    this.currentUrl = URL.createObjectURL(blob);
    const audio = new Audio(this.currentUrl);
    this.currentAudio = audio;
    audio.addEventListener("ended", () => {
      this.releaseCurrentUrl();
      this.currentAudio = null;
      void this.playNext();
    });
    audio.addEventListener("error", () => {
      this.releaseCurrentUrl();
      this.currentAudio = null;
      void this.playNext();
    });
    try {
      await audio.play();
    } catch (err) {
      console.warn("🎵 Rhapsody audio play failed", err);
      this.releaseCurrentUrl();
      this.currentAudio = null;
      void this.playNext();
    }
  }

  private releaseCurrentUrl(): void {
    if (this.currentUrl) {
      URL.revokeObjectURL(this.currentUrl);
      this.currentUrl = null;
    }
  }

  private setPlaying(v: boolean): void {
    if (this._playing === v) return;
    this._playing = v;
    this.listeners.forEach((fn) => fn());
  }
}
