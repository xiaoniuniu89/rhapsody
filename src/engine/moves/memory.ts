// src/engine/moves/memory.ts
import type { MoveRegistry } from "./registry";
import type { MemoryService } from "../../memory/MemoryService";

export function registerMemoryMoves(registry: MoveRegistry, memory: MemoryService) {
  registry.register({
    schema: {
      name: "list_pages",
      description: "List the names of all wiki pages in a scope (bible or journal).",
      parameters: {
        type: "object",
        properties: {
          scope: { type: "string", enum: ["bible", "journal"] }
        },
        required: ["scope"]
      }
    },
    handler: async (args, _context) => {
      const pages = memory.listPages(args.scope);
      return {
        ok: true,
        data: pages.map(p => p.name),
        log: `Listed ${args.scope} pages`
      };
    }
  });

  registry.register({
    schema: {
      name: "read_page",
      description: "Read the content of a specific wiki page by name.",
      parameters: {
        type: "object",
        properties: {
          scope: { type: "string", enum: ["bible", "journal"] },
          name: { type: "string" }
        },
        required: ["scope", "name"]
      }
    },
    handler: async (args, _context) => {
      const page = memory.readPage(args.scope, args.name);
      if (!page) {
        return { ok: false, log: `Page not found: ${args.name} in ${args.scope}` };
      }
      return {
        ok: true,
        data: {
          public: page.public,
          private: page.private
        },
        log: `Read page: ${args.name}`
      };
    }
  });

  registry.register({
    schema: {
      name: "write_page",
      description: "Create or replace a wiki page with new content. Journal scope cannot have private content.",
      parameters: {
        type: "object",
        properties: {
          scope: { type: "string", enum: ["bible", "journal"] },
          name: { type: "string" },
          public: { type: "string", description: "Publicly known facts or events." },
          private: { type: "string", description: "GM-only secrets or hidden motivations (Bible only)." }
        },
        required: ["scope", "name", "public"]
      }
    },
    handler: async (args, _context) => {
      try {
        await memory.writePage(args.scope, args.name, {
          public: args.public,
          private: args.private
        });
        return {
          ok: true,
          log: `Wrote page: ${args.name} (${args.scope})`
        };
      } catch (err) {
        return { ok: false, log: (err as Error).message };
      }
    }
  });

  registry.register({
    schema: {
      name: "append_page",
      description: "Append HTML content to the public section of an existing wiki page.",
      parameters: {
        type: "object",
        properties: {
          scope: { type: "string", enum: ["bible", "journal"] },
          name: { type: "string" },
          html: { type: "string", description: "The HTML content to append." }
        },
        required: ["scope", "name", "html"]
      }
    },
    handler: async (args, _context) => {
      try {
        await memory.appendPage(args.scope, args.name, "Public", args.html);
        return {
          ok: true,
          log: `Appended to page: ${args.name} (${args.scope})`
        };
      } catch (err) {
        return { ok: false, log: (err as Error).message };
      }
    }
  });
}
