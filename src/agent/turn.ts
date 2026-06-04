import type { AgentMessage, AgentTurnRequest, AgentTurnResponse } from "@/ai/agent-turn";
import { hasFunctionResponseParts } from "@/ai/agent-turn";
import { resolveAgentProvider } from "@/ai/providers/factory";
import {
  AGENT_CACHE_MAX_ENTRIES,
  AGENT_SYSTEM_INSTRUCTION,
  DEFAULT_AGENT_MODEL,
} from "./constants";
import { CREEP_FUNCTION_DECLARATIONS } from "./tools/schemas";

const cache = new Map<string, AgentTurnResponse>();
const order: string[] = [];

function cacheKey(request: AgentTurnRequest): string {
  return JSON.stringify({
    model: request.model,
    system: request.system,
    messages: request.messages,
    tools: request.functionDeclarations.map((d) => d.name).sort(),
  });
}

function shouldUseCache(messages: AgentMessage[], useCache?: boolean): boolean {
  return useCache !== false && !hasFunctionResponseParts(messages);
}

export async function generateAgentTurn(
  messages: AgentMessage[],
  options?: { modelId?: string; useCache?: boolean; step?: number }
): Promise<AgentTurnResponse> {
  const request: AgentTurnRequest = {
    model: options?.modelId ?? DEFAULT_AGENT_MODEL,
    system: AGENT_SYSTEM_INSTRUCTION,
    messages,
    functionDeclarations: CREEP_FUNCTION_DECLARATIONS,
  };

  const key = cacheKey(request);
  if (shouldUseCache(messages, options?.useCache)) {
    const hit = cache.get(key);
    if (hit) return { ...hit, fromCache: true };
  }

  const response = await resolveAgentProvider(request.model).generateAgentTurn(
    request
  );

  if (shouldUseCache(messages, options?.useCache) && !cache.has(key)) {
    cache.set(key, response);
    order.push(key);
    if (order.length > AGENT_CACHE_MAX_ENTRIES) {
      const oldest = order.shift();
      if (oldest) cache.delete(oldest);
    }
  }

  return response;
}
