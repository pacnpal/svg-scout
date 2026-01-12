import { browser } from './browser-api';
import type { Settings, StorageSchema, SVGItem } from './types';
import { DEFAULT_SETTINGS } from './constants';

export async function getSettings(): Promise<Settings> {
  const result = await browser.storage.local.get('settings') as { settings?: Partial<Settings> };
  return { ...DEFAULT_SETTINGS, ...result.settings };
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await browser.storage.local.set({
    settings: { ...current, ...settings },
  });
}

export async function getLastScanResults(): Promise<SVGItem[] | undefined> {
  const result = await browser.storage.local.get('lastScanResults');
  return result.lastScanResults as SVGItem[] | undefined;
}

export async function getLastPageTitle(): Promise<string | undefined> {
  const result = await browser.storage.local.get('lastPageTitle');
  return result.lastPageTitle as string | undefined;
}

export async function saveLastScanResults(items: SVGItem[], pageTitle?: string): Promise<void> {
  await browser.storage.local.set({
    lastScanResults: items,
    lastPageTitle: pageTitle,
  });
}

export async function clearLastScanResults(): Promise<void> {
  await browser.storage.local.remove('lastScanResults');
}

export async function getStorageData(): Promise<Partial<StorageSchema>> {
  return browser.storage.local.get(null) as Promise<Partial<StorageSchema>>;
}
