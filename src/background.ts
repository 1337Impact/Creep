chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'CAPTURE_SCREENSHOT') {
    // If sender.tab is defined, use its windowId; otherwise use current window
    const windowId = sender.tab?.windowId || chrome.windows.WINDOW_ID_CURRENT;
    
    chrome.tabs.captureVisibleTab(
      windowId,
      { format: 'png' },
      (dataUrl) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ dataUrl });
        }
      }
    );
    return true; // Indicates asynchronous response
  }
});

