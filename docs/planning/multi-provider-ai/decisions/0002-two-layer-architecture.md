# Decision 0002: Two-Layer Architecture (Provider + AiService)

## Status

Accepted

## Context

Current `gemini.ts` combines SDK calls, prompt logic, and feature methods. The user proposed:

1. **Layer 1:** Interchangeable provider clients (request, caching, errors)
2. **Layer 2:** Logic layer with system prompts and feature functions (`sendInlineQuestion`, etc.)

Components should only use Layer 2.

## Decision

Adopt exactly this two-layer split:

| Layer | Name | Responsibility |
|---|---|---|
| 1 | **Provider adapters** (`GeminiProvider`, etc.) | SDK translation, streaming, caching, provider errors |
| 2 | **AiService** | System prompts, prompt builders, feature APIs |

Shared **types** and **auth/errors** sit alongside providers as cross-cutting modules.

## Rationale

- Matches user's mental model and minimizes component churn
- Prompt logic is provider-agnostic — belongs above adapters
- Adapters stay thin and testable (input: `GenerateRequest`, output: text/stream)
- New Creep features (e.g. "summarize page") add one AiService method, not three provider copies

## Consequences

### Positive

- Components never import provider SDKs
- Adding a provider never touches `prompts.ts` or feature logic
- Clear file layout under `src/ai/`

### Negative

- AiService can become a god-object if too many unrelated features accumulate — mitigate by splitting into `ChatService` / `SelectionService` only if method count exceeds ~10

### Follow-up

- Export single `aiService` singleton from `@/ai` for simplicity
- Internal provider registry in `factory.ts`
