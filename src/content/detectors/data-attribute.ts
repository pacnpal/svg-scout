import type { SVGItem } from '../../shared/types';
import { createSvgItem, isSvgDataUri, dataUriToSvg } from '../../shared/svg-utils';

export function detectDataAttributeSvgs(): SVGItem[] {
  const items: SVGItem[] = [];
  const seenContent = new Set<string>();

  // Query all elements - we need to check their data attributes
  const allElements = document.querySelectorAll('*');

  for (const element of allElements) {
    const attributes = element.attributes;

    for (const attr of attributes) {
      // Only check data-* attributes
      if (!attr.name.startsWith('data-')) continue;

      const value = attr.value.trim();
      if (!value) continue;

      // Skip if we've already seen this exact content
      if (seenContent.has(value)) continue;

      // Check for inline SVG markup
      if (looksLikeSvg(value)) {
        seenContent.add(value);
        const item = createSvgItem(value, 'data-attribute', `${attr.name} attribute`);
        if (item) {
          items.push(item);
        }
        continue;
      }

      // Check for SVG data URI
      if (isSvgDataUri(value)) {
        seenContent.add(value);
        const svgContent = dataUriToSvg(value);
        if (svgContent) {
          const item = createSvgItem(svgContent, 'data-attribute', `${attr.name} attribute`);
          if (item) {
            items.push(item);
          }
        }
      }
    }
  }

  return items;
}

function looksLikeSvg(value: string): boolean {
  const trimmed = value.trim();

  // Must start with <svg or <?xml
  if (!trimmed.startsWith('<svg') && !trimmed.startsWith('<?xml')) {
    return false;
  }

  // Must contain closing tag or self-closing
  if (!trimmed.includes('</svg>') && !trimmed.includes('/>')) {
    return false;
  }

  return true;
}
