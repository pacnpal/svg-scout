// Script to generate PNG icons from SVG
// Run with: node scripts/generate-icons.js
// Requires: npm install sharp

import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sizes = [16, 32, 48, 128];
const inputPath = join(__dirname, '../public/icons/icon.svg');
const outputDir = join(__dirname, '../public/icons');

async function generateIcons() {
  const svgBuffer = readFileSync(inputPath);

  for (const size of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(join(outputDir, `icon-${size}.png`));

    console.log(`Generated icon-${size}.png`);
  }

  console.log('Done!');
}

generateIcons().catch(console.error);
