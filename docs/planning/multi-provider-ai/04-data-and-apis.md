# Data and APIs

## Data Model

### `ContentPart` (discriminated union)

```typescript
type ContentPart =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: "image/png" | "image/jpeg" | "image/webp" }
  | { type: "audio"; data: string; mimeType: "audio/wav" | "audio/mp3" | "audio/webm" };
```

- **Ownership:** Assembled by AiService; consumed by providers.
- **Lifecycle:** Created per request; not persisted (images/audio are ephemeral).
- **Validation:** Base64 strings without data-URL prefix (matches current screenshot flow).

### `Message`

```typescript
interface Message {
  role: "user" | "assistant";
  content: ContentPart[];
}
```

- **Ownership:** `ChatTab.history` in UI state; persisted via `useChatPersistence`.
- **Lifecycle:** Appended after each turn (user message before stream, assistant after completion).
- **Migration:** Replace Gemini `role: "model"` with `role: "assistant"` in Phase 2. Optionally map on read from old persisted data.

### `GenerateRequest` (provider input)

```typescript
interface GenerateRequest {
  model: string;
  system?: string;
  messages: Message[];
  tools?: ToolConfig[];
  stream?: boolean;
}

type ToolConfig = { type: "web_search" };
```

### `AiModel` (registry entry)

```typescript
interface AiModel {
  id: string;
  name: string;
  provider: "gemini" | "openai" | "anthropic";
  capabilities: {
    streaming: boolean;
    vision: boolean;
    audioInput: boolean;
    webSearch: boolean;
  };
}
```

### Initial Gemini capabilities (example)

| Model ID | vision | audioInput | webSearch |
|---|---|---|---|
| `models/gemini-flash-lite-latest` | ✓ | ✓ | ✓ |
| `models/gemini-flash-latest` | ✓ | ✓ | ✓ |
| `models/gemini-2.5-pro` | ✓ | ✓ | ✓ |

## API or Interface Changes

### Public surface (`@/ai/index.ts`)

What components import:

| Export | Layer | Replaces |
|---|---|---|
| `aiService` | 2 | `geminiClient` |
| `getReadableAiError` | shared | `getReadableGeminiError` |
| `resolveApiToken(provider)` | auth | `resolveGeminiApiToken` |
| `hasApiToken(provider)` | auth | inline checks |
| `AI_MODELS`, `getModelById` | registry | `CHAT_MODELS`, `getModelById` |
| `API_TOKEN_STORAGE_KEYS` | auth | `GEMINI_API_TOKEN_STORAGE_KEY` |

### `AiService` methods

#### `streamChat(options: StreamChatOptions): AsyncGenerator<string>`

```typescript
interface StreamChatOptions {
  history: Message[];
  message: string;
  selectedText?: string;
  pageContent?: string;
  screenshot?: string;       // base64 PNG
  audio?: string;            // base64 WAV
  modelId: string;
  enableSearch?: boolean;
}
```

- **Behavior:** Applies prompts, assembles final user message with attachments, streams from provider.
- **History contract:** `history` does NOT include the pending user turn — AiService owns assembly (fixes duplication bug).
- **Errors:** Throws `AiError`; component catches and calls `getReadableAiError`.

#### `sendInlineQuestion(selectedText, question, options?): Promise<string>`

```typescript
interface InlineQuestionOptions {
  modelId?: string;
  enableSearch?: boolean;
}
```

- **Behavior:** Cached non-streaming generate with `INLINE_SYSTEM_INSTRUCTION`.
- **Default model:** Registry default if `modelId` omitted.

#### `transcribeAudio(audioBase64: string, modelId?: string): Promise<string>`

- **Behavior:** Cached generate with transcription prompt; uses model with `audioInput` capability.
- **Default:** Gemini flash model until multi-provider routing is added.

#### `prepareChatPrompt(message, selectedText?, pageContent?): PromptResult`

- **Unchanged logic** from current `geminiClient.prepareChatPrompt` / `prompts.ts`.

### `AiProvider` interface (Layer 1 — internal)

```typescript
interface AiProvider {
  readonly id: ProviderId;
  getCapabilities(model: string): ProviderCapabilities;
  generate(request: GenerateRequest): Promise<string>;
  stream(request: GenerateRequest): AsyncGenerator<string, void, unknown>;
}
```

### Auth storage keys

```typescript
const API_TOKEN_STORAGE_KEYS = {
  gemini: "creep_gemini_api_token",
  openai: "creep_openai_api_token",
  anthropic: "creep_anthropic_api_token",
} as const;
```

Env fallbacks (Phase 1):

- `VITE_GEMINI_API_KEY` → gemini token

Future:

- `VITE_OPENAI_API_KEY`, `VITE_ANTHROPIC_API_KEY`

## Data Risks

| Risk | Mitigation |
|---|---|
| **Persisted history uses old `model` role** | Map `model` → `assistant` on load in `useChatPersistence` |
| **Large base64 in cache keys** | Hash cache keys (SHA-256 of content) in `BaseProvider` |
| **API keys in localStorage** | Existing pattern; document in README; never log keys |
| **Screenshot/audio in history** | Do not persist binary attachments in history — text-only history entries (current behavior) |
| **Model ID mismatch after registry change** | `getModelById` falls back to `DEFAULT_MODEL` |
