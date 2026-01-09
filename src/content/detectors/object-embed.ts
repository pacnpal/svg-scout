import type { SVGItem } from '../../shared/types';
import { createSvgItem, isSvgUrl } from '../../shared/svg-utils';
import { SVG_MIME_TYPES } from '../../shared/constants';

export async function detectObjectEmbedSvgs(): Promise<SVGItem[]> {
  const items: SVGItem[] = [];

  // Detect <object> elements
  const objectElements = document.querySelectorAll('object');
  for (const obj of objectElements) {
    const type = obj.type || obj.getAttribute('type') || '';
    const data = obj.data || obj.getAttribute('data') || '';

    if (SVG_MIME_TYPES.includes(type as typeof SVG_MIME_TYPES[number]) || isSvgUrl(data)) {
      try {
        const content = await fetchSvg(data);
        if (content) {
          const item = createSvgItem(content, 'object-embed', data);
          if (item) {
            items.push(item);
          }
        }
      } catch {
        // Skip failed fetches
      }
    }
  }

  // Detect <embed> elements
  const embedElements = document.querySelectorAll('embed');
  for (const embed of embedElements) {
    const type = embed.type || embed.getAttribute('type') || '';
    const src = embed.src || embed.getAttribute('src') || '';

    if (SVG_MIME_TYPES.includes(type as typeof SVG_MIME_TYPES[number]) || isSvgUrl(src)) {
      try {
        const content = await fetchSvg(src);
        if (content) {
          const item = createSvgItem(content, 'object-embed', src);
          if (item) {
            items.push(item);
          }
        }
      } catch {
        // Skip failed fetches
      }
    }
  }

  return items;
}

async function fetchSvg(url: string): Promise<string | null> {
  if (!url) return null;

  try {
    const response = await fetch(url);
    if (response.ok) {
      return await response.text();
    }
  } catch {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FETCH_EXTERNAL_SVG',
        url,
      });
      if (response.success && response.data) {
        return response.data;
      }
    } catch {
      // Skip this URL
    }
  }
  return null;
}
