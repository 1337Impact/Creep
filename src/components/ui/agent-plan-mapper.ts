import type { AgentEvent } from "@/agent/types";
import type { AgentPlanStatus, AgentPlanTask } from "./agent-plan-types";

function formatToolArgs(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "observe_page":
      return "Snapshot URL, title, page text, and interactable elements";
    case "click":
      return typeof args.ref === "string" ? `Click element ${args.ref}` : "Click element";
    case "type":
      return typeof args.ref === "string"
        ? `Type into ${args.ref}${typeof args.text === "string" ? `: "${args.text}"` : ""}`
        : "Type text into input";
    case "input":
      if (typeof args.id === "string") {
        return `Input into #${args.id}${typeof args.text === "string" ? `: "${args.text}"` : ""}`;
      }
      if (typeof args.selector === "string") {
        return `Input into ${args.selector}${typeof args.text === "string" ? `: "${args.text}"` : ""}`;
      }
      return typeof args.text === "string" ? `Input: "${args.text}"` : "Input text into field";
    case "scroll":
      return `Scroll ${typeof args.direction === "string" ? args.direction : "down"}${
        typeof args.amount === "number" ? ` (${args.amount}px)` : ""
      }`;
    case "navigate":
      return typeof args.url === "string" ? args.url : "Navigate to URL";
    case "evaluate_js":
      return typeof args.script === "string"
        ? `Run script: ${args.script.slice(0, 80)}${args.script.length > 80 ? "…" : ""}`
        : "Run JavaScript in page context";
    case "complete_task":
      return typeof args.summary === "string" ? args.summary : "Mark task complete";
    default:
      return JSON.stringify(args);
  }
}

function toolStatus(hasResult: boolean, ok?: boolean): AgentPlanStatus {
  if (!hasResult) return "in-progress";
  if (ok === false) return "failed";
  return "completed";
}

/**
 * One AgentPlanTask per tool invocation; task title is the tool name (navigate, click, …).
 */
export function agentEventsToPlanTasks(events: AgentEvent[]): AgentPlanTask[] {
  const tasks: AgentPlanTask[] = [];
  const byKey = new Map<string, AgentPlanTask>();

  const register = (key: string, task: AgentPlanTask) => {
    byKey.set(key, task);
    tasks.push(task);
  };

  for (const event of events) {
    if (event.type === "tool_call") {
      const key =
        event.call.id ?? `${event.step}-${event.call.name}-${byKey.size}`;
      register(key, {
        id: key,
        title: event.call.name,
        description: formatToolArgs(event.call.name, event.call.args),
        status: "in-progress",
        step: event.step,
        subtasks: [],
      });
      continue;
    }

    if (event.type === "tool_result") {
      const task =
        (event.callId && byKey.get(event.callId)) ??
        [...tasks].reverse().find((t) => t.title === event.name && t.status === "in-progress");

      if (!task) continue;

      task.status = toolStatus(true, event.ok);
      if (!event.ok && typeof event.result.error === "string") {
        task.description = `${task.description} — ${event.result.error}`;
      }
      continue;
    }

    if (event.type === "model_text") {
      const last = [...tasks].reverse().find((t) => t.step === event.step);
      const note = event.text.trim();
      if (!note) continue;
      if (last) {
        last.description = last.description
          ? `${note}\n${last.description}`
          : note;
      }
    }
  }

  return tasks;
}
