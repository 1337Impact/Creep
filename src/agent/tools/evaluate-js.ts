import {
  EVALUATE_JS_MAX_OUTPUT_CHARS,
  EVALUATE_JS_MAX_SCRIPT_CHARS,
  EVALUATE_JS_TIMEOUT_MS,
} from "../constants";
import type { ToolResult } from "../types";

const EVAL_EVENT = "creep-agent-eval";

function fail(error: string): ToolResult {
  return { ok: false, error };
}

function ok(data: Record<string, unknown>): ToolResult {
  return { ok: true, data };
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n[truncated: ${s.length} chars total, showing first ${max}]`;
}

function stringifyResult(value: unknown): string {
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 0);
  } catch {
    return String(value);
  }
}

/** Run JS in the page main world (not the content-script isolated world). */
export function evaluateJsInPage(doc: Document, script: string): Promise<ToolResult> {
  const trimmed = script.trim();
  if (!trimmed) return Promise.resolve(fail("missing_script"));
  if (trimmed.length > EVALUATE_JS_MAX_SCRIPT_CHARS) {
    return Promise.resolve(fail("script_too_long"));
  }

  return new Promise((resolve) => {
    const requestId = crypto.randomUUID();

    const timeoutId = window.setTimeout(() => {
      doc.removeEventListener(EVAL_EVENT, onResult);
      resolve(fail("evaluate_js_timeout"));
    }, EVALUATE_JS_TIMEOUT_MS);

    const onResult = (event: Event) => {
      const detail = (event as CustomEvent<EvalDetail>).detail;
      if (!detail || detail.id !== requestId) return;

      window.clearTimeout(timeoutId);
      doc.removeEventListener(EVAL_EVENT, onResult);

      if (!detail.ok) {
        resolve(fail(`js_exception: ${detail.error ?? "unknown"}`));
        return;
      }

      resolve(
        ok({
          result: truncate(stringifyResult(detail.result), EVALUATE_JS_MAX_OUTPUT_CHARS),
        })
      );
    };

    doc.addEventListener(EVAL_EVENT, onResult);

    const tag = doc.createElement("script");
    tag.textContent = buildInjector(requestId, trimmed);
    (doc.head || doc.documentElement).appendChild(tag);
    tag.remove();
  });
}

type EvalDetail = {
  id: string;
  ok: boolean;
  error?: string;
  result?: unknown;
};

function buildInjector(requestId: string, script: string): string {
  const idLiteral = JSON.stringify(requestId);
  const scriptLiteral = JSON.stringify(script);

  return `(function(){
  var id=${idLiteral};
  var userScript=${scriptLiteral};
  function emit(ok,err,res){
    document.dispatchEvent(new CustomEvent("${EVAL_EVENT}",{detail:{id:id,ok:ok,error:err,result:res}}));
  }
  try{
    var runner=new Function("return (async function(){\\n"+userScript+"\\n})()");
    var out=runner();
    if(out&&typeof out.then==="function"){
      out.then(function(r){emit(true,undefined,r);}).catch(function(e){emit(false,(e&&e.message)||String(e));});
    }else{
      emit(true,undefined,out);
    }
  }catch(e){
    emit(false,(e&&e.message)||String(e));
  }
})();`;
}
