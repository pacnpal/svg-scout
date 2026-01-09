import type { SVGItem } from '../../shared/types';
import { createSvgItem, isSvgUrl, isSvgDataUri, dataUriToSvg } from '../../shared/svg-utils';

export async function detectImgSvgs(): Promise<SVGItem[]> {
  const items: SVGItem[] = [];
  const imgElements = document.querySelectorAll('img');

  for (const img of imgElements) {
    const src = img.src || img.getAttribute('src') || '';

    if (isSvgDataUri(src)) {
      const content = dataUriToSvg(src);
      if (content) {
        const item = createSvgItem(content, 'img', src);
        if (item) {
          items.push(item);
        }
      }
    } else if (isSvgUrl(src)) {
      try {
        const content = await fetchSvg(src);
        if (content) {
          const item = createSvgItem(content, 'img', src);
          if (item) {
            items.push(item);
          }
        }
      } catch {
        // Skip failed fetches
      }
    }

    // Check srcset for SVGs
    const srcset = img.srcset || img.getAttribute('srcset') || '';
    if (srcset) {
      const srcsetUrls = parseSrcset(srcset);
      for (const url of srcsetUrls) {
        if (isSvgUrl(url)) {
          try {
            const content = await fetchSvg(url);
            if (content) {
              const item = createSvgItem(content, 'img', url);
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
  }

  return items;
}

async function fetchSvg(url: string): Promise<string | null> {
  try {
    // Try direct fetch first (same-origin)
    const response = await fetch(url);
    if (response.ok) {
      return await response.text();
    }
  } catch {
    // If direct fetch fails, try via background script
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

function parseSrcset(srcset: string): string[] {
  return srcset
    .split(',')
    .map((entry) => entry.trim().split(/\s+/)[0])
    .filter(Boolean);
}
