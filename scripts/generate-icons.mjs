/**
 * Genera los iconos de la app en `public/`: un cuadrado plano de tinta azul con una
 * marca de verificación blanca. Sin dependencias ni gradientes: se dibuja píxel a
 * píxel con supermuestreo y se escribe como PNG. Uso: `node scripts/generate-icons.mjs`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const INK = [0x2b, 0x50, 0xc8];
const WHITE = [0xff, 0xff, 0xff];

// La marca cabe en el 80 % central, así que sirve tal cual como icono "maskable".
const CHECK = [
  [0.29, 0.52],
  [0.44, 0.67],
  [0.72, 0.35],
];
const STROKE = 0.09;
const SAMPLES = 4;

function distanceToSegment([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function insideCheck(point) {
  return (
    distanceToSegment(point, CHECK[0], CHECK[1]) <= STROKE / 2 ||
    distanceToSegment(point, CHECK[1], CHECK[2]) <= STROKE / 2
  );
}

function render(size) {
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let covered = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const point = [(x + (sx + 0.5) / SAMPLES) / size, (y + (sy + 0.5) / SAMPLES) / size];
          if (insideCheck(point)) covered++;
        }
      }
      const mix = covered / (SAMPLES * SAMPLES);
      const offset = (y * size + x) * 4;
      for (let c = 0; c < 3; c++)
        pixels[offset + c] = Math.round(INK[c] + (WHITE[c] - INK[c]) * mix);
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size) {
  const rgba = render(size);
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0; // filtro "ninguno"
    rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bits por canal
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <title>Hábitos</title>
  <rect width="100" height="100" fill="#2b50c8"/>
  <polyline points="${CHECK.map(([x, y]) => `${x * 100},${y * 100}`).join(' ')}" fill="none" stroke="#ffffff" stroke-width="${STROKE * 100}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

mkdirSync('public', { recursive: true });
for (const [name, size] of [
  ['pwa-192.png', 192],
  ['pwa-512.png', 512],
  ['pwa-maskable-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(`public/${name}`, png(size));
}
writeFileSync('public/favicon.svg', svg);
process.stdout.write('Iconos generados en public/.\n');
