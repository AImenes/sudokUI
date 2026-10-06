/**
 * Reading a sudoku out of a photo: the numeric half, on plain typed arrays
 * with no DOM, so it can be tested in node and fed from any camera (the
 * browser's file input or getUserMedia today, a native plugin in an app).
 *
 * The pipeline (docs/scan.md): grey, adaptive threshold to ink, the grid
 * as the largest square-ish component of ink, its four corners, a
 * perspective warp to a square, 81 cell crops, each cell's blob
 * normalised and matched against printed-digit templates. Every rotation
 * and mirror image of the warped grid is read, and the one whose digits
 * match best and conflict least wins, so a photo taken upside down, or
 * through a mirroring front camera, still reads.
 */

export interface Gray {
  width: number;
  height: number;
  data: Float32Array; // 0 (black) .. 255 (white)
}

export interface Point {
  x: number;
  y: number;
}

/** the side of the warped grid, and of one cell */
export const GRID = 450;
export const CELL = 50;
/** the side of a normalised digit image */
export const NORM = 24;

export function toGray(rgba: Uint8ClampedArray, width: number, height: number): Gray {
  const data = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i++, p += 4) {
    data[i] = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
  }
  return { width, height, data };
}

/** ink = darker than the local mean by `offset`; the window scales with the image */
export function adaptiveInk(g: Gray, offset = 12, window?: number): Uint8Array {
  const { width: w, height: h, data } = g;
  const win = window ?? Math.max(7, Math.round(Math.min(w, h) / 24) | 1);
  const r = win >> 1;
  // integral image, one row and column of padding
  const W = w + 1;
  const integral = new Float64Array(W * (h + 1));
  for (let y = 1; y <= h; y++) {
    let row = 0;
    for (let x = 1; x <= w; x++) {
      row += data[(y - 1) * w + (x - 1)];
      integral[y * W + x] = integral[(y - 1) * W + x] + row;
    }
  }
  const ink = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      const sum = integral[y1 * W + x1] - integral[y0 * W + x1] - integral[y1 * W + x0] + integral[y0 * W + x0];
      const mean = sum / ((y1 - y0) * (x1 - x0));
      if (data[y * w + x] < mean - offset) ink[y * w + x] = 1;
    }
  }
  return ink;
}

export interface Quad {
  corners: [Point, Point, Point, Point]; // top-left, top-right, bottom-right, bottom-left
  /** ink pixels in the component */
  size: number;
}

/**
 * The grid: the ink component whose bounding box is big, roughly square
 * and mostly empty inside (lines, not a photo). Its corners are the
 * component's extreme pixels along the two diagonals.
 */
export function findGrid(ink: Uint8Array, width: number, height: number): Quad | null {
  const labels = new Int32Array(width * height);
  const stack = new Int32Array(width * height);
  let best: Quad | null = null;
  let bestScore = 0;
  let label = 0;
  const minSide = Math.min(width, height);
  for (let start = 0; start < ink.length; start++) {
    if (!ink[start] || labels[start]) continue;
    label++;
    let top = 0;
    labels[start] = label;
    stack[top++] = start;
    let size = 0;
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let tl = start, tr = start, br = start, bl = start;
    let tlV = Infinity, trV = -Infinity, brV = -Infinity, blV = Infinity;
    while (top > 0) {
      const i = stack[--top];
      size++;
      const x = i % width;
      const y = (i - x) / width;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const s = x + y;
      const d = x - y;
      if (s < tlV) { tlV = s; tl = i; }
      if (s > brV) { brV = s; br = i; }
      if (d > trV) { trV = d; tr = i; }
      if (d < blV) { blV = d; bl = i; }
      // 4-neighbours
      if (x > 0 && ink[i - 1] && !labels[i - 1]) { labels[i - 1] = label; stack[top++] = i - 1; }
      if (x < width - 1 && ink[i + 1] && !labels[i + 1]) { labels[i + 1] = label; stack[top++] = i + 1; }
      if (y > 0 && ink[i - width] && !labels[i - width]) { labels[i - width] = label; stack[top++] = i - width; }
      if (y < height - 1 && ink[i + width] && !labels[i + width]) { labels[i + width] = label; stack[top++] = i + width; }
    }
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    if (Math.min(bw, bh) < minSide * 0.3) continue;
    const squareness = Math.min(bw, bh) / Math.max(bw, bh);
    if (squareness < 0.55) continue;
    const fill = size / (bw * bh);
    if (fill > 0.5) continue; // a dark block, not a grid of lines
    const score = bw * bh * squareness;
    if (score > bestScore) {
      bestScore = score;
      const pt = (i: number): Point => ({ x: i % width, y: Math.floor(i / width) });
      best = { corners: [pt(tl), pt(tr), pt(br), pt(bl)], size };
    }
  }
  return best;
}

/** Solve A x = b for an n×n system by Gaussian elimination with pivoting. */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / d;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / (row[i] || 1e-12));
}

/**
 * The homography that maps the unit square's corners (0,0) (S,0) (S,S)
 * (0,S) onto the four source corners, as the 3×3 matrix h0..h8 (h8 = 1).
 */
export function homography(corners: Quad['corners'], S = GRID): number[] {
  const dst = [
    { x: 0, y: 0 },
    { x: S, y: 0 },
    { x: S, y: S },
    { x: 0, y: S }
  ];
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = dst[i];
    const { x: u, y: v } = corners[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  return [...solve(A, b), 1];
}

/** Sample the source through the homography into an S×S grey square. */
export function warp(g: Gray, H: number[], S = GRID): Gray {
  const out = new Float32Array(S * S);
  const { width: w, height: h, data } = g;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const den = H[6] * x + H[7] * y + 1;
      const u = (H[0] * x + H[1] * y + H[2]) / den;
      const v = (H[3] * x + H[4] * y + H[5]) / den;
      const x0 = Math.floor(u);
      const y0 = Math.floor(v);
      if (x0 < 0 || y0 < 0 || x0 >= w - 1 || y0 >= h - 1) {
        out[y * S + x] = 255;
        continue;
      }
      const fx = u - x0;
      const fy = v - y0;
      const i = y0 * w + x0;
      out[y * S + x] =
        data[i] * (1 - fx) * (1 - fy) + data[i + 1] * fx * (1 - fy) + data[i + w] * (1 - fx) * fy + data[i + w + 1] * fx * fy;
    }
  }
  return { width: S, height: S, data: out };
}

/** the eight symmetries of a square: k = rotation quarter turns (0..3), plus 4 for a mirror first */
export function dihedral(g: Gray, k: number): Gray {
  const S = g.width;
  const out = new Float32Array(S * S);
  const mirror = k >= 4;
  const rot = k % 4;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let sx = x;
      const sy = y;
      if (mirror) sx = S - 1 - x;
      // rotate the (sx, sy) sample point clockwise `rot` times
      let rx = sx;
      let ry = sy;
      for (let r = 0; r < rot; r++) {
        const nx = S - 1 - ry;
        const ny = rx;
        rx = nx;
        ry = ny;
      }
      out[y * S + x] = g.data[ry * S + rx];
    }
  }
  return { width: S, height: S, data: out };
}

/**
 * The digit's ink inside one cell, as a NORM×NORM image: a margin keeps
 * the grid lines out, ink touching the border is dropped (a line that
 * leaked in), the blob is cropped to its box, scaled to fit and centred.
 * Null for an empty cell.
 */
export function cellBlob(g: Gray, row: number, col: number): Float32Array | null {
  const m = 8; // margin inside the cell
  const n = CELL - 2 * m;
  const S = g.width;
  const vals = new Float32Array(n * n);
  let min = 255, max = 0, sum = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const v = g.data[(row * CELL + m + y) * S + col * CELL + m + x];
      vals[y * n + x] = v;
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
    }
  }
  const mean = sum / (n * n);
  if (mean - min < 45) return null; // no real contrast: empty
  const t = mean - 0.4 * (mean - min);
  const ink = new Uint8Array(n * n);
  for (let i = 0; i < ink.length; i++) if (vals[i] < t) ink[i] = 1;
  // drop ink connected to the border
  const stack: number[] = [];
  for (let i = 0; i < n * n; i++) {
    const x = i % n;
    const y = (i - x) / n;
    if (ink[i] && (x === 0 || y === 0 || x === n - 1 || y === n - 1)) stack.push(i);
  }
  while (stack.length) {
    const i = stack.pop()!;
    if (!ink[i]) continue;
    ink[i] = 0;
    const x = i % n;
    if (x > 0) stack.push(i - 1);
    if (x < n - 1) stack.push(i + 1);
    if (i >= n) stack.push(i - n);
    if (i < n * (n - 1)) stack.push(i + n);
  }
  let count = 0;
  let x0 = n, x1 = -1, y0 = n, y1 = -1;
  for (let i = 0; i < n * n; i++) {
    if (!ink[i]) continue;
    count++;
    const x = i % n;
    const y = (i - x) / n;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  if (count < 14 || bh < n * 0.3 || bw < 3) return null; // a speck, or nothing
  return normalise(ink, n, x0, y0, bw, bh);
}

/** crop a box of a binary image, fit it into NORM-4, centre it in NORM×NORM, and blur a little */
export function normalise(ink: Uint8Array, stride: number, x0: number, y0: number, bw: number, bh: number): Float32Array {
  const fit = NORM - 4;
  const scale = fit / Math.max(bw, bh);
  const tw = Math.max(1, Math.round(bw * scale));
  const th = Math.max(1, Math.round(bh * scale));
  const ox = Math.floor((NORM - tw) / 2);
  const oy = Math.floor((NORM - th) / 2);
  const img = new Float32Array(NORM * NORM);
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      // area sample: the source box this target pixel covers
      const sx0 = x0 + Math.floor(x / scale);
      const sx1 = Math.min(x0 + bw - 1, x0 + Math.floor((x + 1) / scale));
      const sy0 = y0 + Math.floor(y / scale);
      const sy1 = Math.min(y0 + bh - 1, y0 + Math.floor((y + 1) / scale));
      let s = 0;
      let c = 0;
      for (let yy = sy0; yy <= sy1; yy++) for (let xx = sx0; xx <= sx1; xx++) { s += ink[yy * stride + xx]; c++; }
      img[(oy + y) * NORM + ox + x] = s / c;
    }
  }
  return blur(img, NORM);
}

function blur(img: Float32Array, S: number): Float32Array {
  const out = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let s = 0;
      let c = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= S || yy >= S) continue;
          s += img[yy * S + xx];
          c++;
        }
      }
      out[y * S + x] = s / c;
    }
  }
  return out;
}

export interface Template {
  digit: number;
  vec: Float32Array;
}

/** zero-mean normalised correlation */
export function correlation(a: Float32Array, b: Float32Array): number {
  let ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) { ma += a[i]; mb += b[i]; }
  ma /= a.length;
  mb /= b.length;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export interface Match {
  digit: number;
  /** the best correlation, and the gap to the best other digit */
  score: number;
  margin: number;
}

export function matchDigit(blob: Float32Array, templates: Template[]): Match {
  const best = new Map<number, number>();
  for (const t of templates) {
    const s = correlation(blob, t.vec);
    if (s > (best.get(t.digit) ?? -1)) best.set(t.digit, s);
  }
  const ranked = [...best.entries()].sort((a, b) => b[1] - a[1]);
  const [digit, score] = ranked[0];
  const margin = ranked.length > 1 ? score - ranked[1][1] : score;
  return { digit, score, margin };
}

export interface Reading {
  /** 81 digits, 0 for empty */
  digits: number[];
  /** the cells the scanner is unsure about */
  doubts: number[];
  /** the total match quality, for choosing among orientations */
  quality: number;
  /** duplicate digits within a house */
  conflicts: number;
  /** which symmetry of the warped grid this is */
  symmetry: number;
}

/** how many times a digit repeats inside one row, column or box */
export function countConflicts(digits: number[]): number {
  let n = 0;
  const units: number[][] = [];
  for (let i = 0; i < 9; i++) {
    units.push(Array.from({ length: 9 }, (_, k) => i * 9 + k));
    units.push(Array.from({ length: 9 }, (_, k) => k * 9 + i));
    const r0 = Math.floor(i / 3) * 3;
    const c0 = (i % 3) * 3;
    units.push(Array.from({ length: 9 }, (_, k) => (r0 + Math.floor(k / 3)) * 9 + c0 + (k % 3)));
  }
  for (const u of units) {
    const seen = new Set<number>();
    for (const c of u) {
      const d = digits[c];
      if (!d) continue;
      if (seen.has(d)) n++;
      seen.add(d);
    }
  }
  return n;
}

/** Read every cell of a warped grid under one symmetry. */
export function readGrid(warped: Gray, templates: Template[], symmetry: number): Reading {
  const g = symmetry ? dihedral(warped, symmetry) : warped;
  const digits: number[] = [];
  const doubts: number[] = [];
  let quality = 0;
  for (let cell = 0; cell < 81; cell++) {
    const blob = cellBlob(g, Math.floor(cell / 9), cell % 9);
    if (!blob) {
      digits.push(0);
      continue;
    }
    const m = matchDigit(blob, templates);
    if (m.score < 0.35) {
      // ink that is no digit we know: left empty, but flagged
      digits.push(0);
      doubts.push(cell);
      continue;
    }
    digits.push(m.digit);
    quality += m.score;
    if (m.score < 0.6 || m.margin < 0.06) doubts.push(cell);
  }
  return { digits, doubts, quality, conflicts: countConflicts(digits), symmetry };
}

/** Read all eight symmetries and keep the one that reads best. */
export function readBest(warped: Gray, templates: Template[]): Reading {
  let best: Reading | null = null;
  for (let k = 0; k < 8; k++) {
    const r = readGrid(warped, templates, k);
    const value = r.quality - 0.7 * r.conflicts;
    if (!best || value > best.quality - 0.7 * best.conflicts) best = r;
  }
  return best!;
}

/** The whole numeric pipeline, from grey pixels to a reading. */
export function scanGray(g: Gray, templates: Template[]): { reading: Reading; warped: Gray; quad: Quad | null } {
  const ink = adaptiveInk(g);
  const quad = findGrid(ink, g.width, g.height);
  const corners: Quad['corners'] = quad
    ? quad.corners
    : [
        { x: 0, y: 0 },
        { x: g.width - 1, y: 0 },
        { x: g.width - 1, y: g.height - 1 },
        { x: 0, y: g.height - 1 }
      ];
  const warped = warp(g, homography(corners));
  const reading = readBest(warped, templates);
  return { reading, warped: reading.symmetry ? dihedral(warped, reading.symmetry) : warped, quad };
}
