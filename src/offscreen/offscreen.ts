import JSZip from 'jszip';
import type { SVGItem, PngScale } from '../shared/types';
import { svgToPng } from '../shared/svg-to-png';
import { generateFileName } from '../shared/svg-utils';

interface OffscreenMessage {
  target: 'offscreen';
  type: string;
  content?: string;
  mimeType?: string;
  items?: SVGItem[];
  includePng?: boolean;
  pngScale?: PngScale;
  scale?: PngScale;
  backgroundColor?: string;
}

chrome.runtime.onMessage.addListener(
  (message: OffscreenMessage, _sender, sendResponse) => {
    if (message.target !== 'offscreen') return false;

    handleMessage(message).then(sendResponse);
    return true;
  }
);

async function handleMessage(message: OffscreenMessage) {
  switch (message.type) {
    case 'CREATE_BLOB_URL':
      return createBlobUrl(message.content!, message.mimeType!);

    case 'CONVERT_TO_PNG':
      return convertToPng(
        message.content!,
        message.scale!,
        message.backgroundColor
      );

    case 'CREATE_ZIP':
      return createZip(
        message.items!,
        message.includePng,
        message.pngScale
      );

    default:
      return { success: false, error: 'Unknown message type' };
  }
}

function createBlobUrl(content: string, mimeType: string) {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    return { success: true, data: url };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function convertToPng(
  content: string,
  scale: PngScale,
  backgroundColor?: string
) {
  try {
    const blob = await svgToPng(content, { scale, backgroundColor });
    const url = URL.createObjectURL(blob);
    return { success: true, data: url };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function createZip(
  items: SVGItem[],
  includePng?: boolean,
  pngScale?: PngScale
) {
  try {
    const zip = new JSZip();
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
          const pngBlob = await svgToPng(item.content, {
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
    const url = URL.createObjectURL(zipBlob);

    return { success: true, data: url };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
