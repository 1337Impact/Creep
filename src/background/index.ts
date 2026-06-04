import { MSG, type BackgroundRequest, type BackgroundResponse } from "@/agent/protocol";
import { KEEPALIVE_PORT_NAME } from "@/agent/protocol";
import { getOrchestrator, handleKeepaliveConnect } from "./agent-orchestrator";

export { KEEPALIVE_PORT_NAME };

export function routeMessage(
  request: BackgroundRequest,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: BackgroundResponse) => void
): boolean {
  const orchestrator = getOrchestrator();
  const tabId = sender.tab?.id;

  if (request.type === MSG.CAPTURE_SCREENSHOT) {
    const windowId = sender.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT;
    chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message ?? "Screenshot failed" });
      } else {
        sendResponse({ dataUrl: dataUrl ?? "" });
      }
    });
    return true;
  }

  if (request.type === MSG.AGENT_START) {
    const resolvedTabId = tabId ?? request.tabId;
    if (resolvedTabId == null) {
      sendResponse({ ok: false, error: "No tab id" });
      return false;
    }
    void orchestrator.start({ ...request, tabId: resolvedTabId }).then(sendResponse);
    return true;
  }

  if (request.type === MSG.AGENT_CANCEL) {
    const resolvedTabId = tabId ?? request.tabId;
    if (resolvedTabId == null) {
      sendResponse({ ok: true });
      return false;
    }
    void orchestrator.cancel(resolvedTabId).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (request.type === MSG.AGENT_GET_STATUS) {
    const resolvedTabId = tabId ?? request.tabId;
    if (resolvedTabId == null) {
      sendResponse({ active: false });
      return false;
    }
    void orchestrator.getStoredStatus(resolvedTabId).then(sendResponse);
    return true;
  }

  if (request.type === MSG.AGENT_CONTENT_READY) {
    if (tabId != null) {
      orchestrator.onContentReady(tabId);
    }
    sendResponse({ ok: true });
    return false;
  }

  return false;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request?.type) return false;
  return routeMessage(request as BackgroundRequest, sender, sendResponse);
});

chrome.runtime.onConnect.addListener(handleKeepaliveConnect);
