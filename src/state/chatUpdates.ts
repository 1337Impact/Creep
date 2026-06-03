import type { Message } from "@/ai/types";
import type { ChatTab, ConversationData } from "@/types/chat";

export function updateTabById(
  tabs: ChatTab[],
  tabId: string,
  updater: (tab: ChatTab) => ChatTab
): ChatTab[] {
  return tabs.map((tab) => (tab.id === tabId ? updater(tab) : tab));
}

export function appendUserMessage(tab: ChatTab, displayText: string): ChatTab {
  return {
    ...tab,
    messages: [...tab.messages, { text: displayText, role: "user" }],
  };
}

export function setTabHistory(tab: ChatTab, history: Message[]): ChatTab {
  return { ...tab, history };
}

export function startStreamingModelMessage(tab: ChatTab): ChatTab {
  return {
    ...tab,
    messages: [...tab.messages, { text: "", role: "model" }],
  };
}

export function appendStreamingChunk(
  tab: ChatTab,
  accumulatedResponse: string
): ChatTab {
  const messages = [...tab.messages];
  messages[messages.length - 1] = { text: accumulatedResponse, role: "model" };
  return { ...tab, messages };
}

export function appendModelError(tab: ChatTab, errorMessage: string): ChatTab {
  const messages = [...tab.messages];
  if (
    messages.length > 0 &&
    messages[messages.length - 1].role === "model" &&
    messages[messages.length - 1].text === ""
  ) {
    messages.pop();
  }
  return {
    ...tab,
    messages: [...messages, { text: `Sorry — ${errorMessage}`, role: "model" }],
  };
}

export function appendConversationToTab(
  tab: ChatTab,
  conversation: ConversationData
): ChatTab {
  const newMessages = [...tab.messages];
  newMessages.push({ text: conversation.userMessage, role: "user" });
  if (conversation.modelResponse) {
    newMessages.push({
      text: conversation.modelResponse,
      role: "model",
    });
  }

  const newHistory = [...tab.history];
  newHistory.push({
    role: "user",
    content: [{ type: "text", text: conversation.userMessage }],
  });
  if (conversation.modelResponse) {
    newHistory.push({
      role: "assistant",
      content: [{ type: "text", text: conversation.modelResponse }],
    });
  }

  return { ...tab, messages: newMessages, history: newHistory };
}
