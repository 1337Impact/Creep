import React, { useState, useRef, useEffect } from "react";
import {
  sendChatMessageStream,
  transcribeAudio,
  ChatMessage,
} from "../api/gemini";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  Mic,
  SendHorizontal,
  X,
  ChevronDown,
  Image as ImageIcon,
  Loader2,
  Plus,
  FileText,
  MessageCirclePlus,
  Search,
} from "lucide-react";
import MarkdownPreview from "@uiw/react-markdown-preview";
// @ts-ignore - re-resizable types will be available after npm install
import { Resizable } from "re-resizable";

// Owl icon SVG component matching the extension icon
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

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MODELS = [
  { id: "models/gemini-flash-lite-latest", name: "Flash Lite" },
  { id: "models/gemini-flash-latest", name: "Flash" },
  { id: "models/gemini-2.5-pro", name: "Pro" },
];

const FUNNY_NAMES = [
  "Zibble",
  "Flompy",
  "Glorp",
  "Snizzle",
  "Blarbo",
  "Womple",
  "Boingo",
  "Tinko",
  "Plompy",
  "Snorko",
  "Xarlo",
  "Vreeb",
  "Quorp",
  "Zarnox",
  "Vloppo",
  "Dreeko",
  "Klarn",
  "Noovo",
  "Zyggo",
  "Plix",
  "Mippo",
  "Luli",
  "Poffi",
  "Nunu",
  "Zuzu",
  "Piplo",
  "Momozi",
  "Fluffo",
  "Titiroo",
  "Kikiro",
];

function getRandomUnusedName(usedNames: string[]): string {
  const availableNames = FUNNY_NAMES.filter(
    (name) => !usedNames.includes(name)
  );
  if (availableNames.length === 0) {
    return `Chat ${usedNames.length + 1}`;
  }
  return availableNames[Math.floor(Math.random() * availableNames.length)];
}

function getInitialGreeting(name: string): string {
  return `Hello, I'm ${name}, here to help...`;
}

interface ConversationData {
  userMessage: string;
  modelResponse: string | null;
}

const ChatInterface: React.FC<{
  registerSetters: (
    setSelectedText: (text: string) => void,
    setIsOpen: (open: boolean) => void,
    addMessagesToChat: (conversation: ConversationData) => void
  ) => void;
}> = ({ registerSetters }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tabs, setTabs] = useState<
    Array<{
      id: string;
      name: string;
      messages: Array<{ text: string; role: "user" | "model" }>;
      history: ChatMessage[];
    }>
  >(() => {
    const initialName = getRandomUnusedName([]);
    return [
      {
        id: "1",
        name: initialName,
        messages: [{ text: getInitialGreeting(initialName), role: "model" }],
        history: [],
      },
    ];
  });
  const [activeTabId, setActiveTabId] = useState("1");

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const messages = activeTab.messages;

  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [recordingState, setRecordingState] = useState<
    "idle" | "recording" | "processing" | "error"
  >("idle");
  const [attachScreenshot, setAttachScreenshot] = useState(false);
  const [attachPageContent, setAttachPageContent] = useState(false);
  const [useGoogleSearch, setUseGoogleSearch] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [selectedModel, setSelectedModel] = useState(MODELS[1]); // Default to Flash

  // Button position state
  const [buttonPosition, setButtonPosition] = useState<{
    x: number;
    y: number;
    side: "left" | "right";
  }>(() => {
    // Default to bottom-right
    return { x: window.innerWidth, y: window.innerHeight - 100, side: "right" };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false); // Track if a meaningful drag occurred
  const buttonRef = useRef<HTMLDivElement>(null);

  // Chat size state
  const [chatSize, setChatSize] = useState({ width: 384, height: 600 });

  // Refs for audio recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Ref for auto-scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen, activeTabId]);

  // Handle Escape key to close chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Function to add conversation messages from selection popup
  const addMessagesToChat = (conversation: ConversationData) => {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id === activeTabId) {
          const newMessages = [...tab.messages];
          // Add user message
          newMessages.push({ text: conversation.userMessage, role: "user" });
          // Add model response if exists
          if (conversation.modelResponse) {
            newMessages.push({
              text: conversation.modelResponse,
              role: "model",
            });
          }

          // Also update history for context
          const newHistory = [...tab.history];
          newHistory.push({
            role: "user",
            parts: [{ text: conversation.userMessage }],
          });
          if (conversation.modelResponse) {
            newHistory.push({
              role: "model",
              parts: [{ text: conversation.modelResponse }],
            });
          }

          return {
            ...tab,
            messages: newMessages,
            history: newHistory,
          };
        }
        return tab;
      })
    );
  };

  // Expose setSelectedText, setIsOpen, and addMessagesToChat
  useEffect(() => {
    registerSetters(setSelectedText, setIsOpen, addMessagesToChat);
  }, [registerSetters, activeTabId]);

  // Load from storage on mount
  useEffect(() => {
    const key = `chat_${btoa(window.location.href).slice(0, 50)}`;
    chrome.storage.local.get([key, "buttonPosition"], (result) => {
      if (result[key]) {
        const { tabs: savedTabs, activeTabId: savedActiveId } = result[key];
        if (savedTabs && savedTabs.length > 0) {
          setTabs(savedTabs);
          if (savedActiveId) {
            setActiveTabId(savedActiveId);
          }
        }
      }
      if (result.buttonPosition) {
        // Ensure position is valid for current window size
        const savedPos = result.buttonPosition;
        const validY = Math.max(
          0,
          Math.min(window.innerHeight - 100, savedPos.y)
        );
        const validX = savedPos.side === "left" ? 0 : window.innerWidth;
        setButtonPosition({
          x: validX,
          y: validY,
          side: savedPos.side || "right",
        });
      }
    });
  }, []);

  // Save to storage when state changes
  useEffect(() => {
    const key = `chat_${btoa(window.location.href).slice(0, 50)}`;
    const timeoutId = setTimeout(() => {
      chrome.storage.local.set({
        [key]: {
          tabs,
          activeTabId,
          lastUpdated: Date.now(),
        },
      });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [tabs, activeTabId]);

  // Save button position to storage
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      chrome.storage.local.set({ buttonPosition });
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [buttonPosition]);

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      hasDraggedRef.current = false; // Reset at the start of a potential drag
      setIsDragging(true);
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      hasDraggedRef.current = true; // Mark that a drag has occurred
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // Constrain Y to viewport
      const constrainedY = Math.max(
        0,
        Math.min(window.innerHeight - 100, newY)
      );

      setButtonPosition((prev) => ({
        ...prev,
        x: newX,
        y: constrainedY,
      }));
    };

    const handleMouseUp = (e: MouseEvent) => {
      setIsDragging(false);

      // Determine which side the button is on based on current mouse position
      const windowWidth = window.innerWidth;
      const side = e.clientX < windowWidth / 2 ? "left" : "right";

      // Snap to edge - x represents distance from left edge
      const snappedX = side === "left" ? 0 : windowWidth;

      setButtonPosition((prev) => ({
        x: snappedX,
        y: prev.y,
        side,
      }));
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset, buttonPosition]);

  // Disable text selection while dragging
  useEffect(() => {
    if (isDragging) {
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.userSelect = '';
    }
    return () => {
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  const handleAddTab = () => {
    if (tabs.length >= 3) return;
    const newId = Date.now().toString();
    const usedNames = tabs.map((tab) => tab.name);
    const newName = getRandomUnusedName(usedNames);
    const newTab = {
      id: newId,
      name: newName,
      messages: [{ text: getInitialGreeting(newName), role: "model" as const }],
      history: [],
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newId);
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    if (tabs.length === 1) return; // Prevent closing last tab

    const newTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(newTabs);

    if (activeTabId === tabId) {
      setActiveTabId(newTabs[newTabs.length - 1].id);
    }
  };

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text && !selectedText) return;

    // Build the full prompt with context
    let fullPrompt = text;
    let displayText = text;

    if (selectedText) {
      fullPrompt = `[SELECTED TEXT FROM WEBPAGE]\n"${selectedText}"\n[END SELECTED TEXT]\n\n${text ||
        "The user has shared this selected text from the webpage. Please acknowledge it and ask how you can help with it."
        }`;
      displayText =
        text ||
        `Selected: "${selectedText.length > 50
          ? selectedText.substring(0, 50) + "..."
          : selectedText
        }"`;
    }

    if (attachPageContent) {
      const pageContent = extractPageContent();
      fullPrompt = `[PAGE CONTENT]\n${pageContent}\n[END PAGE CONTENT]\n\n${fullPrompt}`;
    }

    // Update messages for active tab
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id === activeTabId) {
          return {
            ...tab,
            messages: [...tab.messages, { text: displayText, role: "user" }],
          };
        }
        return tab;
      })
    );

    setInputValue("");
    setSelectedText("");
    setIsLoading(true);

    try {
      let imageBase64: string | undefined = undefined;

      if (attachScreenshot) {
        imageBase64 = await captureScreenshot();
      }

      // Update history
      const currentHistory = [
        ...activeTab.history,
        {
          role: "user" as const,
          parts: [{ text: fullPrompt }],
        },
      ];

      // Update tab history immediately to avoid race conditions if user switches
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id === activeTabId) {
            return { ...tab, history: currentHistory };
          }
          return tab;
        })
      );

      // Initial empty model message for streaming
      let accumulatedResponse = "";
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id === activeTabId) {
            return {
              ...tab,
              messages: [...tab.messages, { text: "", role: "model" }],
            };
          }
          return tab;
        })
      );

      const stream = sendChatMessageStream(
        currentHistory,
        fullPrompt,
        imageBase64,
        selectedModel.id,
        useGoogleSearch
      );

      for await (const chunk of stream) {
        accumulatedResponse += chunk;

        setTabs((prev) =>
          prev.map((tab) => {
            if (tab.id === activeTabId) {
              const newMessages = [...tab.messages];
              // Update the last message (which is the model's streaming message)
              newMessages[newMessages.length - 1] = {
                text: accumulatedResponse,
                role: "model",
              };
              return {
                ...tab,
                messages: newMessages,
              };
            }
            return tab;
          })
        );
      }

      const updatedHistory = [
        ...currentHistory,
        {
          role: "model" as const,
          parts: [{ text: accumulatedResponse }],
        },
      ];

      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id === activeTabId) {
            return {
              ...tab,
              history: updatedHistory,
            };
          }
          return tab;
        })
      );
    } catch (error: any) {
      const errorMessage =
        error?.message ||
        (typeof error === "string" ? error : "Unknown error occurred");
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id === activeTabId) {
            // Remove the empty streaming message if it exists and replace/append error
            const msgs = [...tab.messages];
            if (
              msgs.length > 0 &&
              msgs[msgs.length - 1].role === "model" &&
              msgs[msgs.length - 1].text === ""
            ) {
              msgs.pop();
            }

            return {
              ...tab,
              messages: [
                ...msgs,
                { text: `Error: ${errorMessage}`, role: "model" },
              ],
            };
          }
          return tab;
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Stop propagation to prevent webpage keyboard shortcuts from interfering
    e.stopPropagation();
    
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
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

  const extractPageContent = (): string => {
    // Get the main content, excluding scripts, styles, and our extension
    const clone = document.body.cloneNode(true) as HTMLElement;

    // Remove script and style elements
    clone
      .querySelectorAll("script, style, noscript, #chrome-ai-helper-host")
      .forEach((el) => el.remove());

    // Get text content
    let text = clone.innerText || clone.textContent || "";

    // Clean up whitespace
    text = text.replace(/\s+/g, " ").trim();

    // Limit to reasonable length (about 10k chars)
    if (text.length > 10000) {
      text = text.substring(0, 10000) + "... [content truncated]";
    }

    return text;
  };

  const startRecording = async () => {
    try {
      setRecordingState("recording");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event: any) => {
        console.error("MediaRecorder error:", event.error);
        setRecordingState("error");
        setTabs((prev) =>
          prev.map((tab) => {
            if (tab.id === activeTabId) {
              return {
                ...tab,
                messages: [
                  ...tab.messages,
                  {
                    text: `Recording error: ${event.error?.message || "Unknown error"
                      }`,
                    role: "model",
                  },
                ],
              };
            }
            return tab;
          })
        );
      };

      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: "audio/wav",
          });
          await handleAudioTranscription(audioBlob);
        } else {
          setRecordingState("idle");
        }
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
    } catch (error: any) {
      console.error("Error accessing microphone:", error);
      setRecordingState("error");
      // Reset to idle after a short delay so the user can try again
      setTimeout(() => setRecordingState("idle"), 3000);

      const errorMessage =
        error.name === "NotAllowedError" ||
          error.name === "PermissionDeniedError"
          ? "Microphone permission denied. Please allow microphone access in your browser settings."
          : `Could not access microphone: ${error.message}`;

      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id === activeTabId) {
            return {
              ...tab,
              messages: [
                ...tab.messages,
                { text: errorMessage, role: "model" },
              ],
            };
          }
          return tab;
        })
      );
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
      // State change to processing happens in onstop -> handleAudioTranscription
    }
  };

  const handleAudioTranscription = async (audioBlob: Blob) => {
    setRecordingState("processing");
    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(",")[1];
        const transcription = await transcribeAudio(base64Audio);
        setInputValue(transcription);
        setRecordingState("idle");
      };
    } catch (error: any) {
      setRecordingState("error");
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id === activeTabId) {
            return {
              ...tab,
              messages: [
                ...tab.messages,
                {
                  text: `Transcription failed: ${error.message}`,
                  role: "model",
                },
              ],
            };
          }
          return tab;
        })
      );
      setTimeout(() => setRecordingState("idle"), 3000);
    }
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
          // Only open if we didn't just finish dragging
          if (!hasDraggedRef.current) {
            setIsOpen(true);
          }
          hasDraggedRef.current = false; // Reset for next interaction
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
      minWidth={300}
      minHeight={400}
      maxWidth={window.innerWidth > 1024 ? 1024 : window.innerWidth}
      maxHeight={window.innerHeight > 900 ? 900 : window.innerHeight}
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
          "w-full h-full bg-gray-900 border-gray-900 border shadow-2xl rounded-xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-200 transition-colors"
        )}
      >
        {/* Header */}
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

        {/* Tabs */}
        <div
          className={cn(
            "bg-gray-800 border-gray-700 flex items-center px-2 py-2 gap-1 overflow-x-auto border-b"
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
          {tabs.length < 3 && (
            <div
              onClick={handleAddTab}
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

        {/* Messages */}
        <div
          className={cn(
            "flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900"
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
          <div ref={messagesEndRef} />
        </div>

        {/* Controls */}
        <div
          className={cn(
            "p-4 bg-gray-900 border-t border-gray-800 space-y-3"
          )}
        >
          {/* Row 1: Model Dropdown & Screenshot Toggle */}
          <div className="flex items-center justify-between">
            {/* Model Dropdown */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <div
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors outline-none cursor-pointer bg-gray-800 hover:bg-gray-700 text-gray-200"
                  )}
                  role="button"
                >
                  {selectedModel.name}
                  <ChevronDown className="w-3 h-3" />
                </div>
              </DropdownMenu.Trigger>

              <DropdownMenu.Content
                className={cn(
                  "z-[10000] min-w-[140px] rounded-md shadow-lg border p-1 animate-in fade-in-0 zoom-in-95 duration-100 bg-gray-800 border-gray-700"
                )}
                sideOffset={5}
                align="start"
              >
                {MODELS.map((model) => (
                  <DropdownMenu.Item
                    key={model.id}
                    className={cn(
                      "flex items-center px-2 py-2 text-xs rounded-sm cursor-pointer outline-none transition-colors",
                      selectedModel.id === model.id
                        ? "bg-gray-700 font-medium text-white"
                        : "hover:bg-gray-700 text-gray-300"
                    )}
                    onSelect={() => setSelectedModel(model)}
                  >
                    {model.name}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Root>
            <div className="flex items-center gap-2">
              {/* Search Button */}
              <div
                onClick={() => setUseGoogleSearch(!useGoogleSearch)}
                className={cn(
                  "p-2 rounded-full transition-all duration-200 cursor-pointer",
                  useGoogleSearch
                    ? "bg-orange-900/30 text-orange-400"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                )}
                title="Enable Google Search grounding"
                role="button"
              >
                <Search className="w-4 h-4" />
              </div>

              {/* Page Content Button */}
              <div
                onClick={() => setAttachPageContent(!attachPageContent)}
                className={cn(
                  "p-2 rounded-full transition-all duration-200 cursor-pointer",
                  attachPageContent
                    ? "bg-blue-900/30 text-blue-400"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                )}
                title="Attach page content as text"
                role="button"
              >
                <FileText className="w-4 h-4" />
              </div>

              {/* Screenshot Button */}
              <div
                onClick={() => setAttachScreenshot(!attachScreenshot)}
                className={cn(
                  "p-2 rounded-full transition-all duration-200 cursor-pointer",
                  attachScreenshot
                    ? "bg-green-900/30 text-green-400"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                )}
                title="Attach page screenshot"
                role="button"
              >
                <ImageIcon className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Selected Text Indicator */}
          {selectedText && (
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-2 border rounded-lg text-xs bg-purple-900/20 border-purple-800 text-purple-300"
              )}
            >
              <MessageCirclePlus className="w-3 h-3 shrink-0" />
              <span className="truncate flex-1">
                "
                {selectedText.length > 40
                  ? selectedText.substring(0, 40) + "..."
                  : selectedText}
                "
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

          {/* Row 2: Input & Mic & Send */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              onKeyUp={(e) => e.stopPropagation()}
              onKeyPress={(e) => e.stopPropagation()}
              placeholder={
                selectedText
                  ? "Add a message or press send..."
                  : "Ask anything..."
              }
              className={cn(
                "flex-1 p-2.5 text-sm border rounded-lg focus:outline-none focus:ring-1 transition-all placeholder:text-gray-400 bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500"
              )}
            />

            {/* Mic Button */}
            <div
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={() =>
                recordingState === "recording" && stopRecording()
              }
              className={cn(
                "p-2.5 rounded-full transition-all duration-200 flex items-center justify-center shrink-0 relative cursor-pointer",
                recordingState === "recording"
                  ? "bg-red-500 text-white scale-110 shadow-md"
                  : recordingState === "processing"
                    ? "bg-yellow-100 text-yellow-600 animate-pulse pointer-events-none"
                    : recordingState === "error"
                      ? "bg-red-100 text-red-600 pointer-events-none"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              )}
              title={
                recordingState === "recording"
                  ? "Release to stop"
                  : recordingState === "processing"
                    ? "Processing..."
                    : recordingState === "error"
                      ? "Error"
                      : "Hold to record"
              }
              role="button"
            >
              {recordingState === "processing" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Mic
                  className={cn(
                    "w-4 h-4",
                    recordingState === "recording" && "animate-pulse"
                  )}
                />
              )}

              {/* Recording ring animation */}
              {recordingState === "recording" && (
                <span className="absolute inset-0 rounded-full border-2 border-red-500 animate-ping opacity-75"></span>
              )}
            </div>

            {/* Send Button */}
            <div
              onClick={() => {
                if (
                  !(
                    (!inputValue.trim() &&
                      !selectedText &&
                      recordingState !== "recording") ||
                    isLoading
                  )
                ) {
                  handleSend();
                }
              }}
              className={cn(
                "p-2.5 rounded-full text-white transition-colors shrink-0",
                (!inputValue.trim() &&
                  !selectedText &&
                  recordingState !== "recording") ||
                  isLoading
                  ? "bg-gray-800 opacity-50 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 cursor-pointer"
              )}
              role="button"
            >
              <SendHorizontal className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    </Resizable>
  );
};

export default ChatInterface;
