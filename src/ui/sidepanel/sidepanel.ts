import { browser } from '../../shared/browser-api';
import type { SVGItem, SVGSource, PngScale, ThemeMode } from '../../shared/types';
import type { Message, ScanProgressMessage, ScanResultMessage } from '../../shared/messages';
import { getLastScanResults, getLastPageTitle, getSettings, saveSettings } from '../../shared/storage';
import { generateFileName } from '../../shared/svg-utils';

let currentTheme: ThemeMode = 'system';

// Elements
const scanBtn = document.getElementById('scanBtn') as HTMLButtonElement;
const filterSelect = document.getElementById('filterSelect') as HTMLSelectElement;
const sortSelect = document.getElementById('sortSelect') as HTMLSelectElement;
const gridViewBtn = document.getElementById('gridViewBtn') as HTMLButtonElement;
const listViewBtn = document.getElementById('listViewBtn') as HTMLButtonElement;
const statusBar = document.getElementById('statusBar') as HTMLDivElement;
const statusText = document.getElementById('statusText') as HTMLSpanElement;
const emptyState = document.getElementById('emptyState') as HTMLDivElement;
const svgGrid = document.getElementById('svgGrid') as HTMLDivElement;
const selectAllCheckbox = document.getElementById('selectAllCheckbox') as HTMLInputElement;
const selectedCount = document.getElementById('selectedCount') as HTMLSpanElement;
const formatSelect = document.getElementById('formatSelect') as HTMLSelectElement;
const downloadSelectedBtn = document.getElementById('downloadSelectedBtn') as HTMLButtonElement;
const downloadAllBtn = document.getElementById('downloadAllBtn') as HTMLButtonElement;
const themeToggle = document.getElementById('themeToggle') as HTMLButtonElement;

// State
let allItems: SVGItem[] = [];
let filteredItems: SVGItem[] = [];
let selectedIds = new Set<string>();
let viewMode: 'grid' | 'list' = 'grid';
let currentPageTitle: string | undefined;

interface FormatOption {
  type: 'svg' | 'png';
  scale?: PngScale;
}

function getSelectedFormat(): FormatOption {
  const value = formatSelect.value;
  if (value === 'svg') {
    return { type: 'svg' };
  }
  const scale = parseInt(value.replace('png-', '').replace('x', '')) as PngScale;
  return { type: 'png', scale };
}

async function init(): Promise<void> {
  const settings = await getSettings();
  viewMode = settings.viewMode;
  currentTheme = settings.theme;
  applyTheme(currentTheme);
  updateViewModeButtons();

  const lastResults = await getLastScanResults();
  currentPageTitle = await getLastPageTitle();
  if (lastResults && lastResults.length > 0) {
    allItems = lastResults;
    applyFiltersAndRender();
    statusText.textContent = `Found ${allItems.length} SVG${allItems.length === 1 ? '' : 's'}`;
  }

  scanBtn.addEventListener('click', handleScan);
  filterSelect.addEventListener('change', applyFiltersAndRender);
  sortSelect.addEventListener('change', applyFiltersAndRender);
  gridViewBtn.addEventListener('click', () => setViewMode('grid'));
  listViewBtn.addEventListener('click', () => setViewMode('list'));
  selectAllCheckbox.addEventListener('change', handleSelectAll);
  downloadSelectedBtn.addEventListener('click', handleDownloadSelected);
  downloadAllBtn.addEventListener('click', handleDownloadAll);
  themeToggle.addEventListener('click', handleThemeToggle);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  browser.runtime.onMessage.addListener((message: any) => handleMessage(message as Message));

  // Listen for storage changes to sync with popup
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.lastScanResults) {
      const newResults = changes.lastScanResults.newValue as SVGItem[] | undefined;
      if (newResults && newResults.length > 0) {
        allItems = newResults;
        selectedIds.clear();
        applyFiltersAndRender();
        statusText.textContent = `Found ${allItems.length} SVG${allItems.length === 1 ? '' : 's'}`;
      }
    }
    if (areaName === 'local' && changes.lastPageTitle) {
      currentPageTitle = changes.lastPageTitle.newValue as string | undefined;
    }
    // Sync theme changes from popup
    if (areaName === 'local' && changes.settings) {
      const newSettings = changes.settings.newValue as { theme?: ThemeMode } | undefined;
      if (newSettings?.theme && newSettings.theme !== currentTheme) {
        currentTheme = newSettings.theme;
        applyTheme(currentTheme);
      }
    }
  });
}

function applyTheme(theme: ThemeMode): void {
  // Set the user's preference (for icon display)
  document.documentElement.setAttribute('data-theme-preference', theme);

  if (theme === 'system') {
    // Detect system preference and apply it explicitly
    // This ensures Safari extension popup properly detects the theme
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

async function handleThemeToggle(): Promise<void> {
  const themes: ThemeMode[] = ['system', 'light', 'dark'];
  const currentIndex = themes.indexOf(currentTheme);
  currentTheme = themes[(currentIndex + 1) % themes.length];
  applyTheme(currentTheme);
  await saveSettings({ theme: currentTheme });
}

async function handleScan(): Promise<void> {
  scanBtn.disabled = true;
  statusBar.classList.add('scanning');
  statusText.textContent = 'Scanning page...';

  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) throw new Error('No active tab');

    // Check if this is a restricted page (Chrome, Firefox, Edge)
    if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://') ||
        tab.url?.startsWith('about:') || tab.url?.startsWith('edge://') ||
        tab.url?.startsWith('moz-extension://')) {
      throw new Error('Cannot scan browser pages');
    }

    let response = await trySendMessage(tab.id, { type: 'SCAN_PAGE' });

    if (!response) {
      await injectContentScript(tab.id);
      await new Promise(resolve => setTimeout(resolve, 100));
      response = await sendMessageWithRetry(tab.id, { type: 'SCAN_PAGE' }, 3);
    }

    if (response.success && response.data) {
      allItems = response.data;
      currentPageTitle = response.pageTitle;
      applyFiltersAndRender();
      statusText.textContent = `Found ${allItems.length} SVG${allItems.length === 1 ? '' : 's'}`;
    } else {
      throw new Error(response.error || 'Scan failed');
    }
  } catch (error) {
    const errorStr = String(error);
    if (errorStr.includes('Cannot scan browser pages')) {
      statusText.textContent = 'Cannot scan this page type';
    } else if (errorStr.includes('Could not establish connection') ||
        errorStr.includes('Receiving end does not exist')) {
      statusText.textContent = 'Please refresh the page and try again';
    } else {
      statusText.textContent = `Error: ${error}`;
    }
  } finally {
    scanBtn.disabled = false;
    statusBar.classList.remove('scanning');
  }
}

async function trySendMessage(tabId: number, message: { type: string }): Promise<{ success: boolean; data?: SVGItem[]; error?: string; pageTitle?: string } | null> {
  try {
    return await browser.tabs.sendMessage(tabId, message) as { success: boolean; data?: SVGItem[]; error?: string; pageTitle?: string };
  } catch {
    return null;
  }
}

async function injectContentScript(tabId: number): Promise<void> {
  try {
    // Check if already injected
    const results = await browser.scripting.executeScript({
      target: { tabId },
      func: () => {
        return !!(window as unknown as { __svgScoutInjected?: boolean }).__svgScoutInjected;
      },
    });

    if (results?.[0]?.result) {
      return;
    }

    // Mark as injected
    await browser.scripting.executeScript({
      target: { tabId },
      func: () => {
        (window as unknown as { __svgScoutInjected?: boolean }).__svgScoutInjected = true;
      },
    });

    // Inject the content script
    await browser.scripting.executeScript({
      target: { tabId },
      files: ['assets/index.ts.js'],
    });
  } catch (error) {
    console.error('Failed to inject content script:', error);
    throw error;
  }
}

async function sendMessageWithRetry(
  tabId: number,
  message: { type: string },
  maxRetries: number
): Promise<{ success: boolean; data?: SVGItem[]; error?: string; pageTitle?: string }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await browser.tabs.sendMessage(tabId, message) as { success: boolean; data?: SVGItem[]; error?: string; pageTitle?: string };
      return response;
    } catch (error) {
      lastError = error as Error;
      const isConnectionError = String(error).includes('Could not establish connection') ||
                                String(error).includes('Receiving end does not exist');

      if (isConnectionError && attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 200 * Math.pow(2, attempt)));
      } else {
        throw error;
      }
    }
  }

  throw lastError;
}

function handleMessage(message: Message): void {
  if (message.type === 'SCAN_PROGRESS') {
    const { progress } = message as ScanProgressMessage;
    statusText.textContent = `${progress.phase}: ${progress.found} found`;
  } else if (message.type === 'SCAN_RESULT') {
    const { items, pageTitle } = message as ScanResultMessage;
    if (items && items.length > 0) {
      allItems = items;
      currentPageTitle = pageTitle;
      selectedIds.clear();
      applyFiltersAndRender();
      statusText.textContent = `Found ${allItems.length} SVG${allItems.length === 1 ? '' : 's'}`;
    }
  }
}

function applyFiltersAndRender(): void {
  const filter = filterSelect.value as SVGSource | 'all';
  const sort = sortSelect.value;

  filteredItems = filter === 'all'
    ? [...allItems]
    : allItems.filter(item => item.source === filter);

  switch (sort) {
    case 'size-asc':
      filteredItems.sort((a, b) => a.fileSize - b.fileSize);
      break;
    case 'size-desc':
      filteredItems.sort((a, b) => b.fileSize - a.fileSize);
      break;
    case 'name':
      filteredItems.sort((a, b) => {
        const nameA = generateFileName(a, 0);
        const nameB = generateFileName(b, 0);
        return nameA.localeCompare(nameB);
      });
      break;
    case 'source':
    default:
      break;
  }

  renderGrid();
  updateSelectionUI();
}

function renderGrid(): void {
  if (filteredItems.length === 0) {
    emptyState.style.display = 'flex';
    svgGrid.style.display = 'none';
    downloadAllBtn.disabled = true;
    return;
  }

  emptyState.style.display = 'none';
  svgGrid.style.display = 'grid';
  svgGrid.className = `svg-grid ${viewMode === 'list' ? 'list-view' : ''}`;
  downloadAllBtn.disabled = false;

  svgGrid.replaceChildren();

  for (const item of filteredItems) {
    const div = document.createElement('div');
    div.className = `svg-item ${selectedIds.has(item.id) ? 'selected' : ''}`;
    div.dataset.id = item.id;

    // Create preview container
    const preview = document.createElement('div');
    preview.className = 'svg-preview';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'svg-checkbox';
    checkbox.checked = selectedIds.has(item.id);
    preview.appendChild(checkbox);
    preview.appendChild(sanitizeSvgElement(item.content));

    // Create info section
    const info = document.createElement('div');
    info.className = 'svg-info';

    const source = document.createElement('div');
    source.className = 'svg-source';
    source.textContent = item.source;

    const size = document.createElement('div');
    size.className = 'svg-size';
    size.textContent = `${formatBytes(item.fileSize)} • ${item.dimensions.width}×${item.dimensions.height}`;

    info.appendChild(source);
    info.appendChild(size);

    // Create actions section
    const actions = document.createElement('div');
    actions.className = 'svg-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn btn-secondary copy-btn';
    copyBtn.title = 'Copy SVG';
    copyBtn.textContent = 'Copy';

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'btn btn-secondary download-btn';
    downloadBtn.title = 'Download';
    downloadBtn.textContent = 'Download';

    actions.appendChild(copyBtn);
    actions.appendChild(downloadBtn);

    // Assemble the item
    div.appendChild(preview);
    div.appendChild(info);
    div.appendChild(actions);

    // Add event listeners
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      toggleSelection(item.id);
    });

    preview.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('svg-checkbox')) return;
      toggleSelection(item.id);
    });

    copyBtn.addEventListener('click', () => copyToClipboard(item));
    downloadBtn.addEventListener('click', () => downloadItem(item));

    svgGrid.appendChild(div);
  }
}

function sanitizeSvgElement(content: string): Element {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'image/svg+xml');
  const svg = doc.documentElement;

  // Remove potentially dangerous event handlers
  svg.removeAttribute('onload');
  svg.removeAttribute('onerror');

  if (!svg.hasAttribute('viewBox')) {
    const width = svg.getAttribute('width');
    const height = svg.getAttribute('height');
    if (width && height) {
      const w = parseFloat(width) || 24;
      const h = parseFloat(height) || 24;
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    } else {
      svg.setAttribute('viewBox', '0 0 24 24');
    }
  }

  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.style.width = '100%';
  svg.style.height = '100%';

  return svg;
}

function toggleSelection(id: string): void {
  if (selectedIds.has(id)) {
    selectedIds.delete(id);
  } else {
    selectedIds.add(id);
  }
  updateSelectionUI();
  renderGrid();
}

function handleSelectAll(): void {
  if (selectAllCheckbox.checked) {
    filteredItems.forEach(item => selectedIds.add(item.id));
  } else {
    selectedIds.clear();
  }
  updateSelectionUI();
  renderGrid();
}

function updateSelectionUI(): void {
  const count = selectedIds.size;
  selectedCount.textContent = count > 0 ? `(${count} selected)` : '';
  downloadSelectedBtn.disabled = count === 0;
  selectAllCheckbox.checked = count === filteredItems.length && count > 0;
  selectAllCheckbox.indeterminate = count > 0 && count < filteredItems.length;
}

function setViewMode(mode: 'grid' | 'list'): void {
  viewMode = mode;
  updateViewModeButtons();
  saveSettings({ viewMode: mode });
  renderGrid();
}

function updateViewModeButtons(): void {
  gridViewBtn.classList.toggle('active', viewMode === 'grid');
  listViewBtn.classList.toggle('active', viewMode === 'list');
}

async function copyToClipboard(item: SVGItem): Promise<void> {
  try {
    await navigator.clipboard.writeText(item.content);
    showToast('Copied to clipboard');
  } catch (error) {
    console.error('Copy failed:', error);
  }
}

async function downloadItem(item: SVGItem): Promise<void> {
  const format = getSelectedFormat();

  if (format.type === 'svg') {
    await browser.runtime.sendMessage({
      type: 'DOWNLOAD_SVG',
      item,
      pageTitle: currentPageTitle,
    });
  } else {
    await browser.runtime.sendMessage({
      type: 'DOWNLOAD_PNG',
      item,
      scale: format.scale,
      pageTitle: currentPageTitle,
    });
  }
}

async function handleDownloadSelected(): Promise<void> {
  const items = filteredItems.filter(item => selectedIds.has(item.id));
  if (items.length === 0) return;

  await downloadItems(items);
}

async function handleDownloadAll(): Promise<void> {
  if (filteredItems.length === 0) return;

  await downloadItems(filteredItems);
}

async function downloadItems(items: SVGItem[]): Promise<void> {
  const format = getSelectedFormat();

  if (items.length === 1) {
    if (format.type === 'svg') {
      await browser.runtime.sendMessage({
        type: 'DOWNLOAD_SVG',
        item: items[0],
        pageTitle: currentPageTitle,
      });
    } else {
      await browser.runtime.sendMessage({
        type: 'DOWNLOAD_PNG',
        item: items[0],
        scale: format.scale,
        pageTitle: currentPageTitle,
      });
    }
  } else {
    if (format.type === 'svg') {
      await browser.runtime.sendMessage({
        type: 'DOWNLOAD_ZIP',
        items,
        pageTitle: currentPageTitle,
      });
    } else {
      await browser.runtime.sendMessage({
        type: 'DOWNLOAD_ZIP',
        items,
        includePng: true,
        pngScale: format.scale,
        pageTitle: currentPageTitle,
      });
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function showToast(message: string): void {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: #333;
    color: white;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    z-index: 1000;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

init();
