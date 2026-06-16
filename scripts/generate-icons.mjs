/**
 * Generate app icons from markd.svg.
 * Run: node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const resourcesDir = join(__dirname, '..', 'resources');
const sourcePath = join(resourcesDir, 'markd.png');

mkdirSync(resourcesDir, { recursive: true });

const icon = sharp(sourcePath);

// Generate various sizes
const sizes = [256, 512, 1024];
for (const size of sizes) {
  await icon.clone().resize(size, size).png().toFile(join(resourcesDir, `icon-${size}.png`));
  console.log(`Generated icon-${size}.png`);
}

// Main app icon
await icon.clone().resize(256, 256).png().toFile(join(resourcesDir, 'icon.png'));
console.log('Generated icon.png');

// ICO for Windows
await icon.clone().resize(256, 256).png().toFile(join(resourcesDir, 'markd.ico'));
await icon.clone().resize(256, 256).png().toFile(join(resourcesDir, 'icon.ico'));
console.log('Generated icon.ico');

console.log('\nAll icons regenerated from markd.png');
