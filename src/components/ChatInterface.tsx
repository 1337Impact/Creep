import React, { useState, useRef, useEffect } from "react";
import {
  aiService,
  API_TOKEN_STORAGE_KEYS,
  GEMINI_MISSING_TOKEN_ERROR,
  getProviderForModel,
  getReadableAiError,
  hasApiToken,
  resolveApiToken,
} from "@/ai";
import { cn } from "@/utils";
import { truncateText } from "@/utils/text";
import {
  X,
  Plus,
  MessageCirclePlus,
  Settings,
} from "lucide-react";
import MarkdownPreview from "@uiw/react-markdown-preview";
import {
  PromptInputBox,
  type PromptInputBoxHandle,
  type SendOptions,
} from "@/components/ui/ai-prompt-box";
import {
  CHAT_MAX_SIZE,
  CHAT_MAX_TABS,
  CHAT_MIN_SIZE,
  CHAT_MODELS,
  createInitialTab,
  DEFAULT_MODEL,
  getModelById,
  PAGE_CONTENT_MAX_CHARS,
  SELECTED_TEXT_CHIP_PREVIEW_LENGTH,
} from "@/constants/chat";
import { GEMINI_MISSING_TOKEN_UI_MESSAGE } from "@/constants/messages";
import { SessionsHistoryPopup } from "@/components/SessionsHistoryPopup";
import { useChatTabs } from "@/hooks/useChatTabs";
import { useChatPersistence } from "@/hooks/useChatPersistence";
import { useFloatingButton } from "@/hooks/useFloatingButton";
import {
  appendModelError,
  appendStreamingChunk,
  appendUserMessage,
  setTabHistory,
  startStreamingModelMessage,
  updateTabById,
} from "@/state/chatUpdates";
import type { ConversationData, ChatModel } from "@/types/chat";
// @ts-ignore - re-resizable types will be available after npm install
import { Resizable } from "re-resizable";

const OwlIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 -960 960 960"
    fill="currentColor"
    style={{
      width: "24px",
      height: "24px",
    }}
    className={className}
  >
    <path d="M480-80q-134 0-227-93t-93-227v-200q0-122 96-201t224-79q128 0 224 79t96 201v520H480Zm0-80h80q-19-25-29.5-55.5T520-280v-42q-10 1-20 1.5t-20 .5q-67 0-129.5-23.5T240-415v15q0 100 70 170t170 70Zm120-120q0 50 35 85t85 35v-255q-26 26-56 44.5T600-340v60ZM440-560q0-66-45-111t-109-48q-22 24-34 54t-12 65q0 89 72.5 144.5T480-400q95 0 167.5-55.5T720-600q0-35-12-65.5T674-720q-64 2-109 48t-45 112h-80Zm-100 0q-17 0-28.5-11.5T300-600q0-17 11.5-28.5T340-640q17 0 28.5 11.5T380-600q0 17-11.5 28.5T340-560Zm280 0q-17 0-28.5-11.5T580-600q0-17 11.5-28.5T620-640q17 0 28.5 11.5T660-600q0 17-11.5 28.5T620-560ZM370-778q34 14 62 37t48 52q20-29 47.5-52t61.5-37q-25-11-52.5-16.5T480-800q-29 0-56.5 5.5T370-778Zm430 618H520h280Zm-320 0q-100 0-170-70t-70-170q0 100 70 170t170 70h80-80Zm120-120q0 50 35 85t85 35q-50 0-85-35t-35-85ZM480-689Z" />
  </svg>
);

const INITIAL_TAB = createInitialTab();

const ChatInterface: React.FC<{
  registerSetters: (
    setSelectedText: (text: string) => void,
    setIsOpen: (open: boolean) => void,
    addMessagesToChat: (conversation: ConversationData) => void
  ) => void;
}> = ({ registerSetters }) => {
  const [isOpen, setIsOpen] = useState(false);
  const {
    tabs,
    setTabs,
    activeTab,
    activeTabId,
    setActiveTabId,
    addTab,
    closeTab,
    openSession,
    deleteSession,
    sessions,
    isSessionActive,
    setModelForActiveTab,
    addConversationToActiveTab,
  } = useChatTabs(INITIAL_TAB);
  const messages = activeTab.messages;

  const [isLoading, setIsLoading] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [selectedModel, setSelectedModel] = useState<ChatModel>(DEFAULT_MODEL);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSessionsOpen, setIsSessionsOpen] = useState(false);
  const [apiTokenInput, setApiTokenInput] = useState("");
  const [settingsError, setSettingsError] = useState("");

  const {
    buttonPosition,
    setButtonPosition,
    isDragging,
    buttonRef,
    hasDraggedRef,
    handleMouseDown,
  } = useFloatingButton();

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const promptInputRef = useRef<PromptInputBoxHandle>(null);

  const { chatSize, setChatSize } = useChatPersistence({
    tabs,
    activeTabId,
    setTabs,
    setActiveTabId,
    buttonPosition,
    setButtonPosition,
  });

  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen, activeTabId]);

  useEffect(() => {
    if (isOpen) {
      promptInputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen]);

  useEffect(() => {
    registerSetters(setSelectedText, setIsOpen, addConversationToActiveTab);
  }, [registerSetters, addConversationToActiveTab]);

  useEffect(() => {
    if (!activeTab) return;
    const modelForTab = getModelById(activeTab.modelId);
    if (selectedModel.id !== modelForTab.id) {
      setSelectedModel(modelForTab);
    }
  }, [activeTabId, tabs]);

  const handleModelChange = (model: ChatModel) => {
    setSelectedModel(model);
    setModelForActiveTab(model.id);
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    closeTab(tabId);
  };

  function extractPageContent(): string {
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone
      .querySelectorAll("script, style, noscript, #chrome-ai-helper-host")
      .forEach((el) => el.remove());

    let text = clone.innerText || clone.textContent || "";
    text = text.replace(/\s+/g, " ").trim();

    if (text.length > PAGE_CONTENT_MAX_CHARS) {
      text =
        text.substring(0, PAGE_CONTENT_MAX_CHARS) + "... [content truncated]";
    }

    return text;
  }

  const handleSend = async (messageOverride?: string, options?: SendOptions) => {
    const text = (messageOverride ?? "").trim();
    const enableSearch = options?.enableSearch ?? false;

    if (
      !text &&
      !selectedText &&
      !options?.attachPageContent &&
      !options?.attachScreenshot
    ) {
      return;
    }

    if (!hasApiToken(getProviderForModel(selectedModel.id))) {
      setTabs((prev) =>
        updateTabById(prev, activeTabId, (tab) => ({
          ...tab,
          messages: [
            ...tab.messages,
            { text: GEMINI_MISSING_TOKEN_UI_MESSAGE, role: "model" },
          ],
        }))
      );
      return;
    }

    const capturedSelectedText = selectedText;
    const pageContent = options?.attachPageContent ? extractPageContent() : undefined;

    const prepared = aiService.prepareChatPrompt(
      text,
      capturedSelectedText,
      pageContent
    );
    const displayText = prepared.displayText;
    const historySnapshot = activeTab.history;
    const userHistoryEntry = {
      role: "user" as const,
      content: [{ type: "text" as const, text: prepared.fullPrompt }],
    };

    setTabs((prev) =>
      updateTabById(prev, activeTabId, (tab) => appendUserMessage(tab, displayText))
    );

    setSelectedText("");
    setIsLoading(true);

    try {
      let screenshot: string | undefined;

      if (options?.attachScreenshot) {
        screenshot = await captureScreenshot();
      }

      setTabs((prev) =>
        updateTabById(prev, activeTabId, (tab) =>
          setTabHistory(tab, [...historySnapshot, userHistoryEntry])
        )
      );

      let accumulatedResponse = "";
      setTabs((prev) =>
        updateTabById(prev, activeTabId, (tab) => startStreamingModelMessage(tab))
      );

      const stream = aiService.streamChat({
        history: historySnapshot,
        message: text,
        selectedText: capturedSelectedText,
        pageContent,
        screenshot,
        modelId: selectedModel.id,
        enableSearch: enableSearch,
      });

      for await (const chunk of stream) {
        accumulatedResponse += chunk;
        setTabs((prev) =>
          updateTabById(prev, activeTabId, (tab) =>
            appendStreamingChunk(tab, accumulatedResponse)
          )
        );
      }

      const updatedHistory = [
        ...historySnapshot,
        userHistoryEntry,
        {
          role: "assistant" as const,
          content: [{ type: "text" as const, text: accumulatedResponse }],
        },
      ];

      setTabs((prev) =>
        updateTabById(prev, activeTabId, (tab) => setTabHistory(tab, updatedHistory))
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error && error.message === GEMINI_MISSING_TOKEN_ERROR
          ? GEMINI_MISSING_TOKEN_UI_MESSAGE
          : getReadableAiError(error, getProviderForModel(selectedModel.id));
      setTabs((prev) =>
        updateTabById(prev, activeTabId, (tab) => appendModelError(tab, errorMessage))
      );
    } finally {
      setIsLoading(false);
      promptInputRef.current?.focus();
    }
  };

  const captureScreenshot = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: "CAPTURE_SCREENSHOT" },
        (response) => {
          if (response.error) {
            reject(response.error);
          } else {
            const base64 = response.dataUrl.split(",")[1];
            resolve(base64);
          }
        }
      );
    });
  };

  if (!isOpen) {
    const buttonStyle: React.CSSProperties = {
      position: "fixed",
      left: buttonPosition.side === "left" ? `${buttonPosition.x}px` : "auto",
      right:
        buttonPosition.side === "right"
          ? `${window.innerWidth - buttonPosition.x}px`
          : "auto",
      top: `${buttonPosition.y}px`,
      zIndex: 9999,
      transform:
        buttonPosition.side === "left" ? "translateX(-20%)" : "translateX(20%)",
      transition: isDragging ? "none" : "transform 0.3s",
    };

    const buttonClasses = isDragging
      ? "rounded-full"
      : buttonPosition.side === "left"
        ? "rounded-r-full"
        : "rounded-l-full";

    return (
      <div
        ref={buttonRef}
        onMouseDown={handleMouseDown}
        onClick={() => {
          if (!hasDraggedRef.current) {
            setIsOpen(true);
          }
          hasDraggedRef.current = false;
        }}
        style={buttonStyle}
        className={cn(
          "z-[9999] group bg-black text-white border p-[12px] hover:translate-x-0 transition-transform duration-300 shadow-lg flex items-center gap-2 font-sans group",
          buttonClasses
        )}
        role="button"
      >
        <OwlIcon className="w-6 h-6" />
      </div>
    );
  }

  const chatContainerStyle: React.CSSProperties = {
    position: "fixed",
    bottom: `20px`,
    left: buttonPosition.side === "left" ? "16px" : "auto",
    right: buttonPosition.side === "right" ? "16px" : "auto",
    zIndex: 9999,
  };

  return (
    <Resizable
      size={{ width: chatSize.width, height: chatSize.height }}
      onResizeStop={(
        _e: MouseEvent | TouchEvent,
        _direction: string,
        _ref: HTMLElement,
        d: { width: number; height: number }
      ) => {
        setChatSize({
          width: chatSize.width + d.width,
          height: chatSize.height + d.height,
        });
      }}
      minWidth={CHAT_MIN_SIZE.width}
      minHeight={CHAT_MIN_SIZE.height}
      maxWidth={
        window.innerWidth > CHAT_MAX_SIZE.width
          ? CHAT_MAX_SIZE.width
          : window.innerWidth
      }
      maxHeight={
        window.innerHeight > CHAT_MAX_SIZE.height
          ? CHAT_MAX_SIZE.height
          : window.innerHeight
      }
      enable={{
        top: true,
        bottom: false,
        right: buttonPosition.side === "left",
        left: buttonPosition.side === "right",
        topRight: buttonPosition.side === "left",
        topLeft: buttonPosition.side === "right",
        bottomRight: false,
        bottomLeft: false,
      }}
      style={chatContainerStyle}
      className="font-sans"
    >
      <div
        className={cn(
          "w-full h-full bg-gray-900 border-gray-900 border shadow-2xl rounded-xl flex flex-col overflow-visible animate-in slide-in-from-bottom-10 duration-200 transition-colors"
        )}
      >
        <div
          className={cn(
            "bg-gray-950 border-b border-gray-800 text-white p-4 flex justify-between items-center"
          )}
        >
          <div className="flex items-center gap-2">
            <OwlIcon className="w-5 h-5" />
            <h2 className="font-bold">Creep</h2>
          </div>
          <div
            onClick={() => setIsOpen(false)}
            className="hover:text-gray-300 transition-colors cursor-pointer"
            role="button"
          >
            <X className="w-5 h-5" />
          </div>
        </div>

        <div
          className={cn(
            "relative z-30 shrink-0 bg-gray-800 border-gray-700 flex items-center px-2 py-2 gap-1 border-b overflow-visible"
          )}
        >
          <div
            className={cn(
              "flex items-center gap-1 overflow-x-auto flex-1 min-w-0"
            )}
          >
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors min-w-[80px] justify-between group cursor-pointer",
                activeTabId === tab.id
                  ? "bg-gray-700 text-white shadow-sm"
                  : "text-gray-400 hover:bg-gray-700 hover:text-white"
              )}
              role="button"
            >
              <span className="truncate max-w-[80px]">{tab.name}</span>
              {tabs.length > 1 && (
                <span
                  onClick={(e) => handleCloseTab(e, tab.id)}
                  className={cn(
                    "opacity-0 group-hover:opacity-100 rounded p-0.5 transition-all hover:bg-gray-600"
                  )}
                >
                  <X className="w-3 h-3" />
                </span>
              )}
            </div>
          ))}
          {tabs.length < CHAT_MAX_TABS && (
            <div
              onClick={addTab}
              className={cn(
                "p-1.5 rounded-md transition-colors cursor-pointer hover:bg-gray-700 text-gray-400"
              )}
              title="New Chat"
              role="button"
            >
              <Plus className="w-4 h-4" />
            </div>
          )}
          </div>
          <div className="ml-auto pl-1 flex items-center gap-0.5 shrink-0">
            <SessionsHistoryPopup
              isOpen={isSessionsOpen}
              onToggle={() => {
                setIsSessionsOpen((prev) => !prev);
                if (!isSessionsOpen) setIsSettingsOpen(false);
              }}
              onClose={() => setIsSessionsOpen(false)}
              sessions={sessions}
              isSessionActive={isSessionActive}
              onSelect={(s) => {
                void openSession(s).then((ok) => ok && setIsSessionsOpen(false));
              }}
              onDelete={deleteSession}
            />
            <div
              onClick={() => {
                setApiTokenInput(resolveApiToken("gemini"));
                setSettingsError("");
                setIsSettingsOpen((prev) => !prev);
                setIsSessionsOpen(false);
              }}
              className={cn(
                "p-1.5 rounded-md transition-colors cursor-pointer hover:bg-gray-700 text-gray-400 hover:text-white"
              )}
              title="Gemini API Settings"
              role="button"
            >
              <Settings className="w-4 h-4" />
            </div>
          </div>
        </div>

        {isSettingsOpen && (
          <div className="border-b border-gray-700 bg-gray-800 px-3 py-3">
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={apiTokenInput}
                onChange={(e) => {
                  setApiTokenInput(e.target.value);
                  if (settingsError) setSettingsError("");
                }}
                placeholder="Paste Gemini API token"
                className={cn(
                  "flex-1 bg-gray-900 border border-gray-600 text-gray-100 text-xs rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                )}
              />
              <button
                type="button"
                onClick={() => {
                  const trimmedToken = apiTokenInput.trim();
                  if (!trimmedToken) {
                    setSettingsError("Token cannot be empty.");
                    return;
                  }
                  window.localStorage.setItem(
                    API_TOKEN_STORAGE_KEYS.gemini,
                    trimmedToken
                  );
                  setSettingsError("");
                  setIsSettingsOpen(false);
                }}
                className={cn(
                  "px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                )}
              >
                Submit
              </button>
            </div>
            {settingsError && (
              <p className="mt-2 text-xs text-red-400">{settingsError}</p>
            )}
          </div>
        )}

        <div
          ref={messagesContainerRef}
          className={cn(
            "relative z-0 flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 space-y-4 bg-gray-900 rounded-b-xl"
          )}
        >
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={cn(
                "p-3 rounded-2xl w-fit max-w-[85%] text-sm shadow-sm",
                msg.role === "user"
                  ? "bg-blue-600 text-white self-end ml-auto rounded-br-none"
                  : "bg-gray-800 border border-gray-700 text-gray-100 mr-auto rounded-bl-none"
              )}
            >
              {msg.role === "model" ? (
                <MarkdownPreview
                  source={msg.text}
                  wrapperElement={{
                    "data-color-mode": "dark",
                  }}
                  style={{ backgroundColor: "transparent", color: "inherit" }}
                />
              ) : (
                msg.text
              )}
            </div>
          ))}
        </div>

        <div
          className={cn(
            "relative z-10 p-4 bg-gray-900 border-t border-gray-800 space-y-3 overflow-visible"
          )}
        >
          {selectedText && (
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-2 border rounded-lg text-xs bg-purple-900/20 border-purple-800 text-purple-300"
              )}
            >
              <MessageCirclePlus className="w-3 h-3 shrink-0" />
              <span className="truncate flex-1">
                "{truncateText(selectedText, SELECTED_TEXT_CHIP_PREVIEW_LENGTH)}"
              </span>
              <div
                onClick={() => setSelectedText("")}
                className={cn(
                  "rounded p-0.5 cursor-pointer hover:bg-purple-900/40"
                )}
                role="button"
              >
                <X className="w-3 h-3" />
              </div>
            </div>
          )}

          <PromptInputBox
            ref={promptInputRef}
            onSend={handleSend}
            isLoading={isLoading}
            models={CHAT_MODELS}
            selectedModel={selectedModel}
            onModelChange={handleModelChange}
            placeholder={
              selectedText
                ? "Add a message or press send..."
                : "Ask anything..."
            }
          />
        </div>
      </div>
    </Resizable>
  );
};

export default ChatInterface;
