import browser from 'webextension-polyfill';

// Declare the build-time constant
declare const __BROWSER__: 'chrome' | 'firefox';

// Browser detection - prefer build-time constant, fallback to runtime detection
export const isFirefox = typeof __BROWSER__ !== 'undefined'
  ? __BROWSER__ === 'firefox'
  : typeof browser.runtime.getBrowserInfo === 'function';

export const isChrome = !isFirefox;

// Re-export the browser API for convenience
export { browser };

/**
 * Opens the side panel (Chrome) or sidebar (Firefox)
 */
export async function openSidePanel(windowId?: number): Promise<void> {
  if (isChrome && chrome.sidePanel) {
    let targetWindowId = windowId;
    if (!targetWindowId) {
      const currentWindow = await chrome.windows.getCurrent();
      targetWindowId = currentWindow.id;
    }
    if (targetWindowId) {
      await chrome.sidePanel.open({ windowId: targetWindowId });
    }
  } else if (isFirefox && browser.sidebarAction) {
    // Firefox - open the sidebar
    await browser.sidebarAction.open();
  }
}

/**
 * Sets the side panel behavior (Chrome only)
 * Firefox doesn't have an equivalent - sidebar behavior is different
 */
export async function setSidePanelBehavior(): Promise<void> {
  if (isChrome && chrome.sidePanel) {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  }
  // Firefox: no-op, sidebar has different UX
}

/**
 * Creates a context menu item
 */
export function createContextMenu(options: browser.Menus.CreateCreatePropertiesType): void {
  browser.contextMenus.create(options);
}
