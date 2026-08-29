import type { Message } from "@/ai/types";
import type { ChatTab, ConversationData, CursorChatMessage } from "@/types/chat";

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
  const last = messages[messages.length - 1];
  if (
    messages.length > 0 &&
    last.role === "model" &&
    last.text === ""
  ) {
    messages.pop();
  }
  return {
    ...tab,
    messages: [...messages, { text: `Sorry — ${errorMessage}`, role: "model" }],
  };
}

export function startAgentMessage(tab: ChatTab, agentId: string): ChatTab {
  return {
    ...tab,
    messages: [
      ...tab.messages,
      { role: "agent", agentId, status: "running" },
    ],
  };
}

export function finalizeAgentMessage(
  tab: ChatTab,
  agentMessageIndex: number,
  patch: { text: string; status: "done" | "error"; toolCallCount?: number }
): ChatTab {
  const messages = [...tab.messages];
  const msg = messages[agentMessageIndex];
  if (!msg || msg.role !== "agent") return tab;

  messages[agentMessageIndex] = {
    ...msg,
    text: patch.text,
    status: patch.status,
    toolCallCount: patch.toolCallCount ?? msg.toolCallCount,
  };
  return { ...tab, messages };
}

export function appendAgentHistory(
  tab: ChatTab,
  task: string,
  summary: string
): ChatTab {
  return {
    ...tab,
    history: [
      ...tab.history,
      { role: "user", content: [{ type: "text", text: task }] },
      { role: "assistant", content: [{ type: "text", text: summary }] },
    ],
  };
}

export function startCursorMessage(tab: ChatTab): ChatTab {
  return {
    ...tab,
    messages: [
      ...tab.messages,
      { role: "cursor", status: "running", text: "", events: [] },
    ],
  };
}

export function updateCursorMessage(
  tab: ChatTab,
  index: number,
  patch: Partial<Pick<CursorChatMessage, "text" | "status" | "events">>
): ChatTab {
  const messages = [...tab.messages];
  const msg = messages[index];
  if (!msg || msg.role !== "cursor") return tab;
  messages[index] = { ...msg, ...patch };
  return { ...tab, messages };
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
