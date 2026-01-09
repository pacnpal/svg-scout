import type { SVGItem, ScanProgress } from '../shared/types';
import { deduplicateSvgItems } from '../shared/svg-utils';
import { detectInlineSvgs } from './detectors/inline';
import { detectImgSvgs } from './detectors/img';
import { detectObjectEmbedSvgs } from './detectors/object-embed';
import { detectCssSvgs } from './detectors/css';
import { detectSpriteSvgs } from './detectors/sprite';
import { detectShadowDomSvgs } from './detectors/shadow-dom';
import { detectFaviconSvgs } from './detectors/favicon';

type ProgressCallback = (progress: ScanProgress) => void;

interface Detector {
  name: string;
  detect: () => Promise<SVGItem[]> | SVGItem[];
}

const detectors: Detector[] = [
  { name: 'Inline SVGs', detect: detectInlineSvgs },
  { name: 'Image SVGs', detect: detectImgSvgs },
  { name: 'Object/Embed SVGs', detect: detectObjectEmbedSvgs },
  { name: 'CSS Background SVGs', detect: detectCssSvgs },
  { name: 'Sprite SVGs', detect: detectSpriteSvgs },
  { name: 'Shadow DOM SVGs', detect: detectShadowDomSvgs },
  { name: 'Favicon SVGs', detect: detectFaviconSvgs },
];

export async function scanPage(onProgress?: ProgressCallback): Promise<SVGItem[]> {
  const allItems: SVGItem[] = [];

  for (let i = 0; i < detectors.length; i++) {
    const detector = detectors[i];

    onProgress?.({
      phase: detector.name,
      found: allItems.length,
      total: detectors.length,
    });

    try {
      const items = await detector.detect();
      allItems.push(...items);
    } catch (error) {
      console.warn(`SVG Scout: ${detector.name} failed:`, error);
    }
  }

  const deduplicated = deduplicateSvgItems(allItems);

  onProgress?.({
    phase: 'Complete',
    found: deduplicated.length,
  });

  return deduplicated;
}
