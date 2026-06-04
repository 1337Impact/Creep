import {
  createPartFromFunctionResponse,
  createPartFromText,
  GoogleGenAI,
  type Content,
  type FunctionDeclaration,
  type Part,
} from "@google/genai";
import { GEMINI_MISSING_TOKEN_ERROR } from "@/constants/messages";
import type {
  AgentContentPart,
  AgentFunctionCall,
  AgentMessage,
  AgentTurnRequest,
  AgentTurnResponse,
} from "../agent-turn";
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

type GeminiChatConfig = {
  systemInstruction: string;
  tools?: Array<{ googleSearch: Record<string, never> }>;
};

type GeminiAgentConfig = {
  systemInstruction: string;
  tools: Array<{ functionDeclarations: FunctionDeclaration[] }>;
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

function toGeminiTools(tools?: ToolConfig[]): GeminiChatConfig["tools"] {
  if (!tools?.some((tool) => tool.type === "web_search")) {
    return undefined;
  }

  return [{ googleSearch: {} }];
}

function buildGeminiConfig(
  systemInstruction: string,
  tools?: ToolConfig[]
): GeminiChatConfig {
  const config: GeminiChatConfig = { systemInstruction };
  const geminiTools = toGeminiTools(tools);
  if (geminiTools) {
    config.tools = geminiTools;
  }
  return config;
}

function toGeminiAgentPart(part: AgentContentPart): Part {
  if (part.type === "text") {
    return part.thoughtSignature
      ? { ...createPartFromText(part.text), thoughtSignature: part.thoughtSignature }
      : createPartFromText(part.text);
  }

  if (part.type === "functionCall") {
    return {
      functionCall: {
        id: part.id,
        name: part.name,
        args: part.args,
      },
      ...(part.thoughtSignature ? { thoughtSignature: part.thoughtSignature } : {}),
    };
  }

  return createPartFromFunctionResponse(
    part.id ?? "",
    part.name,
    part.response
  );
}

function parseAgentTurnResponse(response: {
  text?: string;
  candidates?: Array<{ content?: { parts?: Part[] } }>;
}): AgentTurnResponse {
  const rawParts = response.candidates?.[0]?.content?.parts ?? [];
  const modelParts: AgentContentPart[] = [];
  const functionCalls: AgentFunctionCall[] = [];

  for (const part of rawParts) {
    if (part.text != null && part.text !== "") {
      modelParts.push({
        type: "text",
        text: part.text,
        ...(part.thoughtSignature ? { thoughtSignature: part.thoughtSignature } : {}),
      });
    }

    const fc = part.functionCall;
    if (fc?.name) {
      const call: AgentFunctionCall = {
        id: fc.id,
        name: fc.name,
        args: (fc.args as Record<string, unknown> | undefined) ?? {},
        ...(part.thoughtSignature ? { thoughtSignature: part.thoughtSignature } : {}),
      };
      functionCalls.push(call);
      modelParts.push({
        type: "functionCall",
        id: fc.id,
        name: fc.name,
        args: call.args,
        ...(part.thoughtSignature ? { thoughtSignature: part.thoughtSignature } : {}),
      });
    }
  }

  return {
    text: response.text,
    functionCalls,
    modelParts,
  };
}

function toGeminiAgentRole(role: AgentMessage["role"]): "user" | "model" {
  return role === "model" ? "model" : "user";
}

function toGeminiAgentContents(messages: AgentMessage[]): Content[] {
  return messages.map((message) => ({
    role: toGeminiAgentRole(message.role),
    parts: message.parts.map(toGeminiAgentPart),
  }));
}

function buildGeminiAgentConfig(request: AgentTurnRequest): GeminiAgentConfig {
  return {
    systemInstruction: request.system,
    tools: [
      {
        functionDeclarations: request.functionDeclarations.map((d) => ({
          name: d.name,
          description: d.description,
          parametersJsonSchema: d.parametersJsonSchema,
        })),
      },
    ],
  };
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

  async generateAgentTurn(request: AgentTurnRequest): Promise<AgentTurnResponse> {
    const cacheKey = this.getCacheKey(this.id, "generateAgentTurn", request);
    const cached = this.readAgentTurnCache(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const ai = this.ensureClient();
      const config = buildGeminiAgentConfig(request);

      const response = await ai.models.generateContent({
        model: request.model,
        contents: toGeminiAgentContents(request.messages),
        config,
      });

      const result = parseAgentTurnResponse(response);
      this.writeAgentTurnCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error("Agent turn error:", error);
      throw error;
    }
  }
}
