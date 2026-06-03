import { normalizeHistory } from "@/ai/history";
import {
  getModelById,
  getPageHost,
  isChatStorageKey,
} from "@/constants/chat";
import type { ChatPersistedState, ChatSessionEntry, ChatTab } from "@/types/chat";

export const toSessionKey = (storageKey: string, tabId: string) =>
  `${storageKey}:${tabId}`;

export function hydrateStoredTab(
  tab: ChatTab,
  state?: ChatPersistedState
): ChatTab {
  const host =
    tab.host ??
    state?.host ??
    (state?.url ? getPageHost(state.url) : getPageHost());
  return {
    ...tab,
    modelId: getModelById(tab.modelId).id,
    host,
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

export async function deleteStoredSession(
  storageKey: string,
  tabId: string
): Promise<void> {
  const state = await readState(storageKey);
  if (!state?.tabs) return;
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
