# Risks and Weak Points

## Weak Points

### 1. History duplication bug

- **Why it matters:** Extra user message sent to Gemini wastes tokens and may confuse the model.
- **Impact if guessed wrong:** Fix in wrong layer could break history persistence.
- **Proposed resolution:** AiService owns message assembly; `streamChat` receives `history` without pending user turn. Component stops pre-appending user message before calling stream.
- **Status:** Resolved (fix in Phase 1)

### 2. Persisted chat history role migration

- **Why it matters:** Users have tabs saved with `role: "model"` in localStorage.
- **Impact if guessed wrong:** Broken history or failed API calls after upgrade.
- **Proposed resolution:** Map `model` → `assistant` on load in persistence hook; optional reverse map not needed.
- **Status:** Assumed

### 3. Anthropic lacks native audio input

- **Why it matters:** Mic/transcription feature may not work on Anthropic-selected models.
- **Impact if guessed wrong:** Runtime errors or silent failures.
- **Proposed resolution:** Route transcription through Gemini/OpenAI regardless of chat provider; disable mic when no transcription provider configured.
- **Status:** Assumed

### 4. Web search is Gemini-specific today

- **Why it matters:** Search toggle is visible for all models; OpenAI/Anthropic need different tool APIs.
- **Impact if guessed wrong:** Users enable search on unsupported models.
- **Proposed resolution:** `capabilities.webSearch` per model; disable toggle when false.
- **Status:** Resolved (Phase 2–3)

### 5. Client-side API keys

- **Why it matters:** Keys visible in extension storage; standard for BYOK extensions but not enterprise-grade.
- **Impact if guessed wrong:** N/A for current scope.
- **Proposed resolution:** Document in README; out of scope for proxy.
- **Status:** Accepted risk

### 6. Cache key size with base64 attachments

- **Why it matters:** `JSON.stringify` of large screenshots in cache keys is slow and memory-heavy.
- **Impact if guessed wrong:** Performance regression on repeat inline Q (low risk — inline Q has no images today).
- **Proposed resolution:** Hash large payloads in cache key generation.
- **Status:** Deferred (inline Q doesn't cache attachments today)

### 7. Bundle size when adding SDKs

- **Why it matters:** Chrome extensions benefit from lean bundles.
- **Impact if guessed wrong:** Slower load/install.
- **Proposed resolution:** Add OpenAI/Anthropic SDKs only in Phase 4; tree-shake; lazy import per provider if needed.
- **Status:** Open

## Clarifying Questions

### Blocking

None — sufficient direction to begin Phase 1.

### Non-Blocking

| Question | Default assumption | Revisit trigger |
|---|---|---|
| Should OpenAI be Phase 4a before Anthropic? | Yes — OpenAI vision/audio docs align closely with current attachment flow | User preference |
| Single settings field vs tabbed settings? | Single scrollable form with three fields | UX feels crowded |
| Show provider badge on model picker? | Yes, starting Phase 3 | User wants minimal UI |
| Keep `src/api/` folder? | Remove after migration; use `src/ai/` only | Import breakage |

## Technical Debt or Follow-Up

- Wire mic button to `aiService.transcribeAudio` if not already connected
- Unit tests for prompt builders and error normalization
- Unit tests for Gemini adapter request mapping (mock SDK)
- README update for multi-provider setup
- Remove deprecated `src/api/gemini.ts` shim after one release cycle
