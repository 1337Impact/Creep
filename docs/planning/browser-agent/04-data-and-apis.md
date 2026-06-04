# Data and APIs

## Public API (`@/agent`)

### Run input

```ts
interface AgentRunInput {
  task: string;
  initialObservation?: string;  // prepended to first user message only
  modelId?: string;
  maxSteps?: number;            // default 20
  useCache?: boolean;           // default true (with skip-after-tool-results)
}
```

### Events

| Type | Fields | When |
|------|--------|------|
| `tool_call` | `call`, `step` | Before executing a tool |
| `tool_result` | `name`, `ok`, `result`, `step` | After tool execution |
| `model_text` | `text`, `step` | Model returned narration |
| `done` | `summary`, `steps`, `messages` | Terminal success |
| `error` | `code`, `message`, `steps` | Terminal failure |

### Runtime API (extension messages)

| Message | Direction | Purpose |
|---------|-----------|---------|
| `AGENT_START` | UI → background | Start run for tab; returns `{ ok, agentId }` |
| `AGENT_EVENT` | background → content | Stream `AgentEvent` to UI |
| `AGENT_EXECUTE_TOOL` | background → content | Run `BrowserToolExecutor` on host `document` |
| `AGENT_CONTENT_READY` | content → background | Tab document ready after navigation |
| `AGENT_GET_STATUS` | content → background | Reconnect UI to in-flight run |

Loop helpers (`runAgentLoop`, `runPersisted`) are used by `AgentOrchestrator` in the background with `TabToolExecutor`.

### Tools (Gemini function declarations)

| Name | Args | Notes |
|------|------|-------|
| `observe_page` | `{}` | Returns url, title, elements `{ ref, role, name, tag }` |
| `click` | `ref` | Invalidates snapshot URL on success |
| `type` | `ref`, `text` | input/textarea only |
| `scroll` | `direction`, `amount?` | Default 400px |
| `navigate` | `url` | http/https only; clears refs; orchestrator waits for new document before next step |
| `evaluate_js` | `script` | Runs JS in page main world; capped output (~12k chars), 10s timeout |
| `complete_task` | `summary` | Ends loop |

Refs are `el-0`, `el-1`, … from latest observe; errors: `ref_stale`, `ref_stale_navigation`.

**evaluate_js:** Injected into the host page (not the content-script isolated world). Script runs inside an async function wrapper; use `return` for results. Errors: `missing_script`, `script_too_long`, `evaluate_js_timeout`, `js_exception: …`.

## LLM types (`src/ai/agent-turn.ts`)

- **`AgentMessage`:** `user` \| `model` \| `tool` with `text` \| `functionCall` \| `functionResponse` parts.
- **`AgentTurnRequest`:** model, system, messages, functionDeclarations.
- **`AgentTurnResponse`:** optional `text`, `functionCalls[]`.

Chat **`Message`** / **`GenerateRequest`** are unchanged.

## Persistence

**Storage key:** `agent_run_<uuid>` (`AGENT_RUN_PREFIX` in constants).

**Record:**

```ts
interface AgentRunRecord {
  agentId: string;
  createdAt: number;
  initialRequest: string;   // task only
  finalResponse?: string;
  toolCallCount: number;    // excludes complete_task
  durationMs?: number;
  status: "running" | "done" | "error";
}
```

**Writes:** create at run start; finalize on `done`/`error` (two-write pattern, no mid-run updates).

**CRUD:** `createAgentRun`, `getAgentRun`, `finalizeAgentRun`, `deleteAgentRun`, `listAgentRuns`.

**Not stored:** tool args, tool results, full `messages` transcript, thinking.

## Provider API

`GeminiProvider.generateAgentTurn(request: AgentTurnRequest): Promise<AgentTurnResponse>`

Resolved via `resolveAgentProvider(modelId)` in `src/ai/providers/factory.ts`.
