# Validation Plan

## Automated

- `npm run typecheck` — must pass; agent types isolated from chat.
- `npm run build` — content script bundles `@/agent` without errors.

## Manual — agent loop (UI)

1. Open Creep chat, enable agent mode, send: “Observe the page and describe the main button.”
2. Watch the agent plan for `observe_page` and a final summary.

**Pass:** at least one tool step, then done without “interrupted” after a normal (non-navigating) task.

## Manual — navigation survival

1. Agent task: navigate to another https URL, then observe the new page.
2. After full page load, plan should continue (not stale error).

## Manual — persistence

After a completed run, in extension service worker or storage inspector:

```js
const key = 'agent_run_<agentId>';
chrome.storage.local.get(key, (r) => console.log(r[key]));
```

**Pass:** record has `status: "done"`, `durationMs` set, `toolCallCount >= 0`, `finalResponse` string, `initialRequest` equals task.

**Pass:** `complete_task` not counted in `toolCallCount` when it is the only tool in final step (action tools counted separately).

## Manual — error paths

| Case | Expected |
|------|----------|
| Missing API key | `error` with `llm_error` |
| Invalid ref click without observe | `tool_result` with `ok: false` |
| Task impossible in 20 steps | `error` `max_steps` |

## Regression — chat

- Send normal chat message — still uses `AiService.streamChat`.
- Session save/load in `useChatPersistence` — unchanged keys (`chat_*` only).

## Future UI validation

- Agent bubble appears and updates on `done`.
- Reload extension — agent message still shows summary via `agentId` lookup.
- Session history popup — chat sessions still list correctly (agent runs separate).
