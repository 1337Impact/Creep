import React, { useState, useEffect, useCallback } from "react";
import { FloatingOwlButton } from "@/components/FloatingOwlButton";
import { ChatPanel } from "@/components/ChatPanel";
import { readActiveSession } from "@/agent/active-session";
import { useFloatingButton } from "@/hooks/useFloatingButton";
import { useFloatingUiPersistence } from "@/hooks/useFloatingUiPersistence";
import type { ConversationData } from "@/types/chat";

const ChatInterface: React.FC<{
  registerSetters: (
    setSelectedText: (text: string) => void,
    openChat: () => void,
    toggleChat: () => void,
    openChatWithVoice: () => void,
    addMessagesToChat: (conversation: ConversationData) => void
  ) => void;
}> = ({ registerSetters }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [chatMounted, setChatMounted] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [voiceRecordingRequestId, setVoiceRecordingRequestId] = useState(0);
  const [pendingConversation, setPendingConversation] =
    useState<ConversationData | null>(null);

  const {
    buttonPosition,
    setButtonPosition,
    isDragging,
    buttonRef,
    hasDraggedRef,
    handleMouseDown,
  } = useFloatingButton();

  const { chatSize, setChatSize } = useFloatingUiPersistence({
    buttonPosition,
    setButtonPosition,
  });

  const openChat = useCallback(() => {
    setChatMounted(true);
    setIsOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleChat = useCallback(() => {
    setChatMounted(true);
    setIsOpen((open) => !open);
  }, []);

  const openChatWithVoice = useCallback(() => {
    setChatMounted(true);
    setIsOpen(true);
    setVoiceRecordingRequestId((requestId) => requestId + 1);
  }, []);

  const addMessagesToChat = useCallback(
    (conversation: ConversationData) => {
      setPendingConversation(conversation);
      openChat();
    },
    [openChat]
  );

  useEffect(() => {
    void readActiveSession().then((stored) => {
      if (stored && stored.phase !== "idle") {
        setChatMounted(true);
        if (stored.isChatOpen !== false) {
          setIsOpen(true);
        }
      }
    });
  }, []);

  useEffect(() => {
    registerSetters(setSelectedText, openChat, toggleChat, openChatWithVoice, addMessagesToChat);
  }, [registerSetters, openChat, toggleChat, openChatWithVoice, addMessagesToChat]);

  return (
    <>
      {!isOpen && (
        <FloatingOwlButton
          buttonPosition={buttonPosition}
          isDragging={isDragging}
          buttonRef={buttonRef}
          hasDraggedRef={hasDraggedRef}
          onMouseDown={handleMouseDown}
          onOpen={openChat}
        />
      )}
      {chatMounted && (
        <ChatPanel
          isOpen={isOpen}
          onClose={closeChat}
          buttonPosition={buttonPosition}
          chatSize={chatSize}
          setChatSize={setChatSize}
          selectedText={selectedText}
          setSelectedText={setSelectedText}
          pendingConversation={pendingConversation}
          onPendingConversationApplied={() => setPendingConversation(null)}
          voiceRecordingRequestId={voiceRecordingRequestId}
        />
      )}
    </>
  );
};

export default ChatInterface;
