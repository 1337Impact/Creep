import {
  EVALUATE_JS_MAX_OUTPUT_CHARS,
  EVALUATE_JS_MAX_SCRIPT_CHARS,
  EVALUATE_JS_TIMEOUT_MS,
} from "../constants";
import type { ToolResult } from "../types";

const EVAL_RESULT_EVENT = "creep-agent-eval-result";

const fail = (error: string): ToolResult => ({ ok: false, error });
const ok = (data: Record<string, unknown>): ToolResult => ({ ok: true, data });

function formatResult(value: unknown): string {
  let s: string;
  if (value === undefined) s = "undefined";
  else if (value === null) s = "null";
  else if (typeof value === "string") s = value;
  else {
    try {
      const j = JSON.stringify(value);
      s = typeof j === "string" ? j : String(value);
    } catch {
      s = String(value);
    }
  }
  if (s.length <= EVALUATE_JS_MAX_OUTPUT_CHARS) return s;
  return `${s.slice(0, EVALUATE_JS_MAX_OUTPUT_CHARS)}\n[truncated: ${s.length} chars total]`;
}

/**
 * Run user JS in the page main world via a transient <script> tag.
 * MV3 extension CSP blocks AsyncFunction/eval in the content-script bundle;
 * injected page scripts can still access the same DOM (isolated from page JS vars
 * unless the snippet reads window).
 */
function runInPageMainWorld(doc: Document, trimmed: string): Promise<unknown> {
  const win = doc.defaultView;
  if (!win) return Promise.reject(new Error("no_document_window"));

  const id = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      win.removeEventListener(EVAL_RESULT_EVENT, onResult);
      reject(new Error("evaluate_js_timeout"));
    }, EVALUATE_JS_TIMEOUT_MS);

    const onResult = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; ok?: boolean; result?: unknown; error?: string }>)
        .detail;
      if (!detail || detail.id !== id) return;

      clearTimeout(timeoutId);
      win.removeEventListener(EVAL_RESULT_EVENT, onResult);

      if (detail.ok) resolve(detail.result);
      else reject(new Error(detail.error ?? "evaluate_js_failed"));
    };

    win.addEventListener(EVAL_RESULT_EVENT, onResult);

    const tag = doc.createElement("script");
    tag.textContent = `(function(){
  var id=${JSON.stringify(id)};
  var evt=${JSON.stringify(EVAL_RESULT_EVENT)};
  function send(ok,payload){
    window.dispatchEvent(new CustomEvent(evt,{detail:ok?{id:id,ok:true,result:payload}:{id:id,error:String(payload)}}));
  }
  (async function(){
    try{ send(true, await (async function(){
${trimmed}
    })()); }
    catch(e){ send(false, e&&e.message?e.message:String(e)); }
  })();
})();`;

    const parent = doc.head || doc.documentElement;
    parent.appendChild(tag);
    tag.remove();
  });
}

/**
 * DOM queries from the content-script isolated world; uses page injection because
 * the extension bundle cannot eval under MV3 CSP.
 */
export async function evaluateJsInContent(
  script: unknown,
  doc: Document = document
): Promise<ToolResult> {
  if (typeof script !== "string" || !script.trim()) return fail("missing_script");
  const trimmed = script.trim();
  if (trimmed.length > EVALUATE_JS_MAX_SCRIPT_CHARS) return fail("script_too_long");

  try {
    const value = await runInPageMainWorld(doc, trimmed);
    return ok({ result: formatResult(value) });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message === "evaluate_js_timeout") return fail("evaluate_js_timeout");
    if (/content security policy|unsafe-eval|violates the following/i.test(message)) {
      return fail("evaluate_js_csp_blocked");
    }
    return fail(`js_exception: ${message}`);
  }
}
