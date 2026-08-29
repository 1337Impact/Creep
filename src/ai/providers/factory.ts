import type { AgentTurnRequest, AgentTurnResponse } from "../agent-turn";
import { AiError } from "../errors";
import { getModelById } from "../models";
import type { ProviderId } from "../types";
import { GeminiProvider } from "./gemini.provider";
import { OpenAIProvider } from "./openai.provider";
import type { AiProvider } from "./provider.interface";

export type AgentCapableProvider = {
  generateAgentTurn(request: AgentTurnRequest): Promise<AgentTurnResponse>;
};

const providers: Partial<Record<ProviderId, AiProvider>> = {
  gemini: new GeminiProvider(),
  openai: new OpenAIProvider(),
};

export function resolveProviderForModel(modelId: string): AiProvider {
  const providerId = getModelById(modelId).provider;
  const provider = providers[providerId];
  if (!provider) {
    throw new Error(`Provider "${providerId}" is not implemented yet.`);
  }
  return provider;
}

export function getProvider(providerId: ProviderId): AiProvider {
  const provider = providers[providerId];
  if (!provider) {
    throw new Error(`Provider "${providerId}" is not implemented yet.`);
  }
  return provider;
}

export function resolveAgentProvider(modelId: string): AgentCapableProvider {
  const provider = resolveProviderForModel(modelId);
  if (typeof (provider as { generateAgentTurn?: unknown }).generateAgentTurn !== "function") {
    const providerId = getModelById(modelId).provider;
    throw new AiError(
      `Provider "${providerId}" does not support agent turns.`,
      "agent_not_supported",
      providerId
    );
  }
  return provider as unknown as AgentCapableProvider;
}
