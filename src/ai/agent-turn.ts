/** Agent loop types (separate from chat Message / GenerateRequest). */

export type AgentMessageRole = "user" | "model" | "tool";

export type AgentContentPart =
  | { type: "text"; text: string; thoughtSignature?: string }
  | {
      type: "functionCall";
      id?: string;
      name: string;
      args: Record<string, unknown>;
      thoughtSignature?: string;
    }
  | {
      type: "functionResponse";
      id?: string;
      name: string;
      response: Record<string, unknown>;
    };

export interface AgentMessage {
  role: AgentMessageRole;
  parts: AgentContentPart[];
}

export interface AgentFunctionDeclaration {
  name: string;
  description?: string;
  parametersJsonSchema?: unknown;
}

export interface AgentTurnRequest {
  model: string;
  system: string;
  messages: AgentMessage[];
  functionDeclarations: AgentFunctionDeclaration[];
}

export interface AgentFunctionCall {
  id?: string;
  name: string;
  args: Record<string, unknown>;
  thoughtSignature?: string;
}

export interface AgentTurnResponse {
  text?: string;
  functionCalls: AgentFunctionCall[];
  /** Exact model parts to replay on the next turn (preserves thought signatures). */
  modelParts?: AgentContentPart[];
  /** Set when the turn was served from the in-memory agent cache. */
  fromCache?: boolean;
}

export function agentTextMessage(role: AgentMessageRole, text: string): AgentMessage {
  return { role, parts: [{ type: "text", text }] };
}

export function hasFunctionResponseParts(messages: AgentMessage[]): boolean {
  return messages.some((message) =>
    message.parts.some((part) => part.type === "functionResponse")
  );
}
