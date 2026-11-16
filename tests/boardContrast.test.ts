/**
 * The board's own ink in every theme (src/ui/styles.css): the given and
 * entered digits, the candidates and pencil marks, and the red of a
 * repeated digit read at 4.5:1 or better against the cell, the WCAG AA
 * rule for text of their size (a phone's digit is about 24 px at weight
 * 500), and at 3:1 or better on the selected cell. The hunt of November
 * 2026 found Rosé's own digits, the conflict red in Daylight and Rosé and
 * Daylight's candidates below it. The Christmas look, a winter night since
 * 15 November 2026 (the owner: "a more readable layout for christmas mode.
 * I would like it darker"), is held to the same and to what "readable"
 * means there, each measure from the stylesheet's own tokens as the board
 * draws them (src/ui/Grid.tsx): givens and the player's digits at 7:1 on
 * every ground a cell can show and far apart for every colour vision,
 * pencil marks and the conflict's red at 4.5:1, the four grounds a step
 * apart with the selection strongest, the box lines at 3:1 and the thin
 * ones quieter, and every word and control edge of its panels.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrast, over, de2000, linToLab, toLinear, worstDE, seen, luminance } from './colourScience';

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
  // of the dark family since 15 November 2026: what it does not set is Dark's
  christmas: { ...dark, ...block(":root[data-theme='christmas'] {") }
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

describe('the Christmas look, a winter night', () => {
  const v = THEMES.christmas;
  const cell = v['--cell-bg'];
  const tint = (token: string, under: string, opacity = 1) => {
    const { hex, alpha } = rgba(v[token]);
    return over(hex, alpha * opacity, under);
  };
  // the grounds a cell can show, as Grid.tsx layers them: the selection's
  // row, column and box, the selected digit's other cells, the selected
  // cell (its rect at 0.9), a cell that is both a peer and a same digit
  // (where a conflict with the selected cell sits), and a wrong entry
  // after Check (--error-bg at 0.5), alone and over each tint
  const peer = tint('--peer-bg', cell);
  const same = tint('--same-bg', cell);
  const selected = tint('--sel-bg', cell, 0.9);
  const both = tint('--same-bg', peer);
  const GROUNDS: Record<string, string> = {
    plain: cell,
    peer,
    'same digit': same,
    selected,
    'peer and same digit': both,
    wrong: over(v['--error-bg'], 0.5, cell),
    'wrong on a peer': over(v['--error-bg'], 0.5, peer),
    'wrong on a same digit': over(v['--error-bg'], 0.5, both)
  };
  const deNormal = (a: string, b: string) => de2000(seen(a, 'normal'), seen(b, 'normal'));
  const rgb = (hex: string) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));

  it('is a dark look, darker than Dark, on pine-black: green leads every ground, and none is pure black', () => {
    for (const token of ['--bg', '--bg-soft', '--panel', '--cell-bg']) {
      const [r, g, b] = rgb(v[token]);
      expect(g, `${token} ${v[token]}: green over red`).toBeGreaterThan(r);
      expect(g, `${token} ${v[token]}: green over blue`).toBeGreaterThan(b);
      expect(luminance(v[token]), `${token} is not black`).toBeGreaterThan(0.005);
      expect(luminance(v[token]), `${token} is darker than Dark's`).toBeLessThan(luminance(dark[token]));
    }
    // no rule groups it with the light looks any more
    expect(css).not.toMatch(/data-theme='(light|rose)'\][^{}]*,\s*:root\[data-theme='christmas'\]/);
    expect(css).not.toMatch(/data-theme='christmas'\][^{}]*,\s*:root\[data-theme='(light|rose)'\]/);
  });

  it('reads the givens and the player’s digits at 7:1 on every ground a cell can show', () => {
    for (const [name, ground] of Object.entries(GROUNDS))
      for (const token of ['--given', '--entered']) expect(contrast(v[token], ground), `${token} ${v[token]} on the ${name} ground ${ground}`).toBeGreaterThanOrEqual(7);
  });

  it('tells a given from the player’s digit at a glance: 25 apart, 15 for every colour vision, another hue, a clear step in lightness, a heavier weight', () => {
    expect(deNormal(v['--given'], v['--entered'])).toBeGreaterThanOrEqual(25);
    const { de, model } = worstDE(v['--given'], v['--entered']);
    expect(de, model).toBeGreaterThanOrEqual(15);
    const [given, entered] = [seen(v['--given'], 'normal'), seen(v['--entered'], 'normal')];
    // snow is the lighter and has next to no colour; candle gold has plenty
    expect(given[0] - entered[0]).toBeGreaterThanOrEqual(10);
    expect(Math.hypot(given[1], given[2])).toBeLessThan(6);
    expect(Math.hypot(entered[1], entered[2])).toBeGreaterThan(50);
    const grid = new TextDecoder().decode(readFileSync('src/ui/Grid.tsx'));
    expect(grid).toMatch(/fontWeight=\{cell\.given \? 700 : 500\}/);
  });

  it('reads pencil marks at 4.5:1 on every ground, and a highlighted one clearly apart from an ordinary one', () => {
    // a highlighted candidate is the accent, bold, in a frame (Grid.tsx)
    for (const [name, ground] of Object.entries(GROUNDS))
      for (const token of ['--cand', '--accent']) expect(contrast(v[token], ground), `${token} on the ${name} ground ${ground}`).toBeGreaterThanOrEqual(4.5);
    expect(deNormal(v['--accent'], v['--cand'])).toBeGreaterThanOrEqual(15);
    expect(worstDE(v['--accent'], v['--cand']).de).toBeGreaterThanOrEqual(15);
  });

  it('parts its conflict red from both digits for every colour vision, reads it at 4.5:1, and keeps its underline bar', () => {
    for (const token of ['--given', '--entered']) {
      const { de, model } = worstDE(v['--danger-text'], v[token]);
      expect(de, `${token} (${model})`).toBeGreaterThanOrEqual(15);
    }
    // a repeated digit sits on a plain cell, a peer, a same digit, the selected cell, or a peer that is a same digit
    for (const name of ['plain', 'peer', 'same digit', 'selected', 'peer and same digit'])
      expect(contrast(v['--danger-text'], GROUNDS[name]), `on the ${name} ground ${GROUNDS[name]}`).toBeGreaterThanOrEqual(4.5);
    const grid = new TextDecoder().decode(readFileSync('src/ui/Grid.tsx'));
    expect(grid).toMatch(/\{conflict && \(\s*<rect className="conflict-mark"[^>]*height=\{4\}[^>]*fill="var\(--danger-text\)"/);
  });

  it('tells the four grounds apart step by step, the selection strongest, in a border of 3:1', () => {
    expect(deNormal(cell, peer), 'plain to peer').toBeGreaterThanOrEqual(6);
    expect(deNormal(peer, same), 'peer to same digit').toBeGreaterThanOrEqual(6);
    expect(deNormal(cell, same), 'plain to same digit').toBeGreaterThanOrEqual(6);
    expect(deNormal(same, selected), 'same digit to selected').toBeGreaterThanOrEqual(6);
    expect(deNormal(peer, selected), 'peer to selected').toBeGreaterThanOrEqual(6);
    expect(deNormal(cell, selected)).toBeGreaterThan(Math.max(deNormal(cell, peer), deNormal(cell, same)));
    // the border is the rect's stroke, at its 0.9
    const border = over(v['--sel-border'], 0.9, cell);
    for (const ground of [cell, peer, same, selected]) expect(contrast(border, ground), `the border ${border} on ${ground}`).toBeGreaterThanOrEqual(3);
    // and it is not the player's gold: an ice ring round a frost cell
    expect(worstDE(border, v['--entered']).de).toBeGreaterThanOrEqual(15);
  });

  it('draws the box lines at 3:1 on the cell and the thin lines visible and quieter', () => {
    expect(contrast(v['--line'], cell)).toBeGreaterThanOrEqual(3);
    const thin = contrast(v['--line-thin'], cell);
    expect(thin).toBeGreaterThanOrEqual(1.5);
    expect(thin).toBeLessThan(contrast(v['--line'], cell) / 1.5);
    // the board draws its inner lines with the thin token, where a look has one
    const grid = new TextDecoder().decode(readFileSync('src/ui/Grid.tsx'));
    expect(grid.match(/stroke=\{k % 3 === 0 \? 'var\(--line\)' : 'var\(--line-thin, var\(--line\)\)'\}/g)).toHaveLength(2);
    for (const theme of ['dark', 'light', 'rose', 'forest']) expect(THEMES[theme]['--line-thin'], theme).toBeUndefined();
  });

  it('keeps its words, links and buttons at 4.5:1, and a control’s edge at 3:1, on the page, the soft background and the panel', () => {
    for (const bg of ['--bg', '--bg-soft', '--panel']) {
      for (const token of ['--text', '--muted', '--accent-text', '--accent', '--danger-text']) expect(contrast(v[token], v[bg]), `${token} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(v['--edge'], v[bg]), `--edge on ${bg}`).toBeGreaterThanOrEqual(3);
      // a chip's wash of spruce under the words
      expect(contrast(v['--text'], tintOn(v['--tint-bg'], v[bg])), `--text on a chip on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(v['--on-accent'], v['--accent-fill'])).toBeGreaterThanOrEqual(4.5);
    // a filled button stands off every ground it sits on
    for (const bg of ['--bg', '--bg-soft', '--panel']) expect(contrast(v['--accent-fill'], v[bg]), `--accent-fill on ${bg}`).toBeGreaterThanOrEqual(3);
    // only this look names an edge: the others keep their faint borders
    for (const theme of ['dark', 'light', 'rose', 'forest']) expect(THEMES[theme]['--edge'], theme).toBeUndefined();
  });

  it('writes the top bar’s words in snow on its pine, at 4.5:1 or better, and the bar is the browser’s bar', () => {
    // the bar's own tokens, redefined for it (the Christmas look, at the end of styles.css)
    const bar = block(":root[data-theme='christmas'] .topbar {");
    for (const token of ['--text', '--muted', '--accent', '--hint-secondary-ink']) expect(contrast(bar[token], v['--bar-bg']), token).toBeGreaterThanOrEqual(4.5);
    // pine, a step up from the page: the browser's bar wears it (src/ui/theme.ts reads --bar-bg)
    expect(v['--bar-bg']).toBe('#173d2e');
    expect(luminance(v['--bar-bg'])).toBeGreaterThan(luminance(v['--bg']));
  });

  it('keeps its two dimmed words words: the stopped clock on the bar and "not yet" on the panel at 4.5:1', () => {
    const bar = block(":root[data-theme='christmas'] .topbar {");
    const opacityOf = (selector: string) => Number(css.slice(css.indexOf(`\n${selector} {`)).match(/opacity:\s*([\d.]+)/)![1]);
    const clock = over(bar['--muted'], opacityOf(":root[data-theme='christmas'] .timer.paused"), v['--bar-bg']);
    expect(contrast(clock, v['--bar-bg'])).toBeGreaterThanOrEqual(4.5);
    const notYet = over(v['--muted'], opacityOf(":root[data-theme='christmas'] .path-ahead .path-play"), v['--panel']);
    expect(contrast(notYet, v['--panel'])).toBeGreaterThanOrEqual(4.5);
    // and both stay dimmer than their neighbours
    expect(contrast(clock, v['--bar-bg'])).toBeLessThan(contrast(bar['--muted'], v['--bar-bg']) - 2);
    expect(contrast(notYet, v['--panel'])).toBeLessThan(contrast(v['--muted'], v['--panel']) - 1);
  });

  it('dims its decorations for the night: the snowflakes barely there, the lights no brighter than the bar’s words', () => {
    const flakes = [...css.matchAll(/stroke='%23([0-9a-f]{6})' stroke-width='[\d.]+' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath id='a'/g)].map((m) => `#${m[1]}`);
    expect(flakes).toHaveLength(3);
    for (const flake of flakes) {
      expect(contrast(flake, v['--bg'])).toBeLessThanOrEqual(1.5);
      expect(contrast(flake, v['--bg'])).toBeGreaterThanOrEqual(1.15);
    }
    const lights = css.slice(css.indexOf(":root[data-theme='christmas'] .topbar::after {"));
    const bulbs = [...lights.slice(0, lights.indexOf('}')).matchAll(/circle cx='\d+' cy='[\d.]+' r='[\d.]+' fill='%23([0-9a-f]{6})'/g)].map((m) => `#${m[1]}`);
    expect(bulbs).toHaveLength(4);
    const bar = block(":root[data-theme='christmas'] .topbar {");
    for (const bulb of bulbs) expect(luminance(bulb), bulb).toBeLessThan(luminance(bar['--text']));
  });
});

/** an rgba() wash over a ground */
function tintOn(value: string, under: string): string {
  const { hex, alpha } = rgba(value);
  return over(hex, alpha, under);
}
