import type { AgentEvent, AgentRunInput, ToolCall, ToolResult } from "./types";

const LOG_PREFIX = "[Creep Agent]";
const MAX_STRING_CHARS = 800;
const MAX_ARRAY_ITEMS = 12;

export type AgentLogScope = "background" | "content";

export interface AgentLogContext {
  agentId?: string;
  tabId?: number;
  scope?: AgentLogScope;
}

let context: AgentLogContext = {};

export function setAgentLogContext(partial: AgentLogContext): void {
  context = { ...context, ...partial };
}

export function clearAgentLogContext(): void {
  context = {};
}

function label(): string {
  const parts = [LOG_PREFIX];
  if (context.scope) parts.push(`[${context.scope}]`);
  if (context.tabId != null) parts.push(`tab=${context.tabId}`);
  if (context.agentId) parts.push(`run=${context.agentId.slice(0, 8)}`);
  return parts.join(" ");
}

function truncate(value: string, max = MAX_STRING_CHARS): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}… (${value.length} chars)`;
}

export function sanitizeForLog(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[max_depth]";
  if (value == null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") return truncate(value);
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((v) => sanitizeForLog(v, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) {
      items.push(`… +${value.length - MAX_ARRAY_ITEMS} more`);
    }
    return items;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.pageText === "string" && obj.pageText.length > 200) {
      const { pageText, ...rest } = obj;
      return {
        ...sanitizeRecord(rest, depth + 1),
        pageText: truncate(pageText, 200),
      };
    }
    if (Array.isArray(obj.elements) && obj.elements.length > 0) {
      const { elements, ...rest } = obj;
      return {
        ...sanitizeRecord(rest, depth + 1),
        elements: `[${elements.length} items]`,
      };
    }
    return sanitizeRecord(obj, depth + 1);
  }
  return String(value);
}

function sanitizeRecord(obj: Record<string, unknown>, depth: number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key === "thoughtSignature") {
      out[key] = typeof val === "string" ? `[thought:${val.length} chars]` : val;
      continue;
    }
    out[key] = sanitizeForLog(val, depth + 1);
  }
  return out;
}

function emit(level: "log" | "warn" | "error", message: string, detail?: unknown): void {
  const fn = console[level];
  if (detail === undefined) {
    fn(label(), message);
    return;
  }
  fn(label(), message, sanitizeForLog(detail));
}

export const agentLog = {
  runStart(input: AgentRunInput, agentId: string) {
    emit("log", "run started", {
      agentId,
      task: input.task,
      modelId: input.modelId,
      maxSteps: input.maxSteps,
      hasInitialObservation: Boolean(input.initialObservation?.trim()),
    });
  },

  runFinish(payload: {
    agentId: string;
    status: "done" | "error";
    steps?: number;
    summary?: string;
    code?: string;
    toolCallCount?: number;
    durationMs?: number;
  }) {
    emit(payload.status === "error" ? "error" : "log", "run finished", payload);
  },

  stepStart(step: number, maxSteps: number) {
    emit("log", `step ${step + 1}/${maxSteps}`);
  },

  modelTurn(payload: {
    step: number;
    text?: string;
    toolNames: string[];
    fromCache?: boolean;
  }) {
    emit("log", "model turn", {
      step: payload.step,
      text: payload.text?.trim() || undefined,
      tools: payload.toolNames,
      fromCache: payload.fromCache,
    });
  },

  modelText(step: number, text: string) {
    emit("log", "model text", { step, text: truncate(text.trim()) });
  },

  toolCall(step: number, call: ToolCall) {
    emit("log", `tool call → ${call.name}`, {
      step,
      callId: call.id,
      name: call.name,
      input: call.args,
    });
  },

  toolResult(step: number, call: ToolCall, result: ToolResult, extra?: Record<string, unknown>) {
    const status = result.ok ? "ok" : "error";
    const output = result.ok
      ? result.data
      : { error: result.error ?? "tool_failed" };
    emit(result.ok ? "log" : "error", `tool result ← ${call.name} [${status}]`, {
      step,
      callId: call.id,
      name: call.name,
      ok: result.ok,
      output,
      ...extra,
    });
  },

  toolDispatch(payload: { tabId: number; agentId: string; call: ToolCall }) {
    emit("log", `dispatch tool → ${payload.call.name}`, {
      tabId: payload.tabId,
      agentId: payload.agentId,
      callId: payload.call.id,
      input: payload.call.args,
    });
  },

  llmError(step: number, message: string) {
    emit("error", "LLM turn failed", { step, message });
  },

  agentError(payload: { code: string; message: string; steps: number }) {
    emit("error", "agent error", payload);
  },

  event(event: AgentEvent) {
    switch (event.type) {
      case "tool_call":
        agentLog.toolCall(event.step, event.call);
        break;
      case "tool_result":
        emit(event.ok ? "log" : "warn", `tool event ← ${event.name} [${event.ok ? "ok" : "error"}]`, {
          step: event.step,
          callId: event.callId,
          name: event.name,
          ok: event.ok,
          output: event.result,
        });
        break;
      case "model_text":
        agentLog.modelText(event.step, event.text);
        break;
      case "done":
        emit("log", "done", {
          steps: event.steps,
          summary: truncate(event.summary),
        });
        break;
      case "error":
        agentLog.agentError(event);
        break;
    }
  },
};
