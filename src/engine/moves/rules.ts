import type { MoveRegistry } from "./registry";
import type { RulesIndexService } from "../rules/RulesIndexService";

export function registerRulesMoves(
  registry: MoveRegistry,
  rulesIndex: RulesIndexService,
) {
  registry.register({
    schema: {
      name: "query_rules",
      description:
        "Retrieve relevant rules excerpts from indexed compendia. Use this whenever the user asks how a rule works or you need to resolve an action mechanically.",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "The specific rules question to answer.",
          },
          k: {
            type: "number",
            default: 5,
            description: "Number of excerpts to retrieve.",
          },
        },
        required: ["question"],
      },
    },
    handler: async (args: { question: string; k?: number }) => {
      const hits = await rulesIndex.query(args.question, args.k || 5);

      const status = rulesIndex.status();
      if (!status || status.chunkCount === 0) {
        return {
          ok: true,
          log: `query_rules: "${args.question}" → No index available.`,
          data: {
            chunks: [],
            note: "No rules packs are configured or indexed. Advise the user to select and index rules packs in the Rhapsody panel.",
          },
        };
      }

      return {
        ok: true,
        log: `query_rules: "${args.question}" → ${hits.length} hits`,
        data: {
          chunks: hits.map((h) => ({
            excerpt: h.chunk.text,
            citation: `@UUID[${h.chunk.entryUuid}.JournalEntryPage.${h.chunk.pageId}]{${h.chunk.entryName} › ${h.chunk.headingPath.join(" › ") || h.chunk.pageName}}`,
            similarity: h.similarity,
          })),
        },
      };
    },
  });
}
