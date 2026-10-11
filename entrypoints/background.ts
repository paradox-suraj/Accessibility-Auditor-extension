export default defineBackground(() => {
  console.log('[Accessibility Auditor] Background service worker initialized.');

  chrome.runtime.onInstalled.addListener(() => {
    // Configure side panel to open on toolbar action click
    if (chrome.sidePanel?.setPanelBehavior) {
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
        console.warn('Could not set side panel behavior:', err);
      });
    }
  });

  // Action click fallback
  chrome.action?.onClicked?.addListener(async (tab) => {
    if (tab?.windowId && chrome.sidePanel?.open) {
      try {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      } catch (e) {
        console.warn('Error opening side panel:', e);
      }
    }
  });
});
