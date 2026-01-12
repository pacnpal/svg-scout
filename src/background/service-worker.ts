import { browser, setSidePanelBehavior, openSidePanel } from '../shared/browser-api';
import type { Message, MessageResponse } from '../shared/messages';
import type { SVGItem, PngScale } from '../shared/types';
import { CONTEXT_MENU_IDS } from '../shared/constants';
import { saveLastScanResults } from '../shared/storage';
import { generateFileName } from '../shared/svg-utils';
import { createBlobUrl, convertToPng, createZip } from './blob-handler';

browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: CONTEXT_MENU_IDS.DOWNLOAD_SVG,
    title: 'Download SVG',
    contexts: ['image'],
    targetUrlPatterns: ['*://*/*.svg', '*://*/*.svg?*'],
  });

  // Set side panel behavior (Chrome-only, no-op on Firefox)
  setSidePanelBehavior();
});

browser.runtime.onMessage.addListener(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (message: any, sender: any) => {
    // Ignore messages targeted at the offscreen document
    if (message.target === 'offscreen') return;
    // Return a promise for async handling
    return handleMessage(message as Message, sender);
  }
);

async function handleMessage(
  message: Message,
  sender: browser.Runtime.MessageSender | chrome.runtime.MessageSender
): Promise<MessageResponse> {
  switch (message.type) {
    case 'SCAN_RESULT':
      await saveLastScanResults(message.items, message.pageTitle);
      return { success: true };

    case 'DOWNLOAD_SVG':
      return downloadSvg(message.item, message.pageTitle);

    case 'DOWNLOAD_PNG':
      return downloadPng(message.item, message.scale, message.backgroundColor, message.pageTitle, message.returnDataUrl);

    case 'DOWNLOAD_ZIP':
      return downloadZip(message.items, message.includePng, message.pngScale, message.pageTitle, message.returnDataUrl);

    case 'FETCH_EXTERNAL_SVG':
      return fetchExternalSvg(message.url);

    case 'OPEN_SIDE_PANEL':
      return handleOpenSidePanel(message.windowId ?? sender.tab?.windowId);

    case 'COPY_SVG':
      return { success: true };

    default:
      return { success: false, error: 'Unknown message type' };
  }
}

async function downloadSvg(item: SVGItem, pageTitle?: string): Promise<MessageResponse> {
  try {
    const blobUrl = await createBlobUrl(item.content, 'image/svg+xml');
    const fileName = generateFileName(item, 0, pageTitle);

    await browser.downloads.download({
      url: blobUrl,
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
  pageTitle?: string,
  returnDataUrl?: boolean
): Promise<MessageResponse> {
  try {
    const dataUrl = await convertToPng(item.content, scale, backgroundColor);
    const baseName = generateFileName(item, 0, pageTitle).replace('.svg', '');
    const fileName = `${baseName}-${scale}x.png`;

    // Safari: return data URL for popup to handle download
    if (returnDataUrl) {
      return { success: true, dataUrl, filename: fileName };
    }

    // Chrome/Firefox: use downloads API
    await browser.downloads.download({
      url: dataUrl,
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
  pageTitle?: string,
  returnDataUrl?: boolean
): Promise<MessageResponse> {
  try {
    const dataUrl = await createZip(items, includePng, pngScale);
    const zipName = pageTitle ? `${sanitizeFileName(pageTitle)}-svgs.zip` : 'svg-export.zip';

    // Safari: return data URL for popup to handle download
    if (returnDataUrl) {
      return { success: true, dataUrl, filename: zipName };
    }

    // Chrome/Firefox: use downloads API
    await browser.downloads.download({
      url: dataUrl,
      filename: zipName,
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50)
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

async function handleOpenSidePanel(windowId?: number): Promise<MessageResponse> {
  try {
    await openSidePanel(windowId);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

browser.contextMenus.onClicked.addListener(async (info) => {
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
