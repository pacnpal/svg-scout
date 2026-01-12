# SVG Scout

A browser extension for Chrome and Firefox that scouts and extracts SVG icons from any webpage. Find inline SVGs, background images, sprites, shadow DOM elements, and more—all in one click.

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

## Build Instructions for Mozilla Reviewers

### Requirements

- **Operating System**: macOS, Linux, or Windows
- **Node.js**: v18.0.0 or higher (tested with v22.x)
- **Package Manager**: npm (included with Node.js) or Bun v1.0+

### Step-by-Step Build

```bash
# 1. Extract source code and enter directory
cd svg-scout

# 2. Install dependencies
npm install

# 3. Build Firefox extension
npm run build:firefox

# 4. The built extension is in dist/firefox/
# 5. Package is created at dist/svg-scout-firefox.xpi
```

### Build Script

Run the complete build and package process:
```bash
npm run package:firefox
```

This executes: TypeScript compilation → Vite build → ZIP packaging → addons-linter validation

### Build Tools Used

| Tool | Version | Purpose |
|------|---------|---------|
| TypeScript | ^5.7.2 | Type-safe JavaScript compilation |
| Vite | ^6.0.7 | Build tool and bundler |
| @crxjs/vite-plugin | ^2.0.0-beta.28 | Browser extension bundler |

### Third-Party Libraries

| Library | Purpose |
|---------|---------|
| jszip | ZIP file generation for bulk downloads |
| webextension-polyfill | Cross-browser API compatibility |

**Note**: The "Function constructor is eval" warning originates from jszip, a widely-used open-source library (https://github.com/Stuk/jszip).

---

## Installation

### From Source

1. Clone the repository:
   ```bash
   git clone https://github.com/pacnpal/svg-scout.git
   cd svg-scout
   ```

2. Install dependencies:
   ```bash
   npm install
   # or: bun install
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
   - Select the `dist/chrome` folder

5. Load in Firefox:
   - Navigate to `about:debugging#/runtime/this-firefox`
   - Click "Load Temporary Add-on..."
   - Select any file in the `dist/firefox` folder

### Development Mode

Run the development server with hot reload:
```bash
# Chrome
bun run dev

# Firefox
bun run dev:firefox
```

Then load the appropriate `dist/chrome` or `dist/firefox` folder as an unpacked extension. Changes will auto-reload.

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
- Firefox 142+ (required for data collection permissions)

## Building

### Production Build

```bash
# Build both Chrome and Firefox
bun run build

# Build Chrome only
bun run build:chrome

# Build Firefox only
bun run build:firefox
```

Output is in `dist/chrome` and `dist/firefox` folders.

### Package for Distribution

```bash
# Package both browsers
bun run package

# Package Chrome only (creates dist/svg-scout-chrome.zip)
bun run package:chrome

# Package Firefox only (creates dist/svg-scout-firefox.xpi)
# Includes automatic addons-linter validation
bun run package:firefox
```

### Development Build

```bash
# Chrome with hot reload
bun run dev

# Firefox with hot reload
bun run dev:firefox
```

Starts Vite dev server with CRXJS hot reload support.

### Linting

```bash
# TypeScript type checking
bun run lint

# Firefox add-on validation (requires built xpi)
bun run lint:firefox
```

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
