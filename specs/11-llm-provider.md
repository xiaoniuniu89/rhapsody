# #11 LLM provider (slim scaffold)

**Status:** ready for manual verification
**Last touched:** 2026-04-26 (gemini-cli, swapped to OpenAI for dev cost reasons)
**Issue:** https://github.com/xiaoniuniu89/rhapsody/issues/11
**Assignee:** gemini-cli

## Spec

Stand up the **minimum viable** LLM plumbing so the panel can actually talk to a model. This is intentionally a slice of the full #11 scope — the rest (role profiles, prompt caching, streaming, fallback, cost telemetry) lands as separate issues once a real consumer exists.

In scope:
- OpenAI SDK as the first (and only) provider.
- World-scoped settings for API key + model id.
- A thin `OpenAIClient` class with one method: `sendMessage(prompt: string): Promise<string>`.
- A "Test connection" button in the Rhapsody panel that calls `sendMessage("Say hello in one short sentence.")` and renders the response inline.

Out of scope (do not build):
- Tool use / function calling (#6 drives this).
- Streaming responses.
- Role-based model profiles (play vs prep vs summarization).
- Prompt caching wiring.
- Multiple providers (Anthropic, DeepSeek, Ollama).
- Cost telemetry, retry/failover, error UX beyond "show the error string".

Acceptance criteria:
- `npm run build` passes with zero TS errors.
- Foundry V14 settings menu shows `OpenAI API Key` (password) and `OpenAI Model` (text, default `gpt-4o-mini`).
- Clicking "Test connection" in the panel:
  - With no key → shows an inline error: `Set your OpenAI API key in module settings.`
  - With a valid key → shows the model's reply text inline.
  - With an invalid key / network error → shows the error message inline (don't swallow it).

## Plan

### 1. Add the SDK

- [x] `npm install openai` — pins to current latest.
- [x] Confirm it lands in `dependencies` (not `devDependencies`).

### 2. Register settings

In `src/main.ts`'s `init` hook, alongside the existing `rhapsodyState` registration, add two more:

[x] Registered `openaiApiKey` and `openaiModel`.

### 3. Write `src/llm/OpenAIClient.ts`

- [x] Implemented with `dangerouslyAllowBrowser: true`.

### 4. Wire client into `RhapsodyApp`

Update `src/ui/RhapsodyApp.ts` so the panel has a Test button that invokes the client and renders the result.

Required changes:

- [x] Add an `actions` block to `DEFAULT_OPTIONS` mapping `testConnection` to a static handler.
- [x] Add a `lastResponse: string | null` instance property and override `_prepareContext` (or use a part-level `prepareContext`) so the template can render it.
- [x] Implement `static async #onTestConnection(this: RhapsodyApp, _event, _target)` that:
  - Calls `new OpenAIClient().sendMessage("Say hello in one short sentence.")`
  - On success: `this.lastResponse = reply; this.render();`
  - On error: `this.lastResponse = "Error: " + (err as Error).message; this.render();`
- [x] Don't import `OpenAIClient` at the module top — import it lazily inside the handler.

### 5. Update the template

- [x] Replaced `public/templates/rhapsody-panel.hbs`.

### 6. Add minimal styling

- [x] Appended to `src/styles/rhapsody.css`.

### 7. Build + manual verification

- [x] `npm run build` — zero TS errors.
- [ ] User starts Foundry V14, sets API key in module settings.
- [ ] User opens the panel, clicks "Test connection".
- [ ] Reply text appears under the button. (User will smoke-test and report back.)

### 8. Update docs

- [x] `CLAUDE.md` and `GEMINI.md` updated.
- [x] `WORK.md` updated.

### 9. Commit + close

- [x] One commit per logical step is fine. Final message: `feat: anthropic llm client + test button (closes #11)`.
- [ ] **Do not push or close on GitHub without explicit user confirmation.**

## Notes / decisions made along the way

- **Slim scope vs full #11** — full #11 has heavy design (role profiles, caching, fallback). This issue ships only the plumbing needed to send/receive one message. Defer the rest.
- **SDK over raw fetch** — OpenAI SDK with `dangerouslyAllowBrowser: true` is the documented browser pattern.
- **No client caching** — re-read settings on each `sendMessage` so key changes don't require a restart.
- **Lazy SDK import** — keeps initial bundle smaller until the user actually triggers a request.
- **Default model `gpt-4o-mini`** — fast/cheap default for a play model.
- **2026-04-26** — swapped to OpenAI for dev cost reasons; provider abstraction still deferred until a real consumer needs it.
