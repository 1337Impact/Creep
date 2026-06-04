import { useCallback, useEffect, useRef, useState } from "react";
import {
  createInitialTab,
  getChatStorageKey,
  getPageHost,
} from "@/constants/chat";
import type { ChatMessageView, ChatPersistedState, ChatTab } from "@/types/chat";
import {
  AGENT_ACTIVE_SESSION_KEY,
  patchActiveSession,
  readActiveSession,
  type StoredAgentActiveSession,
} from "@/agent/active-session";
import { relocateChatSession } from "@/utils/chatStorage";
import { hydrateStoredTab } from "@/utils/sessions";

export interface AgentPersistenceSession {
  isAgentRunning: boolean;
  isChatOpen: boolean;
  activeTabId: string;
  chatStorageKey: string;
  agentId: string;
}

interface UseChatPersistenceOptions {
  tabs: ChatTab[];
  activeTabId: string;
  setTabs: React.Dispatch<React.SetStateAction<ChatTab[]>>;
  setActiveTabId: (id: string) => void;
  onAgentSessionRestore?: (session: AgentPersistenceSession) => void;
}

function slimMessageForStorage(message: ChatMessageView): ChatMessageView {
  if (message.role !== "agent") return message;
  return {
    role: "agent",
    agentId: message.agentId,
    status: message.status,
    text: message.text,
    toolCallCount: message.toolCallCount,
  };
}

function buildChatPayload(
  tabs: ChatTab[],
  activeTabId: string
): ChatPersistedState {
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const slimTabs = tabs.map((tab) => ({
    ...tab,
    messages: tab.messages.map(slimMessageForStorage),
  }));
  return {
    tabs: slimTabs,
    activeTabId,
    lastUpdated: Date.now(),
    url: window.location.href,
    host: getPageHost(),
    title: document.title || activeTab?.name,
  };
}

function toPersistenceSession(
  stored: StoredAgentActiveSession
): AgentPersistenceSession {
  return {
    isAgentRunning: stored.phase !== "idle",
    isChatOpen: stored.isChatOpen,
    activeTabId: stored.activeTabId,
    chatStorageKey: stored.chatStorageKey,
    agentId: stored.agentId,
  };
}

export function useChatPersistence({
  tabs,
  activeTabId,
  setTabs,
  setActiveTabId,
  onAgentSessionRestore,
}: UseChatPersistenceOptions) {
  const [isHydrated, setIsHydrated] = useState(false);
  const agentSessionRef = useRef<AgentPersistenceSession | null>(null);

  const persistToCurrentPage = useCallback(
    (state: ChatPersistedState) => {
      const key = getChatStorageKey();
      chrome.storage.local.set({ [key]: state });
      return key;
    },
    []
  );

  const migrateAgentChatIfNeeded = useCallback(
    async (fromKey: string, state: ChatPersistedState): Promise<string> => {
      const toKey = await relocateChatSession(fromKey, state);
      if (agentSessionRef.current?.isAgentRunning && fromKey !== toKey) {
        agentSessionRef.current = {
          ...agentSessionRef.current,
          chatStorageKey: toKey,
        };
        await patchActiveSession({ chatStorageKey: toKey });
      }
      return toKey;
    },
    []
  );

  useEffect(() => {
    const pageKey = getChatStorageKey();

    void readActiveSession().then((stored) => {
      const running = stored && stored.phase !== "idle";
      const loadKey = running ? stored!.chatStorageKey : pageKey;
      const activeAgentId = running ? stored!.agentId : null;

      agentSessionRef.current = running ? toPersistenceSession(stored!) : null;

      chrome.storage.local.get([loadKey], (result) => {
          const saved = result[loadKey] as ChatPersistedState | undefined;
          const hydratedTabs = saved?.tabs?.length
            ? saved.tabs.map((tab) =>
                hydrateStoredTab(tab, saved, activeAgentId)
              )
            : null;
          const restoredTabId =
            running && stored!.activeTabId
              ? stored!.activeTabId
              : saved?.activeTabId;

          const finish = () => {
            setIsHydrated(true);
          };

          if (hydratedTabs) {
            setTabs(hydratedTabs);
            if (restoredTabId) setActiveTabId(restoredTabId);
          } else {
            const tab = createInitialTab();
            setTabs([tab]);
            setActiveTabId(tab.id);
          }

          if (running && stored && hydratedTabs && loadKey !== pageKey) {
            const payload = buildChatPayload(
              hydratedTabs,
              restoredTabId ?? saved!.activeTabId
            );
            void migrateAgentChatIfNeeded(loadKey, payload).then(() => {
              onAgentSessionRestore?.(agentSessionRef.current!);
              finish();
            });
            return;
          }

          if (running && stored) {
            onAgentSessionRestore?.(toPersistenceSession(stored));
          }
          finish();
        }
      );
    });
  }, [
    setTabs,
    setActiveTabId,
    onAgentSessionRestore,
    migrateAgentChatIfNeeded,
  ]);

  useEffect(() => {
    if (!isHydrated) return;

    const id = setTimeout(() => {
      persistToCurrentPage(buildChatPayload(tabs, activeTabId));
    }, 500);

    return () => clearTimeout(id);
  }, [tabs, activeTabId, isHydrated, persistToCurrentPage]);

  useEffect(() => {
    if (!isHydrated || !agentSessionRef.current?.isAgentRunning) return;

    const pageKey = getChatStorageKey();
    const fromKey = agentSessionRef.current.chatStorageKey;
    if (fromKey === pageKey) return;

    void migrateAgentChatIfNeeded(
      fromKey,
      buildChatPayload(tabs, activeTabId)
    );
  }, [tabs, activeTabId, isHydrated, migrateAgentChatIfNeeded]);

  useEffect(() => {
    if (!isHydrated || !agentSessionRef.current?.isAgentRunning) return;

    const flush = () => {
      persistToCurrentPage(buildChatPayload(tabs, activeTabId));
    };

    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [tabs, activeTabId, isHydrated, persistToCurrentPage]);

  const setAgentSessionActive = useCallback(
    (session: AgentPersistenceSession | null) => {
      agentSessionRef.current = session;
    },
    []
  );

  return { isHydrated, setAgentSessionActive };
}

export { AGENT_ACTIVE_SESSION_KEY };
