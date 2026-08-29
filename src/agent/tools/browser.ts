import { MAX_OBSERVE_ELEMENTS, MAX_OBSERVE_PAGE_TEXT_CHARS } from "../constants";
import { agentLog, setAgentLogContext } from "../logger";
import type { ToolCall, ToolExecutor, ToolResult } from "../types";
import { evaluateJsInContent } from "./evaluate-js";
import { executeInputTool } from "./input";

const EXT_ROOT = "#chrome-ai-helper-host, [data-extension-root]";
const INTERACTABLE =
  "button,a[href],input:not([type=hidden]),textarea,select,[role=button],[role=link],[role=textbox],[role=combobox],[role=menuitem]";

function fail(error: string): ToolResult {
  return { ok: false, error };
}

function ok(data: Record<string, unknown>): ToolResult {
  return { ok: true, data };
}

function label(el: Element): string {
  const aria = el.getAttribute("aria-label")?.trim();
  if (aria) return aria;
  if (el instanceof HTMLInputElement) {
    return el.placeholder || el.name || el.type;
  }
  return (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
}

function role(el: Element): string {
  return (
    el.getAttribute("role") ??
    ({ button: "button", a: "link", input: "input", textarea: "input", select: "input" }[
      el.tagName.toLowerCase()
    ] as string | undefined) ??
    el.tagName.toLowerCase()
  );
}

function resolveNavigateUrl(raw: string, base: string): string | null {
  try {
    const url = new URL(raw.trim(), base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

export class BrowserToolExecutor implements ToolExecutor {
  private refMap = new Map<string, Element>();
  private snapshotUrl: string;

  constructor(private doc: Document) {
    this.snapshotUrl = doc.location?.href ?? "";
  }

  async execute(call: ToolCall): Promise<ToolResult> {
    const { name, args } = call;
    setAgentLogContext({ scope: "content" });
    agentLog.toolCall(0, call);

    const startedAt = Date.now();
    let result: ToolResult;
    try {
      result = await this.runTool(name, args);
    } catch (error) {
      result = {
        ok: false,
        error: error instanceof Error ? error.message : "browser_tool_threw",
      };
    }
    agentLog.toolResult(0, call, result, { durationMs: Date.now() - startedAt, via: "dom" });
    return result;
  }

  private async runTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    if (name === "complete_task") {
      return args.summary ? ok({ summary: String(args.summary) }) : fail("missing_summary");
    }

    if (name === "observe_page") {
      const elements: Array<{ ref: string; role: string; name: string; tag: string }> = [];
      this.refMap.clear();
      let i = 0;

      for (const el of this.doc.querySelectorAll(INTERACTABLE)) {
        if (!(el instanceof HTMLElement) || el.closest(EXT_ROOT)) continue;
        const s = getComputedStyle(el);
        if (s.display === "none" || s.visibility === "hidden") continue;

        const ref = `el-${i++}`;
        this.refMap.set(ref, el);
        elements.push({ ref, role: role(el), name: label(el), tag: el.tagName.toLowerCase() });
        if (i >= MAX_OBSERVE_ELEMENTS) break;
      }

      this.snapshotUrl = this.doc.location?.href ?? "";
      const pageText = (this.doc.body?.innerText ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_OBSERVE_PAGE_TEXT_CHARS);

      return ok({
        url: this.snapshotUrl,
        title: this.doc.title ?? "",
        pageText,
        elements,
      });
    }

    if (name === "scroll") {
      const dir = args.direction === "up" ? "up" : "down";
      const px =
        typeof args.amount === "number" && Number.isFinite(args.amount)
          ? args.amount
          : 400;
      const root = this.doc.scrollingElement ?? this.doc.documentElement;
      root.scrollBy({ top: dir === "down" ? px : -px, behavior: "smooth" });
      return ok({ direction: dir, amount: px, scrollTop: root.scrollTop });
    }

    if (name === "evaluate_js") {
      return evaluateJsInContent(args.script, this.doc);
    }

    if (name === "input") {
      return executeInputTool(this.doc, args);
    }

    if (name === "navigate") {
      const raw = args.url;
      if (typeof raw !== "string" || !raw.trim()) return fail("missing_url");
      const href = resolveNavigateUrl(raw, this.doc.location?.href ?? "");
      if (!href) return fail("invalid_url");

      this.refMap.clear();
      this.snapshotUrl = href;
      this.doc.defaultView?.location.assign(href);
      return ok({ navigated: true, url: href });
    }

    const ref = args.ref;
    if (typeof ref !== "string" || !ref) return fail("missing_ref");
    if ((this.doc.location?.href ?? "") !== this.snapshotUrl) return fail("ref_stale_navigation");

    const el = this.refMap.get(ref);
    if (!el || !this.doc.contains(el)) return fail("ref_stale");

    if (name === "click") {
      if (!(el instanceof HTMLElement)) return fail("ref_not_clickable");
      el.scrollIntoView({ block: "center", inline: "nearest" });
      el.click();
      this.snapshotUrl = this.doc.location?.href ?? "";
      return ok({ clicked: true });
    }

    if (name === "type") {
      if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) {
        return fail("ref_not_typeable");
      }
      const text = String(args.text ?? "");
      el.focus();
      el.value = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return ok({ typed: true, length: text.length });
    }

    return fail(`unknown_tool:${name}`);
  }

}

export function createBrowserToolExecutor(document: Document): BrowserToolExecutor {
  return new BrowserToolExecutor(document);
}
