# SVG Scout

A Chrome extension that scouts and extracts SVG icons from any webpage. Find inline SVGs, background images, sprites, shadow DOM elements, and more—all in one click.

## Features

- **Comprehensive SVG Detection**
  - Inline `<svg>` elements
  - `<img>` tags with SVG sources
  - CSS background images and masks
  - SVG sprites (`<use>` and `<symbol>`)
  - Shadow DOM traversal (including closed shadow roots)
  - Favicons
  - `<object>` and `<embed>` elements

- **Export Options**
  - Download as SVG (original vector format)
  - Export as PNG at 1x, 2x, or 4x scale
  - Bulk download as ZIP archive
  - Copy SVG code to clipboard

- **User Interface**
  - Quick popup for scanning and downloading
  - Persistent side panel for browsing large collections
  - Grid and list view modes
  - Filter by source type
  - Sort by size, name, or source
  - Multi-select with checkboxes

- **Quality of Life**
  - Auto-scan when popup opens
  - Smart file naming using page title
  - Automatic deduplication by content hash
  - Light/dark/system theme support
  - Synced state between popup and side panel

## Installation

### From Source

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/svg-scout.git
   cd svg-scout
   ```

2. Install dependencies:
   ```bash
   bun install
   # or
   npm install
   ```

3. Build the extension:
   ```bash
   bun run build
   # or
   npm run build
   ```

4. Load in Chrome:
   - Navigate to `chrome://extensions`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist` folder

### Development Mode

Run the development server with hot reload:
```bash
bun run dev
# or
npm run dev
```

Then load the `dist` folder as an unpacked extension. Changes will auto-reload.

## Usage

### Quick Scan (Popup)

1. Navigate to any webpage
2. Click the SVG Scout icon in the toolbar
3. The extension auto-scans and displays found SVGs
4. Click items to select, then download

### Detailed View (Side Panel)

1. After scanning, click "Open Side Panel" in the popup
2. Browse all SVGs with filtering and sorting
3. Switch between grid and list views
4. Use bulk actions to download multiple files

### Export Formats

| Format | Description |
|--------|-------------|
| SVG | Original vector format, perfect for web/design use |
| PNG 1x | Raster at original dimensions |
| PNG 2x | Raster at 2x scale (retina displays) |
| PNG 4x | Raster at 4x scale (high-res printing) |

### Keyboard Shortcuts

- Click item to toggle selection
- Use "Select All" checkbox for bulk selection

## Project Structure

```
svg-scout/
├── src/
│   ├── background/
│   │   └── service-worker.ts    # Extension service worker
│   ├── content/
│   │   ├── index.ts             # Content script entry
│   │   ├── scanner.ts           # SVG detection orchestrator
│   │   └── detectors/           # Detection modules
│   │       ├── inline.ts        # <svg> elements
│   │       ├── img.ts           # <img src="*.svg">
│   │       ├── css.ts           # CSS backgrounds/masks
│   │       ├── sprite.ts        # <use> and <symbol>
│   │       ├── shadow-dom.ts    # Shadow DOM traversal
│   │       ├── favicon.ts       # SVG favicons
│   │       └── object-embed.ts  # <object>/<embed>
│   ├── offscreen/
│   │   ├── offscreen.html       # Offscreen document
│   │   └── offscreen.ts         # Blob/ZIP generation
│   ├── ui/
│   │   ├── popup/               # Toolbar popup UI
│   │   └── sidepanel/           # Side panel UI
│   └── shared/
│       ├── types.ts             # TypeScript interfaces
│       ├── messages.ts          # Message type definitions
│       ├── constants.ts         # Configuration constants
│       ├── storage.ts           # Chrome storage wrappers
│       └── svg-utils.ts         # SVG processing utilities
├── public/
│   └── icons/                   # Extension icons
├── manifest.json                # Chrome extension manifest
├── vite.config.ts               # Vite + CRXJS configuration
├── tsconfig.json                # TypeScript configuration
└── package.json
```

## Technical Details

### Architecture

- **Manifest V3** - Uses the latest Chrome extension platform
- **TypeScript** - Full type safety throughout
- **Vite + CRXJS** - Fast builds with hot module replacement
- **Offscreen Document** - Required for blob URL creation in MV3

### Permissions

| Permission | Purpose |
|------------|---------|
| `activeTab` | Access current tab content |
| `scripting` | Inject content scripts |
| `sidePanel` | Side panel UI |
| `storage` | Persist settings |
| `downloads` | Save files |
| `offscreen` | Blob URL creation |
| `contextMenus` | Right-click menu |
| `windows` | Open side panel |

### Browser Support

- Chrome 116+ (required for side panel API)
- Edge 116+ (Chromium-based)

## Building

### Production Build

```bash
bun run build
```

Output is in the `dist` folder, ready for Chrome Web Store submission.

### Development Build

```bash
bun run dev
```

Starts Vite dev server with CRXJS hot reload support.

### Generate Icons

```bash
bun run generate-icons
```

Generates all icon sizes from a source image using Sharp.

## Configuration

Settings are stored in Chrome's local storage and sync between popup and side panel:

| Setting | Default | Description |
|---------|---------|-------------|
| `theme` | `system` | Light, dark, or system preference |
| `viewMode` | `grid` | Grid or list view in side panel |
| `defaultPngScale` | `2` | Default PNG export scale |

## API Reference

### Message Types

The extension uses typed messages for communication:

```typescript
// Scan the current page
{ type: 'SCAN_PAGE' }

// Download single SVG
{ type: 'DOWNLOAD_SVG', item: SVGItem, pageTitle?: string }

// Download as PNG
{ type: 'DOWNLOAD_PNG', item: SVGItem, scale: 1 | 2 | 4, pageTitle?: string }

// Download multiple as ZIP
{ type: 'DOWNLOAD_ZIP', items: SVGItem[], pageTitle?: string }
```

### SVGItem Interface

```typescript
interface SVGItem {
  id: string;           // Content hash for deduplication
  content: string;      // Raw SVG markup
  source: SVGSource;    // Detection method
  sourceUrl?: string;   // Original URL if external
  dimensions: {
    width: number;
    height: number;
  };
  fileSize: number;     // Bytes
  name?: string;        // Extracted name if available
}

type SVGSource =
  | 'inline'
  | 'img'
  | 'css-background'
  | 'sprite'
  | 'favicon'
  | 'shadow-dom'
  | 'object-embed';
```

## Troubleshooting

### "Please refresh the page and try again"

This occurs when the content script isn't loaded. Solutions:
1. Refresh the target page
2. Reload the extension in `chrome://extensions`

### SVGs not detected

Some SVGs may not be detected if they:
- Are loaded dynamically after page load (try scanning again)
- Are inside iframes from different origins (security restriction)
- Are encoded in formats the extension doesn't recognize

### Downloads not starting

Ensure Chrome's download settings allow the extension to save files. Check `chrome://settings/downloads`.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run the build: `bun run build`
5. Test thoroughly in Chrome
6. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Built with [Vite](https://vitejs.dev/) and [CRXJS](https://crxjs.dev/)
- ZIP generation by [JSZip](https://stuk.github.io/jszip/)
- Icons generated with [Sharp](https://sharp.pixelplumbing.com/)
