# User Experience

## Current State

**No user-facing agent UI** is wired. The backend is callable from the content script (e.g. devtools) only. Chat continues to use standard `streamChat` — no agent mode toggle.

## Planned Chat Integration (not implemented)

1. User message triggers agent path when mode is “agent” (or heuristic).
2. Tab `messages` gains `{ role: "agent", agentId, text? }` stub; `useChatPersistence` saves as today.
3. Event stream drives inline tool cards; on `done`, bubble text = `AgentRunRecord.finalResponse`.
4. Expand agent message → load record for duration and tool count (not per-tool args in v1 storage).

## Event → UI Mapping (reference)

| Event | Suggested UI |
|-------|----------------|
| `tool_call` | Compact row: tool name + key args |
| `tool_result` | Success/fail chip; hide raw JSON by default |
| `model_text` | Optional subtle status line (not persisted) |
| `done` | Final assistant-style summary |
| `error` | Error styling + retry affordance |

## Loading / Running States

- **Running:** show spinner on agent bubble; disable send or allow Stop (future).
- **Persisted reload:** if `status: running` on old record (crash), show stale run warning — v1 does not recover mid-run.

## Accessibility

- Tool rows should be keyboard-readable (name + outcome).
- Do not rely on color alone for success/failure of `tool_result`.
