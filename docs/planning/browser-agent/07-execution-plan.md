# Execution Plan

## Completed (backend)

| Step | Status | Notes |
|------|--------|-------|
| `src/ai/agent-turn.ts` + `generateAgentTurn` on Gemini | Done | Function calling via `@google/genai` |
| `src/agent` loop, tools, handler | Done | `runAgentLoop`, `BrowserToolExecutor` |
| Turn caching (`turn.ts` + provider cache) | Done | Skip after tool responses |
| Minimal `agent_run_*` persistence | Done | `runPersisted` / `runToCompletionPersisted` |
| Code consolidation | Done | ~8 files under `src/agent/` |

## Next — UI integration

| Step | Owner | Acceptance |
|------|-------|------------|
| Agent mode entry in `ChatInterface` | UI | User can submit agent task |
| Consume `runPersisted` event stream | UI | Tool cards + done/error states |
| `ChatMessageView` agent role + `agentId` | Types + UI | Persists in `chat_*` tab state |
| Load `getAgentRun(agentId)` for summary metadata | UI | Duration, tool count, final text |
| Stop / cancel run | UI + loop | Abort generator; finalize record |

## Next — storage enhancements (optional)

| Step | Notes |
|------|-------|
| Per-host index of `agentId`s | Faster list without full scan |
| Prune runs older than N days | Quota management |
| Store tool names only (no args) | If product wants timeline without args |

## Next — quality

| Step | Notes |
|------|-------|
| Mock `ToolExecutor` unit tests | Loop without DOM |
| E2E on static fixture page | Click/type smoke |
| Destructive-action policy | Product + executor guards |

## Explicitly deferred

- OpenAI/Anthropic agent providers
- Streaming LLM tokens during agent steps (v1 uses full turn per step)
- Full transcript persistence for resume
