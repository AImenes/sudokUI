/**
 * A colouring's two shades as they are drawn, not only as their tokens
 * (docs/hint-drawing-colouring.md, decision 7; docs/hint-drawing.md,
 * Colours and sizes). On a phone a shade's disc is about ten CSS pixels
 * across, in a Learn diagram less, and the eye mixes a disc's rim into its
 * fill: a light shade rimmed in its cluster's dark shade reads as the mean
 * of the two, weighted by area. Phase 3 first drew that rim 4 units wide,
 * inwards, on a small board and in Learn, which left the light fill half
 * the disc and brought dark and light purple from 17.6 apart (the tokens)
 * to 9 (the review's measurements on the photographs: 6 to 9).
 *
 * So every shade disc is read from what the renderers draw (the app's
 * board at a small and at a wide size, the Learn diagram, and the legends'
 * swatches in the app and under the diagram), each mixed in linear light
 * over its fill and its rim (the digit, the same on both, left out, and
 * the keyline, the board's own colour, too), and a cluster's dark and
 * light disc must stay 15 or more apart in worst-model CIEDE2000
 * (tests/colourScience.ts) in every theme.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { LIGHT, DARK, CSS_VARS, HintPalette } from '../src/content/hintPalette';
import { EXAMPLES } from '../src/content/examples';
import { boardSvg, legendOf, swatchStyle } from '../src/content/boardSvg';
import type { Example } from '../src/content/boardSvg';
import { toLinear, linToLab, de2000, simulate, MODELS } from './colourScience';
import type { RGB } from './colourScience';

const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k)
};
const { useGame } = await import('../src/state/gameStore');
const { Grid } = await import('../src/ui/Grid');

/** the stored Multi Colors example: both clusters, so both hues, each in both shades */
const EX = EXAMPLES.MULTI_COLORS as Example;

const THEMES: Record<string, HintPalette> = { light: LIGHT, rose: LIGHT, dark: DARK, forest: DARK };
/** a CSS variable's palette key */
const KEY_OF = Object.fromEntries(Object.entries(CSS_VARS).map(([k, v]) => [v, k])) as Record<string, keyof HintPalette>;

/** a shade's disc as drawn: its fill out to `inner`, its rim from there out to `outer` (any unit) */
interface Disc {
  hue: 'purple' | 'orange';
  light: boolean;
  fill: string;
  ink: string;
  inner: number;
  outer: number;
}

/** the disc's colour as the eye mixes it: fill and rim weighted by their areas, in linear light */
function mixed(d: Disc): RGB {
  const f = toLinear(d.fill);
  const k = toLinear(d.ink);
  const a = (d.inner / d.outer) ** 2;
  return f.map((x, i) => a * x + (1 - a) * k[i]) as RGB;
}
/** the lowest CIEDE2000 over normal vision and the eight simulations (tests/colourScience.ts worstDE, on mixed colours) */
const worst = (a: RGB, b: RGB) => Math.min(...MODELS.map((m) => de2000(linToLab(simulate(a, m)), linToLab(simulate(b, m)))));

/** each hue's closest dark and light disc among those drawn, and how far apart they are */
function apart(discs: Disc[], what: string): { hue: string; de: number }[] {
  return (['purple', 'orange'] as const).map((hue) => {
    const dark = discs.filter((d) => d.hue === hue && !d.light);
    const light = discs.filter((d) => d.hue === hue && d.light);
    expect(dark.length, `${what}: dark ${hue}`).toBeGreaterThan(0);
    expect(light.length, `${what}: light ${hue}`).toBeGreaterThan(0);
    let de = Infinity;
    for (const a of dark) for (const b of light) de = Math.min(de, worst(mixed(a), mixed(b)));
    return { hue, de };
  });
}

/** the shade a fill names: its palette key, as fillOf gives it */
const shadeOf = (key: string): { hue: 'purple' | 'orange'; light: boolean } | null =>
  /^(purple|orange)(Light)?$/.test(key) ? { hue: key.startsWith('purple') ? 'purple' : 'orange', light: key.endsWith('Light') } : null;

const attrs = (tag: string) => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));

/** the app's board, the example's hint in full view */
function appBoard(): string {
  const cells = Array.from({ length: 81 }, (_, i) => {
    const value = Number(EX.values[i]);
    return { given: EX.puzzle[i] >= '1' && EX.puzzle[i] <= '9', value, corner: 0, center: 0, excluded: value ? 0 : 0x1ff & ~EX.cands[i], colors: [] };
  });
  useGame.setState({ cells, autoCandidates: true, hint: EX.step, hintStage: 'full', walkIndex: 0, paused: false, won: false, chain: null });
  // a server render reads the store's initial state
  Object.assign(useGame.getInitialState() as unknown as Record<string, unknown>, useGame.getState());
  return renderToStaticMarkup(React.createElement(Grid));
}

/**
 * every shade disc the app's board paints at a size, its colours in a
 * theme: each circle filled with a shade and edged in that shade's ink, as
 * a small board shows it (styles.css hides every .hint-*-wide there, and
 * shows .hint-*-small only there) or a wide one
 */
function appDiscs(board: string, size: 'small' | 'wide', p: HintPalette): Disc[] {
  const out: Disc[] = [];
  for (const [tag] of board.matchAll(/<circle[^>]*>/g)) {
    const a = attrs(tag);
    const fill = KEY_OF[/^var\((--[\w-]+)\)$/.exec(a.fill ?? '')?.[1] ?? ''];
    const shade = fill && shadeOf(fill);
    if (!shade || a.stroke !== `var(${CSS_VARS[`${fill}Ink` as keyof HintPalette]})`) continue;
    const cls = a.class ?? '';
    if (/-(wide)\b/.test(cls) && size === 'small') continue;
    if (/-(small)\b/.test(cls) && size === 'wide') continue;
    const [r, w] = [Number(a.r), Number(a['stroke-width'] ?? 0)];
    out.push({ ...shade, fill: String(p[fill]), ink: String(p[`${fill}Ink` as keyof HintPalette]), inner: r - w / 2, outer: r + w / 2 });
  }
  return out;
}

/** every shade disc a Learn diagram paints (always in the light palette) */
function learnDiscs(svg: string): Disc[] {
  const out: Disc[] = [];
  for (const [tag] of svg.matchAll(/<circle[^>]*>/g)) {
    const a = attrs(tag);
    for (const key of ['purple', 'purpleLight', 'orange', 'orangeLight'] as const) {
      if (a.fill !== LIGHT[key] || a.stroke !== LIGHT[`${key}Ink`]) continue;
      const [r, w] = [Number(a.r), Number(a['stroke-width'] ?? 0)];
      out.push({ ...shadeOf(key)!, fill: LIGHT[key], ink: LIGHT[`${key}Ink`], inner: r - w / 2, outer: r + w / 2 });
    }
  }
  return out;
}

/**
 * a swatch's discs from its radial gradients: the fill to its stop, the
 * rim from there to the soft edge; each colour switch is taken halfway
 * along its ramp
 */
function swatchDiscs(background: string, colour: (token: string) => string): { fill: string; ink: string; inner: number; outer: number }[] {
  const re = /radial-gradient\(circle at [^,]+,\s*(\S+?)\s+([\d.]+)px,\s*(\S+?)\s+([\d.]+)px\s+([\d.]+)px,\s*transparent\s+([\d.]+)px\)/g;
  return [...background.matchAll(re)].map((m) => ({
    fill: colour(m[1]),
    ink: colour(m[3]),
    inner: (Number(m[2]) + Number(m[4])) / 2,
    outer: (Number(m[5]) + Number(m[6])) / 2
  }));
}

// read from disk (Vitest stubs a CSS import); a Windows checkout may give the file CRLF line ends
const css = new TextDecoder().decode(readFileSync('src/ui/styles.css')).replace(/\r\n/g, '\n');
/** the declarations of the rule whose selector list starts with the line given */
function rule(selectorStart: string): string {
  let at = css.indexOf(`\n${selectorStart}`);
  // not a later line of another rule's selector list
  while (at >= 0 && css[at - 1] === ',') at = css.indexOf(`\n${selectorStart}`, at + 1);
  expect(at, selectorStart).toBeGreaterThanOrEqual(0);
  return css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
}

/** the app legend's two discs of a cluster (styles.css .swatch-shades-0 and -1), dark then light, in a theme */
function appSwatch(cluster: 0 | 1, p: HintPalette): Disc[] {
  const vars = Object.fromEntries([...rule(`.hint-legend .swatch-shades-${cluster} {`).matchAll(/(--[\w-]+):\s*var\((--[\w-]+)\);/g)].map((m) => [m[1], m[2]]));
  const background = /background:([^;]+);/.exec(rule('.hint-legend .swatch-shades-0,'))![1];
  const colour = (token: string) => String(p[KEY_OF[vars[/^var\((--[\w-]+)\)$/.exec(token)![1]]]]);
  const hue = cluster === 0 ? 'purple' : 'orange';
  return swatchDiscs(background, colour).map((d, i) => ({ hue, light: i === 1, ...d }));
}

describe("a colouring's shades, as drawn", () => {
  const board = appBoard();
  const svg = boardSvg(EX, 'Multi Colors');

  it('stay 15 or more apart, rim and fill mixed, on the app board at a small and a wide size, in every theme', () => {
    for (const [theme, p] of Object.entries(THEMES)) {
      for (const size of ['small', 'wide'] as const) {
        for (const { hue, de } of apart(appDiscs(board, size, p), `${theme} ${size}`)) expect(de, `${theme} ${size} board: ${hue}`).toBeGreaterThanOrEqual(15);
      }
    }
  });

  it('stay 15 or more apart, rim and fill mixed, in the Learn diagram', () => {
    for (const { hue, de } of apart(learnDiscs(svg), 'Learn')) expect(de, `Learn: ${hue}`).toBeGreaterThanOrEqual(15);
  });

  it("stay 15 or more apart in the legends' swatches, drawn like the marks", () => {
    for (const [theme, p] of Object.entries(THEMES)) {
      for (const { hue, de } of apart([...appSwatch(0, p), ...appSwatch(1, p)], `${theme} legend`)) expect(de, `${theme} legend: ${hue}`).toBeGreaterThanOrEqual(15);
    }
    const pairs = legendOf(EX.step, EX.values).filter((e) => e.kind === 'pair');
    expect(pairs.length).toBe(2);
    const discs = pairs.flatMap((e, k) =>
      swatchDiscs(swatchStyle(e).background, (c) => c).map((d, i): Disc => ({ hue: k === 0 ? 'purple' : 'orange', light: i === 1, ...d }))
    );
    expect(discs.map((d) => [d.fill, d.ink])).toEqual([
      [LIGHT.purple, LIGHT.purpleInk],
      [LIGHT.purpleLight, LIGHT.purpleLightInk],
      [LIGHT.orange, LIGHT.orangeInk],
      [LIGHT.orangeLight, LIGHT.orangeLightInk]
    ]);
    for (const { hue, de } of apart(discs, 'Learn legend')) expect(de, `Learn legend: ${hue}`).toBeGreaterThanOrEqual(15);
  });
});
