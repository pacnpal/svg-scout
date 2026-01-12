import type { SVGItem } from '../../shared/types';
import { createSvgItem, isSvgUrl, isSvgDataUri, dataUriToSvg } from '../../shared/svg-utils';

export async function detectNoscriptSvgs(): Promise<SVGItem[]> {
  const items: SVGItem[] = [];
  const noscriptElements = document.querySelectorAll('noscript');

  for (const noscript of noscriptElements) {
    const html = noscript.innerHTML || noscript.textContent || '';
    if (!html.trim()) continue;

    // Parse the noscript content as HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<body>${html}</body>`, 'text/html');

    // Find inline SVGs
    const svgElements = doc.querySelectorAll('svg');
    for (const svg of svgElements) {
      const serializer = new XMLSerializer();
      const svgContent = serializer.serializeToString(svg);
      const item = createSvgItem(svgContent, 'noscript');
      if (item) {
        items.push(item);
      }
    }

    // Find img elements with SVG sources
    const imgElements = doc.querySelectorAll('img');
    for (const img of imgElements) {
      const src = img.getAttribute('src') || '';

      if (isSvgDataUri(src)) {
        const svgContent = dataUriToSvg(src);
        if (svgContent) {
          const item = createSvgItem(svgContent, 'noscript', src);
          if (item) {
            items.push(item);
          }
        }
      } else if (isSvgUrl(src)) {
        try {
          const svgContent = await fetchSvg(src);
          if (svgContent) {
            const item = createSvgItem(svgContent, 'noscript', src);
            if (item) {
              items.push(item);
            }
          }
        } catch {
          // Skip failed fetches
        }
      }
    }

    // Find object/embed elements with SVG
    const objectElements = doc.querySelectorAll('object[data$=".svg"], embed[src$=".svg"]');
    for (const obj of objectElements) {
      const src = obj.getAttribute('data') || obj.getAttribute('src') || '';
      if (isSvgUrl(src)) {
        try {
          const svgContent = await fetchSvg(src);
          if (svgContent) {
            const item = createSvgItem(svgContent, 'noscript', src);
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

  return items;
}

async function fetchSvg(url: string): Promise<string | null> {
  try {
    const absoluteUrl = new URL(url, window.location.href).href;
    const response = await fetch(absoluteUrl);
    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('svg') || absoluteUrl.endsWith('.svg')) {
        return await response.text();
      }
    }
  } catch {
    // Try via background script for CORS
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
