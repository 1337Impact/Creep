export { aiService, AiService } from "./ai-service";
export {
  API_TOKEN_STORAGE_KEYS,
  GEMINI_API_TOKEN_STORAGE_KEY,
  hasApiToken,
  resolveApiToken,
} from "./auth";
export {
  AiError,
  getReadableAiError,
  getReadableGeminiError,
} from "./errors";
export { normalizeHistory, normalizeHistoryEntry } from "./history";
export {
  AI_MODELS,
  CHAT_MODELS,
  DEFAULT_MODEL,
  DEFAULT_TRANSCRIPTION_MODEL,
  getModelById,
  getProviderForModel,
} from "./models";
export {
  buildInlineQuestionPrompt,
  buildPageContentPrompt,
  buildSelectedTextPrompt,
  INLINE_SYSTEM_INSTRUCTION,
  SYSTEM_INSTRUCTION,
} from "./prompts";
export type {
  AiModel,
  AudioMimeType,
  ContentPart,
  GenerateRequest,
  ImageMimeType,
  InlineQuestionOptions,
  Message,
  MessageRole,
  PromptResult,
  ProviderCapabilities,
  ProviderId,
  StreamChatOptions,
  ToolConfig,
} from "./types";
export {
  getMessageText,
  textMessage,
} from "./types";

export { GEMINI_MISSING_TOKEN_ERROR } from "@/constants/messages";
