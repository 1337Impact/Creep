import type { AgentFunctionCall, AgentMessage, AgentTurnResponse } from "@/ai/agent-turn";
import { agentTextMessage } from "@/ai/agent-turn";
import { getReadableAiError } from "@/ai/errors";
import { MAX_AGENT_STEPS } from "./constants";
import { agentLog } from "./logger";
import { generateAgentTurn } from "./turn";
import type { AgentEvent, AgentRunInput, ToolExecutor, ToolResult } from "./types";

const COMPLETE_TASK = "complete_task";

function initialMessage(input: AgentRunInput): string {
  const obs = input.initialObservation?.trim();
  return obs ? `Task: ${input.task}\n\nInitial context:\n${obs}` : `Task: ${input.task}`;
}

function modelMessage(turn: AgentTurnResponse): AgentMessage | null {
  if (turn.modelParts?.length) {
    return { role: "model", parts: turn.modelParts };
  }

  const parts: AgentMessage["parts"] = [];
  if (turn.text?.trim()) parts.push({ type: "text", text: turn.text });
  for (const call of turn.functionCalls) {
    parts.push({
      type: "functionCall",
      id: call.id,
      name: call.name,
      args: call.args,
      thoughtSignature: call.thoughtSignature,
    });
  }
  return parts.length ? { role: "model", parts } : null;
}

function toolResponse(result: Awaited<ReturnType<ToolExecutor["execute"]>>) {
  return result.ok
    ? { ok: true, ...result.data }
    : { ok: false, error: result.error ?? "tool_failed" };
}

async function* runTools(
  calls: AgentFunctionCall[],
  executor: ToolExecutor,
  messages: AgentMessage[],
  step: number
): AsyncGenerator<AgentEvent> {
  for (const call of calls) {
    const startedAt = Date.now();
    yield { type: "tool_call", call, step };
    agentLog.toolCall(step, call);

    let result: ToolResult;
    try {
      result = await executor.execute(call);
    } catch (error) {
      result = {
        ok: false,
        error: error instanceof Error ? error.message : "tool_executor_threw",
      };
    }

    const response = toolResponse(result);
    agentLog.toolResult(step, call, result, { durationMs: Date.now() - startedAt });

    yield {
      type: "tool_result",
      callId: call.id,
      name: call.name,
      ok: result.ok,
      result: response,
      step,
    };
    messages.push({
      role: "tool",
      parts: [{ type: "functionResponse", id: call.id, name: call.name, response }],
    });
  }
}

export function runAgentLoop(
  input: AgentRunInput,
  executor: ToolExecutor
): AsyncGenerator<AgentEvent> {
  return run(input, executor);
}

async function* run(
  input: AgentRunInput,
  executor: ToolExecutor
): AsyncGenerator<AgentEvent> {
  const maxSteps = input.maxSteps ?? MAX_AGENT_STEPS;
  const messages: AgentMessage[] = [
    agentTextMessage("user", initialMessage(input)),
  ];

  for (let step = 0; step < maxSteps; step++) {
    agentLog.stepStart(step, maxSteps);

    let turn: AgentTurnResponse;
    try {
      turn = await generateAgentTurn(messages, {
        modelId: input.modelId,
        useCache: input.useCache,
        step,
      });
    } catch (error) {
      const message = getReadableAiError(error);
      agentLog.llmError(step, message);
      yield {
        type: "error",
        code: "llm_error",
        message,
        steps: step,
      };
      return;
    }

    agentLog.modelTurn({
      step,
      text: turn.text,
      toolNames: turn.functionCalls.map((c) => c.name),
      fromCache: turn.fromCache,
    });

    if (turn.text?.trim()) yield { type: "model_text", text: turn.text, step };

    const model = modelMessage(turn);
    if (model) messages.push(model);

    if (!turn.functionCalls.length) {
      yield {
        type: "done",
        summary: turn.text?.trim() || "Task completed.",
        steps: step + 1,
        messages: [...messages],
      };
      return;
    }

    const complete = turn.functionCalls.find((c) => c.name === COMPLETE_TASK);
    const calls = complete ? [complete] : turn.functionCalls;

    yield* runTools(calls, executor, messages, step);

    if (complete) {
      const summary =
        (typeof complete.args.summary === "string" && complete.args.summary) ||
        turn.text?.trim() ||
        "Task completed.";
      yield { type: "done", summary, steps: step + 1, messages: [...messages] };
      return;
    }
  }

  const maxStepsMessage = `Agent stopped after ${maxSteps} steps.`;
  agentLog.agentError({ code: "max_steps", message: maxStepsMessage, steps: maxSteps });
  yield {
    type: "error",
    code: "max_steps",
    message: maxStepsMessage,
    steps: maxSteps,
  };
}
