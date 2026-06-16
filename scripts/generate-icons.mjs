import sharp from 'sharp';
import toIco from 'to-ico';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const resourcesDir = join(__dirname, '..', 'resources');
const sourcePath = join(resourcesDir, 'markd.png');

mkdirSync(resourcesDir, { recursive: true });

const icon = sharp(sourcePath);

const sizes = [256, 512, 1024];
for (const size of sizes) {
  await icon.clone().resize(size, size).png().toFile(join(resourcesDir, `icon-${size}.png`));
  console.log(`Generated icon-${size}.png`);
}

await icon.clone().resize(256, 256).png().toFile(join(resourcesDir, 'icon.png'));
console.log('Generated icon.png');

const png256 = await icon.clone().resize(256, 256).png().toBuffer();
const icoBuf = await toIco([png256]);
writeFileSync(join(resourcesDir, 'markd.ico'), icoBuf);
writeFileSync(join(resourcesDir, 'icon.ico'), icoBuf);
console.log('Generated markd.ico and icon.ico');