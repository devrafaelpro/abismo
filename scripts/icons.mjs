// Gera os PNGs dos ícones a partir do SVG. Uso: node scripts/icons.mjs <caminho do sharp>
import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire(import.meta.url);
const sharp = require(process.argv[2] || 'sharp');
const svg = readFileSync(new URL('../icons/icon.svg', import.meta.url));
const out = (n, f) => sharp(svg, { density: 300 }).resize(n, n).png().toFile(new URL('../icons/' + f, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
await out(512, 'icon-512.png');
await out(192, 'icon-192.png');
await out(180, 'apple-touch-icon.png');
// maskable: com margem de segurança
const inner = await sharp(svg, { density: 300 }).resize(410, 410).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#04100b' } })
  .composite([{ input: inner, left: 51, top: 51 }]).png().toFile(new URL('../icons/icon-maskable.png', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
console.log('ícones gerados');
