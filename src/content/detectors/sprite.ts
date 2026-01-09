import type { SVGItem } from '../../shared/types';
import { createSvgItem } from '../../shared/svg-utils';

export async function detectSpriteSvgs(): Promise<SVGItem[]> {
  const items: SVGItem[] = [];

  // Find all <use> elements with href references
  const useElements = document.querySelectorAll('use[href], use[xlink\\:href]');

  for (const use of useElements) {
    const href = use.getAttribute('href') || use.getAttribute('xlink:href') || '';

    if (!href) continue;

    try {
      const resolvedSvg = await resolveUseElement(use as SVGUseElement, href);
      if (resolvedSvg) {
        const item = createSvgItem(resolvedSvg, 'sprite', href);
        if (item) {
          items.push(item);
        }
      }
    } catch {
      // Skip failed resolutions
    }
  }

  // Also extract standalone symbols from hidden sprite sheets
  const hiddenSprites = document.querySelectorAll('svg[aria-hidden="true"] symbol, svg[style*="display: none"] symbol, svg[style*="display:none"] symbol');

  for (const symbol of hiddenSprites) {
    const svgContent = symbolToSvg(symbol as SVGSymbolElement);
    if (svgContent) {
      const id = symbol.id || '';
      const item = createSvgItem(svgContent, 'sprite', `#${id}`);
      if (item) {
        items.push(item);
      }
    }
  }

  return items;
}

async function resolveUseElement(
  _use: SVGUseElement,
  href: string
): Promise<string | null> {
  // Check if it's an external reference
  if (href.includes('.svg') && !href.startsWith('#')) {
    const [url, fragmentId] = href.split('#');

    const svgContent = await fetchExternalSprite(url);
    if (!svgContent) return null;

    if (fragmentId) {
      return extractSymbolFromSvg(svgContent, fragmentId);
    }
    return svgContent;
  }

  // Internal reference (starts with #)
  const id = href.startsWith('#') ? href.slice(1) : href;
  const referencedElement = document.getElementById(id);

  if (!referencedElement) return null;

  if (referencedElement.tagName.toLowerCase() === 'symbol') {
    return symbolToSvg(referencedElement as unknown as SVGSymbolElement);
  }

  if (referencedElement.tagName.toLowerCase() === 'svg') {
    const serializer = new XMLSerializer();
    return serializer.serializeToString(referencedElement);
  }

  return null;
}

function symbolToSvg(symbol: SVGSymbolElement): string {
  const viewBox = symbol.getAttribute('viewBox') || '';

  // Create a new SVG element with the symbol's contents
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  if (viewBox) {
    svg.setAttribute('viewBox', viewBox);
    const [, , width, height] = viewBox.split(/\s+|,/).map(Number);
    if (width) svg.setAttribute('width', String(width));
    if (height) svg.setAttribute('height', String(height));
  }

  // Copy all child nodes
  for (const child of symbol.childNodes) {
    svg.appendChild(child.cloneNode(true));
  }

  // Copy relevant attributes
  for (const attr of symbol.attributes) {
    if (attr.name !== 'id' && !svg.hasAttribute(attr.name)) {
      svg.setAttribute(attr.name, attr.value);
    }
  }

  const serializer = new XMLSerializer();
  return serializer.serializeToString(svg);
}

function extractSymbolFromSvg(svgContent: string, symbolId: string): string | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, 'image/svg+xml');
  const symbol = doc.getElementById(symbolId);

  if (symbol && symbol.tagName.toLowerCase() === 'symbol') {
    return symbolToSvg(symbol as unknown as SVGSymbolElement);
  }

  return null;
}

async function fetchExternalSprite(url: string): Promise<string | null> {
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
