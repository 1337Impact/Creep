import { useEffect, useState } from "react";
import {
  CHAT_DEFAULT_SIZE,
  CHAT_MIN_SIZE,
  FLOATING_BUTTON_Y_OFFSET,
  getChatStorageKey,
  getPageHost,
} from "@/constants/chat";
import type { FloatingButtonPosition } from "@/hooks/useFloatingButton";
import type { ChatPersistedState, ChatTab } from "@/types/chat";
import { hydrateStoredTab } from "@/utils/sessions";

interface UseChatPersistenceOptions {
  tabs: ChatTab[];
  activeTabId: string;
  setTabs: React.Dispatch<React.SetStateAction<ChatTab[]>>;
  setActiveTabId: (id: string) => void;
  buttonPosition: FloatingButtonPosition;
  setButtonPosition: React.Dispatch<
    React.SetStateAction<FloatingButtonPosition>
  >;
}

export function useChatPersistence({
  tabs,
  activeTabId,
  setTabs,
  setActiveTabId,
  buttonPosition,
  setButtonPosition,
}: UseChatPersistenceOptions) {
  const [chatSize, setChatSize] = useState({ ...CHAT_DEFAULT_SIZE });

  useEffect(() => {
    const key = getChatStorageKey();
    chrome.storage.local.get([key, "buttonPosition", "chatWindowSize"], (result) => {
      if (result[key]) {
        const { tabs: savedTabs, activeTabId: savedActiveId } = result[key];
        if (savedTabs?.length) {
          const state = result[key] as ChatPersistedState;
          setTabs(savedTabs.map((tab) => hydrateStoredTab(tab, state)));
          if (savedActiveId) setActiveTabId(savedActiveId);
        }
      }
      if (result.buttonPosition) {
        const savedPos = result.buttonPosition as FloatingButtonPosition;
        setButtonPosition({
          x: savedPos.side === "left" ? 0 : window.innerWidth,
          y: Math.max(
            0,
            Math.min(window.innerHeight - FLOATING_BUTTON_Y_OFFSET, savedPos.y)
          ),
          side: savedPos.side || "right",
        });
      }
      const saved = result.chatWindowSize as typeof CHAT_DEFAULT_SIZE | undefined;
      if (
        saved?.width >= CHAT_MIN_SIZE.width &&
        saved?.height >= CHAT_MIN_SIZE.height
      ) {
        setChatSize(saved);
      }
    });
  }, [setTabs, setActiveTabId, setButtonPosition]);

  useEffect(() => {
    const id = setTimeout(() => {
      chrome.storage.local.set({ buttonPosition, chatWindowSize: chatSize });
    }, 300);
    return () => clearTimeout(id);
  }, [buttonPosition, chatSize]);

  useEffect(() => {
    const key = getChatStorageKey();
    const id = setTimeout(() => {
      const activeTab = tabs.find((tab) => tab.id === activeTabId);
      const payload: ChatPersistedState = {
        tabs,
        activeTabId,
        lastUpdated: Date.now(),
        url: window.location.href,
        host: getPageHost(),
        title: document.title || activeTab?.name,
      };
      chrome.storage.local.set({ [key]: payload });
    }, 500);
    return () => clearTimeout(id);
  }, [tabs, activeTabId]);

  return { chatSize, setChatSize };
}
