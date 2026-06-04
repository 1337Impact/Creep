# Architecture Plan

## System Context

Creep runs as a **content script** React app (`src/content.tsx`) with shadow DOM UI. Chat uses `AiService` → `GeminiProvider.stream`. The agent loop runs in the **background service worker**; DOM tools execute in the content script via tab RPC.

## Module Layout

```
src/agent/
├── index.ts           # Public exports (loop, protocol, persistence)
├── protocol.ts        # Message types + sendToRuntime / sendToTab
├── active-session.ts  # agent_active_session storage
├── loop.ts            # runAgentLoop — tool loop + events
├── turn.ts            # generateAgentTurn + in-memory turn cache
├── persistence.ts     # chrome.storage.local agent_run_<id>
├── constants.ts
├── types.ts
└── tools/
    ├── schemas.ts
    └── browser.ts     # BrowserToolExecutor (content script only)

src/background/
├── index.ts               # onMessage router + keepalive port
├── agent-orchestrator.ts  # Run lifecycle, navigation gate
└── tab-tool-executor.ts   # ToolExecutor → tab RPC

src/content/
└── agent-bridge.ts    # EXECUTE_TOOL handler, event fan-in to UI

src/hooks/
└── useAgentRunEvents.ts  # AGENT_START + event subscription
```

## Boundaries

| Layer | Module | Responsibility |
|-------|--------|----------------|
| UI | `ChatInterface`, `useAgentRunEvents` | `AGENT_START`, subscribe to `AGENT_EVENT` |
| Orchestration | `AgentOrchestrator`, `loop.ts` | Loop until done (background) |
| LLM step | `turn.ts` | Build turn request, call provider |
| Provider | `GeminiProvider` | `generateAgentTurn` |
| Tools | `browser.ts` via `agent-bridge` | DOM observation and actions |
| Persistence | `persistence.ts`, `active-session.ts` | Run records + active session for reload |

## Agent Loop (one step)

```mermaid
sequenceDiagram
    participant Loop as runAgentLoop
    participant Turn as generateAgentTurn
    participant Gemini as GeminiProvider
    participant BG as TabToolExecutor
    participant CS as BrowserToolExecutor

    Loop->>Turn: messages + cache options
    Turn->>Gemini: generateAgentTurn
    Gemini-->>Loop: text + functionCalls
    alt action tools
        Loop->>BG: execute
        BG->>CS: AGENT_EXECUTE_TOOL
        CS-->>BG: ToolResult
        BG-->>Loop: functionResponse messages
    end
```

After `navigate` or click-driven full load, the orchestrator waits for `AGENT_CONTENT_READY` before the next step.

## Done Conditions

1. Model calls **`complete_task`** — primary semantic done.
2. Model returns **text only** with no function calls — fallback done.
3. **`max_steps`** — error event.
4. **LLM error** — error event with `getReadableAiError`.

## Caching (two layers)

| Layer | Location | Key behavior |
|-------|----------|----------------|
| Provider | `BaseProvider.agentTurnCache` | Identical `AgentTurnRequest` → cached response |
| Agent | `turn.ts` Map | Skips cache when history contains `functionResponse` parts |

Tool execution is **never** cached.

## Relation to Multi-Provider AI

See [multi-provider-ai](../multi-provider-ai/index.md). Chat remains Layer 2 `AiService`; agent bypasses `AiService` and calls `resolveAgentProvider` directly with agent-specific types.
