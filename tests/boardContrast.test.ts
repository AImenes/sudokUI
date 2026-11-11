/**
 * The board's own ink in every theme (src/ui/styles.css): the given and
 * entered digits, the candidates and pencil marks, and the red of a
 * repeated digit read at 4.5:1 or better against the cell, the WCAG AA
 * rule for text of their size (a phone's digit is about 24 px at weight
 * 500), and at 3:1 or better on the selected cell. The hunt of November
 * 2026 found Rosé's own digits, the conflict red in Daylight and Rosé and
 * Daylight's candidates below it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrast, over } from './colourScience';

const css = new TextDecoder().decode(readFileSync('src/ui/styles.css')).replace(/\r\n/g, '\n');

/** the declarations of the rule whose selector starts a line as given (the nth such rule) */
function block(selectorStart: string, nth = 0): Record<string, string> {
  let at = -1;
  for (let k = 0; k <= nth; k++) at = css.indexOf(`\n${selectorStart}`, at + 1);
  expect(at, selectorStart).toBeGreaterThanOrEqual(0);
  const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

const dark = block(":root[data-theme='dark'] {");
const light = block(":root[data-theme='light'],");
const THEMES: Record<string, Record<string, string>> = {
  dark,
  light,
  rose: { ...light, ...block(":root[data-theme='rose'] {", 1) },
  forest: { ...dark, ...block(":root[data-theme='forest'] {") }
};

/** rgba(r, g, b, a) as a colour and its alpha */
function rgba(value: string): { hex: string; alpha: number } {
  const [r, g, b, a] = value.match(/[\d.]+/g)!.map(Number);
  return { hex: '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join(''), alpha: a };
}

describe('the board’s own digits and marks', () => {
  for (const [theme, v] of Object.entries(THEMES)) {
    it(`${theme}: read at 4.5:1 on the cell and 3:1 on the selected cell`, () => {
      const cell = v['--cell-bg'];
      // the selection: --sel-bg at the rect's opacity 0.9 (Grid.tsx)
      const sel = rgba(v['--sel-bg']);
      const selected = over(sel.hex, sel.alpha * 0.9, cell);
      // the conflict digit is the error text's red (Grid.tsx)
      for (const token of ['--given', '--entered', '--cand', '--danger-text']) {
        expect(contrast(v[token], cell), `${theme} ${token} ${v[token]} on ${cell}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(v[token], selected), `${theme} ${token} ${v[token]} selected`).toBeGreaterThanOrEqual(3);
      }
    });
  }
});
