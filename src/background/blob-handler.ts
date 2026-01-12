import { browser, isChrome, isFirefox } from '../shared/browser-api';
import type { SVGItem, PngScale } from '../shared/types';
import { OFFSCREEN_DOCUMENT_PATH } from '../shared/constants';
import { generateFileName } from '../shared/svg-utils';

interface MessageResponse {
  success: boolean;
  data?: string;
  error?: string;
}

// Only import for Firefox - Chrome uses offscreen document
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let JSZipModule: any = null;
let svgToPngModule: typeof import('../shared/svg-to-png') | null = null;

async function loadFirefoxModules() {
  if (isFirefox && !JSZipModule) {
    JSZipModule = await import('jszip');
    svgToPngModule = await import('../shared/svg-to-png');
  }
}

// Chrome-specific: offscreen document management
let creatingOffscreenDocument: Promise<void> | null = null;

async function ensureOffscreenDocument(): Promise<void> {
  if (!isChrome) return;

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

/**
 * Creates a blob URL from content
 * Chrome: uses offscreen document
 * Firefox: direct creation (background has DOM access)
 */
export async function createBlobUrl(content: string, mimeType: string): Promise<string> {
  if (isChrome) {
    await ensureOffscreenDocument();
    const response = await browser.runtime.sendMessage({
      target: 'offscreen',
      type: 'CREATE_BLOB_URL',
      content,
      mimeType,
    }) as MessageResponse;
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to create blob URL');
    }
    return response.data;
  } else {
    // Firefox: direct blob creation
    const blob = new Blob([content], { type: mimeType });
    return URL.createObjectURL(blob);
  }
}

/**
 * Converts SVG to PNG and returns a blob URL
 * Chrome: uses offscreen document
 * Firefox: direct conversion (background has DOM access via Canvas)
 */
export async function convertToPng(
  content: string,
  scale: PngScale,
  backgroundColor?: string
): Promise<string> {
  if (isChrome) {
    await ensureOffscreenDocument();
    const response = await browser.runtime.sendMessage({
      target: 'offscreen',
      type: 'CONVERT_TO_PNG',
      content,
      scale,
      backgroundColor,
    }) as MessageResponse;
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to convert to PNG');
    }
    return response.data;
  } else {
    // Firefox: direct conversion using Canvas API
    await loadFirefoxModules();
    if (!svgToPngModule) {
      throw new Error('Failed to load PNG conversion module');
    }
    const blob = await svgToPngModule.svgToPng(content, { scale, backgroundColor });
    return URL.createObjectURL(blob);
  }
}

/**
 * Creates a ZIP file with SVG (and optionally PNG) files
 * Chrome: uses offscreen document
 * Firefox: direct ZIP creation
 */
export async function createZip(
  items: SVGItem[],
  includePng?: boolean,
  pngScale?: PngScale
): Promise<string> {
  if (isChrome) {
    await ensureOffscreenDocument();
    const response = await browser.runtime.sendMessage({
      target: 'offscreen',
      type: 'CREATE_ZIP',
      items,
      includePng,
      pngScale,
    }) as MessageResponse;
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to create ZIP');
    }
    return response.data;
  } else {
    // Firefox: direct ZIP creation
    await loadFirefoxModules();
    if (!JSZipModule || !svgToPngModule) {
      throw new Error('Failed to load ZIP/PNG modules');
    }

    const JSZipConstructor = JSZipModule.default || JSZipModule;
    const zip = new JSZipConstructor();
    const svgFolder = zip.folder('svg');
    const pngFolder = includePng ? zip.folder('png') : null;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const baseName = generateFileName(item, i).replace('.svg', '');

      // Add SVG file
      svgFolder!.file(`${baseName}.svg`, item.content);

      // Add PNG if requested
      if (includePng && pngFolder && pngScale) {
        try {
          const pngBlob = await svgToPngModule.svgToPng(item.content, {
            scale: pngScale,
            backgroundColor: 'transparent',
          });
          pngFolder.file(`${baseName}-${pngScale}x.png`, pngBlob);
        } catch {
          // Skip failed PNG conversions
        }
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    return URL.createObjectURL(zipBlob);
  }
}
