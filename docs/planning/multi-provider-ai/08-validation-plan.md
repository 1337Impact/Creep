# Validation Plan

## Automated Checks

| Check | Command | When |
|---|---|---|
| Typecheck | `npm run typecheck` | Every phase |
| Build | `npm run build` | Every phase |
| Lint | IDE linter on touched files | Every task |

No automated test suite exists today. Phase 1 relies on typecheck + build + manual smoke tests.

### Future automated tests (deferred)

- **Unit:** `prompts.ts` builders — input/output snapshots
- **Unit:** `getReadableAiError` — error string → friendly message mapping
- **Unit:** `GeminiProvider` request mappers — mock `@google/genai`, assert SDK call shape
- **Integration:** AiService with mocked provider — stream yields chunks in order

## Manual or Product Review

### Phase 1 smoke tests

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 1 | Basic chat | Open chat, send "hello" | Streamed response appears |
| 2 | Selected text | Select text on page, send via chat | Prompt includes selection context |
| 3 | Page content | Toggle page content, send question | Response references page |
| 4 | Screenshot | Attach screenshot, ask "what do you see?" | Vision response |
| 5 | Web search | Enable search, ask current-events question | Search-augmented answer |
| 6 | Inline Q&A | Select text, expand popup, ask question | Concise cached-style answer |
| 7 | Missing token | Clear token in settings, send message | Settings prompt message |
| 8 | Model switch | Change model in picker, send message | Request uses selected model ID |
| 9 | History | Multi-turn conversation | Context maintained; no duplicate user msgs |
| 10 | Error handling | Invalid API key | Friendly auth error |

### Phase 3 smoke tests

| # | Scenario | Expected |
|---|---|---|
| 1 | Gemini-only key | Only Gemini models enabled |
| 2 | Search on non-search model | Toggle disabled (when such model exists) |
| 3 | Screenshot on non-vision model | Button disabled |

### Phase 4 smoke tests (per provider)

| # | Scenario | Expected |
|---|---|---|
| 1 | OpenAI chat | gpt-4o responds |
| 2 | OpenAI vision | Screenshot analyzed |
| 3 | Anthropic chat | Claude responds |
| 4 | Anthropic vision | Screenshot analyzed |

## Observability

| Signal | Location | Purpose |
|---|---|---|
| `console.error('Chat error:', error)` | Provider adapters | Debug failures |
| `console.error('Transcription error:', error)` | Provider adapters | Debug mic path |
| Network tab (DevTools) | Extension service worker / content script | Verify single user message, correct model |

No metrics or tracing infrastructure required for this refactor.

## Done Definition

### Phase 1 complete when:

- All Phase 1 acceptance criteria in [01-requirements.md](01-requirements.md) are checked
- All 10 Phase 1 smoke tests pass
- `npm run typecheck` and `npm run build` exit 0
- No component imports from `@/api/gemini`
- Planning doc status updated to "Phase 1 complete" in `index.md`

### Full initiative complete when:

- Gemini, OpenAI, and Anthropic adapters implemented
- Model registry lists models for all three providers
- Settings accepts keys for all three
- Capability UI disables unsupported features
- README documents multi-provider setup
