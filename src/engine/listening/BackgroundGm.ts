import type { OpenAIClient } from "../../llm/OpenAIClient";
import type { MemoryService } from "../../memory/MemoryService";
import type { WorldStateService } from "../state/WorldStateService";
import type { PendingStagecraft } from "./PendingStagecraft";
import type { Signal } from "./signals";
import { id as moduleId } from "../../../module.json";
import type OpenAI from "openai";

export class BackgroundGm {
  private client: OpenAIClient;
  private memory: MemoryService;
  private state: WorldStateService;
  private pending: PendingStagecraft;

  constructor(
    client: OpenAIClient,
    memory: MemoryService,
    state: WorldStateService,
    pending: PendingStagecraft,
  ) {
    this.client = client;
    this.memory = memory;
    this.state = state;
    this.pending = pending;
  }

  async tick(signal: Signal, ambientContext: string): Promise<number> {
    // @ts-ignore
    const model = game.settings.get(moduleId, "openaiModel") as string;
    const snap = this.state.snapshot();

    const entityName = signal.signal !== "none" ? signal.entity : "the world";
    const systemPrompt = `You are the GM thinking between scenes. The player has been talking about ${entityName} (${signal.signal}).
Decide if this changes anything in the world.
If yes, use the provided tools to mutate world state (clocks, dispositions), update the wiki (memory), or queue stagecraft (map, audio, lighting).

IMPORTANT:
- Do NOT produce narration. Return ONLY tool calls.
- If nothing meaningful changes, return no tool calls.
- Stagecraft calls (set_scene_map, play_ambient, set_lighting) will be queued and applied when the player next speaks to you.

Current World State:
${JSON.stringify(snap, null, 2)}

Recent Ambient Context:
"${ambientContext}"`;

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ];

    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
      // Memory
      {
        type: "function",
        function: {
          name: "write_page",
          description: "Upsert a wiki page.",
          parameters: {
            type: "object",
            properties: {
              scope: { type: "string", enum: ["bible", "journal"] },
              name: { type: "string" },
              public: { type: "string" },
              private: { type: "string" },
            },
            required: ["scope", "name", "public"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "append_page",
          description: "Append HTML to a wiki page.",
          parameters: {
            type: "object",
            properties: {
              scope: { type: "string", enum: ["bible", "journal"] },
              name: { type: "string" },
              html: { type: "string" },
            },
            required: ["scope", "name", "html"],
          },
        },
      },
      // State
      {
        type: "function",
        function: {
          name: "advance_clock",
          description: "Advance a clock.",
          parameters: {
            type: "object",
            properties: {
              clockName: { type: "string" },
              segments: { type: "number" },
              reason: { type: "string" },
            },
            required: ["clockName"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "shift_disposition",
          description: "Shift NPC disposition.",
          parameters: {
            type: "object",
            properties: {
              npc: { type: "string" },
              delta: { type: "number" },
              reason: { type: "string" },
            },
            required: ["npc", "delta"],
          },
        },
      },
      // Stagecraft (Queued)
      {
        type: "function",
        function: {
          name: "set_scene_map",
          description: "Queue a map change.",
          parameters: {
            type: "object",
            properties: { query: { type: "string" }, sceneId: { type: "string" } },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "play_ambient",
          description: "Queue an ambient track.",
          parameters: {
            type: "object",
            properties: { query: { type: "string" }, trackId: { type: "string" } },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "set_lighting",
          description: "Queue a lighting change.",
          parameters: {
            type: "object",
            properties: {
              preset: { type: "string", enum: ["day", "dusk", "night", "torchlit", "dark"] },
            },
            required: ["preset"],
          },
        },
      },
    ];

    const response = await this.client.chat({ messages, tools, model });
    const message = response.choices[0]?.message;

    if (message?.tool_calls) {
      for (const call of message.tool_calls) {
        if (call.type !== "function") continue;
        const name = call.function.name;
        const args = JSON.parse(call.function.arguments);

        try {
          switch (name) {
            case "write_page":
              await this.memory.writePage(args.scope, args.name, {
                public: args.public,
                private: args.private,
              });
              break;
            case "append_page":
              await this.memory.appendPage(args.scope, args.name, "Public", args.html);
              break;
            case "advance_clock":
              await this.state.advanceClock(args.clockName, args.segments, args.reason);
              break;
            case "shift_disposition":
              await this.state.shiftDisposition(args.npc, args.delta, args.reason);
              break;
            case "set_scene_map":
            case "play_ambient":
            case "set_lighting":
              this.pending.enqueue(name, args);
              break;
          }
        } catch (err) {
          console.error(`🎵 BackgroundGm: tool ${name} failed`, err);
        }
      }
      return message.tool_calls.length;
    }

    return 0;
  }
}
