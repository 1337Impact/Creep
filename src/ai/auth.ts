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

const cache: Partial<Record<ProviderId, string>> = {};
const STORAGE_KEYS = Object.values(API_TOKEN_STORAGE_KEYS);

function fillCache(store: Record<string, unknown>): void {
  for (const p of Object.keys(API_TOKEN_STORAGE_KEYS) as ProviderId[]) {
    const v = store[API_TOKEN_STORAGE_KEYS[p]];
    if (typeof v === "string" && v.trim()) cache[p] = v.trim();
  }
}

/** Page localStorage → extension storage → in-memory cache (for background agent). */
export async function ensureExtensionTokens(): Promise<void> {
  const patch: Record<string, string> = {};
  if (typeof window !== "undefined" && window.localStorage) {
    for (const key of STORAGE_KEYS) {
      const t = window.localStorage.getItem(key)?.trim();
      if (t) patch[key] = t;
    }
  }
  if (Object.keys(patch).length) await chrome.storage.local.set(patch);
  fillCache(await chrome.storage.local.get(STORAGE_KEYS));
}

export function persistApiToken(provider: ProviderId, token: string): void {
  const t = token.trim();
  if (!t) return;
  cache[provider] = t;
  const key = API_TOKEN_STORAGE_KEYS[provider];
  if (typeof window !== "undefined" && window.localStorage) window.localStorage.setItem(key, t);
  void chrome.storage.local.set({ [key]: t });
}

export function resolveApiToken(provider: ProviderId): string {
  if (typeof window !== "undefined" && window.localStorage) {
    const page = window.localStorage.getItem(API_TOKEN_STORAGE_KEYS[provider])?.trim();
    if (page) return page;
  }
  return cache[provider] ?? ENV_API_KEYS[provider] ?? "";
}

export function hasApiToken(provider: ProviderId): boolean {
  return Boolean(resolveApiToken(provider));
}
