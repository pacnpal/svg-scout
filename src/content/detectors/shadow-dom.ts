import type { SVGItem } from '../../shared/types';
import { createSvgItem } from '../../shared/svg-utils';

export function detectShadowDomSvgs(): SVGItem[] {
  const items: SVGItem[] = [];

  traverseShadowDom(document.body, items);

  return items;
}

function traverseShadowDom(root: Element | ShadowRoot, items: SVGItem[]): void {
  const elements = root.querySelectorAll('*');

  for (const element of elements) {
    // Check for open shadow root
    if (element.shadowRoot) {
      extractSvgsFromRoot(element.shadowRoot, items);
      traverseShadowDom(element.shadowRoot, items);
    }

    // Try to access closed shadow root (Chrome-specific, may not always work)
    try {
      const internals = (element as Element & { __shadowRoot?: ShadowRoot }).__shadowRoot;
      if (internals) {
        extractSvgsFromRoot(internals, items);
        traverseShadowDom(internals, items);
      }
    } catch {
      // Closed shadow roots are typically inaccessible
    }

    // Also try the Chrome DevTools protocol approach for closed shadow roots
    // This uses internals that Chrome exposes
    try {
      const closedRoot = (element as HTMLElement & {
        openOrClosedShadowRoot?: ShadowRoot
      }).openOrClosedShadowRoot;
      if (closedRoot && closedRoot !== element.shadowRoot) {
        extractSvgsFromRoot(closedRoot, items);
        traverseShadowDom(closedRoot, items);
      }
    } catch {
      // Not available in all contexts
    }
  }
}

function extractSvgsFromRoot(root: ShadowRoot, items: SVGItem[]): void {
  const svgElements = root.querySelectorAll('svg');

  for (const svg of svgElements) {
    // Skip sprite containers
    if (isHiddenSpriteContainer(svg)) {
      continue;
    }

    const content = serializeSvg(svg);
    const item = createSvgItem(content, 'shadow-dom');

    if (item) {
      items.push(item);
    }
  }
}

function isHiddenSpriteContainer(svg: SVGElement): boolean {
  if (svg.querySelector('symbol')) {
    const style = window.getComputedStyle(svg);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      (style.width === '0px' && style.height === '0px') ||
      svg.getAttribute('aria-hidden') === 'true'
    ) {
      return true;
    }
  }
  return false;
}

function serializeSvg(svg: SVGElement): string {
  const clone = svg.cloneNode(true) as SVGElement;
  inlineComputedStyles(svg, clone);
  const serializer = new XMLSerializer();
  return serializer.serializeToString(clone);
}

function inlineComputedStyles(original: Element, clone: Element): void {
  const computedStyle = window.getComputedStyle(original);

  const stylesToInline = [
    'fill',
    'stroke',
    'stroke-width',
    'stroke-linecap',
    'stroke-linejoin',
    'stroke-dasharray',
    'stroke-dashoffset',
    'opacity',
    'fill-opacity',
    'stroke-opacity',
    'transform',
    'font-family',
    'font-size',
    'font-weight',
    'text-anchor',
  ];

  for (const prop of stylesToInline) {
    const value = computedStyle.getPropertyValue(prop);
    if (value && value !== 'none' && value !== 'normal') {
      (clone as SVGElement).style.setProperty(prop, value);
    }
  }

  const originalChildren = original.children;
  const cloneChildren = clone.children;

  for (let i = 0; i < originalChildren.length; i++) {
    if (cloneChildren[i]) {
      inlineComputedStyles(originalChildren[i], cloneChildren[i]);
    }
  }
}
