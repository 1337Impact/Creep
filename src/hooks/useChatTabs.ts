import { useCallback, useEffect, useState } from "react";
import {
  CHAT_MAX_TABS,
  DEFAULT_MODEL,
  getChatStorageKey,
  getInitialGreeting,
  getPageHost,
  getRandomUnusedTabName,
} from "@/constants/chat";
import {
  appendConversationToTab,
  updateTabById,
} from "@/state/chatUpdates";
import type { ChatSessionEntry, ChatTab, ConversationData } from "@/types/chat";
import {
  deleteStoredSession,
  listSessions,
  loadSessionTab,
  toSessionKey,
} from "@/utils/sessions";

function makeTab(usedNames: string[]): ChatTab {
  const name = getRandomUnusedTabName(usedNames);
  return {
    id: Date.now().toString(),
    name,
    messages: [{ text: getInitialGreeting(name), role: "model" }],
    history: [],
    modelId: DEFAULT_MODEL.id,
    host: getPageHost(),
  };
}

function findTabForSession(
  tabs: ChatTab[],
  session: ChatSessionEntry,
  pageKey: string
): ChatTab | undefined {
  const key = toSessionKey(session.storageKey, session.tabId);
  return tabs.find(
    (t) =>
      t.sessionKey === key ||
      (session.storageKey === pageKey && t.id === session.tabId)
  );
}

function addTabWithLimit(
  tabs: ChatTab[],
  tab: ChatTab,
  activeTabId: string
): ChatTab[] {
  const next = [...tabs, tab];
  if (next.length <= CHAT_MAX_TABS) return next;
  const drop = tabs.findIndex((t) => t.id !== activeTabId);
  return [...tabs.filter((_, i) => i !== (drop >= 0 ? drop : 0)), tab];
}

export function useChatTabs() {
  const [tabs, setTabs] = useState<ChatTab[]>([]);
  const [activeTabId, setActiveTabId] = useState("");
  const [sessions, setSessions] = useState<ChatSessionEntry[]>([]);
  const pageKey = getChatStorageKey();

  const refreshSessions = useCallback(() => {
    chrome.storage.local.get(null, (all) => setSessions(listSessions(all)));
  }, []);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions, tabs, activeTabId]);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0] ?? null;

  const addTab = useCallback(() => {
    setTabs((prev) => {
      if (prev.length >= CHAT_MAX_TABS) return prev;
      const tab = makeTab(prev.map((t) => t.name));
      setActiveTabId(tab.id);
      return [...prev, tab];
    });
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      if (prev.length === 1) return prev;
      const next = prev.filter((t) => t.id !== tabId);
      setActiveTabId((id) => (id === tabId ? next[next.length - 1].id : id));
      return next;
    });
  }, []);

  const removeTabLocally = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        const rest = prev.filter((t) => t.id !== tabId);
        if (!rest.length) {
          const tab = makeTab([]);
          setActiveTabId(tab.id);
          return [tab];
        }
        if (activeTabId !== tabId) return rest;
        const tab = makeTab(rest.map((t) => t.name));
        setActiveTabId(tab.id);
        return addTabWithLimit(rest, tab, activeTabId);
      });
    },
    [activeTabId]
  );

  const openSession = useCallback(
    async (session: ChatSessionEntry): Promise<boolean> => {
      const loaded = await loadSessionTab(session.storageKey, session.tabId);
      if (!loaded) return false;

      setTabs((prev) => {
        const existing = findTabForSession(prev, session, pageKey);
        if (existing) {
          setActiveTabId(existing.id);
          return prev;
        }
        const tab = prev.some((t) => t.id === loaded.id)
          ? { ...loaded, id: Date.now().toString() }
          : loaded;
        setActiveTabId(tab.id);
        return addTabWithLimit(prev, tab, activeTabId);
      });
      return true;
    },
    [activeTabId, pageKey]
  );

  const deleteSession = useCallback(
    async (session: ChatSessionEntry) => {
      await deleteStoredSession(session.storageKey, session.tabId);
      if (session.storageKey === pageKey) removeTabLocally(session.tabId);
      refreshSessions();
    },
    [pageKey, removeTabLocally, refreshSessions]
  );

  const setModelForActiveTab = useCallback(
    (modelId: string) => {
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTabId ? { ...tab, modelId } : tab
        )
      );
    },
    [activeTabId]
  );

  const addConversationToActiveTab = useCallback(
    (conversation: ConversationData) => {
      setTabs((prev) =>
        updateTabById(prev, activeTabId, (tab) =>
          appendConversationToTab(tab, conversation)
        )
      );
    },
    [activeTabId]
  );

  const isSessionActive = useCallback(
    (session: ChatSessionEntry) => {
      const open = tabs.find((t) => t.id === activeTabId);
      return (
        open?.sessionKey === toSessionKey(session.storageKey, session.tabId) ||
        (session.storageKey === pageKey && session.tabId === activeTabId)
      );
    },
    [tabs, activeTabId, pageKey]
  );

  return {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    activeTab,
    addTab,
    closeTab,
    openSession,
    deleteSession,
    sessions,
    isSessionActive,
    setModelForActiveTab,
    addConversationToActiveTab,
  };
}
