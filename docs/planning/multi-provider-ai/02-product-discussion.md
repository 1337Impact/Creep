# Product Discussion

## User Stories

- As a **Creep user**, I want to choose different AI models, so that I can balance speed, quality, and cost.
- As a **Creep user**, I want to attach screenshots to my questions, so that the AI can analyze what I see on the page.
- As a **Creep user**, I want to use voice input (future), so that I can ask questions without typing.
- As a **Creep user**, I want to use my preferred provider's API key, so that I control billing and data.
- As a **developer**, I want to add a new provider without touching UI components, so that maintenance stays cheap.

## Key Flows

### 1. Streaming chat (ChatInterface)

- **Entry point:** User types in prompt box and sends (optionally with search, page content, screenshot).
- **Main path:**
  1. Component calls `aiService.prepareChatPrompt()` for display text
  2. Component captures screenshot if requested
  3. Component calls `aiService.streamChat({ history, message, attachments, modelId, enableSearch })`
  4. AiService applies `SYSTEM_INSTRUCTION`, assembles messages, routes to provider
  5. Provider streams chunks; component updates tab messages incrementally
  6. On completion, history is updated with assistant response
- **Edge cases:**
  - Missing API token → show settings message, do not call provider
  - Provider error → friendly message via `getReadableAiError`
  - Model lacks vision → screenshot ignored or UI disabled upfront
  - Model lacks web search → search toggle disabled
- **Success state:** User sees streamed markdown response; history persisted in tab.

### 2. Inline selection Q&A (ExpandedSelectionPopup)

- **Entry point:** User selects text, opens expanded popup, asks a question.
- **Main path:**
  1. Component calls `aiService.sendInlineQuestion(selectedText, question, { modelId, enableSearch })`
  2. AiService builds prompt via `buildInlineQuestionPrompt`, applies `INLINE_SYSTEM_INSTRUCTION`
  3. Provider `generate()` returns full response (cached on repeat)
- **Edge cases:** Same token/error handling as chat.
- **Success state:** Concise answer rendered in popup.

### 3. Audio transcription (future / mic button)

- **Entry point:** User records audio via mic in prompt box.
- **Main path:** Component calls `aiService.transcribeAudio(base64, modelId)` → text inserted into input.
- **Edge cases:** Model/provider without `audioInput` → disable mic or fallback model.
- **Success state:** Transcribed text appears in prompt input.

## Idea Expansion

The user's proposed layering maps cleanly to product surfaces:

| Layer | Product responsibility |
|---|---|
| **Provider adapter** | "How do we talk to Gemini/OpenAI/Anthropic?" |
| **AiService** | "What does Creep ask the AI to do?" (chat, inline Q, transcribe) |
| **Components** | "When does the user trigger each feature?" |

Model selection in the tab bar becomes provider-aware: picking `gpt-4o` implicitly uses OpenAI; picking `models/gemini-2.5-flash` uses Gemini. No separate "provider picker" is required unless we want one in settings.

## Tradeoffs

### Custom adapters vs third-party library (omni-llm, llm-bridge)

| | Custom | Library |
|---|---|---|
| **Benefits** | Full control, smaller bundle, native Gemini Search support, matches existing SDK | Faster multi-provider bootstrap, battle-tested message translation |
| **Costs** | Must implement each provider adapter | Extra dependency, may not support Gemini Search, harder to customize errors |
| **Recommendation** | **Custom** — see [Decision 0001](decisions/0001-custom-adapter-over-library.md) |

### Universal `assistant` role vs keep Gemini `model`

| | Universal `assistant` | Keep `model` |
|---|---|---|
| **Benefits** | Industry-standard, maps cleanly to OpenAI/Anthropic | No migration of history shape |
| **Costs** | One-time migration of `ChatTab.history` and state helpers | Leaks Gemini naming into OpenAI/Anthropic adapters |
| **Recommendation** | **Universal `assistant`** in Phase 2 with mapper at persistence boundary if needed |

### Capability flags vs runtime errors

| | Capability flags in UI | Send and fail at provider |
|---|---|---|
| **Benefits** | Better UX — disabled buttons explain limits | Simpler UI code |
| **Costs** | Registry must stay accurate | Confusing errors for users |
| **Recommendation** | **Capability flags** — disable toggles when unsupported |
