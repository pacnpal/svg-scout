import type { PngScale } from './types';

export interface PngConversionOptions {
  scale: PngScale;
  backgroundColor?: string;
}

export async function svgToPng(
  svgContent: string,
  options: PngConversionOptions
): Promise<Blob> {
  const { scale, backgroundColor } = options;

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, 'image/svg+xml');
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

  width = width || 100;
  height = height || 100;

  const scaledWidth = width * scale;
  const scaledHeight = height * scale;

  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svg);
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
