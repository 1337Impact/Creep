import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  aiService,
  persistApiToken,
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
import { ModelLoadingDots } from "@/components/ModelLoadingDots";
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
  DEFAULT_MODEL,
  getChatStorageKey,
  getModelById,
  PAGE_CONTENT_MAX_CHARS,
  SELECTED_TEXT_CHIP_PREVIEW_LENGTH,
} from "@/constants/chat";
import { GEMINI_MISSING_TOKEN_UI_MESSAGE } from "@/constants/messages";
import { SessionsHistoryPopup } from "@/components/SessionsHistoryPopup";
import { OwlIcon } from "@/components/OwlIcon";
import { useChatTabs } from "@/hooks/useChatTabs";
import { useChatPersistence } from "@/hooks/useChatPersistence";
import {
  appendModelError,
  appendAgentHistory,
  appendStreamingChunk,
  appendUserMessage,
  finalizeAgentMessage,
  setTabHistory,
  startAgentMessage,
  startCursorMessage,
  startStreamingModelMessage,
  updateCursorMessage,
  updateTabById,
} from "@/state/chatUpdates";
import { streamCursorAgent } from "@/ai/cursor/cursor-client";
import { CursorMessageBubble } from "@/components/CursorMessageBubble";
import type { AgentEvent } from "@/agent/types";
import { getAgentRun } from "@/agent/persistence";
import type { ChatTab, ConversationData, ChatModel } from "@/types/chat";
import { MSG, sendToRuntime } from "@/agent/protocol";
import { AgentMessageBubble } from "@/components/AgentMessageBubble";
import { useAgentRunEvents } from "@/hooks/useAgentRunEvents";
import type { AgentPersistenceSession } from "@/hooks/useChatPersistence";
import type { FloatingButtonPosition } from "@/hooks/useFloatingButton";
// @ts-ignore - re-resizable types will be available after npm install
import { Resizable } from "re-resizable";

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  buttonPosition: FloatingButtonPosition;
  chatSize: { width: number; height: number };
  setChatSize: React.Dispatch<
    React.SetStateAction<{ width: number; height: number }>
  >;
  selectedText: string;
  setSelectedText: (text: string) => void;
  pendingConversation: ConversationData | null;
  onPendingConversationApplied: () => void;
  voiceRecordingRequestId: number;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  onClose,
  buttonPosition,
  chatSize,
  setChatSize,
  selectedText,
  setSelectedText,
  pendingConversation,
  onPendingConversationApplied,
  voiceRecordingRequestId,
}) => {
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
  } = useChatTabs();
  const messages = activeTab?.messages ?? [];

  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ChatModel>(DEFAULT_MODEL);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSessionsOpen, setIsSessionsOpen] = useState(false);
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState("");
  const [openaiApiKeyInput, setOpenaiApiKeyInput] = useState("");
  const [settingsError, setSettingsError] = useState("");

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const promptInputRef = useRef<PromptInputBoxHandle>(null);

  const agentTaskRef = useRef<string>("");
  const keepaliveCloseRef = useRef<(() => void) | null>(null);
  const activeOperationRef = useRef<"chat" | "agent" | "cursor" | null>(null);
  const chatAbortRef = useRef(false);
  const cursorAbortRef = useRef<AbortController | null>(null);

  const { startRun, openKeepalive } = useAgentRunEvents({
    onStarted: (agentId) => {
      setTabs((prev) =>
        updateTabById(prev, activeTabId, (tab) => {
          if (tab.messages.some((m) => m.role === "agent" && m.agentId === agentId)) {
            return tab;
          }
          return startAgentMessage(tab, agentId);
        })
      );
    },
    onEvent: (agentId, event) => {
      const findRunningAgent = (tab: ChatTab) =>
        tab.messages.findIndex(
          (m) => m.role === "agent" && m.agentId === agentId && m.status === "running"
        );

      if (event.type === "done") {
        const task = agentTaskRef.current;
        void getAgentRun(agentId).then((record) => {
          setTabs((prev) =>
            updateTabById(prev, activeTabId, (tab) => {
              const idx = findRunningAgent(tab);
              if (idx < 0) return tab;
              const withSummary = finalizeAgentMessage(tab, idx, {
                text: event.summary,
                status: "done",
                toolCallCount: record?.toolCallCount,
              });
              return appendAgentHistory(withSummary, task, event.summary);
            })
          );
        });
      }

      if (event.type === "error") {
        void getAgentRun(agentId).then((record) => {
          setTabs((prev) =>
            updateTabById(prev, activeTabId, (tab) => {
              const idx = findRunningAgent(tab);
              if (idx < 0) return tab;
              return finalizeAgentMessage(tab, idx, {
                text: event.message,
                status: "error",
                toolCallCount: record?.toolCallCount,
              });
            })
          );
        });
      }
    },
    onTerminal: () => {
      keepaliveCloseRef.current?.();
      keepaliveCloseRef.current = null;
      setAgentSessionActive(null);
      activeOperationRef.current = null;
      setIsLoading(false);
      promptInputRef.current?.focus();
    },
  });

  const onAgentSessionRestore = useCallback(
    (_session: AgentPersistenceSession) => {
      activeOperationRef.current = "agent";
      setIsLoading(true);
      keepaliveCloseRef.current?.();
      keepaliveCloseRef.current = openKeepalive();
    },
    [openKeepalive]
  );

  const { isHydrated, setAgentSessionActive } = useChatPersistence({
    tabs,
    activeTabId,
    setTabs,
    setActiveTabId,
    onAgentSessionRestore,
  });

  useEffect(() => {
    if (!isHydrated || !pendingConversation) return;
    addConversationToActiveTab(pendingConversation);
    onPendingConversationApplied();
  }, [
    isHydrated,
    pendingConversation,
    addConversationToActiveTab,
    onPendingConversationApplied,
  ]);

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
    if (!isOpen || voiceRecordingRequestId === 0) return;
    promptInputRef.current?.startRecording();
  }, [isOpen, voiceRecordingRequestId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!activeTab) return;
    const modelForTab = getModelById(activeTab.modelId);
    if (selectedModel.id !== modelForTab.id) {
      setSelectedModel(modelForTab);
    }
  }, [activeTabId, tabs, activeTab, selectedModel.id]);

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

  const handleCursorSend = async (text: string, pageContent?: string) => {
    if (!activeTab) return;

    const capturedSelectedText = selectedText;
    const prepared = aiService.prepareChatPrompt(
      text,
      capturedSelectedText,
      pageContent
    );

    setTabs((prev) =>
      updateTabById(prev, activeTabId, (tab) =>
        appendUserMessage(tab, prepared.displayText)
      )
    );
    setSelectedText("");
    setIsLoading(true);
    activeOperationRef.current = "cursor";

    const controller = new AbortController();
    cursorAbortRef.current = controller;

    setTabs((prev) =>
      updateTabById(prev, activeTabId, (tab) => startCursorMessage(tab))
    );

    const events: AgentEvent[] = [];
    let textAccum = "";
    let step = 0;

    const flush = (patch: Partial<{ text: string; status: "running" | "done" | "error"; events: AgentEvent[] }>) => {
      setTabs((prev) =>
        updateTabById(prev, activeTabId, (tab) => {
          const idx = tab.messages.findIndex(
            (m) => m.role === "cursor" && m.status === "running"
          );
          if (idx < 0) return tab;
          return updateCursorMessage(tab, idx, patch);
        })
      );
    };

    try {
      const stream = streamCursorAgent({
        prompt: prepared.fullPrompt,
        model: selectedModel.id,
        conversationId: activeTabId,
        signal: controller.signal,
      });

      for await (const event of stream) {
        if (controller.signal.aborted) break;

        if (event.type === "text") {
          textAccum += event.text;
          flush({ text: textAccum });
        } else if (event.type === "tool_call") {
          events.push({
            type: "tool_call",
            call: { id: event.id, name: event.name, args: event.args },
            step: step++,
          });
          flush({ events: [...events] });
        } else if (event.type === "tool_result") {
          events.push({
            type: "tool_result",
            callId: event.id,
            name: event.name,
            ok: event.ok,
            result: event.result,
            step,
          });
          flush({ events: [...events] });
        } else if (event.type === "done") {
          const summary = textAccum.trim() || event.summary || "Done.";
          flush({ text: summary, status: "done" });
          setTabs((prev) =>
            updateTabById(prev, activeTabId, (tab) =>
              appendAgentHistory(tab, prepared.fullPrompt, summary)
            )
          );
        } else if (event.type === "error") {
          flush({ text: event.message, status: "error" });
        }
      }
    } catch (error: unknown) {
      if (!controller.signal.aborted) {
        const message =
          error instanceof TypeError
            ? `Couldn't reach the Cursor bridge server. Make sure it's running (see server/README.md).`
            : error instanceof Error
              ? error.message
              : getReadableAiError(error, "cursor");
        flush({ text: message, status: "error" });
      }
    } finally {
      // Safety net: if the stream ended without a done/error event, don't leave
      // the message spinning forever.
      flush({ text: textAccum.trim() || "Done.", status: "done" });
      cursorAbortRef.current = null;
      if (activeOperationRef.current === "cursor") {
        activeOperationRef.current = null;
      }
      setIsLoading(false);
      promptInputRef.current?.focus();
    }
  };

  const handleAgentSend = async (text: string) => {
    if (!activeTab) return;

    const capturedSelectedText = selectedText;
    const displayText = capturedSelectedText
      ? text
        ? `"${capturedSelectedText}"\n\n${text}`
        : `"${capturedSelectedText}"`
      : text;

    const task = capturedSelectedText
      ? text
        ? `Selected text:\n"${capturedSelectedText}"\n\nTask: ${text}`
        : `Task for selected text:\n"${capturedSelectedText}"`
      : text;

    agentTaskRef.current = task;

    setTabs((prev) =>
      updateTabById(prev, activeTabId, (tab) => appendUserMessage(tab, displayText))
    );
    setSelectedText("");
    setIsLoading(true);
    activeOperationRef.current = "agent";

    const chatStorageKey = getChatStorageKey();
    setAgentSessionActive({
      isAgentRunning: true,
      isChatOpen: true,
      activeTabId,
      chatStorageKey,
      agentId: "",
    });

    keepaliveCloseRef.current?.();
    keepaliveCloseRef.current = openKeepalive();

    try {
      const result = await startRun({
        input: { task, modelId: selectedModel.id },
        chatStorageKey,
        activeTabId,
        isChatOpen: true,
      });

      if (!result.ok) {
        throw new Error(result.error);
      }

      setAgentSessionActive({
        isAgentRunning: true,
        isChatOpen: true,
        activeTabId,
        chatStorageKey,
        agentId: result.agentId,
      });
    } catch (error: unknown) {
      keepaliveCloseRef.current?.();
      keepaliveCloseRef.current = null;
      setAgentSessionActive(null);

      const errorMessage =
        error instanceof Error && error.message === GEMINI_MISSING_TOKEN_ERROR
          ? GEMINI_MISSING_TOKEN_UI_MESSAGE
          : getReadableAiError(error, getProviderForModel(selectedModel.id));

      setTabs((prev) =>
        updateTabById(prev, activeTabId, (tab) => appendModelError(tab, errorMessage))
      );
      activeOperationRef.current = null;
      setIsLoading(false);
      promptInputRef.current?.focus();
    }
  };

  const handleStop = useCallback(async () => {
    const hasRunningAgent = messages.some(
      (m) => m.role === "agent" && m.status === "running"
    );

    if (activeOperationRef.current === "agent" || hasRunningAgent) {
      try {
        await sendToRuntime({ type: MSG.AGENT_CANCEL, tabId: 0 });
      } catch {
        // Background may be unavailable during teardown.
      }

      keepaliveCloseRef.current?.();
      keepaliveCloseRef.current = null;
      setAgentSessionActive(null);

      setTabs((prev) =>
        updateTabById(prev, activeTabId, (tab) => {
          const idx = tab.messages.findIndex(
            (m) => m.role === "agent" && m.status === "running"
          );
          if (idx < 0) return tab;
          return finalizeAgentMessage(tab, idx, {
            text: "Stopped.",
            status: "error",
          });
        })
      );

      activeOperationRef.current = null;
      setIsLoading(false);
      promptInputRef.current?.focus();
      return;
    }

    if (activeOperationRef.current === "cursor" || cursorAbortRef.current) {
      cursorAbortRef.current?.abort();
      cursorAbortRef.current = null;
      setTabs((prev) =>
        updateTabById(prev, activeTabId, (tab) => {
          const idx = tab.messages.findIndex(
            (m) => m.role === "cursor" && m.status === "running"
          );
          if (idx < 0) return tab;
          return updateCursorMessage(tab, idx, { status: "error", text: "Stopped." });
        })
      );
      activeOperationRef.current = null;
      setIsLoading(false);
      promptInputRef.current?.focus();
      return;
    }

    chatAbortRef.current = true;
    activeOperationRef.current = null;
    setIsLoading(false);
    promptInputRef.current?.focus();
  }, [activeTabId, messages, setTabs, setAgentSessionActive]);

  const handleSend = async (messageOverride?: string, options?: SendOptions) => {
    if (!activeTab) return;

    const text = (messageOverride ?? "").trim();
    const enableSearch = options?.enableSearch ?? false;

    if (getProviderForModel(selectedModel.id) === "cursor") {
      if (!text && !selectedText && !options?.attachPageContent) return;
      const pageContent = options?.attachPageContent
        ? extractPageContent()
        : undefined;
      await handleCursorSend(text, pageContent);
      return;
    }

    if (options?.agentMode) {
      if (!text) return;

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

      await handleAgentSend(text);
      return;
    }

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
    chatAbortRef.current = false;
    activeOperationRef.current = "chat";

    let accumulatedResponse = "";

    try {
      let screenshot: string | undefined;

      if (options?.attachScreenshot) {
        screenshot = await captureScreenshot();
      }

      if (chatAbortRef.current) return;

      setTabs((prev) =>
        updateTabById(prev, activeTabId, (tab) =>
          setTabHistory(tab, [...historySnapshot, userHistoryEntry])
        )
      );

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
        if (chatAbortRef.current) break;
        accumulatedResponse += chunk;
        setTabs((prev) =>
          updateTabById(prev, activeTabId, (tab) =>
            appendStreamingChunk(tab, accumulatedResponse)
          )
        );
      }

      if (chatAbortRef.current) {
        if (accumulatedResponse) {
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
        } else {
          setTabs((prev) =>
            updateTabById(prev, activeTabId, (tab) => {
              const messages = [...tab.messages];
              const last = messages[messages.length - 1];
              if (last?.role === "model" && !last.text) {
                messages.pop();
              }
              return { ...tab, messages };
            })
          );
        }
        return;
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
      if (chatAbortRef.current) return;
      const errorMessage =
        error instanceof Error && error.message === GEMINI_MISSING_TOKEN_ERROR
          ? GEMINI_MISSING_TOKEN_UI_MESSAGE
          : getReadableAiError(error, getProviderForModel(selectedModel.id));
      setTabs((prev) =>
        updateTabById(prev, activeTabId, (tab) => appendModelError(tab, errorMessage))
      );
    } finally {
      if (activeOperationRef.current === "chat") {
        activeOperationRef.current = null;
      }
      if (!chatAbortRef.current) {
        setIsLoading(false);
      }
      promptInputRef.current?.focus();
    }
  };

  const captureScreenshot = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      void sendToRuntime<{ dataUrl: string } | { error: string }>({
        type: MSG.CAPTURE_SCREENSHOT,
      }).then((response) => {
        if ("error" in response) {
          reject(response.error);
        } else {
          const base64 = response.dataUrl.split(",")[1];
          resolve(base64);
        }
      }).catch(reject);
    });
  };

  if (!isOpen || !isHydrated || !activeTab) {
    return null;
  }

  const chatContainerStyle: React.CSSProperties = {
    position: "fixed",
    bottom: `20px`,
    left: buttonPosition.side === "left" ? "16px" : "auto",
    right: buttonPosition.side === "right" ? "16px" : "auto",
    zIndex: 9999,
    borderRadius: "12px",
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
      className="font-sans border border-foreground/20"
    >
      <div
        className={cn(
          "w-full h-full shadow-2xl flex flex-col overflow-visible animate-in slide-in-from-bottom-10 duration-200 transition-colors"
        )}
      >
        <div
          className={cn(
            "bg-muted rounded-t-xl text-foreground p-4 flex justify-between items-center"
          )}
        >
          <div className="flex items-center gap-2">
            <OwlIcon className="w-5 h-5" />
            <h2 className="font-bold">Creep</h2>
          </div>
          <div
            onClick={onClose}
            className="hover:text-muted-foreground transition-colors cursor-pointer"
            role="button"
          >
            <X className="w-5 h-5" />
          </div>
        </div>

        <div
          className={cn(
            "relative z-30 shrink-0 bg-secondary border-secondary flex items-center px-2 py-2 gap-1 border-b overflow-visible"
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
                  ? "bg-secondary text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
              role="button"
            >
              <span className="truncate max-w-[80px]">{tab.name}</span>
              {tabs.length > 1 && (
                <span
                  onClick={(e) => handleCloseTab(e, tab.id)}
                  className={cn(
                    "opacity-0 group-hover:opacity-100 rounded p-0.5 transition-all hover:bg-accent"
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
                "p-1.5 rounded-md transition-colors cursor-pointer hover:bg-secondary text-muted-foreground"
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
                setGeminiApiKeyInput(resolveApiToken("gemini"));
                setOpenaiApiKeyInput(resolveApiToken("openai"));
                setSettingsError("");
                setIsSettingsOpen((prev) => !prev);
                setIsSessionsOpen(false);
              }}
              className={cn(
                "p-1.5 rounded-md transition-colors cursor-pointer hover:bg-secondary text-muted-foreground hover:text-foreground"
              )}
              title="API key settings"
              role="button"
            >
              <Settings className="w-4 h-4" />
            </div>
          </div>
        </div>

        {isSettingsOpen && (
          <div className="border-b border-secondary bg-secondary px-3 py-3 space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={geminiApiKeyInput}
                onChange={(e) => {
                  setGeminiApiKeyInput(e.target.value);
                  if (settingsError) setSettingsError("");
                }}
                placeholder="Gemini API key"
                aria-label="Gemini API key"
                className={cn(
                  "flex-1 min-w-0 bg-background border border-secondary text-foreground text-xs rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                )}
              />
              <button
                type="button"
                onClick={() => {
                  const trimmed = geminiApiKeyInput.trim();
                  if (!trimmed) {
                    setSettingsError("Gemini API key cannot be empty.");
                    return;
                  }
                  persistApiToken("gemini", trimmed);
                  setSettingsError("");
                }}
                className={cn(
                  "shrink-0 px-3 py-2 rounded-md bg-primary hover:bg-primary/90 text-white text-xs font-medium transition-colors whitespace-nowrap"
                )}
              >
                Save Gemini Key
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={openaiApiKeyInput}
                onChange={(e) => {
                  setOpenaiApiKeyInput(e.target.value);
                  if (settingsError) setSettingsError("");
                }}
                placeholder="OpenAI API key"
                aria-label="OpenAI API key"
                className={cn(
                  "flex-1 min-w-0 bg-background border border-secondary text-foreground text-xs rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                )}
              />
              <button
                type="button"
                onClick={() => {
                  const trimmed = openaiApiKeyInput.trim();
                  if (!trimmed) {
                    setSettingsError("OpenAI API key cannot be empty.");
                    return;
                  }
                  persistApiToken("openai", trimmed);
                  setSettingsError("");
                }}
                className={cn(
                  "shrink-0 px-3 py-2 rounded-md bg-primary hover:bg-primary/90 text-white text-xs font-medium transition-colors whitespace-nowrap"
                )}
              >
                Save OpenAI Key
              </button>
            </div>
            {settingsError && (
              <p className="text-xs text-red-400">{settingsError}</p>
            )}
          </div>
        )}

        <div
          ref={messagesContainerRef}
          className={cn(
            "relative z-0 flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 space-y-4 bg-background"
          )}
        >
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={cn(
                "p-3 rounded-2xl w-fit max-w-[85%] text-sm shadow-sm",
                msg.role === "user"
                  ? "bg-primary text-white self-end ml-auto rounded-br-none"
                  : msg.role === "agent" || msg.role === "cursor"
                    ? "bg-secondary border border-primary/40 text-foreground mr-auto rounded-bl-none w-full max-w-full"
                    : "bg-secondary border border-secondary text-foreground mr-auto rounded-bl-none"
              )}
            >
              {msg.role === "model" ? (
                msg.text.trim() ? (
                  <MarkdownPreview
                    source={msg.text}
                    wrapperElement={{
                      "data-color-mode": "dark",
                    }}
                    style={{ backgroundColor: "transparent", color: "inherit" }}
                  />
                ) : (
                  <ModelLoadingDots />
                )
              ) : msg.role === "agent" ? (
                <AgentMessageBubble message={msg} />
              ) : msg.role === "cursor" ? (
                <CursorMessageBubble message={msg} />
              ) : (
                msg.text
              )}
            </div>
          ))}
        </div>

        <div
          className={cn(
            "relative z-10 px-4 py-2 rounded-b-xl bg-background border-t border-secondary overflow-visible"
          )}
        >
          {selectedText && (
            <div
              className={cn(
                "flex items-center gap-2 px-3 mb-1 py-2 border rounded-lg text-xs bg-primary/15 border-primary/40 text-muted-foreground"
              )}
            >
              <MessageCirclePlus className="w-3 h-3 shrink-0" />
              <span className="truncate flex-1">
                "{truncateText(selectedText, SELECTED_TEXT_CHIP_PREVIEW_LENGTH)}"
              </span>
              <div
                onClick={() => setSelectedText("")}
                className={cn(
                  "rounded p-0.5 cursor-pointer hover:bg-primary/25"
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
            onStop={handleStop}
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
