import { useCallback, useEffect, useRef } from "react";
import type { AgentEvent } from "@/agent/types";
import { ensureExtensionTokens } from "@/ai/auth";
import {
  KEEPALIVE_PORT_NAME,
  MSG,
  sendToRuntime,
  type AgentStartPayload,
  type AgentStartResponse,
} from "@/agent/protocol";
import {
  subscribeAgentEvents,
  subscribeAgentReattach,
  subscribeAgentStarted,
} from "@/content/agent-bridge";

export interface AgentRunCallbacks {
  onStarted: (agentId: string) => void;
  onEvent: (agentId: string, event: AgentEvent) => void;
  onTerminal: () => void;
}

export function useAgentRunEvents(callbacks: AgentRunCallbacks): {
  startRun: (payload: Omit<AgentStartPayload, "type" | "tabId">) => Promise<AgentStartResponse>;
  openKeepalive: () => () => void;
} {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    const unsubEvent = subscribeAgentEvents((payload) => {
      callbacksRef.current.onEvent(payload.agentId, payload.event);
      if (payload.event.type === "done" || payload.event.type === "error") {
        callbacksRef.current.onTerminal();
      }
    });

    const unsubStarted = subscribeAgentStarted((agentId) => {
      callbacksRef.current.onStarted(agentId);
    });

    const unsubReattach = subscribeAgentReattach(({ agentId, events }) => {
      callbacksRef.current.onStarted(agentId);
      for (const event of events) {
        callbacksRef.current.onEvent(agentId, event);
        if (event.type === "done" || event.type === "error") {
          callbacksRef.current.onTerminal();
          return;
        }
      }
    });

    return () => {
      unsubEvent();
      unsubStarted();
      unsubReattach();
    };
  }, []);

  const openKeepalive = useCallback(() => {
    const port = chrome.runtime.connect({ name: KEEPALIVE_PORT_NAME });
    return () => port.disconnect();
  }, []);

  const startRun = useCallback(
    async (
      payload: Omit<AgentStartPayload, "type" | "tabId">
    ): Promise<AgentStartResponse> => {
      await ensureExtensionTokens();
      return sendToRuntime<AgentStartResponse>({
        type: MSG.AGENT_START,
        tabId: 0,
        ...payload,
      });
    },
    []
  );

  return { startRun, openKeepalive };
}
