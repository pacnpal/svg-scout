import type { Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  defaultPngScale: 2,
  pngBackgroundColor: 'transparent',
  autoScan: false,
  viewMode: 'grid',
  theme: 'system',
};

export const CSS_PROPERTIES_WITH_SVG = [
  'background-image',
  'background',
  'mask-image',
  'mask',
  '-webkit-mask-image',
  '-webkit-mask',
  'content',
  'list-style-image',
  'border-image-source',
  'cursor',
] as const;

export const SVG_MIME_TYPES = [
  'image/svg+xml',
  'image/svg',
] as const;

export const SVG_FILE_EXTENSIONS = [
  '.svg',
  '.svgz',
] as const;

export const OFFSCREEN_DOCUMENT_PATH = 'src/offscreen/offscreen.html';

export const CONTEXT_MENU_IDS = {
  DOWNLOAD_SVG: 'svg-scout-download',
  COPY_SVG: 'svg-scout-copy',
} as const;

export const PNG_SCALES = [1, 2, 4] as const;

export const MAX_PREVIEW_SIZE = 200;
