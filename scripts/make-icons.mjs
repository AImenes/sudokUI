// Generates icon-192.png and icon-512.png without any native image deps:
// draws the sudokUI mark (gradient rounded square + 3x3 grid) pixel by pixel
// and encodes a minimal PNG using zlib.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = ~0;
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, pixels) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter none
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const radius = size * 0.215;
  const gridMin = size * 0.207;
  const gridMax = size * 0.793;
  const gridW = size * 0.035;
  const borderW = size * 0.037;
  const cell = (gridMax - gridMin) / 3;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // rounded-rect mask
      const cx = Math.max(radius - x, x - (size - 1 - radius), 0);
      const cy = Math.max(radius - y, y - (size - 1 - radius), 0);
      if (cx * cx + cy * cy > radius * radius) {
        px[i + 3] = 0;
        continue;
      }
      // diagonal gradient #5b8fe0 -> #9b74d8
      const t = (x + y) / (2 * size);
      let r = Math.round(0x5b + (0x9b - 0x5b) * t);
      let g = Math.round(0x8f + (0x74 - 0x8f) * t);
      let b = Math.round(0xe0 + (0xd8 - 0xe0) * t);

      const inGrid = x >= gridMin && x <= gridMax && y >= gridMin && y <= gridMax;
      if (inGrid) {
        const onBorder =
          x - gridMin < borderW ||
          gridMax - x < borderW ||
          y - gridMin < borderW ||
          gridMax - y < borderW;
        const gx = (x - gridMin) % cell;
        const gy = (y - gridMin) % cell;
        const onLine =
          (gx < gridW / 2 || cell - gx < gridW / 2 || gy < gridW / 2 || cell - gy < gridW / 2) &&
          !onBorder;
        if (onBorder) {
          r = g = b = 255;
        } else if (onLine) {
          r = Math.round(r + (255 - r) * 0.45);
          g = Math.round(g + (255 - g) * 0.45);
          b = Math.round(b + (255 - b) * 0.45);
        }
      }
      // blocky "UI" wordmark centred over the grid
      const bx = size * 0.30;
      const by = size * 0.355;
      const bw = size * 0.40;
      const bh = size * 0.29;
      if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
        const u = (x - bx) / bw; // 0..1 across the glyph box
        const v = (y - by) / bh;
        const inU =
          (u <= 0.16 && v <= 1) || // U left bar
          (u >= 0.44 && u <= 0.6) || // U right bar
          (u <= 0.6 && v >= 0.8); // U bottom bar
        const inI = u >= 0.84; // I bar
        if (inU || inI) {
          r = g = b = 255;
        }
      }
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = 255;
    }
  }
  return encodePng(size, px);
}

for (const size of [192, 512]) {
  writeFileSync(join(here, '../public', `icon-${size}.png`), drawIcon(size));
  console.log(`wrote icon-${size}.png`);
}
