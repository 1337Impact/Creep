# Open Questions

## Blocking

None.

## Non-Blocking

### Provider priority

- **Question:** Implement OpenAI before Anthropic, or vice versa?
- **Default assumption:** OpenAI first (Phase 4a) — closer attachment API parity with Gemini for vision/audio.
- **Revisit trigger:** User preference or available API keys for testing.

### Settings UX layout

- **Question:** Single form vs tabbed provider settings?
- **Default assumption:** Single scrollable form with three key fields in Phase 3.
- **Revisit trigger:** Settings modal becomes crowded or more providers added.

### Model picker without key

- **Question:** Show all models or only models whose provider has a configured key?
- **Default assumption:** Show all Gemini models always; grey out / hide OpenAI/Anthropic models until key is set.
- **Revisit trigger:** User confusion about unavailable models.

### Mic / transcription wiring

- **Question:** Is mic button currently wired to `transcribeAudio`?
- **Default assumption:** UI exists; wire to `aiService.transcribeAudio` during Phase 3 or as follow-up.
- **Revisit trigger:** Phase 3 capability work on audio.

### Persistence migration strategy

- **Question:** Migrate `role: "model"` on load vs one-time migration script?
- **Default assumption:** Map on load in `useChatPersistence` — no destructive migration.
- **Revisit trigger:** Persisted history corruption reports.

### Deprecated shim retention

- **Question:** How long to keep `src/api/gemini.ts` re-export shim?
- **Default assumption:** Remove in Phase 1 if no external consumers; no shim needed.
- **Revisit trigger:** Import errors from untracked files.
