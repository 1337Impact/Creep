import { useEffect, useState } from "react";
import {
  CHAT_DEFAULT_SIZE,
  CHAT_MIN_SIZE,
  FLOATING_BUTTON_Y_OFFSET,
} from "@/constants/chat";
import type { FloatingButtonPosition } from "@/hooks/useFloatingButton";

interface UseFloatingUiPersistenceOptions {
  buttonPosition: FloatingButtonPosition;
  setButtonPosition: React.Dispatch<React.SetStateAction<FloatingButtonPosition>>;
}

export function useFloatingUiPersistence({
  buttonPosition,
  setButtonPosition,
}: UseFloatingUiPersistenceOptions) {
  const [chatSize, setChatSize] = useState({ ...CHAT_DEFAULT_SIZE });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(["buttonPosition", "chatWindowSize"], (result) => {
      if (result.buttonPosition) {
        const savedPos = result.buttonPosition as FloatingButtonPosition;
        setButtonPosition({
          x: savedPos.side === "left" ? 0 : window.innerWidth,
          y: Math.max(
            0,
            Math.min(
              window.innerHeight - FLOATING_BUTTON_Y_OFFSET,
              savedPos.y
            )
          ),
          side: savedPos.side || "right",
        });
      }

      const savedSize = result.chatWindowSize as typeof CHAT_DEFAULT_SIZE | undefined;
      if (
        savedSize &&
        savedSize.width >= CHAT_MIN_SIZE.width &&
        savedSize.height >= CHAT_MIN_SIZE.height
      ) {
        setChatSize(savedSize);
      }

      setIsLoaded(true);
    });
  }, [setButtonPosition]);

  useEffect(() => {
    if (!isLoaded) return;

    const id = setTimeout(() => {
      chrome.storage.local.set({ buttonPosition, chatWindowSize: chatSize });
    }, 300);

    return () => clearTimeout(id);
  }, [buttonPosition, chatSize, isLoaded]);

  return { chatSize, setChatSize, isLoaded };
}
