/**
 * The QR code of an address, drawn two ways, for scripts/print-poster.ts
 * and for tests/printPoster.test.ts, which redraws it to check the
 * committed files: as SVG, on the sheets and as the code alone
 * (advent-qr.<lang>.svg), and as a PNG at 600 dots to the inch for a
 * layout program that takes no SVG (advent-qr.<lang>.png). Black modules
 * on white, with the quiet zone of four modules the standard asks for, and
 * error correction Q (a quarter of the code can be lost), for a poster
 * that gets creased, dirty or lit badly.
 */
import { crc32 } from 'node:zlib';
import QRCode from 'qrcode';
import { PNG } from 'pngjs';

/** the white border around the code, in modules, that a reader needs to find it */
export const QUIET = 4;

/** the code's modules, row by row, true for a dark one, without the quiet zone */
export function qrModules(text: string): boolean[][] {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'Q' });
  const n: number = qr.modules.size;
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => !!qr.modules.get(r, c)));
}

/**
 * The code as SVG, its quiet zone included, each row's runs of dark
 * modules as one rectangle. With `sizeMm` the SVG says its printed width,
 * so a layout program places it at that size.
 */
export function qrSvg(text: string, sizeMm?: number): { svg: string; modules: number } {
  const grid = qrModules(text);
  const n = grid.length;
  const size = n + 2 * QUIET;
  let d = '';
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!grid[r][c]) {
        c++;
        continue;
      }
      let run = 1;
      while (c + run < n && grid[r][c + run]) run++;
      d += `M${c + QUIET},${r + QUIET}h${run}v1h-${run}z`;
      c += run;
    }
  }
  const measure = sizeMm ? ` width="${sizeMm}mm" height="${sizeMm}mm"` : '';
  return {
    svg: `<svg class="qr"${measure} viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${text}"><rect width="${size}" height="${size}" fill="#ffffff"/><path d="${d}" fill="#000000"/></svg>`,
    modules: n
  };
}

/** PNG's pixels per metre at a number of dots to the inch, as its pHYs chunk keeps them */
const perMetre = (dpi: number) => Math.round(dpi / 0.0254);

/**
 * The code as a black-and-white PNG, its quiet zone included, each module
 * a whole number of pixels so it stays sharp, about `sizeMm` wide at `dpi`
 * dots to the inch; the PNG says its resolution (a pHYs chunk), so Word,
 * Publisher or InDesign place it at that size
 */
export function qrPng(text: string, sizeMm: number, dpi = 600): { png: Buffer; px: number; mm: number } {
  const grid = qrModules(text);
  const n = grid.length;
  const size = n + 2 * QUIET;
  const scale = Math.max(1, Math.round((sizeMm / 25.4) * dpi / size));
  const px = size * scale;
  const img = new PNG({ width: px, height: px, colorType: 0, inputColorType: 0, bitDepth: 8, inputHasAlpha: false });
  const data = Buffer.alloc(px * px, 0xff);
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (!grid[r][c]) continue;
      for (let y = 0; y < scale; y++) data.fill(0x00, ((r + QUIET) * scale + y) * px + (c + QUIET) * scale, ((r + QUIET) * scale + y) * px + (c + QUIET + 1) * scale);
    }
  img.data = data;
  const plain = PNG.sync.write(img, { colorType: 0, inputColorType: 0, bitDepth: 8, inputHasAlpha: false });
  return { png: withResolution(plain, dpi), px, mm: (px / dpi) * 25.4 };
}

/** a PNG with a pHYs chunk after its header: its pixels per metre, the same both ways */
function withResolution(png: Buffer, dpi: number): Buffer {
  const body = Buffer.alloc(9);
  body.writeUInt32BE(perMetre(dpi), 0);
  body.writeUInt32BE(perMetre(dpi), 4);
  body.writeUInt8(1, 8);
  const type = Buffer.from('pHYs', 'latin1');
  const chunk = Buffer.alloc(4 + 4 + 9 + 4);
  chunk.writeUInt32BE(9, 0);
  type.copy(chunk, 4);
  body.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([type, body])) >>> 0, 17);
  // the signature (8 bytes), then IHDR: its length, type, 13 bytes and CRC
  const afterHeader = 8 + 4 + 4 + 13 + 4;
  return Buffer.concat([png.subarray(0, afterHeader), chunk, png.subarray(afterHeader)]);
}
