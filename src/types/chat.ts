import type { Message } from "@/ai/types";

export interface ConversationData {
  userMessage: string;
  modelResponse: string | null;
}

export type ChatMessageView =
  | { role: "user"; text: string }
  | { role: "model"; text: string }
  | {
      role: "agent";
      agentId: string;
      status: "running" | "done" | "error";
      text?: string;
      toolCallCount?: number;
    };

export interface ChatTab {
  id: string;
  name: string;
  messages: ChatMessageView[];
  history: Message[];
  modelId: string;
  host: string;
  /** `${storageKey}:${tabId}` when opened from session history. */
  sessionKey?: string;
}

export interface ChatPersistedState {
  tabs: ChatTab[];
  activeTabId: string;
  lastUpdated: number;
  url?: string;
  host?: string;
  title?: string;
}

export interface ChatSessionEntry {
  storageKey: string;
  tabId: string;
  title: string;
  host: string;
  lastUpdated: number;
}

export interface ChatModel {
  id: string;
  name: string;
}

export type AgentChatMessage = Extract<ChatMessageView, { role: "agent" }>;
