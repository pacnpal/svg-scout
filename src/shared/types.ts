export type SVGSource =
  | 'inline'
  | 'img'
  | 'css-background'
  | 'sprite'
  | 'favicon'
  | 'shadow-dom'
  | 'object-embed'
  | 'network'
  | 'template'
  | 'data-attribute'
  | 'noscript'
  | 'json-script';

export interface SVGItem {
  id: string;
  content: string;
  source: SVGSource;
  sourceUrl?: string;
  dimensions: {
    width: number;
    height: number;
  };
  fileSize: number;
  preview?: string;
  name?: string;
}

export type ThemeMode = 'system' | 'light' | 'dark';

export interface Settings {
  defaultPngScale: 1 | 2 | 4;
  pngBackgroundColor: string;
  autoScan: boolean;
  viewMode: 'grid' | 'list';
  theme: ThemeMode;
}

export interface StorageSchema {
  settings: Settings;
  lastScanResults?: SVGItem[];
  lastPageTitle?: string;
}

export interface ScanProgress {
  phase: string;
  found: number;
  total?: number;
}

export type PngScale = 1 | 2 | 4;
