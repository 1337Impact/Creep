# Multi-Provider AI Client Architecture

## Purpose

Refactor Creep's AI handling from a single Gemini-coupled module into a two-layer architecture: interchangeable provider adapters (Gemini, OpenAI, Anthropic) and a high-level `AiService` that components consume. The goal is to support multiple models, attachments (screenshot, audio), and provider-specific features (e.g. Gemini web search) without leaking provider details into UI code.

## Document Map

- [Overview](00-overview.md)
- [Requirements](01-requirements.md)
- [Product Discussion](02-product-discussion.md)
- [Architecture Plan](03-architecture-plan.md)
- [Data and APIs](04-data-and-apis.md)
- [User Experience](05-user-experience.md)
- [Risks and Weak Points](06-risks-and-weak-points.md)
- [Execution Plan](07-execution-plan.md)
- [Validation Plan](08-validation-plan.md)
- [Open Questions](open-questions.md)

### Decisions

- [0001 — Custom adapter over third-party library](decisions/0001-custom-adapter-over-library.md)
- [0002 — Two-layer architecture (Provider + AiService)](decisions/0002-two-layer-architecture.md)

## Current Status

- **Status:** Ready for implementation
- **Owner/context:** Creep Chrome extension — AI refactor
- **Last updated:** 2026-06-03

## Quick Reference

```
Components  →  AiService (Layer 2)  →  ProviderFactory  →  GeminiProvider | OpenAIProvider | AnthropicProvider
                     ↑                           ↑
                 prompts.ts                  types.ts / errors.ts
```

**First implementation milestone:** Phase 1 — extract Gemini into adapter + AiService with zero behavior change.
