import type { AgentFunctionCall, AgentMessage } from "@/ai/agent-turn";

export interface AgentRunInput {
  task: string;
  initialObservation?: string;
  modelId?: string;
  maxSteps?: number;
  useCache?: boolean;
}

export interface AgentRunResult {
  summary: string;
  steps: number;
  messages: AgentMessage[];
}

export type AgentEvent =
  | { type: "tool_call"; call: AgentFunctionCall; step: number }
  | {
      type: "tool_result";
      callId?: string;
      name: string;
      ok: boolean;
      result: Record<string, unknown>;
      step: number;
    }
  | { type: "model_text"; text: string; step: number }
  | { type: "done"; summary: string; steps: number; messages: AgentMessage[] }
  | { type: "error"; code: string; message: string; steps: number };

export type ToolCall = AgentFunctionCall;

export interface ToolResult {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export interface ToolExecutor {
  execute(call: ToolCall): Promise<ToolResult>;
}

export type AgentRunStatus = "running" | "done" | "error";

export interface AgentRunRecord {
  agentId: string;
  createdAt: number;
  initialRequest: string;
  finalResponse?: string;
  toolCallCount: number;
  durationMs?: number;
  status: AgentRunStatus;
  events: AgentEvent[];
}

export interface PersistedAgentRun {
  agentId: string;
  events: AsyncGenerator<AgentEvent>;
}
