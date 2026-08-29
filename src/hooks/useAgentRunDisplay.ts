import { useEffect, useState } from "react";
import type { AgentEvent } from "@/agent/types";
import { getAgentRun } from "@/agent/persistence";
import { subscribeAgentEvents } from "@/content/agent-bridge";

export function useAgentRunDisplay(
  agentId: string,
  status: "running" | "done" | "error"
): AgentEvent[] {
  const [events, setEvents] = useState<AgentEvent[]>([]);

  useEffect(() => {
    let cancelled = false;

    void getAgentRun(agentId).then((record) => {
      if (!cancelled && record?.events.length) {
        setEvents(record.events);
      }
    });

    if (status !== "running") return () => {
      cancelled = true;
    };

    const unsub = subscribeAgentEvents((payload) => {
      if (payload.agentId !== agentId) return;
      setEvents((prev) => [...prev, payload.event]);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [agentId, status]);

  return events;
}
