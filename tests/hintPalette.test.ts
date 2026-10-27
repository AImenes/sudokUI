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
 *
 * Phase 4's sets (docs/hint-drawing-sets.md, Colours) are held to the
 * figures the design gives, in all four themes: the "one of these" square,
 * the three set tints as tiles over each cell and over the player's own
 * cell colours, their inks and tab letters, the group bars, the dark
 * violet ink, the legend's swatches, and the small-board widths and
 * toggles the stylesheet draws them with.
 */
import { describe, it, expect } from 'vitest';
import { LIGHT, DARK, CSS_VARS, HintPalette, fillOf, MARK } from '../src/content/hintPalette';
import { PALETTE } from '../src/ui/Grid';
import { SIZE, M, candX, candY } from '../src/ui/boardLayout';
import { readFileSync } from 'node:fs';
import { contrast, de2000, seen, worstDE, MODELS, Lab, over } from './colourScience';

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

/**
 * A figure of docs/hint-drawing-sets.md held as a floor, as it is written:
 * a measurement passes when it rounds to the figure or above (the design
 * gives contrasts to two places and CIEDE2000 to one)
 */
function atLeast(value: number, figure: number, places: 1 | 2, what: string) {
  expect(value, `${what}: ${value.toFixed(places + 2)}, the design's ${figure.toFixed(places)}`).toBeGreaterThanOrEqual(figure - 0.5 * 10 ** -places);
}

type Theme = keyof typeof BOARDS;
const THEMES = Object.keys(BOARDS) as Theme[];

/** the almost locked sets' tints, in the order decision 8 gives them out, with the palette's keys */
const TINTS = [
  { name: 'sand', fill: 'set1', ink: 'set1Ink' },
  { name: 'rose', fill: 'set2', ink: 'set2Ink' },
  { name: 'violet', fill: 'set3', ink: 'set3Ink' }
] as const;

/** a set's tile as a theme's board shows it: the tint at the set alpha over the cell */
function tileOn(theme: Theme, tint: number): string {
  const { palette: p, cell } = BOARDS[theme];
  return over(p[TINTS[tint].fill], p.setAlpha, cell);
}

/** the player's own cell colours, as the board draws them under everything (src/ui/Grid.tsx) */
const PLAYER_ALPHA = 0.55;
const playerOn = (theme: Theme) => PALETTE.map((c) => over(c, PLAYER_ALPHA, BOARDS[theme].cell));

/**
 * The design's figures for the tints (docs/hint-drawing-sets.md, Colours),
 * theme by theme: the tiles as drawn (sand, rose, violet); the tints apart
 * in the worst model (sand and rose, sand and violet, rose and violet) and
 * from the board; the hint's ink on each tile; the least it keeps on a
 * tile over any of the player's own colours; and the least each set's ink
 * keeps on any board or panel of its family, which the tab's letter, in
 * the board's colour, keeps on the ink. Forest's hint ink on the tiles is
 * "about the same" as dark's, and held to 4.5:1 with the rest
 */
const SET_FIGURES: Record<Theme, { tiles: string[]; apart: number[]; fromBoard: number[]; hintInk?: number[]; overPlayer: number; inks: number[] }> = {
  light: { tiles: ['#fdf59b', '#dfaac0', '#c6abff'], apart: [15.6, 16.1, 15.3], fromBoard: [9.4, 15.3, 15.8], hintInk: [14.14, 8.05, 8.06], overPlayer: 5.25, inks: [6.04, 6.13, 6.12] },
  rose: { tiles: ['#fdf39a', '#dfa8bf', '#c6a9fe'], apart: [15.5, 16.0, 15.3], fromBoard: [8.3, 15.0, 15.7], hintInk: [13.95, 7.93, 7.94], overPlayer: 5.25, inks: [6.04, 6.13, 6.12] },
  dark: { tiles: ['#323418', '#683a55', '#2e207f'], apart: [16.4, 17.7, 14.0], fromBoard: [9.3, 11.0, 11.1], hintInk: [11.32, 7.99, 11.4], overPlayer: 4.01, inks: [9.6, 7.27, 6.03] },
  forest: { tiles: ['#2f360e', '#653c4b', '#2b2275'], apart: [16.5, 13.9, 18.2], fromBoard: [8.1, 14.2, 9.6], overPlayer: 4.01, inks: [9.6, 7.27, 6.03] }
};

describe('a "one of these" square (docs/hint-drawing-sets.md, decision 1)', () => {
  it("is the true fill at half strength over its family's board, drawn opaque", () => {
    expect(LIGHT.oneOf).toBe(over(LIGHT.place, 0.5, BOARDS.light.cell));
    expect(DARK.oneOf).toBe(over(DARK.place, 0.5, BOARDS.dark.cell));
  });

  it("takes its digit in the ring's ink, readable in every theme, where near-black would not be on a dark board", () => {
    for (const theme of THEMES) {
      const p = BOARDS[theme].palette;
      atLeast(contrast(p.inRing, p.oneOf), p === LIGHT ? 10.74 : 6.36, 2, `${theme}: its digit`);
    }
    // near-black on the dark square would be 2.58:1
    expect(contrast(DARK.onFill, DARK.oneOf)).toBeLessThan(3);
  });

  it("stays apart from the true disc, a false ring's inside, the pattern disc, the board and the tiles under it, and over the player's colours no nearer than measured", () => {
    // 11.6 from the true disc in the light themes (Brettel tritan), where
    // shape carries the rest, square against disc, with the bar or the
    // tile; forest's rose tile, 8.4, is parted by the keyline. Over the
    // player's own colours it leans on its true-ink edge and its keyline:
    // 2.4 from their green in the light themes, 1.9 from their red in
    // dark, 2.8 from their blue in forest. It is 1.6 from light orange
    // under protan vision, and never drawn with it: sets and colourings
    // never share a step
    const FIGURES: Record<Theme, { trueDisc: number; falseInside: number; pattern: number; board: number; tiles: number[]; player: number }> = {
      light: { trueDisc: 11.6, falseInside: 10.6, pattern: 20.8, board: 13.5, tiles: [12.1, 12.1, 12.1], player: 2.4 },
      rose: { trueDisc: 11.6, falseInside: 10.6, pattern: 20.8, board: 13.4, tiles: [12.1, 12.1, 12.1], player: 2.4 },
      dark: { trueDisc: 22.9, falseInside: 11.3, pattern: 22.8, board: 19.8, tiles: [12.2, 12.2, 12.2], player: 1.9 },
      forest: { trueDisc: 22.9, falseInside: 11.3, pattern: 22.8, board: 17.7, tiles: [12.2, 8.4, 12.2], player: 2.8 }
    };
    for (const theme of THEMES) {
      const { palette: p, cell } = BOARDS[theme];
      const f = FIGURES[theme];
      const de = (c: string) => worstDE(p.oneOf, c).de;
      atLeast(de(p.place), f.trueDisc, 1, `${theme}: from the true disc`);
      atLeast(de(over(p.false, p.ringTint, cell)), f.falseInside, 1, `${theme}: from a false ring's inside`);
      atLeast(de(p.primary), f.pattern, 1, `${theme}: from the pattern disc`);
      atLeast(de(cell), f.board, 1, `${theme}: from the board`);
      for (let t = 0; t < 3; t++) atLeast(de(tileOn(theme, t)), f.tiles[t], 1, `${theme}: from the ${TINTS[t].name} tile`);
      atLeast(Math.min(...playerOn(theme).map(de)), f.player, 1, `${theme}: from the player's colours`);
    }
  });
});

describe("an almost locked set's tints (docs/hint-drawing-sets.md, decisions 5, 7, 8 and 9)", () => {
  it('are drawn at half strength over each cell, as the design measured them', () => {
    for (const theme of THEMES) {
      expect(BOARDS[theme].palette.setAlpha, theme).toBe(0.5);
      expect([0, 1, 2].map((t) => tileOn(theme, t)), theme).toEqual(SET_FIGURES[theme].tiles);
    }
  });

  it('stay apart from each other and from the board in every theme, for every colour vision', () => {
    for (const theme of THEMES) {
      const tiles = [0, 1, 2].map((t) => tileOn(theme, t));
      const f = SET_FIGURES[theme];
      [
        [0, 1],
        [0, 2],
        [1, 2]
      ].forEach(([a, b], k) => {
        const { de, model } = worstDE(tiles[a], tiles[b]);
        atLeast(de, f.apart[k], 1, `${theme}: ${TINTS[a].name} and ${TINTS[b].name} (${model})`);
      });
      tiles.forEach((tile, t) => atLeast(worstDE(tile, BOARDS[theme].cell).de, f.fromBoard[t], 1, `${theme}: ${TINTS[t].name} from the board`));
    }
  });

  it("keep the hint's ink readable on every tile, and over the player's own colours never below today's or 4.5:1, whichever is less", () => {
    // the player's colours as Grid.tsx draws them, under every hint mark
    const grid = new TextDecoder().decode(readFileSync('src/ui/Grid.tsx'));
    expect(grid).toMatch(new RegExp(`fill=\\{PALETTE\\[col\\]\\}\\s*opacity=\\{${String(PLAYER_ALPHA).replace('.', '\\.')}\\}`));
    for (const theme of THEMES) {
      const p = BOARDS[theme].palette;
      const f = SET_FIGURES[theme];
      let least = Infinity;
      for (let t = 0; t < 3; t++) {
        const name = TINTS[t].name;
        const on = contrast(p.inRing, tileOn(theme, t));
        expect(on, `${theme}: on ${name}`).toBeGreaterThanOrEqual(4.5);
        if (f.hintInk) atLeast(on, f.hintInk[t], 2, `${theme}: on ${name}`);
        playerOn(theme).forEach((under, k) => {
          const today = contrast(p.inRing, under);
          const now = contrast(p.inRing, over(p[TINTS[t].fill], p.setAlpha, under));
          expect(now, `${theme}: on ${name} over the player's ${PALETTE[k]}, today ${today.toFixed(2)}`).toBeGreaterThanOrEqual(Math.min(4.5, today));
          least = Math.min(least, now);
        });
      }
      // the least is on the player's red in the light themes and yellow in the dark ones (today 3.68 there)
      atLeast(least, f.overPlayer, 2, `${theme}: the least over the player's colours`);
    }
  });

  it('give each set an ink its outline and tab read in on every board and panel, with a readable letter on the tab', () => {
    for (const theme of THEMES) {
      const { palette: p, cell, panel } = BOARDS[theme];
      TINTS.forEach(({ name, ink }, t) => {
        const figure = SET_FIGURES[theme].inks[t];
        for (const [where, bg] of [
          ['the board', cell],
          ['the panel', panel]
        ]) {
          expect(contrast(p[ink], bg), `${theme}: the ${name} ink on ${where}`).toBeGreaterThanOrEqual(4.5);
          atLeast(contrast(p[ink], bg), figure, 2, `${theme}: the ${name} ink on ${where}`);
        }
        // the tab's letter is in the board's colour on the ink (in the
        // panel's, on a legend's tab: the ink on the panel, above)
        atLeast(contrast(cell, p[ink]), figure, 2, `${theme}: the ${name} tab's letter`);
      });
    }
  });

  it("keep the dark violet ink as far from the false ring's blue as the design pushed it, and from every other mark a set step draws", () => {
    const violet = DARK.set3Ink;
    atLeast(worstDE(violet, DARK.false).de, 8.7, 1, "from the false ring's blue");
    atLeast(worstDE(violet, DARK.primary).de, 9.4, 1, 'from the pattern');
    atLeast(worstDE(violet, DARK.set2Ink).de, 9.1, 1, 'from the rose ink');
    atLeast(worstDE(violet, DARK.elim).de, 12.8, 1, 'from the removal');
    // the false ring's blue is the nearest of them all; the colouring's
    // shades are nearer, but sets and colourings never share a step
    const beside = [DARK.primary, DARK.secondary, DARK.fin, DARK.elim, DARK.place, DARK.false, DARK.arrow, DARK.oneOf, DARK.set1Ink, DARK.set2Ink, DARK.inRing];
    for (const c of beside) atLeast(worstDE(violet, c).de, 8.7, 1, `from ${c}`);
    for (const theme of ['dark', 'forest'] as const) {
      const { cell, panel } = BOARDS[theme];
      atLeast(Math.min(contrast(violet, cell), contrast(violet, panel)), 6.03, 2, `${theme}: on the board and the panel`);
      atLeast(contrast(violet, tileOn(theme, 2)), 5.35, 2, `${theme}: on its own tile`);
    }
  });

  it("stand off every panel as the legend's swatches draw them, a small tile at the set alpha", () => {
    for (const theme of THEMES) {
      const { palette: p, panel } = BOARDS[theme];
      for (let t = 0; t < 3; t++) atLeast(worstDE(over(p[TINTS[t].fill], p.setAlpha, panel), panel).de, 7.1, 1, `${theme}: ${TINTS[t].name}`);
    }
  });

  it('leave to shape and edge only the pairs the design names, none nearer than it measured them', () => {
    // the gold disc on the light rose tile (only Death Blossom draws gold
    // on a tile): its keyline and its edge carry it
    for (const theme of ['light', 'rose'] as const) {
      atLeast(worstDE(LIGHT.secondary, tileOn(theme, 1)).de, 6.8, 1, `${theme}: the gold disc on the rose tile`);
      for (let t = 0; t < 3; t++) atLeast(contrast(LIGHT.secondaryInk, tileOn(theme, t)), 3.26, 2, `${theme}: the gold disc's edge on the ${TINTS[t].name} tile`);
    }
    // the light violet ink and the false ring's blue: an outline round
    // candidates and a filled tab never take a ring's shape (the sand ink
    // and the acts-through ink, 0.2 under deutan vision, are told apart by
    // shape alone, and no word names an ink)
    atLeast(worstDE(LIGHT.set3Ink, LIGHT.false).de, 3.3, 1, "the light violet ink and the false ring's blue");
    // a tab beside a walk number, whose badge is the arrows' ink
    for (const p of [LIGHT, DARK]) for (const { name, ink } of TINTS) atLeast(worstDE(p[ink], p.arrow).de, 12.9, 1, `the ${name} tab and a walk number`);
  });
});

describe('a group\'s bar (docs/hint-drawing-sets.md, decisions 2 and 3)', () => {
  it("takes its members' ink, visible on every board, far from the arrows, a true bar apart from a false one", () => {
    for (const theme of THEMES) {
      const { palette: p, cell } = BOARDS[theme];
      const bars = { true: p.placeInk, false: p.false, pattern: p.primaryInk, removal: p.elim };
      for (const [name, ink] of Object.entries(bars)) {
        // the pattern's ink on forest is the closest, 4.78:1
        atLeast(contrast(ink, cell), p === LIGHT ? 6.36 : 4.78, 2, `${theme}: a ${name} bar`);
        atLeast(worstDE(ink, p.arrow).de, 21.5, 1, `${theme}: a ${name} bar and the arrows`);
      }
      // 4.0 in the light themes: the squares and the rings on them part them by shape
      atLeast(worstDE(p.placeInk, p.false).de, p === LIGHT ? 4.0 : 12.1, 1, `${theme}: a true bar and a false one`);
    }
  });
});

/** the body of each at-rule whose header is as given, its braces matched */
function atRules(header: string): string[] {
  const out: string[] = [];
  for (let at = css.indexOf(header); at >= 0; at = css.indexOf(header, at + 1)) {
    const open = css.indexOf('{', at);
    let depth = 0;
    for (let i = open; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}' && --depth === 0) {
        out.push(css.slice(open + 1, i));
        break;
      }
    }
  }
  return out;
}

/** what a stretch of the stylesheet declares for a selector, comments left out: the last rule naming both wins */
function declared(text: string, selector: string, property: string): string | undefined {
  const rules = [...text.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  let found: string | undefined;
  for (const [, selectors, body] of rules) {
    if (!selectors.split(',').some((s) => s.trim() === selector)) continue;
    for (const [, name, value] of body.matchAll(/([\w-]+)\s*:\s*([^;]+);/g)) if (name === property) found = value.trim();
  }
  return found;
}

describe("phase 4's sets in the stylesheet and their sizes (docs/hint-drawing-sets.md, Colours)", () => {
  // a small board by the board's own width, and the window's where a
  // browser has no container queries, each with its step under 330
  const STEPS = [
    {
      small: '@container (max-width: 600px) {',
      tiny: '@container (max-width: 330px) {'
    },
    {
      small: '@media (max-width: 600px), (max-width: 1000px) and (max-height: 520px) and (orientation: landscape) {',
      tiny: '@media (max-width: 350px), (max-width: 1000px) and (max-height: 401px) and (orientation: landscape) {'
    }
  ];

  it("draws a small board's widths and drawings as the palette's sizes give them, with container queries or without", () => {
    // a small board's drawings are hidden on a wide one
    expect(css).toMatch(/\n\.board \.hint-one-of-small,\n\.board \.hint-tile-small,\n\.board \.hint-tile-tiny \{\n {2}display: none;\n\}/);
    for (const { small, tiny } of STEPS) {
      const [s, t] = [atRules(small), atRules(tiny)];
      expect([s.length, t.length], small).toEqual([1, 1]);
      // the step under 330 comes later, so it wins where both hold
      expect(css.indexOf(tiny), tiny).toBeGreaterThan(css.indexOf(small));
      expect(parseFloat(declared(s[0], '.board .hint-group-bar', 'stroke-width') ?? ''), small).toBeCloseTo(MARK.groupBarStrokeSmall * SIZE, 9);
      expect(parseFloat(declared(t[0], '.board .hint-group-bar', 'stroke-width') ?? ''), tiny).toBeCloseTo(MARK.groupBarStrokeTiny * SIZE, 9);
      for (const mark of ['one-of', 'tile']) {
        expect(declared(s[0], `.board .hint-${mark}-wide`, 'display'), `${small} ${mark}`).toBe('none');
        expect(declared(s[0], `.board .hint-${mark}-small`, 'display'), `${small} ${mark}`).toBe('inline');
      }
      expect(declared(t[0], '.board .hint-tile-small', 'display'), tiny).toBe('none');
      expect(declared(t[0], '.board .hint-tile-tiny', 'display'), tiny).toBe('inline');
      // the tab grows to its large size about its place's centre
      const scale = declared(s[0], '.board .hint-tab', 'transform')?.match(/^scale\(([\d.]+)\)$/);
      expect(Number(scale?.[1]), small).toBeCloseTo(MARK.tabLarge / MARK.tab, 3);
    }
  });

  it('keeps every line it adds at 1.5 CSS pixels or more on the smallest board each width is drawn on (G14a)', () => {
    // the board's units across (Grid.tsx's viewBox), and the smallest
    // board of each step: 600 CSS px for the wide widths, 330 for a small
    // board's, and a 320-pixel phone's 300 below that
    const units = 9 * SIZE + 2 * M;
    const steps = [
      { px: 600, widths: { bar: MARK.groupBarStroke, outline: MARK.tileStroke } },
      { px: 330, widths: { bar: MARK.groupBarStrokeSmall, outline: MARK.tileStrokeSmall } },
      { px: 300, widths: { bar: MARK.groupBarStrokeTiny, outline: MARK.tileStrokeTiny } }
    ];
    for (const { px, widths } of steps) {
      for (const [name, w] of Object.entries(widths)) expect((w * SIZE * px) / units, `a ${name} on a ${px}-pixel board`).toBeGreaterThanOrEqual(1.5);
    }
  });

  it("gives sizes that agree with the board's candidate places", () => {
    const places = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => ({ x: candX(d), y: candY(d) - 7 }));
    // a tile 15 out from any of its cell's candidates keeps its outer edge
    // 6 or more from the cell's edge
    for (const { x, y } of places) {
      for (const v of [x, y]) {
        expect(v - MARK.tile * SIZE).toBeGreaterThanOrEqual(MARK.tileMargin * SIZE);
        expect(v + MARK.tile * SIZE).toBeLessThanOrEqual(SIZE - MARK.tileMargin * SIZE);
      }
    }
    // a square reaches 13 along its axes and 15.5 at its corners; of two
    // in neighbouring places, one's keyline on a small board reaches the
    // other's square and no further, as a shade's reaches a disc
    expect(MARK.oneOf * SIZE).toBeCloseTo(13, 9);
    expect(((MARK.oneOf - MARK.oneOfRadius) * Math.SQRT2 + MARK.oneOfRadius) * SIZE).toBeCloseTo(15.5, 1);
    expect((MARK.oneOf + MARK.keylineSmall) * SIZE).toBeLessThanOrEqual(places[1].x - places[0].x - MARK.oneOf * SIZE + 1e-9);
  });

  it("draws the legend's swatches from the tokens: squares, rings and bars in their marks' inks, a set's tile in its tint and ink", () => {
    const decl = (selector: string, property: string) => declared(css, selector, property);
    for (let n = 1; n <= 3; n++) {
      const sw = `.hint-legend .swatch-set-${n}`;
      expect(decl(sw, '--sw'), sw).toBe(`var(--hint-set-${n})`);
      expect(decl(sw, '--sw-ink'), sw).toBe(`var(--hint-set-${n}-ink)`);
      expect(decl(sw, 'border'), sw).toBe('1.5px solid var(--sw-ink)');
      // the tint at the set alpha over the panel, and the tab in the ink
      expect(decl(`${sw}::before`, 'background'), sw).toBe('var(--sw)');
      expect(decl(`${sw}::before`, 'opacity'), sw).toBe('var(--hint-set-alpha)');
      expect(decl(`${sw}::after`, 'background'), sw).toBe('var(--sw-ink)');
    }
    for (const sw of ['one-of', 'one-of-bar']) {
      for (const side of ['before', 'after']) {
        expect(decl(`.hint-legend .swatch-${sw}::${side}`, 'background'), sw).toBe('var(--hint-one-of)');
        expect(decl(`.hint-legend .swatch-${sw}::${side}`, 'border'), sw).toBe('1px solid var(--hint-place-ink)');
      }
    }
    for (const side of ['before', 'after']) expect(decl(`.hint-legend .swatch-false-bar::${side}`, 'border')).toBe('1.5px solid var(--hint-false)');
    // squares in a set have no bar: the tiles carry them
    expect(decl('.hint-legend .swatch-one-of', 'background')).toBe('transparent');
    const bars = { 'one-of-bar': '--hint-place-ink', 'false-bar': '--hint-false', 'bar-primary': '--hint-primary-ink', 'bar-elim': '--hint-elim' };
    for (const [sw, ink] of Object.entries(bars)) expect(decl(`.hint-legend .swatch-${sw}`, '--bar'), sw).toBe(`var(${ink})`);
    for (const sw of ['one-of-bar', 'false-bar']) expect(decl(`.hint-legend .swatch-${sw}`, 'background'), sw).toMatch(/^linear-gradient\(var\(--bar\), var\(--bar\)\) /);
    for (const sw of ['bar-primary', 'bar-elim']) expect(decl(`.hint-legend .swatch-${sw}::before`, 'background'), sw).toBe('var(--bar)');
  });
});
