import {
  GEMINI_MISSING_TOKEN_UI_MESSAGE,
} from "@/constants/messages";
import type { ProviderId } from "./types";

const DEFAULT_FALLBACK_ERROR =
  "Sorry, I couldn't process that request right now. Please try again in a moment.";

const AUTH_ERROR_MESSAGES: Partial<Record<ProviderId, string>> = {
  gemini: "Authentication failed. Please verify your Gemini API key configuration.",
  openai: "Authentication failed. Please verify your OpenAI API key configuration.",
  anthropic: "Authentication failed. Please verify your Anthropic API key configuration.",
};

export class AiError extends Error {
  readonly code: string;
  readonly provider: ProviderId;

  constructor(message: string, code: string, provider: ProviderId) {
    super(message);
    this.name = "AiError";
    this.code = code;
    this.provider = provider;
  }
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractNestedMessage(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const message = record.message;
  if (typeof message === "string" && message.trim()) return message;

  const errorObj = record.error as Record<string, unknown> | undefined;
  if (errorObj && typeof errorObj.message === "string" && errorObj.message.trim()) {
    return errorObj.message as string;
  }

  const detailsObj = record.details as Record<string, unknown> | undefined;
  if (detailsObj && typeof detailsObj.message === "string" && detailsObj.message.trim()) {
    return detailsObj.message as string;
  }

  return null;
}

function deriveFriendlyErrorMessage(message: string, provider?: ProviderId): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("token is missing") ||
    normalized.includes("missing token")
  ) {
    return GEMINI_MISSING_TOKEN_UI_MESSAGE;
  }

  if (
    normalized.includes("region is not supported") ||
    normalized.includes("location is not supported")
  ) {
    return "This AI model isn't available in your current region. Try another model or connect from a supported location.";
  }

  if (
    normalized.includes("api key") ||
    normalized.includes("permission_denied") ||
    normalized.includes("unauthorized")
  ) {
    return AUTH_ERROR_MESSAGES[provider ?? "gemini"] ?? AUTH_ERROR_MESSAGES.gemini!;
  }

  if (
    normalized.includes("resource_exhausted") ||
    normalized.includes("quota") ||
    normalized.includes("rate limit")
  ) {
    return "You've reached the current usage limit. Please wait a bit and try again.";
  }

  if (
    normalized.includes("deadline") ||
    normalized.includes("timeout") ||
    normalized.includes("network")
  ) {
    return "The request timed out or the network is unstable. Please retry.";
  }

  return DEFAULT_FALLBACK_ERROR;
}

export function getReadableAiError(error: unknown, provider?: ProviderId): string {
  if (!error) return DEFAULT_FALLBACK_ERROR;

  if (error instanceof AiError) {
    return deriveFriendlyErrorMessage(error.message, error.provider);
  }

  if (typeof error === "string") {
    const parsed = safeJsonParse(error);
    const nestedMessage = extractNestedMessage(parsed);
    if (nestedMessage) return deriveFriendlyErrorMessage(nestedMessage, provider);
    return deriveFriendlyErrorMessage(error, provider);
  }

  if (error instanceof Error) {
    const parsed = safeJsonParse(error.message);
    const nestedMessage = extractNestedMessage(parsed);
    if (nestedMessage) return deriveFriendlyErrorMessage(nestedMessage, provider);
    if (error.message) {
      return deriveFriendlyErrorMessage(error.message, provider);
    }
  }

  if (typeof error === "object") {
    const maybeMessage = extractNestedMessage(error);
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return deriveFriendlyErrorMessage(maybeMessage, provider);
    }
  }

  return DEFAULT_FALLBACK_ERROR;
}

/** @deprecated Use getReadableAiError */
export const getReadableGeminiError = getReadableAiError;
