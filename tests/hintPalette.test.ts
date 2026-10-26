/**
 * The colours of a hint (src/content/hintPalette.ts; docs/hint-drawing.md,
 * Colours and sizes): the app's CSS tokens (src/ui/styles.css) are the
 * palette's values, light for the light and rose themes and dark for the
 * dark and forest ones, and the contrasts the spec was measured on still
 * hold: a digit on any filled mark at about 5.5:1 or more, a digit in a ring at
 * 4.5:1 or more, every mark's edge and the arrows at 3:1 or more against
 * the board, the arrows far above that.
 *
 * A colouring's shades (docs/hint-drawing-colouring.md, Colours) are held
 * the same way, their edges on the hint panel too, where the legend shows
 * them, and they stay apart in colour alone for every colour vision: a
 * worst-model CIEDE2000 of 12 or more (tests/colourScience.ts, checked
 * here first on Sharma et al.'s published test pairs).
 */
import { describe, it, expect } from 'vitest';
import { LIGHT, DARK, CSS_VARS, HintPalette, fillOf } from '../src/content/hintPalette';
import { readFileSync } from 'node:fs';
import { contrast, de2000, seen, worstDE, MODELS, Lab } from './colourScience';

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

/** each theme's board: the cells a mark sits on, and the hint panel the legend sits on */
const BOARDS = {
  light: { palette: LIGHT, cell: '#ffffff', panel: '#ffffff' },
  rose: { palette: LIGHT, cell: '#fffbfd', panel: '#fff7fa' },
  dark: { palette: DARK, cell: '#1c202e', panel: '#222636' },
  forest: { palette: DARK, cell: '#16241a', panel: '#1b2d21' }
};

/** a colouring's four shades, as fillOf names them, with the palette's keys */
const SHADES = [
  { kind: 'purpleDark', fill: 'purple', ink: 'purpleInk' },
  { kind: 'purpleLight', fill: 'purpleLight', ink: 'purpleLightInk' },
  { kind: 'orangeDark', fill: 'orange', ink: 'orangeInk' },
  { kind: 'orangeLight', fill: 'orangeLight', ink: 'orangeLightInk' }
] as const;

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

  it("is measured on the app's own cells and panels", () => {
    const dark = block(":root[data-theme='dark'] {");
    const light = block(":root[data-theme='light'],");
    // rose and forest each change their base theme's board
    const tokens = {
      light,
      rose: { ...light, ...block(":root[data-theme='rose'] {", 1) },
      dark,
      forest: { ...dark, ...block(":root[data-theme='forest'] {") }
    };
    for (const [theme, { cell, panel }] of Object.entries(BOARDS) as [keyof typeof BOARDS, (typeof BOARDS)['light']][]) {
      expect(tokens[theme]['--cell-bg'], `${theme} cell`).toBe(cell);
      expect(tokens[theme]['--panel'], `${theme} panel`).toBe(panel);
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
      for (const s of SHADES) marks.push(p[s.fill], p[s.ink]);
      expect(marks).not.toContain(p.arrow);
    }
  });
});

describe("a colouring's shades", () => {
  it('fill the same in every theme, rimmed in the dark shade on light boards and in the fill on dark ones', () => {
    for (const s of SHADES) {
      expect(DARK[s.fill], s.fill).toBe(LIGHT[s.fill]);
      expect(DARK[s.ink], `dark ${s.ink}`).toBe(DARK[s.fill]);
      expect(fillOf(LIGHT, s.kind), `light ${s.kind}`).toEqual({ fill: LIGHT[s.fill], ink: LIGHT[s.ink] });
      expect(fillOf(DARK, s.kind), `dark ${s.kind}`).toEqual({ fill: DARK[s.fill], ink: DARK[s.ink] });
    }
    expect([LIGHT.purpleInk, LIGHT.purpleLightInk]).toEqual([LIGHT.purple, LIGHT.purple]);
    expect([LIGHT.orangeInk, LIGHT.orangeLightInk]).toEqual([LIGHT.orange, LIGHT.orange]);
    // the dark shade is the darker one, by a clear step in lightness
    for (const hue of ['purple', 'orange'] as const) {
      const [dark, light] = [seen(LIGHT[hue], 'normal')[0], seen(LIGHT[`${hue}Light`], 'normal')[0]];
      expect(light - dark, hue).toBeGreaterThan(15);
    }
  });

  it('keep the digit readable on every shade, and every edge visible on every cell and panel', () => {
    for (const [board, { palette: p, cell, panel }] of Object.entries(BOARDS)) {
      // dark purple is the closest call for the digit, 5.57:1; the edges'
      // closest is light orange's on rose's panel, 3.01:1, and the pale
      // fills on white (1.80 and 1.40) rely on that edge
      for (const s of SHADES) {
        expect(contrast(p.onFill, p[s.fill]), `${board} digit on ${s.fill}`).toBeGreaterThanOrEqual(5.45);
        expect(contrast(p[s.ink], cell), `${board} ${s.ink} on the cell`).toBeGreaterThanOrEqual(3);
        expect(contrast(p[s.ink], panel), `${board} ${s.ink} on the panel`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe('the colour science the palette is measured with', () => {
  // Sharma, Wu, Dalal 2005, Table 1: L*a*b* of each pair and their CIEDE2000,
  // to four places. Pairs 9 to 15 straddle the hue's wrap at 180 degrees
  // apart, 21 to 24 are each one unit from the same colour.
  const SHARMA: [Lab, Lab, number][] = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    [[50, 2.8361, -74.02], [50, 0, -82.7485], 3.4412],
    [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0],
    [[50, -1.1848, -84.8006], [50, 0, -82.7485], 1.0],
    [[50, -0.9009, -85.5211], [50, 0, -82.7485], 1.0],
    [[50, 0, 0], [50, -1, 2], 2.3669],
    [[50, -1, 2], [50, 0, 0], 2.3669],
    [[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792],
    [[50, 2.49, -0.001], [50, -2.49, 0.001], 7.1792],
    [[50, 2.49, -0.001], [50, -2.49, 0.0011], 7.2195],
    [[50, 2.49, -0.001], [50, -2.49, 0.0012], 7.2195],
    [[50, -0.001, 2.49], [50, 0.0009, -2.49], 4.8045],
    [[50, -0.001, 2.49], [50, 0.001, -2.49], 4.8045],
    [[50, -0.001, 2.49], [50, 0.0011, -2.49], 4.7461],
    [[50, 2.5, 0], [50, 0, -2.5], 4.3065],
    [[50, 2.5, 0], [73, 25, -18], 27.1492],
    [[50, 2.5, 0], [61, -5, 29], 22.8977],
    [[50, 2.5, 0], [56, -27, -3], 31.903],
    [[50, 2.5, 0], [58, 24, 15], 19.4535],
    [[50, 2.5, 0], [50, 3.1736, 0.5854], 1.0],
    [[50, 2.5, 0], [50, 3.2972, 0], 1.0],
    [[50, 2.5, 0], [50, 1.8634, 0.5757], 1.0],
    [[50, 2.5, 0], [50, 3.2592, 0.335], 1.0],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[63.0109, -31.0961, -5.8663], [62.8187, -29.7946, -4.0864], 1.263],
    [[61.2901, 3.7196, -5.3901], [61.4292, 2.248, -4.962], 1.8731],
    [[35.0831, -44.1164, 3.7933], [35.0232, -40.0716, 1.5901], 1.8645],
    [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
    [[36.4612, 47.858, 18.3852], [36.2715, 50.5065, 21.2231], 1.4146],
    [[90.8027, -2.0831, 1.441], [91.1528, -1.6435, 0.0447], 1.4441],
    [[90.9257, -0.5406, -0.9208], [88.6381, -0.8985, -0.7239], 1.5381],
    [[6.7747, -0.2908, -2.4247], [5.8714, -0.0985, -2.2286], 0.6377],
    [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082]
  ];

  it("gives CIEDE2000 as Sharma et al.'s test data do, both ways round", () => {
    SHARMA.forEach(([p, q, want], i) => {
      expect(de2000(p, q), `pair ${i + 1}`).toBeCloseTo(want, 4);
      expect(de2000(q, p), `pair ${i + 1} reversed`).toBeCloseTo(want, 4);
    });
  });

  it('sees black, grey and white as they are under every simulation', () => {
    // each simulation's rows sum to one, so a mistyped matrix entry shows
    for (const grey of ['#000000', '#777777', '#ffffff']) {
      for (const model of MODELS) expect(de2000(seen(grey, model), seen(grey, 'normal')), `${model} ${grey}`).toBeLessThan(0.1);
    }
  });

  it('brings the colours each deficiency confuses together', () => {
    // red and green for protans and deutans, blue and green for tritans: far
    // apart with normal vision (71.8 and 52.5), under half that in every
    // simulation of the deficiency (protan 24.9 to 27.9, deutan 4.6 to 5.0,
    // tritan 6.1 and 11.4)
    const confused = { protan: ['#d62728', '#2ca02c'], deutan: ['#d62728', '#2ca02c'], tritan: ['#4f8fe8', '#4caf50'] };
    for (const [deficiency, [a, b]] of Object.entries(confused)) {
      const normal = de2000(seen(a, 'normal'), seen(b, 'normal'));
      expect(normal, deficiency).toBeGreaterThan(50);
      const models = MODELS.filter((m) => m.endsWith(deficiency));
      expect(models.length, deficiency).toBe(deficiency === 'tritan' ? 2 : 3);
      for (const model of models) expect(de2000(seen(a, model), seen(b, model)), model).toBeLessThan(normal / 2);
    }
  });
});

describe("a colouring's shades, in colour alone", () => {
  // Worst-model CIEDE2000 (tests/colourScience.ts: the lowest over normal
  // vision and the Machado 2009, Brettel 1997 and Viénot 1999 protan,
  // deutan and tritan simulations), as measured for
  // docs/hint-drawing-colouring.md, Colours. In the light themes and the
  // Learn diagrams (LIGHT), then the dark ones (DARK):
  // - within purple 17.6 (Brettel deutan; 23.0 with normal vision), within
  //   orange 22.7 (Viénot deutan; 26.9);
  // - across the clusters: light purple against light orange 14.6
  //   (Machado tritan), the closest pair, dark against dark 14.9, dark
  //   purple against light orange 20.7, light purple against dark orange
  //   28.7 (each Brettel tritan);
  // - purple against true green: dark purple 42.8 and 41.7, light purple
  //   23.4 and 26.8;
  // - purple against the removal: dark purple 25.8 and 15.1, light purple
  //   42.1 and 22.6;
  // - a light shade against a light board, so it reads as a filled disc:
  //   light purple 14.0 from white and 13.2 from rose's cell, light orange
  //   16.2 and 16.7.
  // Under 12, and why each is safe: shape parts them, a disc against a ring,
  // where they meet (in the dark themes dark orange against the removal
  // 11.8, light orange 8.5; light purple against the false ring's blue 6.0
  // there, and against the tint inside a false ring 12.2 on white and 11.0
  // on rose's cell); and orange is never drawn beside true green (10.7 in
  // both palettes): where a step has an orange cluster, only orange is ever
  // proven, and from the proof on it is drawn as removals and true discs.
  const pairs: [string, string, string][] = [];
  for (const p of [LIGHT, DARK]) {
    const theme = p === LIGHT ? 'light' : 'dark';
    pairs.push([`${theme}: dark and light purple`, p.purple, p.purpleLight], [`${theme}: dark and light orange`, p.orange, p.orangeLight]);
    for (const a of [p.purple, p.purpleLight]) {
      for (const b of [p.orange, p.orangeLight]) pairs.push([`${theme}: ${a} (purple) and ${b} (orange)`, a, b]);
      pairs.push([`${theme}: ${a} (purple) and true green`, a, p.place], [`${theme}: ${a} (purple) and the removal`, a, p.elim]);
    }
  }
  for (const [board, cell] of [
    ['white', BOARDS.light.cell],
    ["rose's cell", BOARDS.rose.cell]
  ]) {
    pairs.push([`light purple and ${board}`, LIGHT.purpleLight, cell], [`light orange and ${board}`, LIGHT.orangeLight, cell]);
  }

  it('stay 12 or more apart for every colour vision: within a cluster, across clusters, against true green and the removal, and a light shade against a light board', () => {
    for (const [name, a, b] of pairs) {
      const { de, model } = worstDE(a, b);
      expect(de, `${name} (${model})`).toBeGreaterThanOrEqual(12);
    }
  });
});
