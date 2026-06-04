# Overview

## Problem

Chat-only Creep can read page context but cannot **act** on the page (click, fill forms, navigate flows). Users need an agent that completes multi-step tasks in the same logged-in browser session.

## Desired Outcome

- User gives a **task**; the agent loops: LLM turn → tool calls → tool results → repeat until `complete_task` or limits hit.
- Tool steps are visible to future UI via **events**; run summary is **persisted** for later display.
- Implementation stays **decoupled** from chat history and `AiService` so chat behavior does not regress.

## Scope

- `src/agent/` — loop, tools, handler, turn cache, persistence
- `src/ai/agent-turn.ts` + `GeminiProvider.generateAgentTurn` — function-calling transport
- In-memory + provider-level LLM turn caching
- `chrome.storage.local` records keyed `agent_run_<uuid>`

## Non-Goals (current phase)

- Chat tab / session integration (`ChatMessageView`, `useChatPersistence`)
- Streaming final answer into the chat widget
- Storing per-tool args, tool results, or thinking traces
- Cross-tab agent index or quota pruning
- OpenAI/Anthropic agent providers (Gemini only today)
- User confirmation gates for destructive actions (planned UX)

## Agent Build Philosophy

- **Thin files, clear boundaries:** loop, turn, persistence, browser tools — no god-modules.
- **Chat types stay text-only;** agent uses `AgentMessage` / `AgentTurnRequest`.
- **Executor is the only DOM touchpoint;** excludes `#chrome-ai-helper-host`.
- **Events for UI;** storage for durable summary — do not overload one blob.
