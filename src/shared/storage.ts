import type { Settings, StorageSchema, SVGItem } from './types';
import { DEFAULT_SETTINGS } from './constants';

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...result.settings };
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await chrome.storage.local.set({
    settings: { ...current, ...settings },
  });
}

export async function getLastScanResults(): Promise<SVGItem[] | undefined> {
  const result = await chrome.storage.local.get('lastScanResults');
  return result.lastScanResults;
}

export async function getLastPageTitle(): Promise<string | undefined> {
  const result = await chrome.storage.local.get('lastPageTitle');
  return result.lastPageTitle;
}

export async function saveLastScanResults(items: SVGItem[], pageTitle?: string): Promise<void> {
  await chrome.storage.local.set({
    lastScanResults: items,
    lastPageTitle: pageTitle,
  });
}

export async function clearLastScanResults(): Promise<void> {
  await chrome.storage.local.remove('lastScanResults');
}

export async function getStorageData(): Promise<Partial<StorageSchema>> {
  return chrome.storage.local.get(null);
}
