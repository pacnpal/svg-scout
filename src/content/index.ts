import type { Message, MessageResponse } from '../shared/messages';
import type { SVGItem } from '../shared/types';
import { scanPage } from './scanner';

// Mark as injected so programmatic injection knows we're already here
(window as unknown as { __svgScoutInjected?: boolean }).__svgScoutInjected = true;

chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse: (response: MessageResponse) => void) => {
    handleMessage(message).then(sendResponse);
    return true;
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
      chrome.runtime.sendMessage({
        type: 'SCAN_PROGRESS',
        progress,
      });
    });

    const pageTitle = document.title || undefined;

    chrome.runtime.sendMessage({
      type: 'SCAN_RESULT',
      items,
      pageTitle,
    });

    return { success: true, data: items, pageTitle };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
