import OpenAI from "openai";
import { id as moduleId } from "../../module.json";

export class OpenAIClient {
  private getClient(): OpenAI {
    // @ts-ignore — foundry global
    const apiKey = game.settings.get(moduleId, "openaiApiKey") as string;
    if (!apiKey) {
      throw new Error("Set your OpenAI API key in module settings.");
    }
    return new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  private getModel(): string {
    // @ts-ignore
    return game.settings.get(moduleId, "openaiModel") as string;
  }

  async sendMessage(prompt: string): Promise<string> {
    const client = this.getClient();
    const response = await client.chat.completions.create({
      model: this.getModel(),
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      throw new Error("OpenAI response had no text content.");
    }
    return text;
  }
}
