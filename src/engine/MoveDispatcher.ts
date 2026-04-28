// src/engine/MoveDispatcher.ts
import type { MoveRegistry } from "./moves/registry";
import type { OpenAIClient } from "../llm/OpenAIClient";
import type OpenAI from "openai";

export interface TurnResult {
  narration: string;
  movesTaken: { name: string; args: any; log: string; ok: boolean }[];
}

export class MoveDispatcher {
  private registry: MoveRegistry;
  private client: OpenAIClient;

  constructor(registry: MoveRegistry, client: OpenAIClient) {
    this.registry = registry;
    this.client = client;
  }

  async runTurn(playerMessage: string): Promise<TurnResult> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: "You are an expert Game Master. Use the provided tools to retrieve world information, log events, and resolve actions. Narrate the result to the player."
      },
      { role: "user", content: playerMessage }
    ];

    const tools = this.registry.toolSchemas();
    const movesTaken: TurnResult["movesTaken"] = [];
    let narration = "";
    const MAX_STEPS = 4;

    for (let step = 0; step < MAX_STEPS; step++) {
      const response = await this.client.sendTurn({ messages, tools });
      const message = response.choices[0]?.message;

      if (!message) {
        throw new Error("No message in OpenAI response.");
      }

      // Add assistant message to history for potential next loop
      messages.push({
        ...message,
        content: message.content || ""
      });

      if (message.content) {
        narration = message.content;
      }

      if (message.tool_calls && message.tool_calls.length > 0) {
        for (const toolCall of message.tool_calls) {
          // @ts-ignore
          const functionName = toolCall.function?.name;
          // @ts-ignore
          const functionArgs = toolCall.function?.arguments;

          if (!functionName) continue;

          const move = this.registry.get(functionName);
          let resultData: any;
          let ok = false;
          let log = "";

          if (move) {
            try {
              const args = JSON.parse(functionArgs || "{}");
              const result = await move.handler(args);
              resultData = result.data;
              ok = result.ok;
              log = result.log;
              movesTaken.push({ name: move.schema.name, args, log, ok });
            } catch (err) {
              ok = false;
              log = `Error in ${functionName}: ${(err as Error).message}`;
              resultData = { error: log };
              movesTaken.push({ name: functionName, args: {}, log, ok });
            }
          } else {
            ok = false;
            log = `Unknown move: ${functionName}`;
            resultData = { error: log };
            movesTaken.push({ name: functionName, args: {}, log, ok });
          }

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(resultData ?? { ok, log })
          });
        }
        // Continue loop to give model a chance to respond to tool results
        continue;
      }

      // No tool calls, we're done
      break;
    }

    if (!narration && movesTaken.length > 0) {
      narration = "(The GM performed actions but provided no narration.)";
    }

    return { narration, movesTaken };
  }
}
