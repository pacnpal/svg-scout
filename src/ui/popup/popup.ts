import { browser, isFirefox, openSidePanel } from '../../shared/browser-api';
import type { SVGItem, PngScale, ThemeMode } from '../../shared/types';
import type { Message, ScanProgressMessage, ScanResultMessage } from '../../shared/messages';
import { getSettings, saveSettings } from '../../shared/storage';

const scanBtn = document.getElementById('scanBtn') as HTMLButtonElement;
const sidePanelBtn = document.getElementById('sidePanelBtn') as HTMLButtonElement;
const formatRow = document.getElementById('formatRow') as HTMLDivElement;
const formatSelect = document.getElementById('formatSelect') as HTMLSelectElement;
const downloadActions = document.getElementById('downloadActions') as HTMLDivElement;
const downloadSelectedBtn = document.getElementById('downloadSelectedBtn') as HTMLButtonElement;
const downloadSelectedText = document.getElementById('downloadSelectedText') as HTMLSpanElement;
const downloadAllBtn = document.getElementById('downloadAllBtn') as HTMLButtonElement;
const selectAllCheckbox = document.getElementById('selectAllCheckbox') as HTMLInputElement;
const status = document.getElementById('status') as HTMLDivElement;
const statusText = status.querySelector('.status-text') as HTMLSpanElement;
const results = document.getElementById('results') as HTMLDivElement;
const resultsCount = document.getElementById('resultsCount') as HTMLSpanElement;
const resultsGrid = document.getElementById('resultsGrid') as HTMLDivElement;
const footer = document.querySelector('.footer-text') as HTMLSpanElement;
const themeToggle = document.getElementById('themeToggle') as HTMLButtonElement;

let currentItems: SVGItem[] = [];
let selectedIds = new Set<string>();
let currentTheme: ThemeMode = 'system';
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
  currentTheme = settings.theme;
  applyTheme(currentTheme);

  scanBtn.addEventListener('click', handleScan);
  sidePanelBtn.addEventListener('click', handleOpenSidePanel);
  downloadSelectedBtn.addEventListener('click', handleDownloadSelected);
  downloadAllBtn.addEventListener('click', handleDownloadAll);
  selectAllCheckbox.addEventListener('change', handleSelectAll);
  themeToggle.addEventListener('click', handleThemeToggle);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  browser.runtime.onMessage.addListener((message: any) => handleMessage(message as Message));

  await handleScan();
}

function applyTheme(theme: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', theme);
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
  scanBtn.classList.add('scanning');
  setStatus('scanning', 'Scanning page...');

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
      currentPageTitle = response.pageTitle;
      displayResults(response.data);
    } else {
      throw new Error(response.error || 'Scan failed');
    }
  } catch (error) {
    console.error('Scan error:', error);
    const errorStr = String(error);
    if (errorStr.includes('Cannot scan browser pages')) {
      setStatus('error', 'Cannot scan this page type');
    } else if (errorStr.includes('Could not establish connection') ||
        errorStr.includes('Receiving end does not exist')) {
      setStatus('error', 'Please refresh the page and try again');
    } else {
      setStatus('error', `Error: ${error}`);
    }
  } finally {
    scanBtn.disabled = false;
    scanBtn.classList.remove('scanning');
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
    setStatus('scanning', `${progress.phase}: ${progress.found} found`);
  } else if (message.type === 'SCAN_RESULT') {
    const { items } = message as ScanResultMessage;
    displayResults(items);
  }
}

function displayResults(items: SVGItem[]): void {
  currentItems = items;
  selectedIds.clear();

  if (items.length === 0) {
    setStatus('complete', 'No SVGs found on this page');
    results.style.display = 'none';
    sidePanelBtn.style.display = 'none';
    formatRow.style.display = 'none';
    downloadActions.style.display = 'none';
    footer.textContent = 'Try a different page';
    return;
  }

  setStatus('complete', 'Scan complete');
  results.style.display = 'flex';
  sidePanelBtn.style.display = 'flex';
  formatRow.style.display = 'flex';
  downloadActions.style.display = 'flex';

  resultsCount.textContent = `${items.length} SVG${items.length === 1 ? '' : 's'} found`;

  renderGrid();
  updateSelectionUI();

  footer.textContent = 'Click to select, then download';
}

function renderGrid(): void {
  resultsGrid.replaceChildren();

  for (const item of currentItems) {
    const div = document.createElement('div');
    div.className = `svg-item ${selectedIds.has(item.id) ? 'selected' : ''}`;
    div.dataset.id = item.id;

    // Create check overlay with checkmark SVG
    const checkOverlay = document.createElement('div');
    checkOverlay.className = 'check-overlay';
    const checkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    checkSvg.setAttribute('viewBox', '0 0 24 24');
    checkSvg.setAttribute('fill', 'none');
    checkSvg.setAttribute('stroke', 'currentColor');
    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', '20 6 9 17 4 12');
    checkSvg.appendChild(polyline);
    checkOverlay.appendChild(checkSvg);

    // Create preview container with sanitized SVG
    const preview = document.createElement('div');
    preview.className = 'svg-preview';
    preview.appendChild(sanitizeSvgElement(item.content));

    div.appendChild(checkOverlay);
    div.appendChild(preview);
    div.addEventListener('click', () => toggleSelection(item.id));
    resultsGrid.appendChild(div);
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

  const item = resultsGrid.querySelector(`[data-id="${id}"]`);
  if (item) {
    item.classList.toggle('selected', selectedIds.has(id));
  }
}

function handleSelectAll(): void {
  if (selectAllCheckbox.checked) {
    currentItems.forEach(item => selectedIds.add(item.id));
  } else {
    selectedIds.clear();
  }
  updateSelectionUI();
  renderGrid();
}

function updateSelectionUI(): void {
  const count = selectedIds.size;

  downloadSelectedBtn.disabled = count === 0;

  if (count === 0) {
    downloadSelectedText.textContent = 'Download Selected';
  } else if (count === 1) {
    downloadSelectedText.textContent = 'Download (1)';
  } else {
    downloadSelectedText.textContent = `Download (${count})`;
  }

  selectAllCheckbox.checked = count === currentItems.length && count > 0;
  selectAllCheckbox.indeterminate = count > 0 && count < currentItems.length;
}

function setStatus(type: 'ready' | 'scanning' | 'complete' | 'error', text: string): void {
  status.className = `status ${type}`;
  statusText.textContent = text;
}

async function handleOpenSidePanel(): Promise<void> {
  if (isFirefox) {
    // Firefox requires sidebarAction.open() to be called from a user action context
    // Calling it directly from the popup button click preserves that context
    await openSidePanel();
  } else {
    // Chrome can open side panel from the service worker
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId) {
      await browser.runtime.sendMessage({
        type: 'OPEN_SIDE_PANEL',
        windowId: tab.windowId
      });
    }
  }
  window.close();
}

async function handleDownloadSelected(): Promise<void> {
  const items = currentItems.filter(item => selectedIds.has(item.id));
  if (items.length === 0) return;

  downloadSelectedBtn.disabled = true;

  try {
    await downloadItems(items);
  } catch (error) {
    console.error('Download error:', error);
  } finally {
    downloadSelectedBtn.disabled = false;
  }
}

async function handleDownloadAll(): Promise<void> {
  if (currentItems.length === 0) return;

  downloadAllBtn.disabled = true;

  try {
    await downloadItems(currentItems);
  } catch (error) {
    console.error('Download error:', error);
  } finally {
    downloadAllBtn.disabled = false;
  }
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

init();
