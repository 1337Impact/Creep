import type { ContentPart, Message, MessageRole } from "./types";

type LegacyHistoryEntry = {
  role: "user" | "model" | "assistant";
  parts?: Array<{ text: string }>;
  content?: ContentPart[];
};

export function normalizeHistoryEntry(entry: LegacyHistoryEntry): Message {
  if (entry.content && entry.content.length > 0) {
    return {
      role: entry.role === "model" ? "assistant" : entry.role,
      content: entry.content,
    };
  }

  const textParts = entry.parts ?? [];
  return {
    role: (entry.role === "model" ? "assistant" : entry.role) as MessageRole,
    content: textParts.map((part) => ({ type: "text" as const, text: part.text })),
  };
}

export function normalizeHistory(history: LegacyHistoryEntry[] | undefined): Message[] {
  if (!history) return [];
  return history.map(normalizeHistoryEntry);
}
