import type { SVGItem, ScanProgress, PngScale } from './types';

export type MessageType =
  | 'SCAN_PAGE'
  | 'SCAN_RESULT'
  | 'SCAN_PROGRESS'
  | 'DOWNLOAD_SVG'
  | 'DOWNLOAD_PNG'
  | 'DOWNLOAD_ZIP'
  | 'COPY_SVG'
  | 'FETCH_EXTERNAL_SVG'
  | 'CREATE_BLOB_URL'
  | 'OPEN_SIDE_PANEL';

export interface ScanPageMessage {
  type: 'SCAN_PAGE';
}

export interface ScanResultMessage {
  type: 'SCAN_RESULT';
  items: SVGItem[];
  pageTitle?: string;
}

export interface ScanProgressMessage {
  type: 'SCAN_PROGRESS';
  progress: ScanProgress;
}

export interface DownloadSvgMessage {
  type: 'DOWNLOAD_SVG';
  item: SVGItem;
  pageTitle?: string;
}

export interface DownloadPngMessage {
  type: 'DOWNLOAD_PNG';
  item: SVGItem;
  scale: PngScale;
  backgroundColor?: string;
  pageTitle?: string;
}

export interface DownloadZipMessage {
  type: 'DOWNLOAD_ZIP';
  items: SVGItem[];
  includePng?: boolean;
  pngScale?: PngScale;
  pageTitle?: string;
}

export interface CopySvgMessage {
  type: 'COPY_SVG';
  content: string;
}

export interface FetchExternalSvgMessage {
  type: 'FETCH_EXTERNAL_SVG';
  url: string;
}

export interface CreateBlobUrlMessage {
  type: 'CREATE_BLOB_URL';
  content: string;
  mimeType: string;
}

export interface OpenSidePanelMessage {
  type: 'OPEN_SIDE_PANEL';
  windowId?: number;
}

export type Message =
  | ScanPageMessage
  | ScanResultMessage
  | ScanProgressMessage
  | DownloadSvgMessage
  | DownloadPngMessage
  | DownloadZipMessage
  | CopySvgMessage
  | FetchExternalSvgMessage
  | CreateBlobUrlMessage
  | OpenSidePanelMessage;

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  pageTitle?: string;
}

export function sendMessage<T = unknown>(message: Message): Promise<MessageResponse<T>> {
  return chrome.runtime.sendMessage(message);
}

export function sendTabMessage<T = unknown>(tabId: number, message: Message): Promise<MessageResponse<T>> {
  return chrome.tabs.sendMessage(tabId, message);
}
