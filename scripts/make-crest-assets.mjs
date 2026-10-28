// Makes all of the app's images from the crest in design/ (run with: npm run crest).
// Only needed again if the crest image changes.

import sharp from 'sharp';

const portrait = 'design/crest-portrait.jpg'; // 1024 x 1536
const navy = '#0E1726';

// Square around the flame and shield (pixel positions in the portrait image).
const square = sharp(portrait).extract({ left: 58, top: 98, width: 908, height: 908 });
const icon = await square.png().toBuffer();

// Home-screen and browser-tab icons.
for (const size of [48, 64, 192, 512]) {
  await sharp(icon).resize(size, size).png({ palette: true, quality: 90, compressionLevel: 9 }).toFile(`public/pwa-${size}x${size}.png`);
}
await sharp(icon).resize(180, 180).png({ palette: true, quality: 90, compressionLevel: 9 }).toFile('public/apple-touch-icon-180x180.png');

// Android may cut icons into circles: shrink the crest onto a navy square so nothing is cut off.
const inner = Math.round(512 * 0.76);
await sharp({ create: { width: 512, height: 512, channels: 4, background: navy } })
  .composite([{ input: await sharp(icon).resize(inner, inner).toBuffer(), gravity: 'center' }])
  .png({ palette: true, quality: 90, compressionLevel: 9 })
  .toFile('public/maskable-icon-512x512.png');

// Full crest, small and fast, for the welcome screen (tall for phones, wide for computers).
await sharp(portrait).resize({ width: 480 }).webp({ quality: 72 }).toFile('public/crest.webp');
await sharp('design/crest-landscape.jpg').resize({ width: 960 }).webp({ quality: 72 }).toFile('public/crest-wide.webp');

console.log('Crest images created in public/');
