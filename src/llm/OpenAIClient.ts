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

  async embed(input: string | string[]): Promise<number[][]> {
    const client = this.getClient();
    const response = await client.embeddings.create({
      model: "text-embedding-3-small",
      input,
    });
    return response.data.map((d) => d.embedding);
  }

  async sendTurn(options: {
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
    tools?: OpenAI.Chat.Completions.ChatCompletionTool[];
  }): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const client = this.getClient();
    return await client.chat.completions.create({
      model: this.getModel(),
      max_tokens: 1024,
      messages: options.messages,
      tools: options.tools,
    });
  }
}
