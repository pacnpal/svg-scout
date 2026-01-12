import type { SVGItem } from '../../shared/types';
import { createSvgItem, isSvgDataUri, dataUriToSvg } from '../../shared/svg-utils';

export function detectJsonScriptSvgs(): SVGItem[] {
  const items: SVGItem[] = [];
  const seenContent = new Set<string>();

  // Find JSON script blocks
  const jsonScripts = document.querySelectorAll(
    'script[type="application/json"], script[type="application/ld+json"]'
  );

  for (const script of jsonScripts) {
    const text = script.textContent || '';
    if (!text.trim()) continue;

    try {
      const json = JSON.parse(text);
      const svgStrings = extractSvgStrings(json);

      for (const svgString of svgStrings) {
        if (seenContent.has(svgString)) continue;
        seenContent.add(svgString);

        // Check if it's a data URI
        if (isSvgDataUri(svgString)) {
          const content = dataUriToSvg(svgString);
          if (content) {
            const item = createSvgItem(content, 'json-script');
            if (item) {
              items.push(item);
            }
          }
        } else if (looksLikeSvg(svgString)) {
          // Direct SVG markup
          const item = createSvgItem(svgString, 'json-script');
          if (item) {
            items.push(item);
          }
        }
      }
    } catch {
      // Invalid JSON - skip
    }
  }

  return items;
}

function extractSvgStrings(obj: unknown, results: string[] = []): string[] {
  if (obj === null || obj === undefined) {
    return results;
  }

  if (typeof obj === 'string') {
    // Check if this string might be an SVG
    if (mightContainSvg(obj)) {
      results.push(obj);
    }
    return results;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      extractSvgStrings(item, results);
    }
    return results;
  }

  if (typeof obj === 'object') {
    for (const value of Object.values(obj)) {
      extractSvgStrings(value, results);
    }
  }

  return results;
}

function mightContainSvg(value: string): boolean {
  const trimmed = value.trim();

  // Check for SVG data URI
  if (trimmed.startsWith('data:image/svg+xml')) {
    return true;
  }

  // Check for SVG markup
  if (trimmed.startsWith('<svg') || trimmed.startsWith('<?xml')) {
    if (trimmed.includes('</svg>') || trimmed.includes('/>')) {
      return true;
    }
  }

  return false;
}

function looksLikeSvg(value: string): boolean {
  const trimmed = value.trim();

  if (!trimmed.startsWith('<svg') && !trimmed.startsWith('<?xml')) {
    return false;
  }

  if (!trimmed.includes('</svg>') && !trimmed.includes('/>')) {
    return false;
  }

  return true;
}
