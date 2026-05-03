export interface TextToSpeechProvider {
  synthesize(text: string): Promise<ArrayBuffer>;
}
