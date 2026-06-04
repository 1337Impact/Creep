import { AGENT_RUN_PREFIX } from "./constants";
import { agentLog } from "./logger";
import type { AgentEvent, AgentRunInput, AgentRunRecord, AgentRunStatus, PersistedAgentRun } from "./types";

const runKey = (id: string) => `${AGENT_RUN_PREFIX}${id}`;

const storage = {
  get: <T>(key: string) =>
    new Promise<T | undefined>((r) =>
      chrome.storage.local.get(key, (res) => r(res[key] as T | undefined))
    ),
  set: (key: string, value: AgentRunRecord) =>
    new Promise<void>((r) => chrome.storage.local.set({ [key]: value }, r)),
  remove: (key: string) =>
    new Promise<void>((r) => chrome.storage.local.remove(key, r)),
  all: () =>
    new Promise<Record<string, unknown>>((r) => chrome.storage.local.get(null, r)),
};

export async function createAgentRun(record: AgentRunRecord): Promise<void> {
  await storage.set(runKey(record.agentId), record);
}

export async function getAgentRun(agentId: string): Promise<AgentRunRecord | null> {
  const record = await storage.get<AgentRunRecord>(runKey(agentId));
  if (!record) return null;
  return { ...record, events: record.events ?? [] };
}

export async function finalizeAgentRun(
  agentId: string,
  patch: {
    finalResponse: string;
    toolCallCount: number;
    durationMs: number;
    status: Exclude<AgentRunStatus, "running">;
  }
): Promise<AgentRunRecord> {
  const existing = await getAgentRun(agentId);
  if (!existing) throw new Error(`Agent run not found: ${agentId}`);
  const record = { ...existing, ...patch };
  await storage.set(runKey(agentId), record);
  return record;
}

export async function deleteAgentRun(agentId: string): Promise<void> {
  await storage.remove(runKey(agentId));
}

export async function listAgentRuns(): Promise<AgentRunRecord[]> {
  const store = await storage.all();
  const records: AgentRunRecord[] = [];
  for (const [key, raw] of Object.entries(store)) {
    if (!key.startsWith(AGENT_RUN_PREFIX) || !raw || typeof raw !== "object") continue;
    records.push(raw as AgentRunRecord);
  }
  return records.sort((a, b) => b.createdAt - a.createdAt);
}

class RunRecorder {
  private id = "";
  private started = 0;
  private toolCalls = 0;

  async start(input: AgentRunInput): Promise<string> {
    this.id = crypto.randomUUID();
    this.started = Date.now();
    this.toolCalls = 0;
    await createAgentRun({
      agentId: this.id,
      createdAt: this.started,
      initialRequest: input.task,
      toolCallCount: 0,
      status: "running",
      events: [],
    });
    agentLog.runStart(input, this.id);
    return this.id;
  }

  async onEvent(event: AgentEvent): Promise<void> {
    if (event.type === "tool_call" && event.call.name !== "complete_task") {
      this.toolCalls += 1;
    }
    const existing = await getAgentRun(this.id);
    if (!existing) return;
    await storage.set(runKey(this.id), {
      ...existing,
      events: [...(existing.events ?? []), event],
    });
  }

  async finish(event: Extract<AgentEvent, { type: "done" } | { type: "error" }>) {
    if (!this.id) throw new Error("Recorder not started");
    const durationMs = Date.now() - this.started;
    const status = event.type === "done" ? "done" : "error";
    agentLog.runFinish({
      agentId: this.id,
      status,
      steps: event.steps,
      summary: event.type === "done" ? event.summary : undefined,
      code: event.type === "error" ? event.code : undefined,
      toolCallCount: this.toolCalls,
      durationMs,
    });
    return finalizeAgentRun(this.id, {
      finalResponse: event.type === "done" ? event.summary : event.message,
      toolCallCount: this.toolCalls,
      durationMs,
      status,
    });
  }
}

export async function runPersisted(
  input: AgentRunInput,
  source: AsyncGenerator<AgentEvent>
): Promise<PersistedAgentRun> {
  const rec = new RunRecorder();
  const agentId = await rec.start(input);

  async function* events() {
    try {
      for await (const event of source) {
        await rec.onEvent(event);
        if (event.type === "done" || event.type === "error") await rec.finish(event);
        yield event;
      }
    } catch (error) {
      await rec.finish({
        type: "error",
        code: "aborted",
        message: error instanceof Error ? error.message : "Agent run failed",
        steps: 0,
      });
      throw error;
    }
  }

  return { agentId, events: events() };
}
