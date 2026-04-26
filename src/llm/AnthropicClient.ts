import Anthropic from "@anthropic-ai/sdk";
import { id as moduleId } from "../../module.json";

export class AnthropicClient {
  private getClient(): Anthropic {
    // @ts-ignore — foundry global
    const apiKey = game.settings.get(moduleId, "anthropicApiKey") as string;
    if (!apiKey) {
      throw new Error("Set your Anthropic API key in module settings.");
    }
    return new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  private getModel(): string {
    // @ts-ignore
    return game.settings.get(moduleId, "anthropicModel") as string;
  }

  async sendMessage(prompt: string): Promise<string> {
    const client = this.getClient();
    const response = await client.messages.create({
      model: this.getModel(),
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      throw new Error("Anthropic response had no text content.");
    }
    return block.text;
  }
}
