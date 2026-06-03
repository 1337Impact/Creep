# Requirements

## Functional Requirements

### Layer 1 — Provider Adapters

- Each provider implements a common `AiProvider` interface with `generate()` and `stream()` methods.
- Adapters accept a universal `GenerateRequest` (model, system prompt, messages, optional tools).
- Adapters translate `ContentPart` attachments (text, image, audio) to provider-native formats.
- Adapters manage SDK client lifecycle (lazy init, token change detection).
- Adapters support optional response caching for idempotent non-streaming calls.
- Adapters throw structured errors that Layer 2 can normalize into user-facing messages.
- A `ProviderFactory` resolves the correct adapter from a `modelId` via the model registry.

### Layer 2 — AiService

- Exposes high-level methods used by components:
  - `streamChat()` — streaming chat with system prompt, context, attachments
  - `sendInlineQuestion()` — selection popup Q&A with inline system prompt
  - `transcribeAudio()` — audio-to-text
  - `prepareChatPrompt()` — builds full/display prompts from user input + context
- Applies system instructions from `prompts.ts`; never duplicated in adapters.
- Assembles universal `Message[]` from history + new user turn + attachments.
- Routes requests to the correct provider based on `modelId`.

### Model & Auth

- Model registry entries include: `id`, `name`, `provider`, `capabilities`.
- Token storage is keyed per provider (`creep_gemini_api_token`, `creep_openai_api_token`, etc.).
- Settings UI supports entering tokens per provider (Phase 3).
- Env fallback remains supported for Gemini (`VITE_GEMINI_API_KEY`).

### Attachments

- **Screenshot (image):** PNG base64 passed as `{ type: "image", data, mimeType: "image/png" }`.
- **Audio:** WAV base64 passed as `{ type: "audio", data, mimeType: "audio/wav" }`.
- Adapters reject or no-op unsupported attachment types based on capabilities.

### Provider-Specific Features

- Gemini Google Search tool maps to universal `tools: [{ type: "web_search" }]`.
- UI disables web search toggle when selected model lacks `webSearch` capability.
- OpenAI/Anthropic web search deferred until those adapters are implemented.

## Non-Functional Requirements

| Area | Requirement |
|---|---|
| **Performance** | No regression in streaming latency; cache hits remain instant for inline Q&A and transcription |
| **Reliability** | Provider errors surface friendly messages; missing token blocks send with clear UI copy |
| **Security/privacy** | API keys stay in extension localStorage / env; never logged |
| **Maintainability** | New provider = one adapter file + registry entries; no component changes |
| **Bundle size** | No new heavy dependencies; optional peer SDKs added only when provider is implemented |
| **Observability** | `console.error` on provider failures (existing pattern); no new infra required |

## Acceptance Criteria

### Phase 1 (Gemini extraction)

- [ ] `ChatInterface` and `ExpandedSelectionPopup` import from `@/ai` (AiService), not `@/api/gemini`
- [ ] All existing chat, inline Q&A, and streaming behavior works unchanged
- [ ] `npm run typecheck` and `npm run build` pass
- [ ] History duplication bug in streaming is fixed (user message not sent twice)
- [ ] `src/api/gemini.ts` removed or reduced to a deprecated re-export shim

### Phase 2 (Types & registry)

- [ ] Universal `Message` type uses `assistant` role (not Gemini's `model`)
- [ ] Model registry includes `provider` and `capabilities` for all Gemini models
- [ ] `ChatTab.history` uses universal types

### Phase 3 (Multi-provider settings)

- [ ] Settings UI accepts tokens for at least Gemini (+ placeholder for others)
- [ ] Model picker shows models grouped or labeled by provider
- [ ] Capability toggles (search, screenshot, mic) respect selected model

### Phase 4+ (New providers)

- [ ] OpenAI adapter passes manual smoke test (chat + vision)
- [ ] Anthropic adapter passes manual smoke test (chat + vision)
- [ ] Audio transcription works on at least one provider per capability matrix

## Assumptions

- **BYOK remains client-side.** A backend proxy is out of scope; users paste API keys in settings.
- **Gemini stays the default provider** for Phase 1–3; OpenAI/Anthropic are additive.
- **Anthropic audio input is not native.** Transcription may route through Gemini or OpenAI Whisper when Anthropic is the chat provider.
- **Mic UI exists but transcription may not be wired in all flows yet.** `transcribeAudio` is preserved in AiService for when mic is connected.
