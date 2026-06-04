import {
  MSG,
  NAVIGATION_WAIT_MS,
  sendToTab,
  TOOL_TAB_TIMEOUT_MS,
  type TabToolResponse,
} from "@/agent/protocol";
import { agentLog, setAgentLogContext } from "@/agent/logger";
import type { ToolCall, ToolExecutor, ToolResult } from "@/agent/types";

export interface DocumentWaiter {
  waitForDocument(tabId: number, timeoutMs?: number): Promise<void>;
  waitForPossibleNavigation(tabId: number, timeoutMs?: number): Promise<void>;
}

export class TabToolExecutor implements ToolExecutor {
  constructor(
    private tabId: number,
    private agentId: string,
    private documentWaiter: DocumentWaiter
  ) {}

  setAgentId(agentId: string): void {
    this.agentId = agentId;
  }

  async execute(call: ToolCall): Promise<ToolResult> {
    setAgentLogContext({ scope: "background", tabId: this.tabId, agentId: this.agentId });
    agentLog.toolDispatch({ tabId: this.tabId, agentId: this.agentId, call });

    const result = await this.executeOnTab(call);

    if (call.name === "navigate" && result.ok) {
      await this.documentWaiter.waitForDocument(this.tabId, NAVIGATION_WAIT_MS);
    } else if (call.name === "click" && result.ok) {
      await this.documentWaiter.waitForPossibleNavigation(this.tabId, 3000);
    }

    return result;
  }

  private executeOnTab(call: ToolCall): Promise<ToolResult> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve({ ok: false, error: "tool_tab_unreachable" });
      }, TOOL_TAB_TIMEOUT_MS);

      sendToTab<TabToolResponse>(this.tabId, {
        type: MSG.AGENT_EXECUTE_TOOL,
        call,
        agentId: this.agentId,
      })
        .then((response) => {
          clearTimeout(timer);
          resolve(response ?? { ok: false, error: "tool_tab_unreachable" });
        })
        .catch(() => {
          clearTimeout(timer);
          resolve({ ok: false, error: "tool_tab_unreachable" });
        });
    });
  }
}
