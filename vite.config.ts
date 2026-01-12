import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import baseManifest from './manifest.json';
import { writeFileSync, readFileSync, copyFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

// Deep clone and process manifest for specific browser
function processManifest(browser: 'chrome' | 'firefox' | 'safari') {
  const manifest = JSON.parse(JSON.stringify(baseManifest));

  if (browser === 'chrome') {
    // Remove Firefox-specific keys
    delete manifest.browser_specific_settings;
    delete manifest.browser_action;
    delete manifest.sidebar_action;
    // Remove scripts from background (Chrome uses service_worker)
    if (manifest.background) {
      delete manifest.background.scripts;
    }
  } else if (browser === 'firefox') {
    // Remove Chrome-specific keys (keep 'action' - Firefox MV3 supports it)
    delete manifest.side_panel;
    delete manifest.minimum_chrome_version;
    // Remove service_worker from background (Firefox uses scripts)
    if (manifest.background) {
      delete manifest.background.service_worker;
    }
    // Remove Chrome-only permissions
    manifest.permissions = manifest.permissions.filter(
      (p: string) => !['sidePanel', 'offscreen', 'windows'].includes(p)
    );
    // Remove optional_permissions that Firefox doesn't support
    if (manifest.optional_permissions) {
      manifest.optional_permissions = manifest.optional_permissions.filter(
        (p: string) => !['sidePanel'].includes(p)
      );
      if (manifest.optional_permissions.length === 0) {
        delete manifest.optional_permissions;
      }
    }
  } else if (browser === 'safari') {
    // Remove Firefox-specific keys
    delete manifest.browser_specific_settings;
    delete manifest.browser_action;
    delete manifest.sidebar_action;
    // Remove Chrome-specific keys
    delete manifest.side_panel;
    delete manifest.minimum_chrome_version;
    // Safari uses service_worker (like Chrome)
    if (manifest.background) {
      delete manifest.background.scripts;
    }
    // Remove unsupported permissions
    manifest.permissions = manifest.permissions.filter(
      (p: string) => !['sidePanel', 'offscreen', 'windows'].includes(p)
    );
    // Remove optional_permissions Safari doesn't support
    if (manifest.optional_permissions) {
      manifest.optional_permissions = manifest.optional_permissions.filter(
        (p: string) => !['sidePanel'].includes(p)
      );
      if (manifest.optional_permissions.length === 0) {
        delete manifest.optional_permissions;
      }
    }
  }

  return manifest;
}

export default defineConfig(({ mode }) => {
  const browser = mode === 'firefox' ? 'firefox' : mode === 'safari' ? 'safari' : 'chrome';
  const manifest = processManifest(browser);
  const outDir = browser === 'firefox' ? 'dist/firefox' : browser === 'safari' ? 'dist/safari' : 'dist/chrome';

  // Post-build plugin to clean manifest for non-Chrome browsers and copy Safari-specific files
  const cleanManifest = {
    name: 'clean-manifest',
    writeBundle() {
      if (browser === 'firefox' || browser === 'safari') {
        const manifestPath = resolve(outDir, 'manifest.json');
        try {
          const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
          // Remove use_dynamic_url from web_accessible_resources (Firefox/Safari don't support it)
          if (manifest.web_accessible_resources) {
            manifest.web_accessible_resources = manifest.web_accessible_resources.map(
              (resource: Record<string, unknown>) => {
                const { use_dynamic_url, ...rest } = resource;
                return rest;
              }
            );
          }
          writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        } catch {
          // Ignore if manifest doesn't exist yet
        }
      }

      // Copy Safari-specific iframe download files
      if (browser === 'safari') {
        const popupDir = resolve(outDir, 'src/ui/popup');
        if (!existsSync(popupDir)) {
          mkdirSync(popupDir, { recursive: true });
        }
        try {
          copyFileSync(
            resolve('src/ui/popup/iframe-download.html'),
            resolve(popupDir, 'iframe-download.html')
          );
          copyFileSync(
            resolve('src/ui/popup/iframe-download.js'),
            resolve(popupDir, 'iframe-download.js')
          );
        } catch (e) {
          console.warn('Failed to copy Safari iframe files:', e);
        }
      }
    },
  };

  // Determine rollup input based on browser
  // Chrome needs offscreen.html, Firefox/Safari don't (they have direct DOM access)
  const getRollupInput = () => {
    if (browser === 'chrome') {
      return { offscreen: 'src/offscreen/offscreen.html' };
    }
    // Firefox and Safari don't need offscreen document
    return { sidepanel: 'src/ui/sidepanel/sidepanel.html' };
  };

  return {
    plugins: [
      crx({ manifest }),
      cleanManifest,
    ],
    define: {
      __BROWSER__: JSON.stringify(browser),
    },
    build: {
      outDir,
      rollupOptions: {
        input: getRollupInput(),
        output: {
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name].[ext]',
        },
      },
    },
    publicDir: 'public',
    assetsInclude: [],
    // Exclude .DS_Store files from build
    server: {
      watch: {
        ignored: ['**/.DS_Store'],
      },
    },
  };
});
