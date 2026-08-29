# Decision 0001: Custom Adapter Over Third-Party Library

## Status

Accepted

## Context

Creep needs multi-provider AI support (Gemini today; OpenAI and Anthropic planned). Several TypeScript libraries offer unified LLM interfaces (omni-llm, llm-bridge, llm-wrapper, AIKit). The extension already uses `@google/genai`, stores API keys client-side, and relies on Gemini-specific features (Google Search tool).

## Decision

Build a **custom two-layer adapter architecture** in `src/ai/` rather than adopting a third-party multi-LLM library.

## Rationale

- **Bundle size:** Chrome extensions benefit from minimal dependencies; adding a multi-provider lib plus optional SDKs increases bundle weight.
- **Gemini Search:** Native Google Search tool is Gemini-specific; universal libraries may not expose it cleanly.
- **BYOK pattern:** Token storage and error copy are extension-specific; custom auth layer is simpler.
- **Scope control:** Only 2–3 providers planned; custom adapters are ~100–200 lines each.
- **Existing investment:** `@google/genai` integration already works; extraction is lower risk than migration to a new abstraction.

Libraries remain useful as **reference for universal message shapes**, not as dependencies.

## Consequences

### Positive

- Full control over error messages, caching, and Gemini-specific tools
- Smaller bundle; no library upgrade churn
- Clear ownership boundaries (Layer 1 vs Layer 2)

### Negative

- Must implement OpenAI/Anthropic adapters manually in Phase 4
- Must maintain provider translation as SDKs evolve

### Follow-up

- Revisit if provider count exceeds ~5 or translation complexity grows significantly
- Consider llm-bridge-style IR only if adapter files become unwieldy

