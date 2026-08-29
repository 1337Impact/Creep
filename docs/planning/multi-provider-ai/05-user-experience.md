# User Experience

## Personas

- **Primary:** Browser power-user who selects text, chats in-overlay, and occasionally attaches page context or screenshots — wants fast answers without leaving the tab.
- **Secondary:** Developer/power-user who may swap models or providers via API keys in settings.

## Screens or Touchpoints

| Touchpoint | Current behavior | After refactor |
|---|---|---|
| **Chat prompt box** | Send, search toggle, page content, screenshot | Same; toggles respect model capabilities |
| **Model picker** | Gemini models only | Gemini models (Phase 1–2); multi-provider labels (Phase 3) |
| **Settings modal** | Gemini API token input | Per-provider token fields (Phase 3) |
| **Selection popup** | Inline Q&A via Gemini | Same via `aiService.sendInlineQuestion` |
| **Mic button** | UI present; transcription may not be wired | Disabled when model lacks `audioInput` |

## Empty, Loading, Error, and Success States

### Empty

- No change — initial tab greeting remains.

### Loading

- Streaming: incremental markdown render (unchanged).
- Inline popup: spinner during `sendInlineQuestion` (unchanged).

### Error

- **Missing token:** Provider-specific message — e.g. "Gemini API token is missing…" / "OpenAI API key is missing…"
- **Provider errors:** Normalized via `getReadableAiError` — quota, region, auth, timeout, generic fallback.
- **Unsupported feature:** Prefer disabled UI over error — e.g. grey out search toggle if model lacks `webSearch`.

### Success

- Stream completes; history updated.
- Inline answer rendered in popup.

## Copy and Messaging Notes

- Keep existing friendly error tone from `deriveFriendlyErrorMessage`.
- Generalize "Gemini" references in error copy when the active provider is known:
  - `"Authentication failed. Please verify your Gemini API key."` → dynamic per provider
- Settings labels: "Gemini API key", "OpenAI API key", "Anthropic API key"
- Do not expose provider names in normal chat UX unless user selected a non-default provider
- Preserve `GEMINI_MISSING_TOKEN_UI_MESSAGE` behavior through Phase 1; rename constants in Phase 3

## Phase 3 Settings UX (sketch)

```
┌─ Settings ─────────────────────────┐
│  Gemini API key    [______________] │
│  OpenAI API key    [______________] │
│  Anthropic API key [______________] │
│                                     │
│  [Save]                             │
└─────────────────────────────────────┘
```

Only providers with a saved key show their models in the picker (or show all with "needs key" badge).
