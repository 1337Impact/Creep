# Execution Plan

## Milestones

### Phase 1 — Extract Gemini (no behavior change)

**Goal:** Introduce `src/ai/` structure; components use `AiService`; fix history duplication.

**Tasks:**

1. Create `src/ai/types.ts` — universal types
2. Create `src/ai/errors.ts` — move error helpers from `gemini.ts`, rename to `getReadableAiError`
3. Create `src/ai/auth.ts` — `resolveApiToken`, storage keys (Gemini only initially)
4. Create `src/ai/providers/provider.interface.ts`
5. Create `src/ai/providers/base-provider.ts` — cache helper
6. Create `src/ai/providers/gemini.provider.ts` — extract from `GeminiClient`
7. Create `src/ai/providers/factory.ts` — resolve Gemini for all current models
8. Move `src/api/prompts.ts` → `src/ai/prompts.ts`
9. Create `src/ai/ai-service.ts` — wrap provider with feature methods
10. Create `src/ai/index.ts` — public exports
11. Update `ChatInterface.tsx` — import `@/ai`, fix history flow
12. Update `ExpandedSelectionPopup.tsx` — import `@/ai`
13. Update `src/types/chat.ts` — import `Message` from `@/ai/types`
14. Update `src/state/chatUpdates.ts` — type imports
15. Delete or shim `src/api/gemini.ts`
16. Run `npm run typecheck && npm run build`

**Dependencies:** None

**Acceptance criteria:** See [01-requirements.md](01-requirements.md) Phase 1 checklist

---

### Phase 2 — Types & model registry

**Goal:** Universal message roles; capabilities on models; persistence migration.

**Tasks:**

1. Rename `ChatMessage.role: "model"` → `Message.role: "assistant"` across codebase
2. Add `provider` and `capabilities` to `AI_MODELS` in `src/ai/models.ts`
3. Move model helpers from `constants/chat.ts` or re-export from `@/ai/models`
4. Add `model` → `assistant` mapper in `useChatPersistence` on load
5. Fix `streamChat` history contract (document in types)
6. Run typecheck + build

**Dependencies:** Phase 1 complete

**Acceptance criteria:** See Phase 2 checklist in requirements

---

### Phase 3 — Multi-provider settings & capability UI

**Goal:** Settings for multiple API keys; UI respects capabilities.

**Tasks:**

1. Extend settings modal with OpenAI/Anthropic key fields (save to localStorage)
2. Add env fallbacks for new providers in `auth.ts`
3. Group or label models by provider in model picker
4. Disable search/screenshot/mic based on `getModelById(id).capabilities`
5. Provider-specific missing-token messages
6. Update README setup section

**Dependencies:** Phase 2 complete

**Acceptance criteria:** See Phase 3 checklist in requirements

---

### Phase 4a — OpenAI provider

**Goal:** Chat + vision on OpenAI models.

**Tasks:**

1. Add `openai` peer dependency (`openai` package)
2. Implement `src/ai/providers/openai.provider.ts`
3. Register OpenAI models in `AI_MODELS`
4. Map attachments and streaming
5. Manual smoke test

**Dependencies:** Phase 3 complete (or Phase 2 if skipping multi-key UI)

---

### Phase 4b — Anthropic provider

**Goal:** Chat + vision on Claude models.

**Tasks:**

1. Add `@anthropic-ai/sdk`
2. Implement `src/ai/providers/anthropic.provider.ts`
3. Register Anthropic models
4. Transcription fallback strategy for mic
5. Manual smoke test

**Dependencies:** Phase 4a recommended first

---

## Agent Task Breakdown (Phase 1 detail)

### Task 1.1 — Scaffold `src/ai/types.ts`

- **Context to read:** [04-data-and-apis.md](04-data-and-apis.md), `src/api/gemini.ts`
- **Files likely touched:** `src/ai/types.ts`
- **Expected output:** All universal types exported
- **Validation:** Typecheck passes

### Task 1.2 — Extract Gemini provider

- **Context to read:** `src/api/gemini.ts` lines 165–334
- **Files likely touched:** `src/ai/providers/gemini.provider.ts`, `base-provider.ts`
- **Expected output:** `GeminiProvider implements AiProvider` with `generate`, `stream`
- **Validation:** Same SDK calls as before; manual chat smoke test

### Task 1.3 — Implement AiService

- **Context to read:** `src/api/gemini.ts` feature methods, `prompts.ts`
- **Files likely touched:** `src/ai/ai-service.ts`
- **Expected output:** `streamChat`, `sendInlineQuestion`, `transcribeAudio`, `prepareChatPrompt`
- **Validation:** Components work unchanged

### Task 1.4 — Migrate components

- **Context to read:** `ChatInterface.tsx` handleSend, `ExpandedSelectionPopup.tsx`
- **Files likely touched:** Both components, `types/chat.ts`, `state/chatUpdates.ts`
- **Expected output:** No imports from `@/api/gemini`
- **Validation:** Build passes; manual extension test

### Task 1.5 — Fix history duplication

- **Context to read:** `ChatInterface.tsx` handleSend lines 219–242
- **Files likely touched:** `ChatInterface.tsx`, `ai-service.ts`
- **Expected output:** Single user message per turn sent to provider
- **Validation:** Inspect network/SDK contents or log `messages.length`

---

## Sequencing Notes

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4a ──► Phase 4b
   │            │           │
   │            │           └── Can parallelize UI polish
   │            └── Must follow Phase 1 (types exist)
   └── Start here; no blockers
```

- **Phase 1 is strictly sequential** inside the PR (types → provider → service → components).
- **Phase 4a and 4b** can be separate PRs; no dependency between them except shared factory/registry.
- **Do not add OpenAI/Anthropic SDKs** until Phase 4 — keeps Phase 1 diff minimal.

## File Migration Map

| Current | New |
|---|---|
| `src/api/gemini.ts` | `src/ai/providers/gemini.provider.ts` + `src/ai/errors.ts` + `src/ai/auth.ts` |
| `src/api/prompts.ts` | `src/ai/prompts.ts` |
| `src/constants/chat.ts` (models) | `src/ai/models.ts` (Phase 2) |
| `GeminiClient` | `GeminiProvider` + `AiService` |
| `geminiClient` singleton | `aiService` singleton |
| `getReadableGeminiError` | `getReadableAiError` |
