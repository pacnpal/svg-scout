import type { SVGItem, SVGSource } from './types';

export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export function normalizeSvg(content: string): string {
  let svg = content.trim();

  if (!svg.includes('xmlns')) {
    svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  return svg;
}

export function isValidSvg(content: string): boolean {
  if (!content || typeof content !== 'string') return false;

  const trimmed = content.trim();
  if (!trimmed.startsWith('<svg') && !trimmed.startsWith('<?xml')) return false;
  if (!trimmed.includes('</svg>') && !trimmed.includes('/>')) return false;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'image/svg+xml');
    const errorNode = doc.querySelector('parsererror');
    return !errorNode;
  } catch {
    return false;
  }
}

export function getSvgDimensions(content: string): { width: number; height: number } {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'image/svg+xml');
    const svg = doc.documentElement;

    let width = parseFloat(svg.getAttribute('width') || '0');
    let height = parseFloat(svg.getAttribute('height') || '0');

    if ((!width || !height) && svg.hasAttribute('viewBox')) {
      const viewBox = svg.getAttribute('viewBox')!.split(/\s+|,/).map(Number);
      if (viewBox.length === 4) {
        width = width || viewBox[2];
        height = height || viewBox[3];
      }
    }

    return { width: width || 100, height: height || 100 };
  } catch {
    return { width: 100, height: 100 };
  }
}

export function createSvgItem(
  content: string,
  source: SVGSource,
  sourceUrl?: string
): SVGItem | null {
  const normalized = normalizeSvg(content);

  if (!isValidSvg(normalized)) {
    return null;
  }

  const dimensions = getSvgDimensions(normalized);
  const id = hashString(normalized);

  return {
    id,
    content: normalized,
    source,
    sourceUrl,
    dimensions,
    fileSize: new Blob([normalized]).size,
  };
}

export function deduplicateSvgItems(items: SVGItem[]): SVGItem[] {
  const seen = new Map<string, SVGItem>();

  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.set(item.id, item);
    }
  }

  return Array.from(seen.values());
}

export function generateFileName(item: SVGItem, index: number, pageTitle?: string): string {
  const prefix = pageTitle ? `${sanitizeForFileName(pageTitle)}-` : '';

  if (item.name) {
    const name = item.name.endsWith('.svg') ? item.name : `${item.name}.svg`;
    return prefix + name;
  }

  if (item.sourceUrl) {
    const url = new URL(item.sourceUrl, 'https://example.com');
    const pathParts = url.pathname.split('/');
    const fileName = pathParts[pathParts.length - 1];
    if (fileName && fileName.includes('.svg')) {
      return prefix + fileName;
    }
  }

  return `${prefix}svg-${index + 1}.svg`;
}

function sanitizeForFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')  // Remove invalid characters
    .replace(/\s+/g, '-')           // Replace spaces with hyphens
    .replace(/-+/g, '-')            // Collapse multiple hyphens
    .replace(/^-|-$/g, '')          // Remove leading/trailing hyphens
    .substring(0, 30)               // Limit length for prefix
    .toLowerCase();
}

export function svgToDataUri(content: string): string {
  const encoded = encodeURIComponent(content)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
  return `data:image/svg+xml,${encoded}`;
}

export function dataUriToSvg(dataUri: string): string | null {
  try {
    if (dataUri.startsWith('data:image/svg+xml;base64,')) {
      const base64 = dataUri.slice('data:image/svg+xml;base64,'.length);
      return atob(base64);
    }

    if (dataUri.startsWith('data:image/svg+xml,')) {
      const encoded = dataUri.slice('data:image/svg+xml,'.length);
      return decodeURIComponent(encoded);
    }

    if (dataUri.startsWith('data:image/svg+xml;charset=utf-8,')) {
      const encoded = dataUri.slice('data:image/svg+xml;charset=utf-8,'.length);
      return decodeURIComponent(encoded);
    }

    return null;
  } catch {
    return null;
  }
}

export function isSvgUrl(url: string): boolean {
  try {
    const parsed = new URL(url, 'https://example.com');
    const pathname = parsed.pathname.toLowerCase();
    return pathname.endsWith('.svg') || pathname.endsWith('.svgz');
  } catch {
    return false;
  }
}

export function isSvgDataUri(uri: string): boolean {
  return uri.startsWith('data:image/svg+xml');
}
