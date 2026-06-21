import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const sourcePath = join(rootDir, 'resources', 'markd.png');
const outputDir = join(rootDir, 'build', 'appx');
const background = { r: 241, g: 242, b: 244, alpha: 1 };

await mkdir(outputDir, { recursive: true });

async function createSquare(name, size) {
  await sharp(sourcePath)
    .resize(size, size, { fit: 'cover' })
    .png()
    .toFile(join(outputDir, name));
}

await Promise.all([
  createSquare('StoreLogo.png', 50),
  createSquare('Square44x44Logo.png', 44),
  createSquare('Square150x150Logo.png', 150),
  sharp(sourcePath)
    .resize(140, 140, { fit: 'contain' })
    .extend({ top: 5, bottom: 5, left: 85, right: 85, background })
    .png()
    .toFile(join(outputDir, 'Wide310x150Logo.png')),
]);

console.log(`Generated Microsoft Store assets in ${outputDir}`);
