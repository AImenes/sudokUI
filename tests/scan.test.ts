/**
 * The scanner's numeric pipeline (src/scan/image.ts), on synthetic photos:
 * a drawn grid with nine made-up glyphs stamped into cells is read back,
 * whichever way the photo is turned or mirrored, and when it is taken
 * from an angle.
 */
import { describe, it, expect } from 'vitest';
import { Gray, Template, homography, warp, dihedral, normalise, findGrid, adaptiveInk, scanGray, countConflicts, NORM } from '../src/scan/image';

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';

/**
 * Nine 12×12 glyphs from 3×3 block masks, chosen so that no glyph is a
 * rotation or mirror image of itself or of another: as distinct as digits
 * are, and readable only the right way up.
 */
function glyphs(): Uint8Array[] {
  const sym = (m: number[]): string[] => {
    // the 8 symmetries of a 3×3 mask, as strings
    const rot = (a: number[]) => [a[6], a[3], a[0], a[7], a[4], a[1], a[8], a[5], a[2]];
    const mir = (a: number[]) => [a[2], a[1], a[0], a[5], a[4], a[3], a[8], a[7], a[6]];
    const out: string[] = [];
    let a = m;
    for (let r = 0; r < 4; r++) {
      out.push(a.join(''), mir(a).join(''));
      a = rot(a);
    }
    return out;
  };
  const chosen: number[][] = [];
  const taken = new Set<string>();
  for (let bits = 0; bits < 512 && chosen.length < 9; bits++) {
    const m = Array.from({ length: 9 }, (_, i) => (bits >> i) & 1);
    const n = m.reduce((a, b) => a + b, 0);
    if (n < 4 || n > 5) continue;
    const forms = sym(m);
    if (new Set(forms).size !== 8) continue; // symmetric in some way
    if (forms.some((f) => taken.has(f))) continue;
    forms.forEach((f) => taken.add(f));
    chosen.push(m);
  }
  return chosen.map((m) => {
    const g = new Uint8Array(144);
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) if (m[Math.floor(y / 4) * 3 + Math.floor(x / 4)]) g[y * 12 + x] = 1;
    return g;
  });
}

const GLYPHS = glyphs();
/** a template is normalised from its ink box, exactly as the scanner builds its own */
function template(g: Uint8Array, digit: number): Template {
  let x0 = 12, x1 = -1, y0 = 12, y1 = -1;
  for (let i = 0; i < 144; i++) {
    if (!g[i]) continue;
    const x = i % 12;
    const y = (i - x) / 12;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { digit, vec: normalise(g, 12, x0, y0, x1 - x0 + 1, y1 - y0 + 1) };
}
const templates: Template[] = GLYPHS.map((g, i) => template(g, i + 1));

/** a clean picture of the puzzle: white page, a grid of lines, glyphs in the given cells */
function picture(puzzle: string, size = 620, cell = 54, left = 70, top = 60): Gray {
  const data = new Float32Array(size * size).fill(235);
  const line = (x0: number, y0: number, x1: number, y1: number, w: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) for (let t = 0; t < w; t++) {
      const yy = y + (x1 - x0 > y1 - y0 ? t : 0);
      const xx = x + (x1 - x0 > y1 - y0 ? 0 : t);
      if (xx < size && yy < size) data[yy * size + xx] = 20;
    }
  };
  for (let k = 0; k <= 9; k++) {
    const w = k % 3 === 0 ? 4 : 1;
    line(left, top + k * cell, left + 9 * cell, top + k * cell, w);
    line(left + k * cell, top, left + k * cell, top + 9 * cell, w);
  }
  for (let i = 0; i < 81; i++) {
    const d = Number(puzzle[i] === '.' ? 0 : puzzle[i]);
    if (!d) continue;
    const g = GLYPHS[d - 1];
    const x0 = left + (i % 9) * cell + 15;
    const y0 = top + Math.floor(i / 9) * cell + 15;
    // each glyph pixel drawn 2×2
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) if (g[y * 12 + x]) {
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) data[(y0 + y * 2 + dy) * size + x0 + x * 2 + dx] = 30;
    }
  }
  return { width: size, height: size, data };
}

const asString = (digits: number[]) => digits.map((d) => (d ? String(d) : '.')).join('');

describe('the scanner', () => {
  it('finds the grid and reads the glyphs back', () => {
    const pic = picture(EASY);
    const quad = findGrid(adaptiveInk(pic), pic.width, pic.height)!;
    expect(quad).not.toBeNull();
    expect(quad.corners[0].x).toBeLessThan(75);
    expect(quad.corners[2].x).toBeGreaterThan(70 + 9 * 54 - 6);
    const { reading } = scanGray(pic, templates);
    expect(asString(reading.digits)).toBe(EASY);
    expect(reading.symmetry).toBe(0);
    expect(reading.conflicts).toBe(0);
  });

  it('reads a photo turned or mirrored any of the eight ways', () => {
    const pic = picture(EASY);
    for (let k = 1; k < 8; k++) {
      const turned = dihedral(pic, k);
      const { reading } = scanGray(turned, templates);
      expect(asString(reading.digits), `symmetry ${k}`).toBe(EASY);
    }
  });

  it('reads a photo taken from an angle', () => {
    const pic = picture(EASY);
    // the grid seen through a skewed quadrilateral: a camera off to one side
    const H = homography([
      { x: 40, y: 30 },
      { x: 600, y: 70 },
      { x: 570, y: 600 },
      { x: 60, y: 570 }
    ], 700);
    const photo = warp(pic, H, 700);
    const { reading, quad } = scanGray(photo, templates);
    expect(quad).not.toBeNull();
    const got = asString(reading.digits);
    let wrong = 0;
    for (let i = 0; i < 81; i++) if (got[i] !== EASY[i]) wrong++;
    expect(wrong, got).toBeLessThanOrEqual(2);
  });

  it('homography maps the square onto the corners, and the symmetries compose as expected', () => {
    const corners: [any, any, any, any] = [{ x: 10, y: 20 }, { x: 110, y: 25 }, { x: 105, y: 130 }, { x: 15, y: 120 }];
    const H = homography(corners, 100);
    const map = (x: number, y: number) => {
      const d = H[6] * x + H[7] * y + 1;
      return { x: (H[0] * x + H[1] * y + H[2]) / d, y: (H[3] * x + H[4] * y + H[5]) / d };
    };
    expect(map(0, 0).x).toBeCloseTo(10, 6);
    expect(map(100, 0).y).toBeCloseTo(25, 6);
    expect(map(100, 100).x).toBeCloseTo(105, 6);
    expect(map(0, 100).y).toBeCloseTo(120, 6);
    const g: Gray = { width: 3, height: 3, data: new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]) };
    expect([...dihedral(g, 0).data]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect([...dihedral(g, 2).data]).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect([...dihedral(g, 4).data]).toEqual([3, 2, 1, 6, 5, 4, 9, 8, 7]);
    expect(normalise(new Uint8Array([1]), 1, 0, 0, 1, 1)).toHaveLength(NORM * NORM);
    expect(countConflicts([1, 0, 0, 0, 0, 0, 0, 0, 1, ...Array(72).fill(0)])).toBe(1);
  });
});
