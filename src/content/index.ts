import { browser } from '../shared/browser-api';
import type { Message, MessageResponse } from '../shared/messages';
import type { SVGItem } from '../shared/types';
import { scanPage } from './scanner';

// Mark as injected so programmatic injection knows we're already here
(window as unknown as { __svgScoutInjected?: boolean }).__svgScoutInjected = true;

browser.runtime.onMessage.addListener(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (message: any) => {
    // Return a promise for async handling
    return handleMessage(message as Message);
  }
);

async function handleMessage(message: Message): Promise<MessageResponse> {
  switch (message.type) {
    case 'SCAN_PAGE':
      return performScan();

    default:
      return { success: false, error: 'Unknown message type' };
  }
}

async function performScan(): Promise<MessageResponse<SVGItem[]>> {
  try {
    const items = await scanPage((progress) => {
      browser.runtime.sendMessage({
        type: 'SCAN_PROGRESS',
        progress,
      });
    });

    const pageTitle = document.title || undefined;

    browser.runtime.sendMessage({
      type: 'SCAN_RESULT',
      items,
      pageTitle,
    });

    return { success: true, data: items, pageTitle };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
