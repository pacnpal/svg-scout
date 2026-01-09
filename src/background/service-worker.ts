import type { Message, MessageResponse } from '../shared/messages';
import type { SVGItem, PngScale } from '../shared/types';
import { OFFSCREEN_DOCUMENT_PATH, CONTEXT_MENU_IDS } from '../shared/constants';
import { saveLastScanResults } from '../shared/storage';
import { generateFileName } from '../shared/svg-utils';

let creatingOffscreenDocument: Promise<void> | null = null;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_IDS.DOWNLOAD_SVG,
    title: 'Download SVG',
    contexts: ['image'],
    targetUrlPatterns: ['*://*/*.svg', '*://*/*.svg?*'],
  });

  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
});

chrome.runtime.onMessage.addListener(
  (message: Message, sender, sendResponse: (response: MessageResponse) => void) => {
    handleMessage(message, sender).then(sendResponse);
    return true;
  }
);

async function handleMessage(
  message: Message,
  sender: chrome.runtime.MessageSender
): Promise<MessageResponse> {
  switch (message.type) {
    case 'SCAN_RESULT':
      await saveLastScanResults(message.items, message.pageTitle);
      return { success: true };

    case 'DOWNLOAD_SVG':
      return downloadSvg(message.item, message.pageTitle);

    case 'DOWNLOAD_PNG':
      return downloadPng(message.item, message.scale, message.backgroundColor, message.pageTitle);

    case 'DOWNLOAD_ZIP':
      return downloadZip(message.items, message.includePng, message.pngScale, message.pageTitle);

    case 'FETCH_EXTERNAL_SVG':
      return fetchExternalSvg(message.url);

    case 'OPEN_SIDE_PANEL':
      return openSidePanel(message.windowId ?? sender.tab?.windowId);

    case 'COPY_SVG':
      return { success: true };

    default:
      return { success: false, error: 'Unknown message type' };
  }
}

async function downloadSvg(item: SVGItem, pageTitle?: string): Promise<MessageResponse> {
  try {
    await ensureOffscreenDocument();

    const response = await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'CREATE_BLOB_URL',
      content: item.content,
      mimeType: 'image/svg+xml',
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to create blob URL');
    }

    const fileName = generateFileName(item, 0, pageTitle);

    await chrome.downloads.download({
      url: response.data as string,
      filename: fileName,
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function downloadPng(
  item: SVGItem,
  scale: PngScale,
  backgroundColor?: string,
  pageTitle?: string
): Promise<MessageResponse> {
  try {
    await ensureOffscreenDocument();

    const response = await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'CONVERT_TO_PNG',
      content: item.content,
      scale,
      backgroundColor,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to convert to PNG');
    }

    const baseName = generateFileName(item, 0, pageTitle).replace('.svg', '');
    const fileName = `${baseName}-${scale}x.png`;

    await chrome.downloads.download({
      url: response.data as string,
      filename: fileName,
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function downloadZip(
  items: SVGItem[],
  includePng?: boolean,
  pngScale?: PngScale,
  pageTitle?: string
): Promise<MessageResponse> {
  try {
    await ensureOffscreenDocument();

    const response = await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'CREATE_ZIP',
      items,
      includePng,
      pngScale,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to create ZIP');
    }

    const zipName = pageTitle ? `${sanitizeFileName(pageTitle)}-svgs.zip` : 'svg-export.zip';

    await chrome.downloads.download({
      url: response.data as string,
      filename: zipName,
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')  // Remove invalid characters
    .replace(/\s+/g, '-')           // Replace spaces with hyphens
    .replace(/-+/g, '-')            // Collapse multiple hyphens
    .replace(/^-|-$/g, '')          // Remove leading/trailing hyphens
    .substring(0, 50)               // Limit length
    .toLowerCase();
}

async function fetchExternalSvg(url: string): Promise<MessageResponse<string>> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const content = await response.text();
    return { success: true, data: content };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function openSidePanel(
  windowId?: number
): Promise<MessageResponse> {
  try {
    // If no windowId provided (e.g., from popup), get the current window
    let targetWindowId = windowId;
    if (!targetWindowId) {
      const currentWindow = await chrome.windows.getCurrent();
      targetWindowId = currentWindow.id;
    }

    if (targetWindowId) {
      await chrome.sidePanel.open({ windowId: targetWindowId });
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function ensureOffscreenDocument(): Promise<void> {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)],
  });

  if (existingContexts.length > 0) {
    return;
  }

  if (creatingOffscreenDocument) {
    await creatingOffscreenDocument;
    return;
  }

  creatingOffscreenDocument = chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: [chrome.offscreen.Reason.BLOBS],
    justification: 'Create blob URLs for downloads and ZIP files',
  });

  await creatingOffscreenDocument;
  creatingOffscreenDocument = null;
}

chrome.contextMenus.onClicked.addListener(async (info, _tab) => {
  if (info.menuItemId === CONTEXT_MENU_IDS.DOWNLOAD_SVG && info.srcUrl) {
    try {
      const response = await fetchExternalSvg(info.srcUrl);
      if (response.success && response.data) {
        const item: SVGItem = {
          id: 'context-menu-download',
          content: response.data,
          source: 'img',
          sourceUrl: info.srcUrl,
          dimensions: { width: 0, height: 0 },
          fileSize: response.data.length,
        };
        await downloadSvg(item);
      }
    } catch (error) {
      console.error('Failed to download SVG:', error);
    }
  }
});
