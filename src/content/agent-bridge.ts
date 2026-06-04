import { setAgentLogContext } from "@/agent/logger";
import { getAgentRun } from "@/agent/persistence";
import { createBrowserToolExecutor } from "@/agent/tools/browser";
import {
  MSG,
  sendToRuntime,
  type AgentContentReadyPayload,
  type AgentEventPayload,
  type AgentExecuteToolPayload,
  type AgentGetStatusResponse,
} from "@/agent/protocol";
import type { ToolResult } from "@/agent/types";

type AgentEventListener = (payload: AgentEventPayload) => void;
type AgentStartedListener = (agentId: string) => void;
type ReattachListener = (payload: {
  agentId: string;
  events: AgentEventPayload["event"][];
}) => void;

let executor = createBrowserToolExecutor(document);
let eventListeners: AgentEventListener[] = [];
let startedListeners: AgentStartedListener[] = [];
let reattachListeners: ReattachListener[] = [];

function notifyReattach(agentId: string, events: AgentEventPayload["event"][]): void {
  for (const listener of reattachListeners) {
    listener({ agentId, events });
  }
}

export function subscribeAgentEvents(listener: AgentEventListener): () => void {
  eventListeners.push(listener);
  return () => {
    eventListeners = eventListeners.filter((l) => l !== listener);
  };
}

export function subscribeAgentStarted(listener: AgentStartedListener): () => void {
  startedListeners.push(listener);
  return () => {
    startedListeners = startedListeners.filter((l) => l !== listener);
  };
}

export function subscribeAgentReattach(listener: ReattachListener): () => void {
  reattachListeners.push(listener);
  return () => {
    reattachListeners = reattachListeners.filter((l) => l !== listener);
  };
}

async function announceContentReady(): Promise<void> {
  const payload: AgentContentReadyPayload = {
    type: MSG.AGENT_CONTENT_READY,
    url: window.location.href,
  };
  try {
    await sendToRuntime(payload);
  } catch {
    // Background may be unavailable during teardown
  }
}

async function tryReattach(): Promise<void> {
  try {
    const status = await sendToRuntime<AgentGetStatusResponse>({
      type: MSG.AGENT_GET_STATUS,
      tabId: 0,
    });

    if (!status.active || !status.session?.agentId) return;

    const record = await getAgentRun(status.session.agentId);
    notifyReattach(status.session.agentId, record?.events ?? status.events ?? []);
  } catch {
    // Ignore when background is unavailable
  }
}

function handleExecuteTool(
  message: AgentExecuteToolPayload,
  sendResponse: (response: ToolResult) => void
): boolean {
  setAgentLogContext({ scope: "content", agentId: message.agentId });
  executor = createBrowserToolExecutor(document);
  void executor.execute(message.call).then(sendResponse);
  return true;
}

export function initAgentBridge(): void {
  executor = createBrowserToolExecutor(document);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message?.type) return false;

    if (message.type === MSG.AGENT_EXECUTE_TOOL) {
      return handleExecuteTool(message as AgentExecuteToolPayload, sendResponse);
    }

    if (message.type === MSG.AGENT_EVENT) {
      const payload = message as AgentEventPayload;
      for (const listener of eventListeners) {
        listener(payload);
      }
      return false;
    }

    if (message.type === MSG.AGENT_STARTED) {
      const agentId = (message as { agentId: string }).agentId;
      for (const listener of startedListeners) {
        listener(agentId);
      }
      return false;
    }

    return false;
  });

  void announceContentReady();
  void tryReattach();
}
