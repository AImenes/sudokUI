/**
 * Reading a sudoku out of a photo: the browser half. Decodes the photo,
 * renders the printed-digit templates once (digits 1 to 9 in a few common
 * fonts, drawn on a canvas and normalised exactly like a cell's blob), and
 * hands the pixels to the numeric pipeline in image.ts. A native app can
 * feed scanImage any Blob a camera plugin gives it.
 */
import { Gray, Template, NORM, toGray, normalise, scanGray, adaptiveInk, gridCandidates, gridness, warp, homography, gridLines, eraseLines, cellBlob, matchDigit, findGrid, trackLines, cellBox } from './image';

export interface ScanResult {
  /** 81 characters, dots for empty cells */
  puzzle: string;
  digits: number[];
  /** cells the scanner is unsure about, to be checked by eye */
  doubts: number[];
  /** the grid as the scanner saw it, upright, as a data URL */
  preview: string;
  foundGrid: boolean;
  conflicts: number;
}

const FONTS = ['Helvetica, Arial, sans-serif', 'Georgia, "Times New Roman", serif', 'Verdana, sans-serif', '"Courier New", monospace', 'system-ui, sans-serif'];
const WEIGHTS = ['normal', 'bold'];
/** the long side the photo is scaled to before reading */
const MAX_SIDE = 900;

let templates: Template[] | null = null;

/** digits 1 to 9 rendered in each font, normalised like a cell's blob */
export function digitTemplates(): Template[] {
  if (templates) return templates;
  const S = 64;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const out: Template[] = [];
  for (const font of FONTS) {
    for (const weight of WEIGHTS) {
      for (let digit = 1; digit <= 9; digit++) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, S, S);
        ctx.fillStyle = '#000';
        ctx.font = `${weight} 46px ${font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(digit), S / 2, S / 2 + 2);
        const px = ctx.getImageData(0, 0, S, S).data;
        const ink = new Uint8Array(S * S);
        let x0 = S, x1 = -1, y0 = S, y1 = -1;
        for (let i = 0; i < S * S; i++) {
          if (px[i * 4] < 128) {
            ink[i] = 1;
            const x = i % S;
            const y = (i - x) / S;
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
        if (x1 < 0) continue;
        out.push({ digit, vec: normalise(ink, S, x0, y0, x1 - x0 + 1, y1 - y0 + 1), aspect: (x1 - x0 + 1) / (y1 - y0 + 1) });
      }
    }
  }
  templates = out;
  return out;
}

async function decode(blob: Blob): Promise<HTMLImageElement | ImageBitmap> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {
      /* fall through to an <img> */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file is not an image the browser can read.'));
    };
    img.src = url;
  });
}

/** the photo as grey pixels, scaled down to a size the pipeline reads quickly */
export async function grayFromBlob(blob: Blob): Promise<Gray> {
  const img = await decode(blob);
  const w0 = 'naturalWidth' in img ? img.naturalWidth : img.width;
  const h0 = 'naturalHeight' in img ? img.naturalHeight : img.height;
  const k = Math.min(1, MAX_SIDE / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * k));
  const h = Math.max(1, Math.round(h0 * k));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  if ('close' in img) img.close();
  return toGray(ctx.getImageData(0, 0, w, h).data, w, h);
}

function previewOf(g: Gray): string {
  const S = g.width;
  const canvas = document.createElement('canvas');
  const half = S / 2;
  canvas.width = half;
  canvas.height = half;
  const ctx = canvas.getContext('2d')!;
  const im = ctx.createImageData(half, half);
  for (let y = 0; y < half; y++) {
    for (let x = 0; x < half; x++) {
      const v = g.data[y * 2 * S + x * 2];
      const i = (y * half + x) * 4;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
      im.data[i + 3] = 255;
    }
  }
  ctx.putImageData(im, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.7);
}

export async function scanImage(blob: Blob): Promise<ScanResult> {
  const g = await grayFromBlob(blob);
  const { reading, warped, quad } = scanGray(g, digitTemplates());
  return {
    puzzle: reading.digits.map((d) => (d ? String(d) : '.')).join(''),
    digits: reading.digits,
    doubts: reading.doubts,
    preview: previewOf(warped),
    foundGrid: !!quad,
    conflicts: reading.conflicts
  };
}

/** one frame of a live camera, as a JPEG */
export function captureFrame(video: HTMLVideoElement): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The camera gave no picture.'))), 'image/jpeg', 0.92)
  );
}

/** everything the pipeline saw, for tuning against a real photo */
export async function scanDebug(blob: Blob, cells: number[] = []) {
  const g = await grayFromBlob(blob);
  const ink = adaptiveInk(g);
  const candidates = gridCandidates(ink, g.width, g.height).map((c) => ({
    corners: c.corners,
    size: c.size,
    gridness: gridness(warp(g, homography(c.corners, 270), 270))
  }));
  const quad = findGrid(ink, g.width, g.height, g);
  const corners = quad
    ? quad.corners
    : ([{ x: 0, y: 0 }, { x: g.width - 1, y: 0 }, { x: g.width - 1, y: g.height - 1 }, { x: 0, y: g.height - 1 }] as const);
  const warped = warp(g, homography(corners as never));
  const lines = gridLines(warped);
  const tracked = trackLines(warped, lines);
  const clean = eraseLines(warped, tracked, lines);
  const dumps: Record<number, string> = {};
  for (const cell of cells) {
    const b = cellBlob(clean, cellBox(tracked, Math.floor(cell / 9), cell % 9));
    if (!b) {
      dumps[cell] = 'null';
      continue;
    }
    let nan = 0;
    for (const v of b.vec) if (!Number.isFinite(v)) nan++;
    let head = `aspect ${b.aspect} nan ${nan}`;
    try {
      head += ' ' + JSON.stringify(matchDigit(b, digitTemplates()));
    } catch (e) {
      head += ' match failed: ' + String(e);
    }
    let t = `${head}\n`;
    for (let y = 0; y < NORM; y++) {
      for (let x = 0; x < NORM; x++) t += b.vec[y * NORM + x] > 0.5 ? '#' : b.vec[y * NORM + x] > 0.15 ? '+' : '.';
      t += '\n';
    }
    dumps[cell] = t;
  }
  let reading: unknown = null;
  let error = '';
  try {
    reading = scanGray(g, digitTemplates()).reading;
  } catch (e) {
    error = String(e);
  }
  return { width: g.width, height: g.height, quad, candidates, reading, lines, dumps, error, preview: previewOf(warped) };
}

if (typeof window !== 'undefined') (window as unknown as { __sudokuiScan?: unknown }).__sudokuiScan = { scanImage, scanDebug, digitTemplates, grayFromBlob };

export { NORM };
