/**
 * The colours of a hint (src/content/hintPalette.ts; docs/hint-drawing.md,
 * Colours and sizes): the app's CSS tokens (src/ui/styles.css) are the
 * palette's values, light for the light and rose themes and dark for the
 * dark and forest ones, and the contrasts the spec was measured on still
 * hold: a digit on any filled mark at about 5.5:1 or more, a digit in a ring at
 * 4.5:1 or more, every mark's edge and the arrows at 3:1 or more against
 * the board, the arrows far above that.
 */
import { describe, it, expect } from 'vitest';
import { LIGHT, DARK, CSS_VARS, HintPalette } from '../src/content/hintPalette';
import { readFileSync } from 'node:fs';

// read from disk (Vitest stubs a CSS import); a Windows checkout may give
// the file CRLF line ends
const css = new TextDecoder().decode(readFileSync('src/ui/styles.css')).replace(/\r\n/g, '\n');

/** the declarations of the rule whose selector starts a line as given (the nth such rule) */
function block(selectorStart: string, nth = 0): Record<string, string> {
  let at = -1;
  for (let k = 0; k <= nth; k++) at = css.indexOf(`\n${selectorStart}`, at + 1);
  expect(at, selectorStart).toBeGreaterThanOrEqual(0);
  const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

const BOARDS = {
  light: { palette: LIGHT, cell: '#ffffff' },
  rose: { palette: LIGHT, cell: '#fffbfd' },
  dark: { palette: DARK, cell: '#1c202e' },
  forest: { palette: DARK, cell: '#16241a' }
};

/** WCAG 2 relative luminance and contrast */
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe('the hint palette', () => {
  it('is what the app draws with, theme by theme', () => {
    const dark = block(":root[data-theme='dark'] {");
    const light = block(":root[data-theme='rose'] {");
    for (const [name, v] of Object.entries(CSS_VARS) as [keyof HintPalette, string][]) {
      expect(String(dark[v]), `dark ${v}`).toBe(String(DARK[name]));
      expect(String(light[v]), `light ${v}`).toBe(String(LIGHT[name]));
    }
    // rose and forest change the board, never the hint colours (the first
    // rose rule is the one it shares with light)
    for (const v of Object.values(CSS_VARS)) {
      expect(block(":root[data-theme='rose'] {", 1)[v], `rose ${v}`).toBeUndefined();
      expect(block(":root[data-theme='forest'] {")[v], `forest ${v}`).toBeUndefined();
    }
  });

  it('keeps every digit on a mark readable, and every mark and arrow visible, on every board', () => {
    for (const [board, { palette: p, cell }] of Object.entries(BOARDS)) {
      // the pattern blue is the closest call, 5.499:1, the spec's "5.5"
      for (const fill of [p.primary, p.secondary, p.fin, p.place]) expect(contrast(p.onFill, fill), `${board} digit on ${fill}`).toBeGreaterThanOrEqual(5.45);
      expect(contrast(p.inRing, cell), `${board} digit in a ring`).toBeGreaterThanOrEqual(4.5);
      for (const ink of [p.primaryInk, p.secondaryInk, p.finInk, p.placeInk, p.elim, p.false]) {
        expect(contrast(ink, cell), `${board} ${ink}`).toBeGreaterThanOrEqual(3);
      }
      expect(contrast(p.arrow, cell), `${board} arrow`).toBeGreaterThanOrEqual(12);
    }
  });

  it('gives the arrows a colour no mark uses', () => {
    for (const p of [LIGHT, DARK]) {
      const marks = [p.primary, p.primaryInk, p.secondary, p.secondaryInk, p.fin, p.finInk, p.place, p.placeInk, p.elim, p.false];
      expect(marks).not.toContain(p.arrow);
    }
  });
});
