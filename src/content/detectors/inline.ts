import type { SVGItem } from '../../shared/types';
import { createSvgItem } from '../../shared/svg-utils';

export function detectInlineSvgs(): SVGItem[] {
  const items: SVGItem[] = [];
  const svgElements = document.querySelectorAll('svg');

  for (const svg of svgElements) {
    if (isHiddenSpriteContainer(svg)) {
      continue;
    }

    const content = serializeSvg(svg);
    const item = createSvgItem(content, 'inline');

    if (item) {
      items.push(item);
    }
  }

  return items;
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
