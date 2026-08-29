import OpenAI from "openai";
import type {
  ChatCompletionContentPart,
  ChatCompletionMessage,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { OPENAI_MISSING_TOKEN_ERROR } from "@/constants/messages";
import type {
  AgentContentPart,
  AgentFunctionCall,
  AgentTurnRequest,
  AgentTurnResponse,
} from "../agent-turn";
import { resolveApiToken } from "../auth";
import { AiError } from "../errors";
import { getModelById } from "../models";
import type {
  AudioMimeType,
  ContentPart,
  GenerateRequest,
  Message,
  ProviderCapabilities,
  TranscribeAudioInput,
  TranscribeAudioOptions,
} from "../types";
import { BaseProvider } from "./base-provider";
import type { AiProvider } from "./provider.interface";

const DEFAULT_TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe";

function toDataUrl(mimeType: string, base64: string): string {
  return `data:${mimeType};base64,${base64}`;
}

function toOpenAiAudioFormat(mimeType: AudioMimeType): "wav" | "mp3" {
  if (mimeType === "audio/mp3") return "mp3";
  if (mimeType === "audio/wav") return "wav";
  throw new AiError(
    "OpenAI supports wav and mp3 audio only.",
    "unsupported_audio",
    "openai"
  );
}

function getAudioExtension(mimeType: AudioMimeType): "wav" | "mp3" | "webm" {
  if (mimeType === "audio/mp3") return "mp3";
  if (mimeType === "audio/webm") return "webm";
  return "wav";
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const normalized = base64.includes(",") ? base64.split(",").pop() ?? "" : base64;
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function toTranscriptionUploadable(
  audio: TranscribeAudioInput,
  filename?: string
): File {
  const resolvedFilename = filename ?? `audio.${getAudioExtension(audio.mimeType)}`;
  return new File([base64ToArrayBuffer(audio.data)], resolvedFilename, {
    type: audio.mimeType,
  });
}

function toOpenAiContentPart(part: ContentPart): ChatCompletionContentPart {
  if (part.type === "text") {
    return { type: "text", text: part.text };
  }

  if (part.type === "image") {
    return {
      type: "image_url",
      image_url: { url: toDataUrl(part.mimeType, part.data) },
    };
  }

  return {
    type: "input_audio",
    input_audio: {
      data: part.data,
      format: toOpenAiAudioFormat(part.mimeType),
    },
  };
}

function toOpenAiMessage(message: Message): ChatCompletionMessageParam {
  if (message.role === "assistant") {
    return {
      role: "assistant",
      content: message.content
        .filter((part): part is Extract<ContentPart, { type: "text" }> => part.type === "text")
        .map((part) => part.text)
        .join("\n"),
    };
  }

  const content = message.content.map(toOpenAiContentPart);
  if (content.length === 1 && content[0].type === "text") {
    return { role: "user", content: content[0].text };
  }

  return { role: "user", content };
}

function toOpenAiMessages(request: GenerateRequest): ChatCompletionMessageParam[] {
  const messages: ChatCompletionMessageParam[] = [];

  if (request.system?.trim()) {
    messages.push({ role: "system", content: request.system });
  }

  for (const message of request.messages) {
    messages.push(toOpenAiMessage(message));
  }

  return messages;
}

function parseToolCallArguments(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || "{}") as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Model may return invalid JSON; fall back to empty args.
  }
  return {};
}

function toOpenAiToolCall(
  part: Extract<AgentContentPart, { type: "functionCall" }>,
  index: number
): ChatCompletionMessageToolCall {
  return {
    id: part.id ?? `call_${part.name}_${index}`,
    type: "function",
    function: {
      name: part.name,
      arguments: JSON.stringify(part.args ?? {}),
    },
  };
}

function toOpenAiAgentMessages(
  request: AgentTurnRequest
): ChatCompletionMessageParam[] {
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: request.system },
  ];

  for (const message of request.messages) {
    if (message.role === "user") {
      const text = message.parts
        .filter((part): part is Extract<AgentContentPart, { type: "text" }> => part.type === "text")
        .map((part) => part.text)
        .join("\n");
      messages.push({ role: "user", content: text });
      continue;
    }

    if (message.role === "model") {
      const text = message.parts
        .filter((part): part is Extract<AgentContentPart, { type: "text" }> => part.type === "text")
        .map((part) => part.text)
        .join("\n");
      const functionCallParts = message.parts.filter(
        (part): part is Extract<AgentContentPart, { type: "functionCall" }> =>
          part.type === "functionCall"
      );
      const toolCalls = functionCallParts.map(toOpenAiToolCall);

      messages.push({
        role: "assistant",
        content: text || null,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      });
      continue;
    }

    for (const part of message.parts) {
      if (part.type !== "functionResponse") continue;
      messages.push({
        role: "tool",
        tool_call_id: part.id ?? `call_${part.name}`,
        content: JSON.stringify(part.response),
      });
    }
  }

  return messages;
}

function toOpenAiAgentTools(
  request: AgentTurnRequest
): ChatCompletionTool[] {
  return request.functionDeclarations.map((declaration) => ({
    type: "function",
    function: {
      name: declaration.name,
      description: declaration.description,
      parameters:
        (declaration.parametersJsonSchema as Record<string, unknown> | undefined) ?? {
          type: "object",
          properties: {},
        },
    },
  }));
}

function parseOpenAiAgentTurnResponse(
  message: ChatCompletionMessage
): AgentTurnResponse {
  const modelParts: AgentContentPart[] = [];
  const functionCalls: AgentFunctionCall[] = [];

  if (message.content?.trim()) {
    modelParts.push({ type: "text", text: message.content });
  }

  for (const toolCall of message.tool_calls ?? []) {
    if (toolCall.type !== "function") continue;

    const args = parseToolCallArguments(toolCall.function.arguments);
    const call: AgentFunctionCall = {
      id: toolCall.id,
      name: toolCall.function.name,
      args,
    };
    functionCalls.push(call);
    modelParts.push({
      type: "functionCall",
      id: toolCall.id,
      name: toolCall.function.name,
      args,
    });
  }

  return {
    text: message.content ?? undefined,
    functionCalls,
    modelParts: modelParts.length ? modelParts : undefined,
  };
}

export class OpenAIProvider extends BaseProvider implements AiProvider {
  readonly id = "openai" as const;

  private client: OpenAI | null = null;
  private activeToken = "";

  private ensureClient(): OpenAI {
    const token = resolveApiToken("openai");
    if (!token) {
      throw new AiError(OPENAI_MISSING_TOKEN_ERROR, "missing_token", "openai");
    }

    if (!this.client || this.activeToken !== token) {
      this.client = new OpenAI({ apiKey: token, dangerouslyAllowBrowser: true });
      this.activeToken = token;
    }

    return this.client;
  }

  getCapabilities(model: string): ProviderCapabilities {
    return getModelById(model).capabilities;
  }

  async generate(request: GenerateRequest): Promise<string> {
    const cacheKey = this.getCacheKey(this.id, "generate", request);
    const cached = this.readCache(cacheKey);
    if (cached !== undefined) return cached;

    try {
      const client = this.ensureClient();
      const completion = await client.chat.completions.create({
        model: request.model,
        messages: toOpenAiMessages(request),
      });

      const result = completion.choices[0]?.message?.content ?? "";
      this.writeCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error("OpenAI generate error:", error);
      throw error;
    }
  }

  async transcribeAudio(
    audio: TranscribeAudioInput,
    options?: TranscribeAudioOptions
  ): Promise<string> {
    try {
      const client = this.ensureClient();
      const response = await client.audio.transcriptions.create({
        file: toTranscriptionUploadable(audio, options?.filename),
        model: options?.model ?? DEFAULT_TRANSCRIBE_MODEL,
      });

      return (response.text ?? "").trim();
    } catch (error) {
      console.error("OpenAI transcription error:", error);
      throw error;
    }
  }

  async *stream(request: GenerateRequest): AsyncGenerator<string, void, unknown> {
    try {
      const client = this.ensureClient();
      const stream = await client.chat.completions.create({
        model: request.model,
        messages: toOpenAiMessages(request),
        stream: true,
      });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) {
          yield text;
        }
      }
    } catch (error) {
      console.error("OpenAI stream error:", error);
      throw error;
    }
  }

  async generateAgentTurn(request: AgentTurnRequest): Promise<AgentTurnResponse> {
    const cacheKey = this.getCacheKey(this.id, "generateAgentTurn", request);
    const cached = this.readAgentTurnCache(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const client = this.ensureClient();
      const completion = await client.chat.completions.create({
        model: request.model,
        messages: toOpenAiAgentMessages(request),
        tools: toOpenAiAgentTools(request),
        tool_choice: "auto",
      });

      const message = completion.choices[0]?.message;
      if (!message) {
        return { functionCalls: [] };
      }

      const result = parseOpenAiAgentTurnResponse(message);
      this.writeAgentTurnCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error("OpenAI agent turn error:", error);
      throw error;
    }
  }
}
