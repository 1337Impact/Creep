import type { AgentActiveSession, AgentRunPhase } from "./protocol";

export const AGENT_ACTIVE_SESSION_KEY = "agent_active_session";

export type StoredAgentActiveSession = AgentActiveSession;

export function readActiveSession(): Promise<StoredAgentActiveSession | undefined> {
  return new Promise((resolve) =>
    chrome.storage.local.get(AGENT_ACTIVE_SESSION_KEY, (result) =>
      resolve(result[AGENT_ACTIVE_SESSION_KEY] as StoredAgentActiveSession | undefined)
    )
  );
}

export function writeActiveSession(
  session: StoredAgentActiveSession | null
): Promise<void> {
  if (!session) {
    return new Promise((resolve) =>
      chrome.storage.local.remove(AGENT_ACTIVE_SESSION_KEY, resolve)
    );
  }
  return new Promise((resolve) =>
    chrome.storage.local.set({ [AGENT_ACTIVE_SESSION_KEY]: session }, resolve)
  );
}

export function patchActiveSession(
  patch: Partial<StoredAgentActiveSession>
): Promise<void> {
  return readActiveSession().then((existing) => {
    if (!existing) return;
    return writeActiveSession({ ...existing, ...patch });
  });
}

export function isActiveAgentForTab(
  session: StoredAgentActiveSession | undefined,
  tabId: number,
  agentId: string
): boolean {
  return (
    !!session &&
    session.tabId === tabId &&
    session.agentId === agentId &&
    session.phase !== "idle"
  );
}

export function sessionPhase(
  phase: AgentRunPhase
): StoredAgentActiveSession["phase"] {
  return phase;
}
