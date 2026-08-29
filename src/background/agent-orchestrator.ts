import { ensureExtensionTokens } from "@/ai/auth";
import { runAgentLoop } from "@/agent/loop";
import { getAgentRun, runPersisted } from "@/agent/persistence";
import {
  MSG,
  type AgentActiveSession,
  type AgentEventPayload,
  type AgentGetStatusResponse,
  type AgentRunPhase,
  type AgentStartPayload,
  type AgentStartResponse,
} from "@/agent/protocol";
import {
  patchActiveSession,
  readActiveSession,
  writeActiveSession,
} from "@/agent/active-session";
import { clearAgentLogContext, setAgentLogContext } from "@/agent/logger";
import type { AgentEvent } from "@/agent/types";
import { TabToolExecutor } from "./tab-tool-executor";

import { KEEPALIVE_PORT_NAME } from "@/agent/protocol";

interface TabRun {
  tabId: number;
  agentId: string;
  chatStorageKey: string;
  activeTabId: string;
  isChatOpen: boolean;
  phase: AgentRunPhase;
  abortController: AbortController;
}

export class AgentOrchestrator {
  private runs = new Map<number, TabRun>();
  private documentWaiters = new Map<
    number,
    { resolve: () => void; timer: ReturnType<typeof setTimeout> }[]
  >();
  private keepalivePorts = new Map<number, chrome.runtime.Port>();
  private navigationFallbackInstalled = false;

  constructor() {
    this.installNavigationFallback();
  }

  attachKeepalive(tabId: number, port: chrome.runtime.Port): void {
    this.keepalivePorts.get(tabId)?.disconnect();
    this.keepalivePorts.set(tabId, port);
    port.onDisconnect.addListener(() => {
      if (this.keepalivePorts.get(tabId) === port) {
        this.keepalivePorts.delete(tabId);
      }
    });
  }

  onContentReady(tabId: number): void {
    this.resolveDocumentWaiters(tabId);
    const run = this.runs.get(tabId);
    if (run?.phase === "awaiting_document") {
      run.phase = "running";
      void patchActiveSession({ phase: "running" });
    }
  }

  async waitForDocument(tabId: number, timeoutMs = 60_000): Promise<void> {
    const run = this.runs.get(tabId);
    if (run) {
      run.phase = "awaiting_document";
      await patchActiveSession({ phase: "awaiting_document" });
    }
    await this.waitForDocumentSignal(tabId, timeoutMs);
  }

  async waitForPossibleNavigation(tabId: number, timeoutMs = 3000): Promise<void> {
    const before = await this.getTabUrl(tabId);
    await this.waitForDocumentSignal(tabId, timeoutMs, before);
  }

  async start(payload: AgentStartPayload): Promise<AgentStartResponse> {
    const { tabId, input, chatStorageKey, activeTabId, isChatOpen } = payload;

    await ensureExtensionTokens();

    if (this.runs.has(tabId)) {
      await this.cancel(tabId);
    }

    const abortController = new AbortController();
    const run: TabRun = {
      tabId,
      agentId: "",
      chatStorageKey,
      activeTabId,
      isChatOpen,
      phase: "running",
      abortController,
    };
    this.runs.set(tabId, run);

    const executor = new TabToolExecutor(tabId, "", this);

    try {
      const { agentId, events } = await runPersisted(
        input,
        runAgentLoop(input, executor)
      );

      run.agentId = agentId;
      executor.setAgentId(agentId);
      setAgentLogContext({ scope: "background", tabId, agentId });

      await writeActiveSession({
        tabId,
        agentId,
        chatStorageKey,
        activeTabId,
        phase: "running",
        isChatOpen,
      });

      this.broadcast(tabId, { type: MSG.AGENT_STARTED, agentId });

      void this.pumpEvents(tabId, agentId, events, abortController.signal);

      return { ok: true, agentId };
    } catch (error) {
      this.runs.delete(tabId);
      await writeActiveSession(null);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Agent start failed",
      };
    }
  }

  async cancel(tabId: number): Promise<void> {
    const run = this.runs.get(tabId);
    if (!run) return;
    run.abortController.abort();
    this.runs.delete(tabId);
    this.keepalivePorts.get(tabId)?.disconnect();
    this.keepalivePorts.delete(tabId);
    await writeActiveSession(null);
  }

  async getStatus(tabId: number): Promise<AgentGetStatusResponse> {
    const run = this.runs.get(tabId);
    if (run?.agentId) {
      const record = await getAgentRun(run.agentId);
      return {
        active: true,
        session: this.toSession(run),
        events: record?.events ?? [],
      };
    }
    return { active: false };
  }

  async getStoredStatus(tabId: number): Promise<AgentGetStatusResponse> {
    const memory = await this.getStatus(tabId);
    if (memory.active) return memory;

    const stored = await readActiveSession();
    if (stored && stored.tabId === tabId && stored.phase !== "idle") {
      const record = await getAgentRun(stored.agentId);
      return {
        active: true,
        session: stored,
        events: record?.events ?? [],
      };
    }
    return { active: false };
  }

  private async pumpEvents(
    tabId: number,
    agentId: string,
    events: AsyncGenerator<AgentEvent>,
    signal: AbortSignal
  ): Promise<void> {
    try {
      for await (const event of events) {
        if (signal.aborted) break;

        const run = this.runs.get(tabId);
        if (run) {
          await patchActiveSession({ phase: run.phase });
        }

        this.broadcast(tabId, { type: MSG.AGENT_EVENT, agentId, event });

        if (event.type === "done" || event.type === "error") {
          break;
        }
      }
    } catch (error) {
      if (!signal.aborted) {
        this.broadcast(tabId, {
          type: MSG.AGENT_EVENT,
          agentId,
          event: {
            type: "error",
            code: "aborted",
            message: error instanceof Error ? error.message : "Agent run failed",
            steps: 0,
          },
        });
      }
    } finally {
      this.runs.delete(tabId);
      this.keepalivePorts.get(tabId)?.disconnect();
      this.keepalivePorts.delete(tabId);
      clearAgentLogContext();
      await writeActiveSession(null);
    }
  }

  private broadcast(
    tabId: number,
    payload: AgentEventPayload | { type: typeof MSG.AGENT_STARTED; agentId: string }
  ): void {
    chrome.tabs.sendMessage(tabId, payload).catch(() => {});
  }

  private toSession(run: TabRun): AgentActiveSession {
    return {
      tabId: run.tabId,
      agentId: run.agentId,
      chatStorageKey: run.chatStorageKey,
      activeTabId: run.activeTabId,
      phase: run.phase,
      isChatOpen: run.isChatOpen,
    };
  }

  private installNavigationFallback(): void {
    if (this.navigationFallbackInstalled) return;
    this.navigationFallbackInstalled = true;

    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (changeInfo.status !== "complete") return;
      const run = this.runs.get(tabId);
      if (run?.phase === "awaiting_document") {
        this.resolveDocumentWaiters(tabId);
        run.phase = "running";
        void patchActiveSession({ phase: "running" });
      }
    });
  }

  private waitForDocumentSignal(
    tabId: number,
    timeoutMs: number,
    urlBefore?: string
  ): Promise<void> {
    return new Promise((resolve) => {
      const done = () => {
        const list = this.documentWaiters.get(tabId) ?? [];
        const remaining = list.filter((w) => w.resolve !== done);
        if (remaining.length) this.documentWaiters.set(tabId, remaining);
        else this.documentWaiters.delete(tabId);
        resolve();
      };

      const timer = setTimeout(done, timeoutMs);
      const list = this.documentWaiters.get(tabId) ?? [];
      list.push({ resolve: done, timer });
      this.documentWaiters.set(tabId, list);

      if (urlBefore !== undefined) {
        void this.getTabUrl(tabId).then((after) => {
          if (after && after !== urlBefore) return;
          clearTimeout(timer);
          done();
        });
      }
    });
  }

  private resolveDocumentWaiters(tabId: number): void {
    const list = this.documentWaiters.get(tabId) ?? [];
    for (const { resolve, timer } of list) {
      clearTimeout(timer);
      resolve();
    }
    this.documentWaiters.delete(tabId);
  }

  private getTabUrl(tabId: number): Promise<string | undefined> {
    return new Promise((resolve) => {
      chrome.tabs.get(tabId, (tab) => {
        resolve(tab?.url);
      });
    });
  }
}

let orchestrator: AgentOrchestrator | null = null;

export function getOrchestrator(): AgentOrchestrator {
  if (!orchestrator) orchestrator = new AgentOrchestrator();
  return orchestrator;
}

export function handleKeepaliveConnect(port: chrome.runtime.Port): void {
  if (port.name !== KEEPALIVE_PORT_NAME) return;
  const tabId = port.sender?.tab?.id;
  if (tabId == null) return;
  getOrchestrator().attachKeepalive(tabId, port);
}
