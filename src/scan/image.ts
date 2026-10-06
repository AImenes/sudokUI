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
export function gridCandidates(ink: Uint8Array, width: number, height: number, keep = 6): Quad[] {
  const labels = new Int32Array(width * height);
  const stack = new Int32Array(width * height);
  const found: { quad: Quad; score: number; label: number; box: { minX: number; maxX: number; minY: number; maxY: number } }[] = [];
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
    const pt = (i: number): Point => ({ x: i % width, y: Math.floor(i / width) });
    found.push({ quad: { corners: [pt(tl), pt(tr), pt(br), pt(bl)], size }, score, label, box: { minX, maxX, minY, maxY } });
  }
  const best = found.sort((a, b) => b.score - a.score).slice(0, keep);
  // a second corner estimate per component: its outline as a convex hull,
  // cut down to four corners. The diagonal extremes above drift on a
  // curved or shadowed edge; the hull drifts when something touches the
  // grid (a caption, a bleed). Both go in, and the gridness score decides.
  const out: Quad[] = [];
  for (const f of best) {
    const pts: Point[] = [];
    for (let y = f.box.minY; y <= f.box.maxY; y++) {
      for (let x = f.box.minX; x <= f.box.maxX; x++) {
        const i = y * width + x;
        if (labels[i] !== f.label) continue;
        if (x === 0 || y === 0 || x === width - 1 || y === height - 1 || !ink[i - 1] || !ink[i + 1] || !ink[i - width] || !ink[i + width]) {
          pts.push({ x, y });
        }
      }
    }
    out.push(f.quad);
    const quad = hullCorners(pts);
    if (quad && quad.some((c, k) => Math.abs(c.x - f.quad.corners[k].x) + Math.abs(c.y - f.quad.corners[k].y) > 3)) {
      out.push({ corners: quad, size: f.quad.size });
    }
  }
  return out;
}

/** the convex hull (monotone chain), then the four corners that keep most of its area */
export function hullCorners(pts: Point[]): Quad['corners'] | null {
  if (pts.length < 4) return null;
  const sorted = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  let hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  if (hull.length < 4) return null;
  // drop, one at a time, the vertex whose removal loses the least area
  while (hull.length > 4) {
    let worst = 0;
    let least = Infinity;
    for (let i = 0; i < hull.length; i++) {
      const a = hull[(i + hull.length - 1) % hull.length];
      const b = hull[i];
      const c = hull[(i + 1) % hull.length];
      const lost = Math.abs(cross(a, b, c)) / 2;
      if (lost < least) {
        least = lost;
        worst = i;
      }
    }
    hull.splice(worst, 1);
  }
  // in order round the centre, starting top-left
  const cx = hull.reduce((a, p) => a + p.x, 0) / 4;
  const cy = hull.reduce((a, p) => a + p.y, 0) / 4;
  hull = hull.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  let start = 0;
  for (let i = 1; i < 4; i++) if (hull[i].x + hull[i].y < hull[start].x + hull[start].y) start = i;
  const out = [0, 1, 2, 3].map((k) => hull[(start + k) % 4]);
  return [out[0], out[1], out[2], out[3]];
}

/**
 * How much a warped square looks like a sudoku grid: ink along the ten
 * line positions in each direction, against ink elsewhere. A table edge
 * or a loudspeaker's rim is large, square-ish and mostly empty too; this
 * tells them apart.
 */
export function gridness(warped: Gray): number {
  const S = warped.width;
  const ink = adaptiveInk(warped, 10, 15);
  // along the lines where they really are, so a curved page still counts
  const { xs, ys } = gridLines(warped, ink);
  let onLines = 0;
  let onCount = 0;
  let all = 0;
  for (let i = 0; i < ink.length; i++) all += ink[i];
  for (let k = 0; k <= 9; k++) {
    for (let t = 0; t < S; t++) {
      for (let d = -1; d <= 1; d++) {
        const x = Math.min(S - 1, Math.max(0, xs[k] + d));
        const y = Math.min(S - 1, Math.max(0, ys[k] + d));
        onLines += ink[t * S + x] + ink[y * S + t];
        onCount += 2;
      }
    }
  }
  return onLines / onCount - all / ink.length;
}

/** The grid: the candidate that, warped, shows the most grid lines. */
export function findGrid(ink: Uint8Array, width: number, height: number, g?: Gray): Quad | null {
  return findGrids(ink, width, height, g)[0] ?? null;
}

/**
 * The plausible grids, best first: every candidate quad that looks like a
 * grid once warped (gridness above 0.035), ranked by gridness, at most
 * `keep` of them. Without the grey image the candidates come back as found.
 */
export function findGrids(ink: Uint8Array, width: number, height: number, g?: Gray, keep = 3): Quad[] {
  const candidates = gridCandidates(ink, width, height);
  if (!g) return candidates.slice(0, keep);
  const scored: { quad: Quad; score: number }[] = [];
  for (const quad of candidates) {
    const score = gridness(warp(g, homography(quad.corners, 270), 270));
    if (score > 0.035) scored.push({ quad, score }); // less than this is no grid
  }
  scored.sort((a, b) => b.score - a.score);
  // only quads nearly as grid-like as the best are worth a full reading
  return scored.filter((s) => s.score >= scored[0].score * 0.5).slice(0, keep).map((s) => s.quad);
}

/**
 * Where the lines really are inside the warped grid: the ten peaks of the
 * ink profile in each direction, each sought near its expected place, so
 * a page that curves or a corner found a little off still reads cell by
 * cell. Returns the ten x positions and the ten y positions.
 */
export function gridLines(warped: Gray, inkGiven?: Uint8Array): { xs: number[]; ys: number[] } {
  const S = warped.width;
  const ink = inkGiven ?? adaptiveInk(warped, 10, 15);
  const cols = new Float32Array(S);
  const rows = new Float32Array(S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const v = ink[y * S + x];
      cols[x] += v;
      rows[y] += v;
    }
  }
  const peaks = (profile: Float32Array): number[] => {
    const step = S / 9;
    const smooth = (x: number) => (profile[x] ?? 0) + (profile[x - 1] ?? 0) + (profile[x + 1] ?? 0);
    const seek = (expect: number, reach: number): number => {
      let best = expect;
      let bestV = -1;
      for (let d = -reach; d <= reach; d++) {
        const x = expect + d;
        if (x < 0 || x >= S) continue;
        // nearer the expected place preferred when equal
        const v = smooth(x) * (1 - Math.abs(d) / (reach * 6 + 1));
        if (v > bestV) {
          bestV = v;
          best = x;
        }
      }
      return best;
    };
    // the four box lines are thick and unmistakable: find them first
    const box = [0, 3, 6, 9].map((k) => seek(Math.round(k * step), Math.round(step * (k === 0 || k === 9 ? 0.12 : 0.3))));
    for (let i = 1; i < 4; i++) if (box[i] < box[i - 1] + step * 2) box[i] = Math.round(box[i - 1] + step * 3);
    // the thin lines sit a third of the way between them, give or take a few pixels
    const out: number[] = [];
    for (let b = 0; b < 3; b++) {
      const from = box[b];
      const to = box[b + 1];
      out.push(from);
      for (let j = 1; j <= 2; j++) out.push(seek(Math.round(from + ((to - from) * j) / 3), Math.round(step * 0.1)));
    }
    out.push(box[3]);
    for (let k = 1; k <= 9; k++) if (out[k] < out[k - 1] + step * 0.6) out[k] = Math.round(out[k - 1] + step * 0.8);
    return out;
  };
  return { xs: peaks(cols), ys: peaks(rows) };
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

export interface Tracked {
  /** vx[k][strip]: the x of vertical line k in row strip `strip` */
  vx: number[][];
  /** hy[k][strip]: the y of horizontal line k in column strip `strip` */
  hy: number[][];
}

/**
 * Each line followed strip by strip (one strip per cell), so a page that
 * curves is still cut along its lines. A line moves only where a column
 * (or row) of ink runs almost the whole strip; a digit's stroke does not.
 */
export function trackLines(g: Gray, lines: { xs: number[]; ys: number[] }): Tracked {
  const S = g.width;
  const ink = adaptiveInk(g, 10, 15);
  const reach = 8;
  const follow = (base: number, strips: number[], vertical: boolean): number[] => {
    const out: number[] = [];
    let at = base;
    for (let strip = 0; strip < 9; strip++) {
      const a = strips[strip];
      const b = strips[strip + 1];
      let best = at;
      let bestV = -1;
      for (let d = -reach; d <= reach; d++) {
        const p = base + d;
        if (p < 0 || p >= S) continue;
        let v = 0;
        for (let t = a; t < b; t++) v += vertical ? ink[t * S + p] : ink[p * S + t];
        v *= 1 - Math.abs(p - at) / (reach * 8);
        if (v > bestV) {
          bestV = v;
          best = p;
        }
      }
      if (bestV >= (b - a) * 0.8) at = best;
      out.push(at);
    }
    return out;
  };
  return {
    vx: lines.xs.map((x) => follow(x, lines.ys, true)),
    hy: lines.ys.map((y) => follow(y, lines.xs, false))
  };
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** the cell's box, between the lines as tracked for its row and column */
export function cellBox(tracked: Tracked, row: number, col: number): Box {
  return { x0: tracked.vx[col][row], x1: tracked.vx[col + 1][row], y0: tracked.hy[row][col], y1: tracked.hy[row + 1][col] };
}

/** The grid lines painted over with page colour along their tracked positions. */
export function eraseLines(g: Gray, tracked: Tracked, lines: { xs: number[]; ys: number[] }, half = 4): Gray {
  const S = g.width;
  const data = new Float32Array(g.data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  const page = Math.min(255, sum / data.length + 20);
  tracked.vx.forEach((positions, k) => {
    const h = k % 3 === 0 ? half : half - 1;
    positions.forEach((x0, strip) => {
      for (let d = -h; d <= h; d++) {
        const x = x0 + d;
        if (x < 0 || x >= S) continue;
        for (let y = lines.ys[strip]; y < lines.ys[strip + 1]; y++) data[y * S + x] = page;
      }
    });
  });
  tracked.hy.forEach((positions, k) => {
    const h = k % 3 === 0 ? half : half - 1;
    positions.forEach((y0, strip) => {
      for (let d = -h; d <= h; d++) {
        const y = y0 + d;
        if (y < 0 || y >= S) continue;
        for (let x = lines.xs[strip]; x < lines.xs[strip + 1]; x++) data[y * S + x] = page;
      }
    });
  });
  return { width: S, height: S, data };
}

/**
 * The digit's ink inside one cell, as a NORM×NORM image: a margin keeps
 * the grid lines out, ink touching the border is dropped (a line that
 * leaked in), the blob is cropped to its box, scaled to fit and centred.
 * Null for an empty cell.
 */
export interface Blob {
  vec: Float32Array;
  /** width over height of the ink box: a 1 is narrow, a 4 is not */
  aspect: number;
}

export function cellBlob(g: Gray, box: Box): Blob | null {
  const S = g.width;
  const { x0, x1, y0, y1 } = box;
  // a margin inside the cell keeps its lines out
  const mx = Math.round((x1 - x0) * 0.12);
  const my = Math.round((y1 - y0) * 0.12);
  const nw = x1 - x0 - 2 * mx;
  const nh = y1 - y0 - 2 * my;
  if (nw < 8 || nh < 8) return null;
  const n = nw; // row stride
  const vals = new Float32Array(nw * nh);
  let min = 255, max = 0, sum = 0;
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const v = g.data[(y0 + my + y) * S + x0 + mx + x];
      vals[y * n + x] = v;
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
    }
  }
  const mean = sum / (nw * nh);
  if (mean - min < 45) return null; // no real contrast: empty
  const t = mean - 0.4 * (mean - min);
  const ink = new Uint8Array(nw * nh);
  for (let i = 0; i < ink.length; i++) if (vals[i] < t) ink[i] = 1;
  // drop the line-shaped ink that touches the border (a grid line that
  // leaked in); a digit that touches the border is kept
  const seen = new Uint8Array(nw * nh);
  const stack: number[] = [];
  for (let start = 0; start < nw * nh; start++) {
    if (!ink[start] || seen[start]) continue;
    const members: number[] = [];
    let touches = false;
    let cx0 = nw, cx1 = -1, cy0 = nh, cy1 = -1;
    seen[start] = 1;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop()!;
      members.push(i);
      const x = i % n;
      const y = (i - x) / n;
      if (x === 0 || y === 0 || x === nw - 1 || y === nh - 1) touches = true;
      if (x < cx0) cx0 = x;
      if (x > cx1) cx1 = x;
      if (y < cy0) cy0 = y;
      if (y > cy1) cy1 = y;
      const next = [x > 0 ? i - 1 : -1, x < nw - 1 ? i + 1 : -1, y > 0 ? i - n : -1, y < nh - 1 ? i + n : -1];
      for (const j of next) {
        if (j >= 0 && ink[j] && !seen[j]) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    if (!touches) continue;
    const cw = cx1 - cx0 + 1;
    const ch = cy1 - cy0 + 1;
    const thin = cw < nw * 0.22 || ch < nh * 0.22;
    const small = members.length < 10;
    // a corner of two lines spans a box it barely fills; a digit fills its box
    const hollow = members.length / (cw * ch) < 0.13;
    if (thin || small || hollow) for (const i of members) ink[i] = 0;
  }
  let count = 0;
  let bx0 = nw, bx1 = -1, by0 = nh, by1 = -1;
  for (let i = 0; i < nw * nh; i++) {
    if (!ink[i]) continue;
    count++;
    const x = i % n;
    const y = (i - x) / n;
    if (x < bx0) bx0 = x;
    if (x > bx1) bx1 = x;
    if (y < by0) by0 = y;
    if (y > by1) by1 = y;
  }
  const bw = bx1 - bx0 + 1;
  const bh = by1 - by0 + 1;
  if (count < 10 || bh < nh * 0.3 || bw < 3) return null; // a speck, or nothing
  // a digit fills a fair share of its box and of the cell, and is never a
  // sliver; a stray mark or a line fragment is
  if (count / (bw * bh) < 0.2 || bw * bh < nw * nh * 0.06 || bw / bh < 0.25) return null;
  return { vec: normalise(ink, n, bx0, by0, bw, bh), aspect: bw / bh };
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
  aspect: number;
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

/**
 * Templates no font is needed for: the digit 1 as a bar, with and without
 * its flag, since 1 is the digit fonts draw most differently.
 */
export function barTemplates(): Template[] {
  const out: Template[] = [];
  const W = 12;
  const H = 40;
  for (const flag of [0, 4, 7]) {
    const ink = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = W - 6; x < W; x++) ink[y * W + x] = 1;
    for (let k = 0; k < flag; k++) {
      // a flag going down-left from the top
      const y = k + 1;
      for (let x = Math.max(0, W - 7 - k); x < W - 6; x++) ink[y * W + x] = 1;
    }
    const bw = flag ? W - Math.max(0, W - 7 - (flag - 1)) : 6;
    out.push({ digit: 1, vec: normalise(ink, W, W - bw, 0, bw, H), aspect: bw / H });
  }
  return out;
}

export interface Match {
  digit: number;
  /** the best correlation, and the gap to the best other digit */
  score: number;
  margin: number;
}

export function matchDigit(blob: Blob, templates: Template[]): Match {
  const best = new Map<number, number>();
  for (const t of templates) {
    // the shape, and a penalty for a different width: a narrow 1 is not a 4
    const s = correlation(blob.vec, t.vec) - 1.2 * Math.abs(blob.aspect - t.aspect);
    if (s > (best.get(t.digit) ?? -Infinity)) best.set(t.digit, s);
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
  const turned = symmetry ? dihedral(warped, symmetry) : warped;
  const lines = gridLines(turned);
  const tracked = trackLines(turned, lines);
  const g = eraseLines(turned, tracked, lines);
  const digits: number[] = [];
  const doubts: number[] = [];
  let quality = 0;
  for (let cell = 0; cell < 81; cell++) {
    // the box as tracked, and shifted a little either way: where the warp
    // is a few pixels off, one of them holds the whole digit
    const box = cellBox(tracked, Math.floor(cell / 9), cell % 9);
    const w = box.x1 - box.x0;
    let blob: Blob | null = null;
    let m: Match | null = null;
    for (const shift of [0, -0.18, 0.18]) {
      const dx = Math.round(w * shift);
      const b = cellBlob(g, { x0: box.x0 + dx, x1: box.x1 + dx, y0: box.y0, y1: box.y1 });
      if (!b) continue;
      const mm = matchDigit(b, templates);
      // a shifted box must read clearly better to win over the tracked one
      if (!m || mm.score > m.score + (shift ? 0.08 : 0)) {
        blob = b;
        m = mm;
      }
    }
    if (!blob || !m) {
      digits.push(0);
      continue;
    }
    if (m.score < 0.42) {
      // ink that is no digit we know: left empty, but flagged
      digits.push(0);
      doubts.push(cell);
      continue;
    }
    digits.push(m.digit);
    quality += m.score;
    if (m.score < 0.66 || m.margin < 0.1) doubts.push(cell);
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
  const quads = findGrids(ink, g.width, g.height, g);
  const whole: Quad['corners'] = [
    { x: 0, y: 0 },
    { x: g.width - 1, y: 0 },
    { x: g.width - 1, y: g.height - 1 },
    { x: 0, y: g.height - 1 }
  ];
  // each plausible quad gets a full reading; the reading that matches
  // best, conflicts counted against it, decides between them, the same
  // measure that picks the orientation
  let best: { reading: Reading; warped: Gray; quad: Quad | null } | null = null;
  for (const quad of quads.length ? quads : [null]) {
    const warped = warp(g, homography(quad ? quad.corners : whole));
    const reading = readBest(warped, templates);
    const value = reading.quality - 0.7 * reading.conflicts;
    if (!best || value > best.reading.quality - 0.7 * best.reading.conflicts) best = { reading, warped, quad };
  }
  const { reading, warped, quad } = best!;
  return { reading, warped: reading.symmetry ? dihedral(warped, reading.symmetry) : warped, quad };
}
