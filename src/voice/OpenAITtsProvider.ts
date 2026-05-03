import { id as moduleId } from "../../module.json";
import type { TextToSpeechProvider } from "./TextToSpeechProvider";

export class OpenAITtsProvider implements TextToSpeechProvider {
  async synthesize(text: string): Promise<ArrayBuffer> {
    // @ts-ignore — foundry global
    const apiKey = game.settings.get(moduleId, "openaiApiKey") as string;
    if (!apiKey) throw new Error("Set your OpenAI API key in module settings.");
    // @ts-ignore
    const model =
      // @ts-ignore
      (game.settings.get(moduleId, "openaiTtsModel") as string) || "tts-1";
    // @ts-ignore
    const voice =
      // @ts-ignore
      (game.settings.get(moduleId, "openaiTtsVoice") as string) || "alloy";

    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        voice,
        input: text,
        response_format: "mp3",
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`TTS request failed: ${res.status} ${detail}`);
    }

    return await res.arrayBuffer();
  }
}
