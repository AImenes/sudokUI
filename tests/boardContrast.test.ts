/**
 * The board's own ink in every theme (src/ui/styles.css): the given and
 * entered digits, the candidates and pencil marks, and the red of a
 * repeated digit read at 4.5:1 or better against the cell, the WCAG AA
 * rule for text of their size (a phone's digit is about 24 px at weight
 * 500), and at 3:1 or better on the selected cell. The hunt of November
 * 2026 found Rosé's own digits, the conflict red in Daylight and Rosé and
 * Daylight's candidates below it. The Christmas look (12 November 2026)
 * is held to the same, and to the rest of what its design promised: its
 * conflict red apart from its spruce digits for every colour vision, its
 * selection's gold edge and its board lines at 3:1 or better.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrast, over, de2000, linToLab, toLinear, worstDE } from './colourScience';

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
  forest: { ...dark, ...block(":root[data-theme='forest'] {") },
  christmas: { ...light, ...block(":root[data-theme='christmas'] {") }
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

describe('a repeated digit stands apart from the theme’s own digits', () => {
  // Rosé's digits are red, and daylight's crimson beside its raspberry
  // givens read as a thin given (the check of November 2026): the
  // conflict ink must differ in colour, not only by its underline
  const lab = (hex: string) => linToLab(toLinear(hex));
  for (const [theme, v] of Object.entries(THEMES)) {
    it(`${theme}: the conflict ink is far from the given and the entered digit`, () => {
      for (const token of ['--given', '--entered']) {
        const de = de2000(lab(v['--danger-text']), lab(v[token]));
        expect(de, `${theme} --danger-text ${v['--danger-text']} vs ${token} ${v[token]}`).toBeGreaterThanOrEqual(15);
      }
    });
  }
});

describe('the Christmas look', () => {
  const v = THEMES.christmas;
  const cell = v['--cell-bg'];
  const sel = rgba(v['--sel-bg']);
  const selected = over(sel.hex, sel.alpha * 0.9, cell);

  it('keeps daylight’s white board and panel, so every hint colour reads as it does there', () => {
    expect(cell).toBe(light['--cell-bg']);
    expect(v['--panel']).toBe(light['--panel']);
  });

  it('parts its conflict red from its own digits for every colour vision, not only for normal vision', () => {
    for (const token of ['--given', '--entered']) {
      const { de, model } = worstDE(v['--danger-text'], v[token]);
      expect(de, `${token} (${model})`).toBeGreaterThanOrEqual(15);
    }
  });

  it('draws the selection’s edge and the board’s lines at 3:1 or better, and its digits on a same-digit cell at 4.5:1', () => {
    expect(contrast(v['--sel-border'], selected)).toBeGreaterThanOrEqual(3);
    expect(contrast(v['--sel-border'], cell)).toBeGreaterThanOrEqual(3);
    expect(contrast(v['--line'], cell)).toBeGreaterThanOrEqual(3);
    const same = rgba(v['--same-bg']);
    const onSame = over(same.hex, same.alpha, cell);
    for (const token of ['--given', '--entered', '--cand', '--danger-text']) expect(contrast(v[token], onSame), token).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps its words, links and buttons at 4.5:1 on the page, the soft background and the panel', () => {
    for (const token of ['--text', '--muted', '--accent-text', '--accent'])
      for (const bg of ['--bg', '--bg-soft', '--panel']) expect(contrast(v[token], v[bg]), `${token} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(v['--on-accent'], v['--accent-fill'])).toBeGreaterThanOrEqual(4.5);
  });

  it('writes the top bar’s words in snow on its pine, at 4.5:1 or better', () => {
    // the bar's own tokens, redefined for it (the Christmas look, at the end of styles.css)
    const bar = block(":root[data-theme='christmas'] .topbar {");
    for (const token of ['--text', '--muted', '--accent', '--hint-secondary-ink']) expect(contrast(bar[token], v['--bar-bg']), token).toBeGreaterThanOrEqual(4.5);
  });
});
