import type { SVGItem } from '../../shared/types';
import { createSvgItem, isSvgUrl, isSvgDataUri, dataUriToSvg } from '../../shared/svg-utils';
import { SVG_MIME_TYPES } from '../../shared/constants';

export async function detectFaviconSvgs(): Promise<SVGItem[]> {
  const items: SVGItem[] = [];

  // Find all link elements that might be SVG favicons
  const linkElements = document.querySelectorAll(
    'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
  );

  for (const link of linkElements) {
    const href = link.getAttribute('href') || '';
    const type = link.getAttribute('type') || '';

    // Check if it's explicitly an SVG or has SVG extension
    const isSvgType = SVG_MIME_TYPES.includes(type as typeof SVG_MIME_TYPES[number]);

    if (isSvgDataUri(href)) {
      const content = dataUriToSvg(href);
      if (content) {
        const item = createSvgItem(content, 'favicon', href);
        if (item) {
          items.push(item);
        }
      }
    } else if (isSvgType || isSvgUrl(href)) {
      try {
        const content = await fetchSvg(href);
        if (content) {
          const item = createSvgItem(content, 'favicon', href);
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
    const absoluteUrl = new URL(url, window.location.href).href;
    const response = await fetch(absoluteUrl);
    if (response.ok) {
      return await response.text();
    }
  } catch {
    try {
      const absoluteUrl = new URL(url, window.location.href).href;
      const response = await chrome.runtime.sendMessage({
        type: 'FETCH_EXTERNAL_SVG',
        url: absoluteUrl,
      });
      if (response.success && response.data) {
        return response.data;
      }
    } catch {
      // Skip
    }
  }
  return null;
}
