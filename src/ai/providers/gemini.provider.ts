import { GoogleGenAI } from "@google/genai";
import { GEMINI_MISSING_TOKEN_ERROR } from "@/constants/messages";
import { resolveApiToken } from "../auth";
import { AiError } from "../errors";
import { getModelById } from "../models";
import type {
  ContentPart,
  GenerateRequest,
  Message,
  ProviderCapabilities,
  ToolConfig,
} from "../types";
import { BaseProvider } from "./base-provider";
import type { AiProvider } from "./provider.interface";

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

type GeminiContent = {
  role: "user" | "model";
  parts: GeminiPart[];
};

type GeminiRequestConfig = {
  systemInstruction: string;
  tools?: Array<{ googleSearch: Record<string, never> }>;
};

function toGeminiPart(part: ContentPart): GeminiPart {
  if (part.type === "text") {
    return { text: part.text };
  }

  return {
    inlineData: {
      mimeType: part.mimeType,
      data: part.data,
    },
  };
}

function toGeminiContents(messages: Message[]): GeminiContent[] {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: message.content.map(toGeminiPart),
  }));
}

function toGeminiTools(tools?: ToolConfig[]): GeminiRequestConfig["tools"] {
  if (!tools?.some((tool) => tool.type === "web_search")) {
    return undefined;
  }

  return [{ googleSearch: {} }];
}

function buildGeminiConfig(
  systemInstruction: string,
  tools?: ToolConfig[]
): GeminiRequestConfig {
  const config: GeminiRequestConfig = { systemInstruction };
  const geminiTools = toGeminiTools(tools);
  if (geminiTools) {
    config.tools = geminiTools;
  }
  return config;
}

export class GeminiProvider extends BaseProvider implements AiProvider {
  readonly id = "gemini" as const;

  private ai: GoogleGenAI | null = null;
  private activeToken = "";

  private ensureClient(): GoogleGenAI {
    const token = resolveApiToken("gemini");
    if (!token) {
      throw new AiError(GEMINI_MISSING_TOKEN_ERROR, "missing_token", "gemini");
    }

    if (!this.ai || this.activeToken !== token) {
      this.ai = new GoogleGenAI({ apiKey: token });
      this.activeToken = token;
    }

    return this.ai;
  }

  getCapabilities(model: string): ProviderCapabilities {
    return getModelById(model).capabilities;
  }

  async generate(request: GenerateRequest): Promise<string> {
    const cacheKey = this.getCacheKey(this.id, "generate", request);
    const cached = this.readCache(cacheKey);
    if (cached !== undefined) return cached;

    try {
      const ai = this.ensureClient();
      const config = buildGeminiConfig(request.system ?? "", request.tools);

      const response = await ai.models.generateContent({
        model: request.model,
        contents: toGeminiContents(request.messages),
        config,
      });

      const result = response.text || "";
      this.writeCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error("Generate error:", error);
      throw error;
    }
  }

  async *stream(request: GenerateRequest): AsyncGenerator<string, void, unknown> {
    try {
      const ai = this.ensureClient();
      const config = buildGeminiConfig(request.system ?? "", request.tools);

      const response = await ai.models.generateContentStream({
        model: request.model,
        contents: toGeminiContents(request.messages),
        config,
      });

      for await (const chunk of response) {
        const chunkText = chunk.text;
        if (chunkText) {
          yield chunkText;
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      throw error;
    }
  }
}
