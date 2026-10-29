// public/icons/icon.svg'den PWA ve iOS ikonlarını üretir: npm run icons
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const svg = await readFile('public/icons/icon.svg');
const out = (size, file, pad = 0, bg = { r: 0, g: 0, b: 0, alpha: 0 }) =>
  sharp(svg).resize(size - pad * 2, size - pad * 2)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: bg })
    .flatten(bg.alpha ? { background: bg } : false)
    .png().toFile(`public/icons/${file}`);

await out(192, 'icon-192.png');
await out(512, 'icon-512.png');
await out(512, 'icon-maskable-512.png', 56, { r: 27, g: 16, b: 51, alpha: 1 });
await out(180, 'apple-touch-icon.png', 0, { r: 27, g: 16, b: 51, alpha: 1 });
console.log('ikonlar üretildi');
