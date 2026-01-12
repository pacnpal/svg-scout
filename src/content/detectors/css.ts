import { browser } from '../../shared/browser-api';
import type { SVGItem } from '../../shared/types';
import { createSvgItem, isSvgUrl, isSvgDataUri, dataUriToSvg } from '../../shared/svg-utils';
import { CSS_PROPERTIES_WITH_SVG } from '../../shared/constants';

export async function detectCssSvgs(): Promise<SVGItem[]> {
  const items: SVGItem[] = [];
  const seenUrls = new Set<string>();

  // Get all elements and check their computed styles
  const allElements = document.querySelectorAll('*');

  for (const element of allElements) {
    const computedStyle = window.getComputedStyle(element);
    const beforeStyle = window.getComputedStyle(element, '::before');
    const afterStyle = window.getComputedStyle(element, '::after');

    for (const prop of CSS_PROPERTIES_WITH_SVG) {
      // Check main element style
      const value = computedStyle.getPropertyValue(prop);
      await extractSvgsFromCssValue(value, items, seenUrls);

      // Check ::before pseudo-element
      const beforeValue = beforeStyle.getPropertyValue(prop);
      await extractSvgsFromCssValue(beforeValue, items, seenUrls);

      // Check ::after pseudo-element
      const afterValue = afterStyle.getPropertyValue(prop);
      await extractSvgsFromCssValue(afterValue, items, seenUrls);
    }
  }

  return items;
}

async function extractSvgsFromCssValue(
  value: string,
  items: SVGItem[],
  seenUrls: Set<string>
): Promise<void> {
  if (!value || value === 'none') return;

  // Extract all url() references
  // Handle double-quoted, single-quoted, and unquoted URLs separately
  const urlMatches = value.matchAll(/url\((?:"([^"]+)"|'([^']+)'|([^)]+))\)/g);

  for (const match of urlMatches) {
    // URL is in group 1 (double-quoted), group 2 (single-quoted), or group 3 (unquoted)
    const url = match[1] || match[2] || match[3];
    if (!url) continue;

    if (seenUrls.has(url)) continue;
    seenUrls.add(url);

    if (isSvgDataUri(url)) {
      const content = dataUriToSvg(url);
      if (content) {
        const item = createSvgItem(content, 'css-background', url);
        if (item) {
          items.push(item);
        }
      }
    } else if (isSvgUrl(url)) {
      try {
        const content = await fetchSvg(url);
        if (content) {
          const item = createSvgItem(content, 'css-background', url);
          if (item) {
            items.push(item);
          }
        }
      } catch {
        // Skip failed fetches
      }
    }
  }
}

async function fetchSvg(url: string): Promise<string | null> {
  try {
    // Resolve relative URLs
    const absoluteUrl = new URL(url, window.location.href).href;

    const response = await fetch(absoluteUrl);
    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('svg') || absoluteUrl.endsWith('.svg')) {
        return await response.text();
      }
    }
  } catch {
    try {
      const absoluteUrl = new URL(url, window.location.href).href;
      const response = await browser.runtime.sendMessage({
        type: 'FETCH_EXTERNAL_SVG',
        url: absoluteUrl,
      }) as { success: boolean; data?: string };
      if (response.success && response.data) {
        return response.data;
      }
    } catch {
      // Skip this URL
    }
  }
  return null;
}
