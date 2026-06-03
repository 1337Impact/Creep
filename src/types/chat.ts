import type { Message } from "@/ai/types";

export interface ConversationData {
  userMessage: string;
  modelResponse: string | null;
}

export interface ChatMessageView {
  text: string;
  role: "user" | "model";
}

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
