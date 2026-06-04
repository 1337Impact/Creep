# Requirements

## Functional Requirements

- Accept a user **task** (`AgentRunInput.task`) and optional **initial observation** string (not persisted in run record).
- Run up to **20 steps** (`MAX_AGENT_STEPS`) of LLM + tools per invocation.
- Expose tools: `observe_page`, `click`, `type`, `scroll`, `complete_task`.
- Emit **AgentEvent** stream: `tool_call`, `tool_result`, `model_text`, `done`, `error`.
- Terminate on `complete_task`, model text with no tools, `max_steps`, or LLM failure.
- Optional **persistence:** create run at start, finalize on `done`/`error` with summary metadata.
- List/get/delete persisted runs by `agentId`.

## Non-Functional Requirements

- **Performance:** Default Flash Lite for cost/latency; turn cache skips after tool results in history.
- **Reliability:** Ref staleness errors after navigation; max step cap prevents runaway loops.
- **Security/privacy:** Runs in user's page context (same cookies/session); no arbitrary JS eval.
- **Maintainability:** Separate from `@/ai` chat; import agent only from `@/agent`.
- **Observability:** Events for live UI; `AgentRunRecord` for post-hoc inspection.

## Acceptance Criteria (backend — implemented)

- `AGENT_START` from chat runs the loop in the background; content script executes tools via RPC.
- `runPersisted` writes `agent_run_<uuid>` with `status: running` then `done`/`error`.
- Record contains: `agentId`, `createdAt`, `initialRequest`, `finalResponse`, `toolCallCount`, `durationMs`, `status`.
- `toolCallCount` excludes `complete_task`.
- `npm run typecheck` and `npm run build` pass with agent module included.

## Acceptance Criteria (future — UI)

- User can start an agent task from chat; thread shows agent message linked by `agentId`.
- Tool activity visible during run; final summary shown when complete.

## Assumptions

- Content script has access to host `document` when invoking the handler.
- Gemini API key is configured (same auth as chat).
- Single-tab, same-document execution is enough for v1.
