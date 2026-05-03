import { id as moduleId } from "../../module.json";
import type { SpeechToTextProvider, SttResult } from "./SpeechToTextProvider";

export class WhisperSttProvider implements SpeechToTextProvider {
  async transcribe(blob: Blob): Promise<SttResult> {
    // @ts-ignore — foundry global
    const apiKey = game.settings.get(moduleId, "openaiApiKey") as string;
    if (!apiKey) throw new Error("Set your OpenAI API key in module settings.");

    const durationSec = await estimateDurationSec(blob);

    const form = new FormData();
    const filename = blob.type.includes("ogg")
      ? "utterance.ogg"
      : "utterance.webm";
    form.append("file", blob, filename);
    form.append("model", "whisper-1");
    form.append("response_format", "json");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Whisper request failed: ${res.status} ${detail}`);
    }

    const json = (await res.json()) as { text?: string };
    return { text: (json.text ?? "").trim(), durationSec };
  }
}

async function estimateDurationSec(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.src = url;
    const done = (sec: number) => {
      URL.revokeObjectURL(url);
      resolve(sec);
    };
    audio.addEventListener("loadedmetadata", () => {
      const d = audio.duration;
      done(Number.isFinite(d) ? d : 0);
    });
    audio.addEventListener("error", () => done(0));
    setTimeout(() => done(0), 2000);
  });
}
