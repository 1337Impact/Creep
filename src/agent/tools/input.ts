import type { ToolResult } from "../types";

const EXT_ROOT = "#chrome-ai-helper-host, [data-extension-root]";
const TYPE_DELAY_MS = 20;

const fail = (error: string): ToolResult => ({ ok: false, error });
const ok = (data: Record<string, unknown>): ToolResult => ({ ok: true, data });

function resolveTarget(doc: Document, args: Record<string, unknown>): Element | ToolResult {
  const id = typeof args.id === "string" ? args.id.trim() : "";
  const selector = typeof args.selector === "string" ? args.selector.trim() : "";

  if (id && selector) return fail("ambiguous_target");
  if (!id && !selector) return fail("missing_target");

  const el = id ? doc.getElementById(id) : doc.querySelector(selector);
  if (!el) return fail("element_not_found");
  if (el.closest(EXT_ROOT)) return fail("element_in_extension_ui");
  return el;
}

function isTypeable(el: Element): boolean {
  if (el instanceof HTMLInputElement) return el.type !== "hidden";
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  return false;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Type into an element using keyboard/input events (Godel agent-sdk type_text).
 * Works with plain inputs and React/Vue controlled components.
 */
async function typeIntoElement(
  el: HTMLElement,
  text: string,
  clear: boolean
): Promise<void> {
  if (clear && "value" in el) {
    (el as HTMLInputElement).value = "";
  }

  if ("setSelectionRange" in el && typeof (el as HTMLInputElement).value === "string") {
    const input = el as HTMLInputElement;
    const end = input.value.length;
    input.setSelectionRange(end, end);
  }

  const fireKeyboard = (type: string, key: string) => {
    el.dispatchEvent(
      new KeyboardEvent(type, {
        key,
        code:
          key === " "
            ? "Space"
            : key === "\n"
              ? "Enter"
              : `Key${key.toUpperCase()}`,
        bubbles: true,
        cancelable: true,
      })
    );
  };

  const fireInput = (data: string) => {
    el.dispatchEvent(
      new InputEvent("input", {
        data,
        inputType: "insertText",
        bubbles: true,
        cancelable: true,
      })
    );
  };

  const insertChar = (ch: string) => {
    const usedExec =
      typeof document.execCommand === "function" &&
      document.execCommand("insertText", false, ch);
    if (!usedExec) {
      if (
        "setRangeText" in el &&
        typeof (el as HTMLInputElement).setRangeText === "function" &&
        "selectionStart" in el
      ) {
        const input = el as HTMLInputElement;
        const start = input.selectionStart ?? (typeof input.value === "string" ? input.value.length : 0);
        const end = input.selectionEnd ?? start;
        input.setRangeText(ch, start, end, "end");
      } else if (el.isContentEditable) {
        const sel = el.ownerDocument?.defaultView?.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          range.insertNode(el.ownerDocument!.createTextNode(ch));
          range.collapse(false);
        } else {
          el.appendChild(el.ownerDocument!.createTextNode(ch));
        }
      } else if ("value" in el) {
        const input = el as HTMLInputElement;
        input.value = (input.value ?? "") + ch;
      }
    }
    fireInput(ch);
  };

  el.focus();

  for (const ch of text) {
    if (el.ownerDocument?.activeElement !== el) {
      el.focus();
    }

    const key =
      ch === "\n" ? "Enter" : ch === "\r" ? "Enter" : ch === " " ? " " : ch;
    fireKeyboard("keydown", key);
    fireKeyboard("keypress", key);

    if (ch === "\n" || ch === "\r") {
      if (
        "setRangeText" in el &&
        "selectionStart" in el &&
        typeof (el as HTMLInputElement).value === "string"
      ) {
        const input = el as HTMLInputElement;
        const start = input.selectionStart ?? 0;
        const end = input.selectionEnd ?? start;
        input.setRangeText("\n", start, end, "end");
        fireInput("\n");
      } else {
        document.execCommand?.("insertLineBreak");
        fireInput("\n");
      }
    } else {
      insertChar(ch);
    }

    fireKeyboard("keyup", key);
    await sleep(TYPE_DELAY_MS);
  }

  el.dispatchEvent(new Event("change", { bubbles: true }));
}

export async function executeInputTool(
  doc: Document,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const text = typeof args.text === "string" ? args.text : "";
  if (!text) return fail("missing_text");

  const resolved = resolveTarget(doc, args);
  if (!("tagName" in resolved)) return resolved;

  const el = resolved;
  if (!(el instanceof HTMLElement)) return fail("element_not_typeable");
  if (!isTypeable(el)) return fail("element_not_typeable");

  const clear = args.clear !== false;

  try {
    await typeIntoElement(el, text, clear);
    return ok({
      typed: true,
      length: text.length,
      cleared_first: clear,
      ...(typeof args.id === "string" && args.id.trim()
        ? { id: args.id.trim() }
        : { selector: String(args.selector).trim() }),
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "input_failed");
  }
}
