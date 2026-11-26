/**
 * Reading the printed sheets back (scripts/print-poster.ts, which stops a
 * run on what these find, and tests/printPoster.test.ts, which reads the
 * committed files): the QR codes of a PNG preview, decoded with jsQR, and
 * the pages of a PDF with their sizes.
 */
import jsQR from 'jsqr';
import { PNG } from 'pngjs';

/** a code read back: its text, its version (a code of version v is 17 + 4v modules across) and how wide it is in the picture, in pixels, from the outer edge of one finder pattern to the other's */
export interface CodeRead {
  data: string;
  version: number;
  modules: number;
  widthPx: number;
}

/**
 * The codes a preview holds, read back: one per strip, the picture cut
 * into `codes` strips side by side (the sheet of two flyers has one code
 * in each half); null for a strip where none reads
 */
export function readCodes(png: Uint8Array, codes = 1): (CodeRead | null)[] {
  const img = PNG.sync.read(png);
  const out: (CodeRead | null)[] = [];
  const strip = Math.floor(img.width / codes);
  for (let i = 0; i < codes; i++) {
    const data = new Uint8ClampedArray(strip * img.height * 4);
    for (let y = 0; y < img.height; y++) {
      const from = (y * img.width + i * strip) * 4;
      data.set(img.data.subarray(from, from + strip * 4), y * strip * 4);
    }
    const code = jsQR(data, strip, img.height, { inversionAttempts: 'dontInvert' });
    if (!code) {
      out.push(null);
      continue;
    }
    const { topLeftCorner: a, topRightCorner: b } = code.location;
    out.push({ data: code.data, version: code.version, modules: 17 + 4 * code.version, widthPx: Math.hypot(b.x - a.x, b.y - a.y) });
  }
  return out;
}

/** a PNG's size in pixels */
export function pngSize(png: Uint8Array): [number, number] {
  const img = PNG.sync.read(png);
  return [img.width, img.height];
}

/** a PDF's pages and the size of each in points, as their MediaBox says */
export function pdfPages(pdf: Uint8Array): [number, number][] {
  let text = '';
  for (const byte of pdf) text += String.fromCharCode(byte);
  return [...text.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map((m) => [Number(m[1]), Number(m[2])]);
}
