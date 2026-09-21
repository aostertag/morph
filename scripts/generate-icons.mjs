/**
 * Genera los iconos de la app en `public/` a partir del icono de marca
 * `brand/morph-icon-source.png` (1024×1024, sin modificar). Sin dependencias: lee el PNG con
 * `zlib`, lo reduce promediando el área que cubre cada píxel de destino y escribe los PNG.
 * El favicon es un SVG que incrusta un PNG de 64 px.
 * Uso: `node scripts/generate-icons.mjs`.
 *
 * Además comprueba que la marca cae dentro del círculo seguro del 80 % de un icono
 * "maskable" (radio = 0,4 × el lado) y falla si no es así.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

const SOURCE = 'brand/morph-icon-source.png';
const SAFE_RADIUS = 0.4;
// El favicon (16/32 px) recorta la fuente alrededor de la «m» para que ocupe esta fracción
// del lado; a 16 px, con la proporción del icono grande, la «m» se veía como un manchón.
// Los demás iconos usan la fuente entera, sin cambios.
const FAVICON_FILL = 0.7;

function readPng(path) {
  const file = readFileSync(path);
  let offset = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat = [];
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    const data = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[12] !== 0) throw new Error('Solo PNG de 8 bits sin entrelazar.');
      if (data[9] === 2) channels = 3;
      else if (data[9] === 6) channels = 4;
      else throw new Error('Solo PNG RGB o RGBA.');
    } else if (type === 'IDAT') idat.push(data);
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const rgb = new Float64Array(width * height * 3);
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const start = y * (stride + 1);
    const filter = raw[start];
    const line = Buffer.from(raw.subarray(start + 1, start + 1 + stride));
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? line[i - channels] : 0;
      const up = previous[i];
      const upLeft = i >= channels ? previous[i - channels] : 0;
      let add = 0;
      if (filter === 1) add = left;
      else if (filter === 2) add = up;
      else if (filter === 3) add = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        add = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      line[i] = (line[i] + add) & 0xff;
    }
    for (let x = 0; x < width; x++)
      for (let c = 0; c < 3; c++) rgb[(y * width + x) * 3 + c] = line[x * channels + c];
    previous = line;
  }
  return { width, height, rgb };
}

/**
 * Reduce promediando el área exacta (con fracciones) que cubre cada píxel de destino.
 * `crop` ({ x, y, side }) limita el origen a un cuadrado; por defecto, la imagen entera.
 */
function resize({ width, height, rgb }, size, crop = { x: 0, y: 0, side: width }) {
  if (size === width && crop.side === width) return Uint8Array.from(rgb, Math.round);
  const scale = crop.side / size;
  const out = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) {
    const y0 = crop.y + y * scale;
    const y1 = y0 + scale;
    for (let x = 0; x < size; x++) {
      const x0 = crop.x + x * scale;
      const x1 = x0 + scale;
      const sum = [0, 0, 0];
      let weight = 0;
      for (let sy = Math.max(0, Math.floor(y0)); sy < Math.min(height, Math.ceil(y1)); sy++) {
        const wy = Math.min(sy + 1, y1) - Math.max(sy, y0);
        for (let sx = Math.max(0, Math.floor(x0)); sx < Math.min(width, Math.ceil(x1)); sx++) {
          const w = wy * (Math.min(sx + 1, x1) - Math.max(sx, x0));
          for (let c = 0; c < 3; c++) sum[c] += (rgb[(sy * width + sx) * 3 + c] ?? 0) * w;
          weight += w;
        }
      }
      for (let c = 0; c < 3; c++) out[(y * size + x) * 3 + c] = Math.round((sum[c] ?? 0) / weight);
    }
  }
  return out;
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

function png(rgb, size) {
  const rows = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    rows[y * (size * 3 + 1)] = 0; // filtro "ninguno"
    Buffer.from(rgb.buffer, y * size * 3, size * 3).copy(rows, y * (size * 3 + 1) + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bits por canal
  header[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Caja de la marca: los píxeles claramente más claros que el fondo (la esquina 0,0). */
function assertMarkInsideSafeCircle(rgb, size) {
  const bg = [rgb[0] ?? 0, rgb[1] ?? 0, rgb[2] ?? 0];
  const center = (size - 1) / 2;
  let farthest = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 3;
      const diff = Math.abs((rgb[i] ?? 0) - bg[0]) + Math.abs((rgb[i + 1] ?? 0) - bg[1]);
      if (diff > 60) farthest = Math.max(farthest, Math.hypot(x - center, y - center));
    }
  }
  const ratio = farthest / size;
  if (ratio > SAFE_RADIUS)
    throw new Error(`La marca sale del círculo seguro: ${ratio.toFixed(3)} > ${SAFE_RADIUS}.`);
  process.stdout.write(
    `Marca a ${(ratio * 100).toFixed(1)} % del lado desde el centro (límite ${SAFE_RADIUS * 100} %).\n`,
  );
}

/** Cuadrado de recorte centrado en la marca (píxeles distintos del fondo de la esquina 0,0). */
function faviconCrop({ width, height, rgb }, fill) {
  const bg = [rgb[0] ?? 0, rgb[1] ?? 0, rgb[2] ?? 0];
  let [minX, minY, maxX, maxY] = [width, height, 0, 0];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      const diff = Math.abs((rgb[i] ?? 0) - bg[0]) + Math.abs((rgb[i + 1] ?? 0) - bg[1]);
      if (diff > 60)
        [minX, minY, maxX, maxY] = [
          Math.min(minX, x),
          Math.min(minY, y),
          Math.max(maxX, x),
          Math.max(maxY, y),
        ];
    }
  }
  const side = Math.min(width, (maxX - minX + 1) / fill);
  const clamp = (v) => Math.max(0, Math.min(width - side, v));
  return {
    x: clamp((minX + maxX + 1) / 2 - side / 2),
    y: clamp((minY + maxY + 1) / 2 - side / 2),
    side,
  };
}

const source = readPng(SOURCE);
if (source.width !== source.height) throw new Error('El icono de origen debe ser cuadrado.');

mkdirSync('public', { recursive: true });
const maskable = resize(source, 512);
assertMarkInsideSafeCircle(maskable, 512);

for (const [name, size] of [
  ['pwa-192.png', 192],
  ['pwa-512.png', 512],
  ['pwa-maskable-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(`public/${name}`, png(resize(source, size), size));
}

const favicon = png(resize(source, 64, faviconCrop(source, FAVICON_FILL)), 64).toString('base64');
writeFileSync(
  'public/favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 64 64">
  <title>Morph</title>
  <image width="64" height="64" xlink:href="data:image/png;base64,${favicon}"/>
</svg>
`,
);
process.stdout.write('Iconos generados en public/.\n');
