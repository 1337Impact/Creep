import type { ProviderId } from "./types";

const ENV_API_KEYS: Partial<Record<ProviderId, string>> = {
  gemini: import.meta.env.VITE_GEMINI_API_KEY || "",
};

export const API_TOKEN_STORAGE_KEYS: Record<ProviderId, string> = {
  gemini: "creep_gemini_api_token",
  openai: "creep_openai_api_token",
  anthropic: "creep_anthropic_api_token",
};

/** @deprecated Use API_TOKEN_STORAGE_KEYS.gemini */
export const GEMINI_API_TOKEN_STORAGE_KEY = API_TOKEN_STORAGE_KEYS.gemini;

export function resolveApiToken(provider: ProviderId): string {
  if (typeof window !== "undefined" && window.localStorage) {
    const storedToken = window.localStorage
      .getItem(API_TOKEN_STORAGE_KEYS[provider])
      ?.trim();
    if (storedToken) {
      return storedToken;
    }
  }

  return ENV_API_KEYS[provider] ?? "";
}

export function hasApiToken(provider: ProviderId): boolean {
  return Boolean(resolveApiToken(provider));
}
