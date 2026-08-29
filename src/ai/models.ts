import type { AiModel, ProviderCapabilities } from "./types";

const GEMINI_CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  vision: true,
  audioInput: true,
  webSearch: true,
};

const OPENAI_CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  vision: true,
  audioInput: true,
  webSearch: false,
};

const CURSOR_CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  vision: false,
  audioInput: false,
  webSearch: false,
};

export const AI_MODELS: AiModel[] = [
  {
    id: "models/gemini-flash-lite-latest",
    name: "Flash Lite",
    provider: "gemini",
    capabilities: GEMINI_CAPABILITIES,
  },
  {
    id: "models/gemini-flash-latest",
    name: "Flash",
    provider: "gemini",
    capabilities: GEMINI_CAPABILITIES,
  },
  {
    id: "models/gemini-2.5-pro",
    name: "Pro",
    provider: "gemini",
    capabilities: GEMINI_CAPABILITIES,
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    capabilities: OPENAI_CAPABILITIES,
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    capabilities: OPENAI_CAPABILITIES,
  },
  {
    id: "composer-2.5",
    name: "Cursor",
    provider: "cursor",
    capabilities: CURSOR_CAPABILITIES,
  },
];

export const DEFAULT_MODEL = AI_MODELS[1];

export const DEFAULT_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";

/** UI-facing model list ({ id, name } only). */
export const CHAT_MODELS = AI_MODELS.map(({ id, name }) => ({ id, name }));

export function getModelById(modelId?: string): AiModel {
  return AI_MODELS.find((model) => model.id === modelId) ?? DEFAULT_MODEL;
}

export function getProviderForModel(modelId: string) {
  return getModelById(modelId).provider;
}
