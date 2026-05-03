export interface SttResult {
  text: string;
  durationSec: number;
}

export interface SpeechToTextProvider {
  transcribe(blob: Blob): Promise<SttResult>;
}
