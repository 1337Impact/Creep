import type { AgentFunctionDeclaration } from "@/ai/agent-turn";

const obj = (
  properties: Record<string, unknown>,
  required?: string[]
): unknown => ({
  type: "object",
  properties,
  ...(required ? { required } : {}),
  additionalProperties: false,
});

export const CREEP_FUNCTION_DECLARATIONS: AgentFunctionDeclaration[] = [
  {
    name: "observe_page",
    description: "Snapshot URL, title, and interactable elements with stable refs.",
    parametersJsonSchema: obj({}),
  },
  {
    name: "click",
    description: "Click an element by ref from the latest observe_page.",
    parametersJsonSchema: obj({ ref: { type: "string" } }, ["ref"]),
  },
  {
    name: "type",
    description: "Type text into an input or textarea by ref.",
    parametersJsonSchema: obj(
      { ref: { type: "string" }, text: { type: "string" } },
      ["ref", "text"]
    ),
  },
  {
    name: "scroll",
    description: "Scroll the page up or down.",
    parametersJsonSchema: obj(
      {
        direction: { type: "string", enum: ["up", "down"] },
        amount: { type: "number" },
      },
      ["direction"]
    ),
  },
  {
    name: "navigate",
    description: "Navigate the browser to a URL (include https://).",
    parametersJsonSchema: obj(
      {
        url: {
          type: "string",
          description: "Full or relative URL to open in the current tab.",
        },
      },
      ["url"]
    ),
  },
  {
    name: "evaluate_js",
    description:
      "Run JavaScript in the page context and return the result (JSON-serialized). Keep scripts small; return only fields you need.",
    parametersJsonSchema: obj(
      {
        script: {
          type: "string",
          description:
            "JS statements run in an async function wrapper; use return for the value, e.g. return document.title",
        },
      },
      ["script"]
    ),
  },
  {
    name: "complete_task",
    description: "Signal the task is finished with a summary for the user.",
    parametersJsonSchema: obj({ summary: { type: "string" } }, ["summary"]),
  },
];
