# Decision 0001: Agent Module Separate from Chat

## Status

Accepted

## Context

Creep already has a two-layer AI stack (`AiService` + providers) for **text chat**. Agentic behavior needs function calling, a tool loop, DOM execution, and different persistence — but must not break existing chat sessions or `history` shape.

## Decision

- Implement agent orchestration in **`src/agent/`**, not in `AiService`.
- Use **`AgentMessage` / `AgentTurnRequest`** in `src/ai/agent-turn.ts`, not chat `Message`.
- UI imports chat from **`@/ai`** and agent from **`@/agent`**.
- Do not add agent methods to `AiService` in v1.

## Rationale

- Chat streaming and agent multi-turn function calling have different provider configs (e.g. no `web_search` mixed with Creep tools).
- Clearer testing and smaller diffs when changing one mode.
- Persistence namespaces stay separate: `chat_*` vs `agent_run_*`.

## Consequences

### Positive

- Chat regression surface stays small.
- Agent can evolve (tools, storage) independently.

### Negative

- Some duplication (auth, model IDs, error helpers) — acceptable via shared `@/ai` utilities.
- Future UI must orchestrate both paths explicitly.

## Follow-up

- Chat integration via `agentId` message type (see [05-user-experience.md](../05-user-experience.md)).
