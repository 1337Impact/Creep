import { getModelById } from "../models";
import type { ProviderId } from "../types";
import { GeminiProvider } from "./gemini.provider";
import type { AiProvider } from "./provider.interface";

const providers: Partial<Record<ProviderId, AiProvider>> = {
  gemini: new GeminiProvider(),
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
