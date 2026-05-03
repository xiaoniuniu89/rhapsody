// src/engine/MoveDispatcher.ts
import type { MoveRegistry } from "./moves/registry";
import type { OpenAIClient } from "../llm/OpenAIClient";
import type { SceneContractService } from "./contract/SceneContractService";
import type { RulesIndexService } from "./rules/RulesIndexService";
import type OpenAI from "openai";

export interface TurnResult {
  narration: string;
  movesTaken: { name: string; args: any; log: string; ok: boolean }[];
}

export class MoveDispatcher {
  private registry: MoveRegistry;
  private client: OpenAIClient;
  private contractService: SceneContractService;
  private rulesIndex: RulesIndexService;

  constructor(
    registry: MoveRegistry,
    client: OpenAIClient,
    contractService: SceneContractService,
    rulesIndex: RulesIndexService,
  ) {
    this.registry = registry;
    this.client = client;
    this.contractService = contractService;
    this.rulesIndex = rulesIndex;
  }

  async runTurn(playerMessage: string): Promise<TurnResult> {
    const activeContract = this.contractService.active();
    const rulesStatus = this.rulesIndex.status();

    const systemPrompt = [
      "You are an expert Game Master. Use the provided tools to retrieve world information, log events, and resolve actions. Narrate the result to the player.",
      "\nWorld state mutations (clocks, NPC dispositions) must go through advance_clock, set_clock, shift_disposition. Call read_state first to inspect existing entries so you advance/shift instead of creating duplicates. Do not invent state in narration — use these moves so changes persist.",
    ];

    if (rulesStatus && rulesStatus.chunkCount > 0) {
      systemPrompt.push(
        "\nWhen you cite a rule in your narration, include the citation string from the tool result verbatim. Foundry will render it as a clickable link.",
      );
    }

    if (activeContract) {
      const { contract } = activeContract;
      systemPrompt.push("\n### ACTIVE SCENE CONTRACT");
      systemPrompt.push(`Goal/Question: ${contract.question}`);
      if (contract.onOffer.length > 0) {
        systemPrompt.push("Information/Clues available to reveal:");
        contract.onOffer.forEach((c) =>
          systemPrompt.push(`- ${c.text} (id: ${c.id})`),
        );
      }
      if (contract.hidden.length > 0) {
        systemPrompt.push("STRICTLY HIDDEN (Do NOT reveal these yet):");
        contract.hidden.forEach((h) => systemPrompt.push(`- ${h}`));
      }
      if (contract.exits.length > 0) {
        systemPrompt.push("Available scene exits:");
        contract.exits.forEach((e) => systemPrompt.push(`- ${e}`));
      }
      systemPrompt.push("### END CONTRACT");
    }

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: systemPrompt.join("\n"),
      },
      { role: "user", content: playerMessage },
    ];

    const tools = this.registry.toolSchemas();
    const movesTaken: TurnResult["movesTaken"] = [];
    let narration = "";
    const MAX_STEPS = 4;

    const context = {
      contract: {
        active: activeContract?.contract ?? null,
        sceneId: activeContract?.sceneId ?? null,
        recordProgress: async (patch: any) => {
          if (activeContract) {
            await this.contractService.recordProgress(
              activeContract.sceneId,
              patch,
            );
            // Update local context for subsequent tool calls in the same turn
            const updated = this.contractService.read(activeContract.sceneId);
            if (updated) context.contract.active = updated;
          }
        },
      },
    };

    for (let step = 0; step < MAX_STEPS; step++) {
      const response = await this.client.sendTurn({ messages, tools });
      const message = response.choices[0]?.message;

      if (!message) {
        throw new Error("No message in OpenAI response.");
      }

      // Add assistant message to history for potential next loop
      messages.push({
        ...message,
        content: message.content || "",
      });

      if (message.content) {
        narration = message.content;

        // Hidden leak detection
        if (activeContract && activeContract.contract.hidden.length > 0) {
          const lowerNarration = narration.toLowerCase();
          const leaks = activeContract.contract.hidden.filter((h) =>
            lowerNarration.includes(h.toLowerCase()),
          );
          if (leaks.length > 0) {
            console.warn(
              "🎵 Rhapsody: Hidden leak detected in narration!",
              leaks,
            );
            await this.contractService.recordProgress(activeContract.sceneId, {
              hiddenLeaks: [
                ...(context.contract.active?.progress.hiddenLeaks || []),
                ...leaks,
              ],
            });
          }
        }
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
              const result = await move.handler(args, context);
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
            content: JSON.stringify(resultData ?? { ok, log }),
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
