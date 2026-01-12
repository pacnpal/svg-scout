import type { SVGItem } from '../../shared/types';
import { createSvgItem, isSvgUrl, isSvgDataUri, dataUriToSvg } from '../../shared/svg-utils';

export function detectTemplateSvgs(): SVGItem[] {
  const items: SVGItem[] = [];
  const templates = document.querySelectorAll('template');

  for (const template of templates) {
    const content = template.content;

    // Find inline SVGs in template
    const svgElements = content.querySelectorAll('svg');
    for (const svg of svgElements) {
      const serializer = new XMLSerializer();
      const svgContent = serializer.serializeToString(svg);
      const item = createSvgItem(svgContent, 'template');
      if (item) {
        items.push(item);
      }
    }

    // Find img elements with SVG sources
    const imgElements = content.querySelectorAll('img');
    for (const img of imgElements) {
      const src = img.getAttribute('src') || '';

      if (isSvgDataUri(src)) {
        const svgContent = dataUriToSvg(src);
        if (svgContent) {
          const item = createSvgItem(svgContent, 'template', src);
          if (item) {
            items.push(item);
          }
        }
      } else if (isSvgUrl(src)) {
        // Store URL reference - actual fetch would need async handling
        // For templates, we primarily catch inline SVGs and data URIs
      }
    }

    // Find use elements referencing SVG symbols
    const useElements = content.querySelectorAll('use[href], use[xlink\\:href]');
    for (const use of useElements) {
      const href = use.getAttribute('href') || use.getAttribute('xlink:href') || '';
      if (href.startsWith('#')) {
        // Internal reference - look for the symbol in the template
        const symbolId = href.slice(1);
        const symbol = content.getElementById(symbolId);
        if (symbol && symbol.tagName.toLowerCase() === 'symbol') {
          const svgContent = symbolToSvg(symbol as unknown as SVGSymbolElement);
          if (svgContent) {
            const item = createSvgItem(svgContent, 'template', href);
            if (item) {
              items.push(item);
            }
          }
        }
      }
    }
  }

  return items;
}

function symbolToSvg(symbol: SVGSymbolElement): string {
  const viewBox = symbol.getAttribute('viewBox') || '';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  if (viewBox) {
    svg.setAttribute('viewBox', viewBox);
    const parts = viewBox.split(/\s+|,/).map(Number);
    if (parts.length === 4) {
      if (parts[2]) svg.setAttribute('width', String(parts[2]));
      if (parts[3]) svg.setAttribute('height', String(parts[3]));
    }
  }

  for (const child of symbol.childNodes) {
    svg.appendChild(child.cloneNode(true));
  }

  for (const attr of symbol.attributes) {
    if (attr.name !== 'id' && !svg.hasAttribute(attr.name)) {
      svg.setAttribute(attr.name, attr.value);
    }
  }

  const serializer = new XMLSerializer();
  return serializer.serializeToString(svg);
}
