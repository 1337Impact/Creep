export type ProviderId = "gemini" | "openai" | "anthropic";

export type MessageRole = "user" | "assistant";

export type ImageMimeType = "image/png" | "image/jpeg" | "image/webp";
export type AudioMimeType = "audio/wav" | "audio/mp3" | "audio/webm";

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: ImageMimeType }
  | { type: "audio"; data: string; mimeType: AudioMimeType };

export interface Message {
  role: MessageRole;
  content: ContentPart[];
}

export type ToolConfig = { type: "web_search" };

export interface GenerateRequest {
  model: string;
  system?: string;
  messages: Message[];
  tools?: ToolConfig[];
}

export interface ProviderCapabilities {
  streaming: boolean;
  vision: boolean;
  audioInput: boolean;
  webSearch: boolean;
}

export interface AiModel {
  id: string;
  name: string;
  provider: ProviderId;
  capabilities: ProviderCapabilities;
}

export interface PromptResult {
  fullPrompt: string;
  displayText: string;
}

export interface StreamChatOptions {
  history: Message[];
  message: string;
  selectedText?: string;
  pageContent?: string;
  screenshot?: string;
  audio?: string;
  modelId: string;
  enableSearch?: boolean;
}

export interface InlineQuestionOptions {
  modelId?: string;
  enableSearch?: boolean;
}

export interface TranscribeAudioInput {
  data: string;
  mimeType: AudioMimeType;
}

export interface TranscribeAudioOptions {
  model?: string;
  filename?: string;
}

export function getMessageText(message: Message): string {
  return message.content
    .filter((part): part is Extract<ContentPart, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

export function textMessage(role: MessageRole, text: string): Message {
  return { role, content: [{ type: "text", text }] };
}
