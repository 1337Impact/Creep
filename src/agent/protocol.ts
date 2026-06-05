import type { AgentEvent, AgentRunInput, ToolCall, ToolResult } from "./types";

export const KEEPALIVE_PORT_NAME = "creep-agent-keepalive";

export const MSG = {
  CAPTURE_SCREENSHOT: "CAPTURE_SCREENSHOT",
  AGENT_START: "AGENT_START",
  AGENT_CANCEL: "AGENT_CANCEL",
  AGENT_GET_STATUS: "AGENT_GET_STATUS",
  AGENT_CONTENT_READY: "AGENT_CONTENT_READY",
  AGENT_EXECUTE_TOOL: "AGENT_EXECUTE_TOOL",
  AGENT_EVENT: "AGENT_EVENT",
  AGENT_STARTED: "AGENT_STARTED",
  AGENT_KEEPALIVE: "AGENT_KEEPALIVE",
  CHAT_TOGGLE: "CHAT_TOGGLE",
  CHAT_OPEN_VOICE: "CHAT_OPEN_VOICE",
} as const;

export type AgentRunPhase = "running" | "awaiting_document" | "idle";

export interface AgentActiveSession {
  tabId: number;
  agentId: string;
  chatStorageKey: string;
  activeTabId: string;
  phase: AgentRunPhase;
  isChatOpen: boolean;
}

export interface AgentStartPayload {
  type: typeof MSG.AGENT_START;
  input: AgentRunInput;
  tabId: number;
  chatStorageKey: string;
  activeTabId: string;
  isChatOpen: boolean;
}

export interface AgentCancelPayload {
  type: typeof MSG.AGENT_CANCEL;
  tabId: number;
}

export interface AgentGetStatusPayload {
  type: typeof MSG.AGENT_GET_STATUS;
  tabId: number;
}

export interface AgentContentReadyPayload {
  type: typeof MSG.AGENT_CONTENT_READY;
  url: string;
}

export interface AgentExecuteToolPayload {
  type: typeof MSG.AGENT_EXECUTE_TOOL;
  call: ToolCall;
  agentId: string;
}

export interface AgentEventPayload {
  type: typeof MSG.AGENT_EVENT;
  agentId: string;
  event: AgentEvent;
}

export interface AgentStartedPayload {
  type: typeof MSG.AGENT_STARTED;
  agentId: string;
}

export interface CaptureScreenshotPayload {
  type: typeof MSG.CAPTURE_SCREENSHOT;
}

export interface ChatTogglePayload {
  type: typeof MSG.CHAT_TOGGLE;
}

export interface ChatOpenVoicePayload {
  type: typeof MSG.CHAT_OPEN_VOICE;
}

export type BackgroundRequest =
  | AgentStartPayload
  | AgentCancelPayload
  | AgentGetStatusPayload
  | AgentContentReadyPayload
  | CaptureScreenshotPayload;

export type AgentGetStatusResponse = {
  active: boolean;
  session?: AgentActiveSession;
  events?: AgentEvent[];
};

export type AgentStartResponse =
  | { ok: true; agentId: string }
  | { ok: false; error: string };

export type BackgroundResponse =
  | AgentGetStatusResponse
  | AgentStartResponse
  | { dataUrl: string }
  | { error: string }
  | { ok: true };

export type ContentRequest =
  | AgentExecuteToolPayload
  | AgentEventPayload
  | ChatTogglePayload
  | ChatOpenVoicePayload;

const RUNTIME_ERROR = "Extension runtime unavailable";

export function sendToRuntime<T extends BackgroundResponse>(
  message: BackgroundRequest
): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: T | undefined) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || RUNTIME_ERROR));
        return;
      }
      if (response === undefined) {
        reject(new Error(RUNTIME_ERROR));
        return;
      }
      resolve(response);
    });
  });
}

export function sendToTab<T>(
  tabId: number,
  message: ContentRequest | AgentExecuteToolPayload,
  options?: { frameId?: number }
): Promise<T> {
  return new Promise((resolve, reject) => {
    const onResponse = (response: T | undefined) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || "Tab unreachable"));
        return;
      }
      if (response === undefined) {
        reject(new Error("tool_no_response"));
        return;
      }
      resolve(response);
    };
    if (options?.frameId != null) {
      chrome.tabs.sendMessage(tabId, message, { frameId: options.frameId }, onResponse);
    } else {
      chrome.tabs.sendMessage(tabId, message, onResponse);
    }
  });
}

export function getCurrentTabId(): Promise<number> {
  return new Promise((resolve, reject) => {
    chrome.tabs.getCurrent((tab) => {
      if (chrome.runtime.lastError || !tab?.id) {
        reject(new Error(chrome.runtime.lastError?.message || "No tab id"));
        return;
      }
      resolve(tab.id);
    });
  });
}

export const TOOL_TAB_TIMEOUT_MS = 30_000;
export const NAVIGATION_WAIT_MS = 60_000;

export type TabToolResponse = ToolResult;
