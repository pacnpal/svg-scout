import type { PngScale } from './types';

export interface PngConversionOptions {
  scale: PngScale;
  backgroundColor?: string;
}

interface NormalizedSvg {
  svgElement: SVGSVGElement;
  width: number;
  height: number;
}

function extractTransformScale(style: string): { scaleX: number; scaleY: number } {
  // Check for matrix transform: matrix(a, b, c, d, e, f) where a=scaleX, d=scaleY
  const matrixMatch = style.match(/transform:\s*matrix\(\s*([^,]+),\s*[^,]+,\s*[^,]+,\s*([^,]+)/);
  if (matrixMatch) {
    const scaleX = parseFloat(matrixMatch[1]) || 1;
    const scaleY = parseFloat(matrixMatch[2]) || 1;
    return { scaleX, scaleY };
  }

  // Check for scale transform: scale(x) or scale(x, y)
  const scaleMatch = style.match(/transform:\s*scale\(\s*([^,)]+)(?:,\s*([^)]+))?\)/);
  if (scaleMatch) {
    const scaleX = parseFloat(scaleMatch[1]) || 1;
    const scaleY = scaleMatch[2] ? parseFloat(scaleMatch[2]) : scaleX;
    return { scaleX, scaleY };
  }

  return { scaleX: 1, scaleY: 1 };
}

function removeTransformFromStyle(style: string): string {
  // Remove transform property from inline style
  return style
    .replace(/transform:\s*[^;]+;?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSvgForRender(svgContent: string): NormalizedSvg {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, 'image/svg+xml');
  const svg = doc.documentElement as unknown as SVGSVGElement;

  // Extract transform scale from inline style
  const style = svg.getAttribute('style') || '';
  const { scaleX, scaleY } = extractTransformScale(style);

  // Remove transform from style to prevent double-scaling
  if (scaleX !== 1 || scaleY !== 1) {
    const cleanStyle = removeTransformFromStyle(style);
    if (cleanStyle) {
      svg.setAttribute('style', cleanStyle);
    } else {
      svg.removeAttribute('style');
    }
  }

  // Get base dimensions from attributes
  let width = parseFloat(svg.getAttribute('width') || '0');
  let height = parseFloat(svg.getAttribute('height') || '0');

  // Handle viewBox
  let viewBoxX = 0;
  let viewBoxY = 0;
  let viewBoxWidth = 0;
  let viewBoxHeight = 0;

  if (svg.hasAttribute('viewBox')) {
    const viewBox = svg.getAttribute('viewBox')!.split(/\s+|,/).map(Number);
    if (viewBox.length === 4) {
      viewBoxX = viewBox[0];
      viewBoxY = viewBox[1];
      viewBoxWidth = viewBox[2];
      viewBoxHeight = viewBox[3];

      // Use viewBox dimensions if width/height not set
      width = width || viewBoxWidth;
      height = height || viewBoxHeight;
    }
  }

  // Default dimensions if nothing specified
  width = width || 100;
  height = height || 100;

  // Apply transform scale to dimensions
  const finalWidth = width * scaleX;
  const finalHeight = height * scaleY;

  // Handle viewBox offset by normalizing to 0,0 origin
  if (viewBoxX !== 0 || viewBoxY !== 0) {
    // Adjust viewBox to start at 0,0
    svg.setAttribute('viewBox', `0 0 ${viewBoxWidth} ${viewBoxHeight}`);

    // Wrap all children in a group with translate to compensate
    const wrapper = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
    wrapper.setAttribute('transform', `translate(${-viewBoxX}, ${-viewBoxY})`);

    while (svg.firstChild) {
      wrapper.appendChild(svg.firstChild);
    }
    svg.appendChild(wrapper);
  }

  // Set final dimensions on SVG element
  svg.setAttribute('width', String(finalWidth));
  svg.setAttribute('height', String(finalHeight));

  // Ensure viewBox matches content dimensions for proper scaling
  if (!svg.hasAttribute('viewBox') || (viewBoxX === 0 && viewBoxY === 0)) {
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }

  return {
    svgElement: svg,
    width: finalWidth,
    height: finalHeight,
  };
}

export async function svgToPng(
  svgContent: string,
  options: PngConversionOptions
): Promise<Blob> {
  const { scale, backgroundColor } = options;

  // Normalize SVG to handle transforms and viewBox offsets
  const { svgElement, width, height } = normalizeSvgForRender(svgContent);

  // Calculate final canvas size (normalized dimensions * user scale)
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;

  // Update SVG dimensions to match canvas for crisp rendering
  svgElement.setAttribute('width', String(scaledWidth));
  svgElement.setAttribute('height', String(scaledHeight));

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgElement);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;

      const ctx = canvas.getContext('2d')!;

      if (backgroundColor && backgroundColor !== 'transparent') {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, scaledWidth, scaledHeight);
      }

      ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

      URL.revokeObjectURL(svgUrl);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create PNG blob'));
          }
        },
        'image/png',
        1.0
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      reject(new Error('Failed to load SVG image'));
    };

    img.src = svgUrl;
  });
}

export async function svgToPngDataUrl(
  svgContent: string,
  options: PngConversionOptions
): Promise<string> {
  const blob = await svgToPng(svgContent, options);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
