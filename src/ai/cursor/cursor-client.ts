import { CURSOR_SERVER_URL } from "./config";

/** Events streamed by the Cursor bridge server (see server/main.py). */
export type CursorStreamEvent =
  | { type: "text"; text: string }
  | { type: "thinking"; text: string }
  | { type: "tool_call"; id?: string; name: string; args: Record<string, unknown> }
  | {
      type: "tool_result";
      id?: string;
      name: string;
      ok: boolean;
      result: Record<string, unknown>;
    }
  | { type: "done"; summary: string }
  | { type: "error"; message: string };

export interface CursorStreamOptions {
  prompt: string;
  model: string;
  conversationId?: string;
  signal?: AbortSignal;
}

/**
 * Streams a Cursor agent run from the bridge server, yielding one event per
 * SSE `data:` line. Throws if the server is unreachable or returns non-2xx.
 */
export async function* streamCursorAgent(
  options: CursorStreamOptions
): AsyncGenerator<CursorStreamEvent, void, unknown> {
  const response = await fetch(`${CURSOR_SERVER_URL}/agent/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: options.prompt,
      model: options.model,
      conversation_id: options.conversationId,
    }),
    signal: options.signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(
      `Cursor bridge returned ${response.status}. Is the server running at ${CURSOR_SERVER_URL}?`
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line.
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const dataLine = frame
        .split("\n")
        .find((line) => line.startsWith("data:"));
      if (dataLine) {
        const json = dataLine.slice(5).trim();
        if (json) {
          try {
            yield JSON.parse(json) as CursorStreamEvent;
          } catch {
            // Ignore malformed frames rather than aborting the whole stream.
          }
        }
      }

      boundary = buffer.indexOf("\n\n");
    }
  }
}
