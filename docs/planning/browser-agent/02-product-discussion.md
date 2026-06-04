# Product Discussion

## User Stories

- As a user, I want to describe a task on the current page so the extension can complete it without me clicking through manually.
- As a user, I want to see what the agent is doing (tools called) so I trust it is not hallucinating actions.
- As a user, I want a clear final answer when the task finishes or fails.

## Primary Flow (target)

1. User enters an agent-style prompt in chat (future).
2. Creep starts `runPersisted`, shows “running” state.
3. UI renders `tool_call` / `tool_result` cards from the event stream.
4. On `done`, UI loads `getAgentRun(agentId)` for duration/tool count and shows `finalResponse`.

## Alternate Flows

- **Failure:** `error` event or `status: error` on record — show message, allow retry.
- **Stop:** User cancels generator (future) — record finalized with error/aborted message.
- **Stale refs:** Model must re-`observe_page` after navigation; user sees failed tool result in stream.

## UX Principles

- Prefer **compact** tool cards (name + args preview), not full DOM dumps.
- **Final summary** is user-facing prose from `complete_task` or model text fallback.
- Do not show raw `innerText` page dumps in the agent trace (observation is structured elements only).

## Out of Scope for v1 Product

- Multi-page workflows with explicit tab management
- “Plan only” mode without tools
- Agent memory across sessions per domain
