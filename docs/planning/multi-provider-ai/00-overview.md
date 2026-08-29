# Overview

## Problem

All AI logic currently lives in `src/api/gemini.ts`, which mixes three concerns:

1. **Provider transport** — Google GenAI SDK calls, streaming, `inlineData` attachments, Google Search tool
2. **Application logic** — system prompts, prompt builders (`buildSelectedTextPrompt`, etc.)
3. **Feature APIs** — `sendChatMessageStream`, `sendInlineQuestion`, `transcribeAudio`

Components (`ChatInterface`, `ExpandedSelectionPopup`) import Gemini-specific types, token helpers, and error mappers directly. Adding OpenAI or Anthropic would require duplicating feature logic or branching heavily inside one file.

Each provider uses different message formats, system prompt placement, streaming APIs, and attachment encodings. Without a unified contract, every new provider multiplies complexity in UI code.

## Desired Outcome

- **Layer 1 (Providers):** Thin, interchangeable adapters that translate a universal request format to/from each SDK. Each handles caching, token lifecycle, and provider-specific errors.
- **Layer 2 (AiService):** High-level feature methods (`streamChat`, `sendInlineQuestion`, `transcribeAudio`) that apply system prompts and prompt builders. This is the only import surface for components.
- **Model registry:** `modelId` resolves to a provider automatically; UI stays provider-blind.
- **Attachments:** Screenshots and audio work through a universal `ContentPart` union; adapters map to provider-native formats.
- **Future-ready:** OpenAI and Anthropic can be added one adapter at a time without touching components or prompt logic.

## Scope

- Define universal types (`Message`, `ContentPart`, `GenerateRequest`)
- Extract `GeminiProvider` from current `GeminiClient`
- Create `AiService` with existing feature parity
- Migrate `ChatInterface` and `ExpandedSelectionPopup` to `AiService`
- Extend model registry with `provider` and `capabilities`
- Generalize auth/token storage per provider
- Generalize error messages (`getReadableAiError`)
- Fix history duplication bug in chat streaming
- Document provider translation patterns for OpenAI and Anthropic (implementation in later phases)

## Non-Goals

- Implementing OpenAI or Anthropic adapters in Phase 1 (Gemini extraction only)
- Adding a backend proxy for API keys (BYOK via `localStorage` stays client-side)
- Tool calling / function calling beyond existing web search toggle
- Embeddings, image generation, or TTS
- Replacing the Gemini SDK with `fetch`-only calls
- Adopting a third-party multi-LLM library (see [Decision 0001](decisions/0001-custom-adapter-over-library.md))

## Agent Build Philosophy

- **Small, reviewable PRs** — one phase per PR where possible
- **Behavior parity first** — Phase 1 must not change user-visible behavior except bug fixes explicitly called out
- **Provider details never leak above Layer 1** — components and `AiService` use universal types only
- **Capability-driven UI** — disable screenshot/search/mic when the selected model lacks support
- **Docs as system of record** — this plan is the source of truth for sequencing and acceptance criteria
