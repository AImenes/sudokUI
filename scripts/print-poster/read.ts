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

/** the resolution a PNG says it has, in dots to the inch, from its pHYs chunk; null when it says none */
export function pngDpi(png: Uint8Array): number | null {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const type = (at: number) => String.fromCharCode(...png.subarray(at, at + 4));
  // past the signature, chunk by chunk: its length, its type, its data and a CRC
  for (let at = 8; at + 8 <= png.length; at += 12 + view.getUint32(at)) {
    if (type(at + 4) === 'pHYs' && view.getUint8(at + 16) === 1) return Math.round(view.getUint32(at + 8) * 0.0254);
    if (type(at + 4) === 'IDAT') return null;
  }
  return null;
}

/** the width an SVG says it prints at, in millimetres; null when it says none */
export function svgWidthMm(svg: string): number | null {
  const m = /^<svg[^>]*\swidth="([\d.]+)mm"/.exec(svg);
  return m ? Number(m[1]) : null;
}

/**
 * The modules an SVG code draws, quiet zone included, as rows of true for
 * dark: its viewBox is one unit a module, and its path is rectangles of
 * whole modules (scripts/print-poster/qr.ts, qrSvg)
 */
export function svgModules(svg: string): boolean[][] {
  const size = Number(/viewBox="0 0 (\d+) \d+"/.exec(svg)?.[1] ?? 0);
  const grid = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  for (const [, x, y, w] of svg.matchAll(/M(\d+),(\d+)h(\d+)v1h-\d+z/g))
    for (let c = Number(x); c < Number(x) + Number(w); c++) grid[Number(y)][c] = true;
  return grid;
}

/** the modules of a PNG code drawn a whole number of pixels to a module, `size` modules across with its quiet zone: each module's middle pixel, dark or not */
export function pngModules(png: Uint8Array, size: number): boolean[][] {
  const img = PNG.sync.read(png);
  const step = img.width / size;
  return Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => {
      const at = (Math.floor((r + 0.5) * step) * img.width + Math.floor((c + 0.5) * step)) * 4;
      return img.data[at] < 128;
    })
  );
}
