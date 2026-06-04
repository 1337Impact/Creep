# Open Questions

## Product

1. **How is agent mode triggered?** Separate toggle, slash command, or auto-detect intent?
2. **Destructive actions** — confirm every click on `submit`/`pay`, or heuristic only?
3. **Should `initialObservation` appear in persisted `initialRequest`?** Currently task-only in storage.

## UX

4. **Tool card detail level** — show full args or redacted (password fields)?
5. **In-progress persistence** — if user reloads mid-run, show failed run or attempt resume?

## Technical

6. **Chat `history` for agent turns** — store only user task + final summary for LLM continuity, or omit?
7. **Multi-provider agent** — priority when OpenAI/Anthropic adapters land?
8. **Storage cleanup** — max runs per user, LRU prune, or manual delete only?

## Resolved (documented in decisions/)

- Agent separate from chat → [0001](decisions/0001-separate-from-chat.md)
- Minimal run storage shape → [0002](decisions/0002-minimal-run-storage.md)
- `toolCallCount` excludes `complete_task` → [0002](decisions/0002-minimal-run-storage.md)
