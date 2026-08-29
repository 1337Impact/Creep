# Decision 0002: Minimal Agent Run Storage

## Status

Accepted

## Context

Agent runs produce a long event stream (tool calls, results, model text). Chat already persists tabs in `chrome.storage.local` under `chat_*` keys. We need durable metadata for future UI without bloating storage or coupling to chat sessions in v1.

## Decision

- Store each run at **`agent_run_<uuid>`** as an **`AgentRunRecord`**.
- **Two writes per run:** create (`status: running`) at start, finalize on `done`/`error`.
- Persist only:
  - `agentId`, `createdAt`, `initialRequest` (task string only)
  - `finalResponse`, `toolCallCount`, `durationMs`, `status`
- **Do not persist:** tool args, tool results, thinking/`model_text`, full message transcript.
- **`toolCallCount`:** increment on `tool_call` events where `name !== "complete_task"`.

## Rationale

- Keeps quota low and privacy-friendly (no form field values in storage).
- Enough for summary bubble + “N tools · Xs” metadata in UI.
- Avoids duplicating chat session schema before integration design is final.

## Consequences

### Positive

- Simple CRUD and listing via prefix scan.
- Recorder stays ~100 lines in `persistence.ts`.

### Negative

- Cannot reconstruct tool timeline after reload from storage alone — UI must capture events live or extend schema later.
- Cannot resume interrupted runs from storage.

## Follow-up

- Optional: `{ role: "agent", agentId }` in chat tab messages pointing at this record.
- Optional: store tool **names** only for a static timeline.
