# Risks and Weak Points

## Product / UX

| Risk | Impact | Mitigation |
|------|--------|------------|
| Agent acts in logged-in session | High — can click pay/submit | Future confirm gates; blocklist URL patterns |
| No visible progress until UI ships | Medium | Dev-only testing via console |
| User confuses chat vs agent mode | Medium | Clear mode toggle and copy |

## Technical

| Risk | Impact | Mitigation |
|------|--------|------------|
| Ref staleness after SPA nav | Medium | `ref_stale*` errors; prompt says re-observe |
| `innerText` not used — structured observe only | Medium | Model may miss custom widgets; expand selectors later |
| Max 80 elements cap | Low | Truncation on heavy pages |
| `evaluate_js` runs arbitrary page JS | High | Script/output caps, timeout; no eval in extension isolated world |
| Strict page CSP blocks inline injection | Medium | `evaluate_js` may timeout or fail on locked-down sites |
| Gemini-only agent turns | Medium | `resolveAgentProvider` throws for other providers |
| Storage quota (many `agent_run_*`) | Low | Future prune/list by host |
| Crash mid-run leaves `status: running` | Low | v1 no recovery; UI can show orphan state |
| LLM cache stale after DOM change | Low | Cache skipped when tool results in history |

## Security

- Tools cannot run arbitrary JS (by design).
- Extension UI (`#chrome-ai-helper-host`) excluded from observe.
- API keys remain client-side (same as chat).

## Testing Gaps

- No automated tests for loop or executor.
- Manual validation only (see [08-validation-plan.md](08-validation-plan.md)).
