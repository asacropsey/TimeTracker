// Makes all of the app's images (run with: npm run crest). Only needed again if a source image changes.
// - App icons: from design/app-icon.svg (gold Sigma on navy – the owner's choice; the cropped
//   crest was unreadable at icon size)
// - Welcome screen: the full crest from design/crest-*.jpg

import { readFileSync } from 'node:fs';
import sharp from 'sharp';

// No colour reduction: it would speckle the soft background shading.
const png = { compressionLevel: 9, adaptiveFiltering: true };
const svg = readFileSync('design/app-icon.svg', 'utf8');
const render = (svgText) => sharp(Buffer.from(svgText), { density: 300 }).resize(1024, 1024).png().toBuffer();
const icon = await render(svg);

// Home-screen and browser-tab icons.
for (const size of [48, 64, 192, 512]) {
  await sharp(icon).resize(size, size).png(png).toFile(`public/icon-${size}.png`);
}
await sharp(icon).resize(180, 180).png(png).toFile('public/icon-apple-180.png');

// Android may cut icons into circles: the same design with a smaller Sigma, so nothing is cut off.
const maskable = svg.replace('<g id="sigma">', '<g id="sigma" transform="translate(256 256) scale(0.78) translate(-256 -256)">');
await sharp(await render(maskable)).resize(512, 512).png(png).toFile('public/icon-maskable-512.png');

// Full crest, small and fast, for the welcome screen (tall for phones, wide for computers).
await sharp('design/crest-portrait.jpg').resize({ width: 480 }).webp({ quality: 72 }).toFile('public/crest.webp');
await sharp('design/crest-landscape.jpg').resize({ width: 960 }).webp({ quality: 72 }).toFile('public/crest-wide.webp');

console.log('Icons and crest images created in public/');
