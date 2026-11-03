/**
 * The picture of the player's board (src/content/boardImage.ts), drawn by
 * the Learn diagrams' renderer (src/content/boardSvg.ts) and shared from the
 * Share dialog and the hint panel (docs/reach-plan-2026-11.md, build item 3):
 * no hint marks without a step; with a step, the same drawing as the
 * example's diagram; at a walk frame, what the board draws in that frame,
 * but for the walk's numbers on the arrows, which it leaves out; the board
 * as the player sees it: with auto candidates on, the auto candidates, and
 * with them off the player's own pencil marks, laid out as the board lays
 * them out (corner marks alone on the 3×3 grid, a line of up to four centre
 * marks, five or more on the grid, corner marks round the edge beside a
 * centre line, and a cell the hint marks on the grid with the hint's
 * digits); the player's colours and the footer only when asked; never a
 * technique's name; and nothing a canvas would refuse to export (a link,
 * an image, a foreign object).
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EXAMPLES } from '../src/content/examples';
import { boardSvg, BOARD_SIZE, FOOTER_SIZE } from '../src/content/boardSvg';
import type { Example } from '../src/content/boardSvg';
import { positionSvg, pictureOf, svgSize, hasMarksToDraw } from '../src/content/boardImage';
import type { PictureCell } from '../src/content/boardImage';
import { candidateLists } from '../src/content/textGrid';
import { PALETTE } from '../src/content/playerColours';
import { frameMarks } from '../src/content/hintMarks';
import { walkFrames, drawnLinks } from '../src/engine/hintFrames';
import { TECHS, type Tech } from '../src/engine/ratings';
import { parseGrid, bit, emptyGrid, setValue } from '../src/engine/board';
import type { Step } from '../src/engine/steps';
import { techNames as nbNames } from '../src/content/locales/names.nb';
import { techNames as esNames } from '../src/content/locales/names.es';

// the app's board is rendered here too, to hold the picture to its layout of the marks
const storage = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k)
};
const { useGame } = await import('../src/state/gameStore');
const { Grid } = await import('../src/ui/Grid');

const examples = Object.entries(EXAMPLES).filter((e): e is [Tech, Example] => !!e[1]);

/** the example's position as the store keeps it: its digits, givens as givens, its candidates as centre marks */
const cellsOf = (ex: Example): PictureCell[] =>
  [...ex.values].map((ch, i) => {
    const value = Number(ch);
    return { given: ex.puzzle[i] >= '1' && ex.puzzle[i] <= '9', value, corner: 0, center: value ? 0 : ex.cands[i], excluded: 0, colors: [] };
  });

/** the example's position under auto candidates: its eliminations as the player's strikes, no marks */
const struckOf = (ex: Example): PictureCell[] => {
  const g = emptyGrid();
  [...ex.values].forEach((ch, i) => Number(ch) && setValue(g, i, Number(ch)));
  return cellsOf(ex).map((c, i) => ({ ...c, center: 0, excluded: c.value ? 0 : g.cands[i] & ~ex.cands[i] }));
};

/** the mask's name hashes the puzzle string and the step's index, which a picture of a board does not keep */
const unmasked = (svg: string) => svg.replace(/knockout-[a-z0-9]+/g, 'knockout');

/** the words an SVG prints: its text elements' contents */
const printed = (svg: string) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

/** how often a pattern is drawn, outside the mask that holds a copy of the digits to cut them out of the lines */
const count = (svg: string, re: RegExp) => svg.replace(/<mask [\s\S]*?<\/mask>/g, '').match(re)?.length ?? 0;

const digits = (mask: number) => [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => mask & bit(d));
const bits = (...ds: number[]) => ds.reduce((m, d) => m | bit(d), 0);
const ones = (mask: number) => digits(mask).length;

const HARD = '...6..9.1..95....4....4985..241....5....3....9....546..7549....3....12..1.2..3...';
/** a position as a player leaves it: a few entries, a few marks, some colours */
function played(): PictureCell[] {
  const g = parseGrid(HARD)!;
  return Array.from({ length: 81 }, (_, i) => ({
    given: g.values[i] > 0,
    value: g.values[i],
    corner: !g.values[i] && i % 7 === 0 ? bit(2) | bit(7) : 0,
    center: !g.values[i] && i % 11 === 0 ? bit(3) | bit(5) | bit(8) : 0,
    excluded: !g.values[i] && i % 5 === 0 ? bit(1) | bit(9) : 0,
    colors: i % 13 === 0 ? [i % 9] : i === 40 ? [1, 5] : []
  }));
}

/** HARD with one empty cell per layout of the marks, in row 1 (its empty cells r1c1-3, r1c5, r1c6, r1c8) */
const LAYOUTS = {
  grid: { cell: 0, corner: bits(2, 4, 5), center: 0 },
  line: { cell: 1, corner: 0, center: bits(3, 4, 5, 8) },
  list: { cell: 2, corner: 0, center: bits(1, 2, 3, 4, 5, 7) },
  edge: { cell: 4, corner: bits(2, 7), center: bits(7, 8) },
  edgeList: { cell: 5, corner: bits(1, 5), center: bits(2, 3, 4, 5, 7, 8) },
  none: { cell: 7, corner: 0, center: 0 }
} as const;
function laidOut(): PictureCell[] {
  const cells = Array.from(parseGrid(HARD)!.values, (value): PictureCell => ({ given: value > 0, value, corner: 0, center: 0, excluded: 0, colors: [] }));
  for (const { cell, corner, center } of Object.values(LAYOUTS)) cells[cell] = { ...cells[cell], corner, center };
  return cells;
}

/** a piece of text a drawing puts in a cell, in the cell's own fractions: where, how big, how bold, what it says */
interface Placed {
  cell: number;
  x: number;
  y: number;
  size: number;
  weight: number;
  text: string;
}

/** the picture's texts in empty cells, outside the mask (class sizes from its style) */
function pictureTexts(svg: string): Placed[] {
  const style = /<style>([\s\S]*?)<\/style>/.exec(svg)![1];
  const of = (cls: string) => {
    const rule = new RegExp(`\\.${cls}\\{([^}]*)\\}`).exec(style)?.[1] ?? '';
    return { size: Number(/font-size:([\d.]+)px/.exec(rule)?.[1] ?? 0), weight: Number(/font-weight:(\d+)/.exec(rule)?.[1] ?? 400) };
  };
  const body = svg.replace(/<mask [\s\S]*?<\/mask>/g, '');
  return [...body.matchAll(/<text x="([\d.]+)" y="([\d.]+)" class="(cd|cc|ce|cl|mk|rm)"(?: style="font-size:([\d.]+)px")?>([^<]*)<\/text>/g)].map((m) => {
    const x = Number(m[1]) - 24;
    const y = Number(m[2]) - 24;
    const col = Math.floor(x / 60);
    const row = Math.floor(y / 60);
    const cls = of(m[3]);
    return { cell: row * 9 + col, x: (x - col * 60) / 60, y: (y - row * 60) / 60, size: (m[4] ? Number(m[4]) : cls.size) / 60, weight: cls.weight, text: m[5] };
  });
}

/** the app board's texts in empty cells (the pencil marks, a hint's digits), outside its mask */
function boardTexts(cells: PictureCell[], step: Step | null = null): Placed[] {
  useGame.setState({ cells: cells.map((c) => ({ ...c, colors: [...c.colors] })), autoCandidates: false, hint: step, hintStage: step ? 'full' : 'hidden', walkIndex: 0, paused: false, won: false, chain: null, selection: [] });
  // a server render reads the store's initial state: give it the one set here (as tests/gridDrawing.test.ts does)
  Object.assign(useGame.getInitialState() as unknown as Record<string, unknown>, useGame.getState());
  // the centre line measures its glyphs in a layout effect, which a server render skips, and says so
  const quiet = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (!String(args[0]).includes('useLayoutEffect does nothing on the server')) console.warn(...args);
  });
  const html = renderToStaticMarkup(React.createElement(Grid)).replace(/<mask [\s\S]*?<\/mask>/g, '');
  quiet.mockRestore();
  return [...html.matchAll(/<text ([^>]*)>([\s\S]*?)<\/text>/g)].flatMap((m) => {
    const attr = (name: string) => new RegExp(`(?:^| )${name}="([^"]*)"`).exec(m[1])?.[1];
    const size = Number(attr('font-size'));
    const x = Number(attr('x')) - 4;
    const y = Number(attr('y')) - 4;
    const col = Math.floor(x / 100);
    const row = Math.floor(y / 100);
    const cell = row * 9 + col;
    if (size >= 50 || !(cell >= 0 && cell < 81) || cells[cell].value) return [];
    return [{ cell, x: (x - col * 100) / 100, y: (y - row * 100) / 100, size: size / 100, weight: Number(attr('font-weight') ?? 400), text: m[2].replace(/<[^>]+>/g, '') }];
  });
}

/** what a drawing puts in its empty cells, sorted, sizes relative to its 3×3 grid's digits, so the board's and the picture's compare */
const layoutOf = (texts: Placed[], grid: number) =>
  texts
    .map((t) => ({ ...t, x: Math.round(t.x * 100) / 100, y: Math.round(t.y * 100) / 100, size: Math.round((t.size / grid) * 20) / 20 }))
    .sort((a, b) => a.cell - b.cell || a.y - b.y || a.x - b.x || a.text.localeCompare(b.text));

describe('a picture of the board', () => {
  it('draws no hint marks without a step', () => {
    for (const autoCandidates of [true, false]) {
      const svg = positionSvg({ cells: played(), autoCandidates });
      // marks are circles, rounded squares, bars and arrows; the board alone draws none
      expect(svg).not.toMatch(/<circle|<polygon|<path|<mask|class="(mk|rm|sq|gb|tl|to|tb)"/);
      // and no house band: the only rectangles are the board, its frame and the colours (off here)
      expect(count(svg, /<rect /g)).toBe(2);
      // digits, and with auto candidates off the player's centre lines
      expect(printed(svg).every((t) => /^[1-9]+$/.test(t))).toBe(true);
    }
  });

  it('with a step, draws what the example diagram draws, its candidates the auto candidates less the strikes', () => {
    for (const [tech, ex] of examples) {
      const title = `${TECHS[tech].name} example`;
      const picture = positionSvg({ cells: struckOf(ex), autoCandidates: true, step: ex.step, title });
      expect(unmasked(picture), tech).toBe(unmasked(boardSvg(ex, title)));
    }
  });

  it("at a walk frame, draws what the board draws in that frame but the walk's numbers, and the full view without one", () => {
    let frames = 0;
    let startDots = 0;
    for (const [tech, ex] of examples) {
      for (const [cells, autoCandidates] of [
        [struckOf(ex), true],
        [cellsOf(ex), false]
      ] as const) {
        const solved = (c: number) => cells[c].value > 0;
        const base = { cells, autoCandidates, step: ex.step };
        for (const frame of [null, ...walkFrames(ex.step)]) {
          const svg = positionSvg({ ...base, frame });
          const what = `${tech} ${autoCandidates ? 'auto' : 'marks'} ${frame?.text ?? 'full'}`;
          // every candidate the frame marks wears its mark (a bold digit), and no other does
          const marked = [...frameMarks(ex.step, frame, solved).cands].reduce((n, [cell, m]) => n + (solved(cell) ? 0 : m.size), 0);
          expect(count(svg, /class="(mk|rm)"/g), what).toBe(marked);
          // a start dot only on a link the frame draws: none before the first link
          const dots = count(svg, /<circle [^>]*r="3\.8" fill="#151a24" stroke="#ffffff" stroke-width="1\.2"\/>/g);
          if (!drawnLinks(ex.step, frame).size) expect(dots, what).toBe(0);
          else startDots += dots;
          if (frame) frames++;
        }
        expect(unmasked(positionSvg({ ...base, frame: null }))).toBe(unmasked(positionSvg(base)));
      }
    }
    expect(frames).toBeGreaterThan(200);
    expect(startDots).toBeGreaterThan(100);
  });

  it('draws what the board draws in its empty cells: the auto candidates with them on, the player’s own marks with them off', () => {
    for (const markContract of ['unknown', 'exhaustive', 'open'] as const) {
      const cells = played();
      // auto candidates on: the engine's candidates less the strikes, whatever the marks say
      const auto = pictureOf({ cells, autoCandidates: true });
      expect(auto.cands).toEqual(candidateLists(cells, true, markContract));
      expect(auto.marks).toBeUndefined();
      // off: the player's corner and centre marks, whatever their contract, and nothing in a cell without marks
      const own = pictureOf({ cells, autoCandidates: false });
      expect(own.cands).toEqual(cells.map((c) => (c.value ? 0 : c.corner | c.center)));
      expect(own.marks).toEqual(cells.map((c) => ({ corner: c.value ? 0 : c.corner, center: c.value ? 0 : c.center })));
      // with the tick off, nothing at all
      for (const autoCandidates of [true, false]) {
        const bare = pictureOf({ cells, autoCandidates, candidates: false });
        expect(bare.cands.every((m) => m === 0)).toBe(true);
        expect(bare.marks).toBeUndefined();
        expect(count(positionSvg({ cells, autoCandidates, candidates: false }), /class="(cd|cc|ce|cl)"/g)).toBe(0);
      }
    }
    // a candidate the auto view shows is a digit at its place; the struck ones are gone
    const cells = played();
    const svg = positionSvg({ cells, autoCandidates: true });
    expect(count(svg, /class="cd"/g)).toBe(candidateLists(cells, true, 'unknown').reduce((n, m) => n + ones(m), 0));
    expect(count(svg, /class="(cc|ce|cl)"/g)).toBe(0);
    // with a hint, a candidate the hint marks is drawn though the tick is off, and no other
    const ex = EXAMPLES.X_WING!;
    for (const autoCandidates of [true, false]) {
      const hinted = positionSvg({ cells: cellsOf(ex), autoCandidates, step: ex.step, candidates: false });
      expect(count(hinted, /class="(cd|cc|ce|cl)"/g)).toBe(0);
      expect(count(hinted, /class="(mk|rm)"/g)).toBeGreaterThan(0);
    }
  });

  it('lays out each cell’s marks as the board does: on the 3×3 grid, a line, or round the edge with a line', () => {
    const cells = laidOut();
    const picture = pictureTexts(positionSvg({ cells, autoCandidates: false }));
    const at = (k: keyof typeof LAYOUTS) => picture.filter((t) => t.cell === LAYOUTS[k].cell);
    const grid = picture.find((t) => t.cell === LAYOUTS.grid.cell)!.size;
    // corner marks alone: each digit at its place on the 3×3 grid, a little bold
    expect(at('grid').map((t) => [t.text, t.weight])).toEqual([['2', 600], ['4', 600], ['5', 600]]);
    // up to four centre marks: one line in the middle, larger than the grid's digits
    expect(at('line').map((t) => t.text)).toEqual(['3458']);
    expect(at('line')[0].size).toBeGreaterThan(grid);
    // five or more: the 3×3 grid, at the weight of a candidate
    expect(at('list').map((t) => [t.text, t.weight])).toEqual(['1', '2', '3', '4', '5', '7'].map((d) => [d, 400]));
    // both layers: the corner marks round the edge, smaller, and the centre line between them
    expect(at('edge').map((t) => t.text)).toEqual(['2', '7', '78']);
    expect(at('edge')[0].size).toBeLessThan(grid);
    // five or more centre marks beside corner marks: a smaller line, so it fits
    expect(at('edgeList').map((t) => t.text)).toEqual(['1', '5', '234578']);
    expect(at('edgeList')[2].size).toBeLessThan(at('edge')[2].size);
    // a cell without marks draws nothing
    expect(at('none')).toEqual([]);
    // and every place, size and weight is the board's own, scaled to the picture's cell
    expect(layoutOf(picture, grid)).toEqual(layoutOf(boardTexts(cells), 0.23));
  });

  it('draws a cell the hint marks as the board does then: both layers and the hint’s digits on the 3×3 grid', () => {
    let promotedCells = 0;
    for (const tech of ['X_WING', 'XY_CHAIN', 'AIC', 'SIMPLE_COLORS'] as Tech[]) {
      const ex = EXAMPLES[tech]!;
      // the player writes pairs and triples in the centre and longer lists in the corners, and leaves a marked cell blank
      const cells = cellsOf(ex).map((c, i) => {
        if (c.value) return c;
        if (i % 4 === 0) return { ...c, center: 0 };
        return ones(c.center) > 3 ? { ...c, corner: c.center, center: 0 } : c;
      });
      const solved = (c: number) => cells[c].value > 0;
      const full = frameMarks(ex.step, null, solved).cands;
      const svg = positionSvg({ cells, autoCandidates: false, step: ex.step });
      const texts = pictureTexts(svg);
      for (const [cell, marks] of full) {
        if (solved(cell)) continue;
        promotedCells++;
        // the union, each digit alone at its place, the corner marks a little bold and the hint's in its marks
        const union = digits(cells[cell].corner | cells[cell].center | [...marks.keys()].reduce((m, d) => m | bit(d), 0));
        const here = texts.filter((t) => t.cell === cell).sort((a, b) => Number(a.text) - Number(b.text));
        expect(here.map((t) => t.text), `${tech} r${Math.floor(cell / 9) + 1}c${(cell % 9) + 1}`).toEqual(union.map(String));
        for (const t of here) {
          const d = Number(t.text);
          expect(t.weight, `${tech} ${cell} ${d}`).toBe(marks.has(d) ? 700 : cells[cell].corner & bit(d) ? 600 : 400);
        }
      }
      // and the cells it does not mark keep their own layout
      const other = cells.findIndex((c, i) => !c.value && !full.has(i) && c.center && ones(c.center) <= 3);
      expect(texts.filter((t) => t.cell === other).map((t) => t.text), tech).toEqual([digits(cells[other].center).join('')]);
      // the picture's places are the board's (the hint's own marks drawn smaller in the picture, as its candidates are)
      const unmarkedOf = (list: Placed[]) => list.filter((t) => t.weight !== 700);
      expect(layoutOf(unmarkedOf(texts), 13 / 60), tech).toEqual(layoutOf(unmarkedOf(boardTexts(cells, ex.step)), 0.23));
    }
    expect(promotedCells).toBeGreaterThan(20);
  });

  it('has a marks tick only when the empty cells draw something', () => {
    const cells = laidOut();
    expect(hasMarksToDraw(cells, false)).toBe(true);
    expect(hasMarksToDraw(cells, true)).toBe(true);
    const bare = cells.map((c) => ({ ...c, corner: 0, center: 0 }));
    expect(hasMarksToDraw(bare, false)).toBe(false);
    expect(hasMarksToDraw(bare, true)).toBe(true);
    // a solved board's picture: its givens alone, nothing in the empty cells
    expect(count(positionSvg({ cells: bare, autoCandidates: false }), /class="(cd|cc|ce|cl)"/g)).toBe(0);
  });

  it('draws the player colours only when asked, as the board lays them', () => {
    const cells = played();
    const plain = positionSvg({ cells, autoCandidates: true });
    const coloured = positionSvg({ cells, autoCandidates: true, colours: true });
    for (const c of PALETTE) expect(plain).not.toContain(`fill="${c}"`);
    const swatches = [...coloured.matchAll(/<rect x="([\d.]+)" y="(\d+)" width="([\d.]+)" height="60" fill="(#[0-9a-f]{6})" fill-opacity="0.55"\/>/g)];
    expect(swatches.length).toBe(cells.reduce((n, c) => n + c.colors.length, 0));
    // a cell of two colours: each takes half of it, side by side
    const centre = swatches.filter((m) => m[2] === String(24 + 4 * 60));
    expect(centre.map((m) => [m[4], m[3]])).toContainEqual([PALETTE[1], '30.0']);
    expect(centre.map((m) => [m[4], m[3]])).toContainEqual([PALETTE[5], '30.0']);
  });

  it('prints the footer only when asked, under the board', () => {
    const cells = played();
    const without = positionSvg({ cells, autoCandidates: true });
    expect(svgSize(without)).toEqual({ width: BOARD_SIZE, height: BOARD_SIZE });
    expect(without).not.toContain('class="ft"');
    // the level and the rating held together, as the Share dialog writes them
    const footer = 'sudokui.app · Hard 1288';
    const svg = positionSvg({ cells, autoCandidates: true, footer });
    expect(svgSize(svg)).toEqual({ width: BOARD_SIZE, height: BOARD_SIZE + FOOTER_SIZE });
    expect(svg).toContain(`class="ft">${footer}</text>`);
    expect(printed(svg).filter((t) => !/^[1-9]$/.test(t))).toEqual([footer]);
    // the background reaches under the footer
    expect(svg).toContain(`<rect width="${BOARD_SIZE}" height="${BOARD_SIZE + FOOTER_SIZE}" rx="8"`);
    // a footer is written as text, never as markup
    expect(positionSvg({ cells, autoCandidates: true, footer: '<a href="x">' })).toContain('&lt;a href=&quot;x&quot;&gt;');
  });

  it("never prints a technique's name, in any language", () => {
    for (const [tech, ex] of examples) {
      for (const autoCandidates of [true, false]) {
        const svg = positionSvg({ cells: autoCandidates ? struckOf(ex) : cellsOf(ex), autoCandidates, step: ex.step, footer: 'sudokui.app · Hard 1288' });
        const words = [...printed(svg), /<title>([^<]*)<\/title>/.exec(svg)![1], /aria-label="([^"]*)"/.exec(svg)![1]].join(' ');
        for (const name of [TECHS[tech].name, nbNames[tech], esNames[tech]]) if (name) expect(words, tech).not.toContain(name);
        // the words printed: digits (a centre line among them), the sets' letters and the footer
        for (const t of printed(svg)) expect(t, tech).toMatch(/^([1-9]+|[A-Z]|sudokui\.app · Hard 1288)$/);
      }
    }
  });

  it('holds nothing a canvas would refuse to export: no link, no image, no foreign object', () => {
    const cells = played();
    const pictures = [
      positionSvg({ cells, autoCandidates: true, colours: true, footer: 'sudokui.app' }),
      positionSvg({ cells: laidOut(), autoCandidates: false, colours: true, footer: 'sudokui.app' }),
      ...examples.map(([, ex]) => positionSvg({ cells: cellsOf(ex), autoCandidates: false, step: ex.step, footer: 'sudokui.app' }))
    ];
    for (const svg of pictures) {
      expect(svg).not.toMatch(/href|<image|foreignObject|@import|url\((?!#)/i);
      // the only address is the SVG namespace's, which names it and fetches nothing
      expect(svg.match(/https?:\/\/[^"]*/g)).toEqual(['http://www.w3.org/2000/svg']);
    }
  });
});
