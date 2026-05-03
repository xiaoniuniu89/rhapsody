import type { OpenAIClient } from "../../llm/OpenAIClient";
import type { Signal } from "./signals";
import { id as moduleId } from "../../../module.json";

export class Classifier {
  private client: OpenAIClient;

  constructor(client: OpenAIClient) {
    this.client = client;
  }

  async classify(transcript: string): Promise<Signal> {
    // @ts-ignore
    const model = game.settings.get(moduleId, "openaiClassifierModel") as string || "gpt-4o-mini";
    
    const response = await this.client.chat({
      model,
      messages: [
        {
          role: "system",
          content: "Classify the following player transcript from a solo RPG session into one of the following signals. Return 'none' if it doesn't fit or is just filler. Be precise about the entity if mentioned.",
        },
        { role: "user", content: transcript },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "signal_classifier",
          strict: true,
          schema: {
            type: "object",
            properties: {
              signal: {
                type: "string",
                enum: [
                  "intends_to_visit",
                  "suspects_npc",
                  "recalls_detail",
                  "plans_action",
                  "speculates_world",
                  "none",
                ],
              },
              entity: { type: "string" },
            },
            required: ["signal", "entity"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return { signal: "none" };

    try {
      return JSON.parse(content) as Signal;
    } catch (err) {
      console.error("🎵 Classifier: failed to parse structured output", err);
      return { signal: "none" };
    }
  }
}
