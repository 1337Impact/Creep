import type { AgentTurnResponse } from "../agent-turn";

export class BaseProvider {
  protected cache = new Map<string, string>();
  protected agentTurnCache = new Map<string, AgentTurnResponse>();

  protected getCacheKey(...args: unknown[]): string {
    return JSON.stringify(args);
  }

  protected readCache(key: string): string | undefined {
    return this.cache.get(key);
  }

  protected writeCache(key: string, value: string): void {
    this.cache.set(key, value);
  }

  protected readAgentTurnCache(key: string): AgentTurnResponse | undefined {
    return this.agentTurnCache.get(key);
  }

  protected writeAgentTurnCache(key: string, value: AgentTurnResponse): void {
    this.agentTurnCache.set(key, value);
  }
}
