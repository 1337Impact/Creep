import { readActiveSession, writeActiveSession } from "@/agent/active-session";
import { deleteAgentRun } from "@/agent/persistence";
import { MSG, sendToRuntime } from "@/agent/protocol";
import { normalizeHistory } from "@/ai/history";
import {
  getModelById,
  getPageHost,
  isChatStorageKey,
} from "@/constants/chat";
import type {
  ChatMessageView,
  ChatPersistedState,
  ChatSessionEntry,
  ChatTab,
} from "@/types/chat";

export const toSessionKey = (storageKey: string, tabId: string) =>
  `${storageKey}:${tabId}`;

export const STALE_AGENT_RUN_MESSAGE =
  "This agent run was interrupted and could not be resumed.";

export function normalizeChatMessage(
  message: ChatMessageView,
  activeAgentId?: string | null
): ChatMessageView {
  if (message.role === "user" || message.role === "model") {
    return message;
  }

  const slim = {
    role: "agent" as const,
    agentId: message.agentId,
    status: message.status,
    text: message.text,
    toolCallCount: message.toolCallCount,
  };

  if (message.status === "running") {
    if (activeAgentId && message.agentId === activeAgentId) {
      return { ...slim, status: "running" as const };
    }
    return {
      ...slim,
      status: "error" as const,
      text: message.text ?? STALE_AGENT_RUN_MESSAGE,
    };
  }

  return {
    ...slim,
    status: message.status ?? (message.text ? "done" : "error"),
  };
}

export function hydrateStoredTab(
  tab: ChatTab,
  state?: ChatPersistedState,
  activeAgentId?: string | null
): ChatTab {
  const host =
    tab.host ??
    state?.host ??
    (state?.url ? getPageHost(state.url) : getPageHost());
  return {
    ...tab,
    modelId: getModelById(tab.modelId).id,
    host,
    messages: (tab.messages ?? []).map((message) =>
      normalizeChatMessage(message as ChatMessageView, activeAgentId)
    ),
    history: normalizeHistory(
      tab.history as Parameters<typeof normalizeHistory>[0]
    ),
  };
}

function readState(key: string): Promise<ChatPersistedState | undefined> {
  return new Promise((resolve) =>
    chrome.storage.local.get(key, (r) =>
      resolve(r[key] as ChatPersistedState | undefined)
    )
  );
}

export function listSessions(
  store: Record<string, unknown>
): ChatSessionEntry[] {
  const entries: ChatSessionEntry[] = [];
  for (const [storageKey, raw] of Object.entries(store)) {
    if (!isChatStorageKey(storageKey) || !raw || typeof raw !== "object") continue;
    const state = raw as ChatPersistedState;
    if (!state.tabs?.length) continue;
    const host = state.host ?? (state.url ? getPageHost(state.url) : "Unknown host");
    const updated = state.lastUpdated ?? 0;
    for (const tab of state.tabs) {
      entries.push({
        storageKey,
        tabId: tab.id,
        title: tab.name,
        host: tab.host ?? host,
        lastUpdated: updated,
      });
    }
  }
  return entries.sort((a, b) => b.lastUpdated - a.lastUpdated);
}

export async function loadSessionTab(
  storageKey: string,
  tabId: string
): Promise<ChatTab | null> {
  const state = await readState(storageKey);
  const tab = state?.tabs.find((t) => t.id === tabId);
  if (!tab) return null;
  return {
    ...hydrateStoredTab(tab, state),
    sessionKey: toSessionKey(storageKey, tabId),
  };
}

function agentIdsInTab(tab: ChatTab): string[] {
  const ids = new Set<string>();
  for (const message of tab.messages ?? []) {
    if (message.role === "agent" && message.agentId) {
      ids.add(message.agentId);
    }
  }
  return [...ids];
}

async function cleanupAgentsForDeletedTab(
  storageKey: string,
  tab: ChatTab
): Promise<void> {
  const agentIds = agentIdsInTab(tab);
  if (!agentIds.length) return;

  const stored = await readActiveSession();
  const touchesActive =
    stored &&
    (agentIds.includes(stored.agentId) ||
      (stored.chatStorageKey === storageKey && stored.activeTabId === tab.id));

  if (touchesActive) {
    try {
      await sendToRuntime({ type: MSG.AGENT_CANCEL, tabId: stored!.tabId });
    } catch {
      // Background may be unavailable during teardown
    }
    await writeActiveSession(null);
  }

  await Promise.all(agentIds.map((id) => deleteAgentRun(id)));
}

export async function deleteStoredSession(
  storageKey: string,
  tabId: string
): Promise<void> {
  const state = await readState(storageKey);
  if (!state?.tabs) return;

  const removed = state.tabs.find((t) => t.id === tabId);
  if (removed) {
    await cleanupAgentsForDeletedTab(storageKey, removed);
  }

  const tabs = state.tabs.filter((t) => t.id !== tabId);
  if (!tabs.length) {
    chrome.storage.local.remove(storageKey);
    return;
  }
  const activeTabId =
    state.activeTabId === tabId ? tabs[tabs.length - 1].id : state.activeTabId;
  chrome.storage.local.set({
    [storageKey]: { ...state, tabs, activeTabId, lastUpdated: Date.now() },
  });
}
