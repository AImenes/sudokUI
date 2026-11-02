/**
 * The picture of the player's board (src/content/boardImage.ts), drawn by
 * the Learn diagrams' renderer (src/content/boardSvg.ts) and shared from the
 * Share dialog and the hint panel (docs/reach-plan-2026-11.md, build item 3):
 * no hint marks without a step; with a step, the same drawing as the
 * example's diagram; at a walk frame, what the board draws in that frame,
 * but for the walk's numbers on the arrows, which it leaves out;
 * the candidates the pencil-mark grid writes; the player's colours and the
 * footer only when asked; never a technique's name; and nothing a canvas
 * would refuse to export (a link, an image, a foreign object).
 */
import { describe, it, expect } from 'vitest';
import { EXAMPLES } from '../src/content/examples';
import { boardSvg, BOARD_SIZE, FOOTER_SIZE } from '../src/content/boardSvg';
import type { Example } from '../src/content/boardSvg';
import { positionSvg, pictureOf, svgSize } from '../src/content/boardImage';
import type { PictureCell } from '../src/content/boardImage';
import { shownCandidates } from '../src/content/textGrid';
import { PALETTE } from '../src/content/playerColours';
import { frameMarks } from '../src/content/hintMarks';
import { walkFrames, drawnLinks } from '../src/engine/hintFrames';
import { TECHS, type Tech } from '../src/engine/ratings';
import { parseGrid, bit } from '../src/engine/board';
import { techNames as nbNames } from '../src/content/locales/names.nb';
import { techNames as esNames } from '../src/content/locales/names.es';

const examples = Object.entries(EXAMPLES).filter((e): e is [Tech, Example] => !!e[1]);

/** the example's position as the store keeps it: its digits, givens as givens, its candidates as centre marks */
const cellsOf = (ex: Example): PictureCell[] =>
  [...ex.values].map((ch, i) => {
    const value = Number(ch);
    return { given: ex.puzzle[i] >= '1' && ex.puzzle[i] <= '9', value, corner: 0, center: value ? 0 : ex.cands[i], excluded: 0, colors: [] };
  });

/** the mask's name hashes the puzzle string and the step's index, which a picture of a board does not keep */
const unmasked = (svg: string) => svg.replace(/knockout-[a-z0-9]+/g, 'knockout');

/** the words an SVG prints: its text elements' contents */
const printed = (svg: string) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

/** how often a pattern is drawn, outside the mask that holds a copy of the digits to cut them out of the lines */
const count = (svg: string, re: RegExp) => svg.replace(/<mask [\s\S]*?<\/mask>/g, '').match(re)?.length ?? 0;

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

describe('a picture of the board', () => {
  it('draws no hint marks without a step', () => {
    for (const autoCandidates of [true, false]) {
      const svg = positionSvg({ cells: played(), autoCandidates, markContract: 'exhaustive' });
      // marks are circles, rounded squares, bars and arrows; the board alone draws none
      expect(svg).not.toMatch(/<circle|<polygon|<path|<mask|class="(mk|rm|sq|gb|tl|to|tb)"/);
      // and no house band: the only rectangles are the board, its frame and the colours (off here)
      expect(count(svg, /<rect /g)).toBe(2);
      expect(printed(svg).every((t) => /^[1-9]$/.test(t))).toBe(true);
    }
  });

  it('with a step, draws what the example diagram draws', () => {
    for (const [tech, ex] of examples) {
      const title = `${TECHS[tech].name} example`;
      const picture = positionSvg({ cells: cellsOf(ex), autoCandidates: false, markContract: 'exhaustive', step: ex.step, title });
      expect(unmasked(picture), tech).toBe(unmasked(boardSvg(ex, title)));
    }
  });

  it("at a walk frame, draws what the board draws in that frame but the walk's numbers, and the full view without one", () => {
    let frames = 0;
    let startDots = 0;
    for (const [tech, ex] of examples) {
      const cells = cellsOf(ex);
      const solved = (c: number) => cells[c].value > 0;
      const base = { cells, autoCandidates: false, markContract: 'exhaustive' as const, step: ex.step };
      for (const frame of [null, ...walkFrames(ex.step)]) {
        const svg = positionSvg({ ...base, frame });
        // every candidate the frame marks wears its mark (a bold digit), and no other does
        const marked = [...frameMarks(ex.step, frame, solved).cands].reduce((n, [cell, m]) => n + (solved(cell) ? 0 : m.size), 0);
        expect(count(svg, /class="(mk|rm)"/g), `${tech} ${frame?.text ?? 'full'}`).toBe(marked);
        // a start dot only on a link the frame draws: none before the first link
        const dots = count(svg, /<circle [^>]*r="3\.8" fill="#151a24" stroke="#ffffff" stroke-width="1\.2"\/>/g);
        if (!drawnLinks(ex.step, frame).size) expect(dots, `${tech} ${frame?.text ?? 'full'}`).toBe(0);
        else startDots += dots;
        if (frame) frames++;
      }
      expect(unmasked(positionSvg({ ...base, frame: null }))).toBe(unmasked(positionSvg(base)));
    }
    expect(frames).toBeGreaterThan(100);
    expect(startDots).toBeGreaterThan(50);
  });

  it('draws the candidates the pencil-mark grid writes, and with them off only what a hint marks', () => {
    for (const autoCandidates of [true, false]) {
      for (const markContract of ['exhaustive', 'open'] as const) {
        const cells = played();
        const shown = shownCandidates(cells, autoCandidates, markContract);
        expect(pictureOf({ cells, autoCandidates, markContract }).cands).toEqual(shown);
        const svg = positionSvg({ cells, autoCandidates, markContract });
        expect(count(svg, /class="cd"/g)).toBe(shown.reduce((n, m) => n + m.toString(2).replace(/0/g, '').length, 0));
        expect(count(positionSvg({ cells, autoCandidates, markContract, candidates: false }), /class="cd"/g)).toBe(0);
      }
    }
    // with a hint, a candidate the hint marks is drawn though the candidates are off, and no other
    const ex = EXAMPLES.X_WING!;
    const cells = cellsOf(ex);
    const svg = positionSvg({ cells, autoCandidates: false, markContract: 'exhaustive', step: ex.step, candidates: false });
    expect(count(svg, /class="cd"/g)).toBe(0);
    expect(count(svg, /class="(mk|rm)"/g)).toBeGreaterThan(0);
  });

  it('draws the player colours only when asked, as the board lays them', () => {
    const cells = played();
    const plain = positionSvg({ cells, autoCandidates: true, markContract: 'exhaustive' });
    const coloured = positionSvg({ cells, autoCandidates: true, markContract: 'exhaustive', colours: true });
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
    const without = positionSvg({ cells, autoCandidates: true, markContract: 'exhaustive' });
    expect(svgSize(without)).toEqual({ width: BOARD_SIZE, height: BOARD_SIZE });
    expect(without).not.toContain('class="ft"');
    // the level and the rating held together, as the Share dialog writes them
    const footer = 'sudokui.app · Hard\u00a01288';
    const svg = positionSvg({ cells, autoCandidates: true, markContract: 'exhaustive', footer });
    expect(svgSize(svg)).toEqual({ width: BOARD_SIZE, height: BOARD_SIZE + FOOTER_SIZE });
    expect(svg).toContain(`class="ft">${footer}</text>`);
    expect(printed(svg).filter((t) => !/^[1-9]$/.test(t))).toEqual([footer]);
    // the background reaches under the footer
    expect(svg).toContain(`<rect width="${BOARD_SIZE}" height="${BOARD_SIZE + FOOTER_SIZE}" rx="8"`);
    // a footer is written as text, never as markup
    expect(positionSvg({ cells, autoCandidates: true, markContract: 'exhaustive', footer: '<a href="x">' })).toContain('&lt;a href=&quot;x&quot;&gt;');
  });

  it("never prints a technique's name, in any language", () => {
    for (const [tech, ex] of examples) {
      const svg = positionSvg({ cells: cellsOf(ex), autoCandidates: false, markContract: 'exhaustive', step: ex.step, footer: 'sudokui.app · Hard\u00a01288' });
      const words = [...printed(svg), /<title>([^<]*)<\/title>/.exec(svg)![1], /aria-label="([^"]*)"/.exec(svg)![1]].join(' ');
      for (const name of [TECHS[tech].name, nbNames[tech], esNames[tech]]) if (name) expect(words, tech).not.toContain(name);
      // the words printed: digits, the sets' letters and the footer
      for (const t of printed(svg)) expect(t, tech).toMatch(/^([1-9]|[A-Z]|sudokui\.app · Hard\u00a01288)$/);
    }
  });

  it('holds nothing a canvas would refuse to export: no link, no image, no foreign object', () => {
    const cells = played();
    const pictures = [
      positionSvg({ cells, autoCandidates: true, markContract: 'exhaustive', colours: true, footer: 'sudokui.app' }),
      ...examples.map(([, ex]) => positionSvg({ cells: cellsOf(ex), autoCandidates: false, markContract: 'exhaustive', step: ex.step, footer: 'sudokui.app' }))
    ];
    for (const svg of pictures) {
      expect(svg).not.toMatch(/href|<image|foreignObject|@import|url\((?!#)/i);
      // the only address is the SVG namespace's, which names it and fetches nothing
      expect(svg.match(/https?:\/\/[^"]*/g)).toEqual(['http://www.w3.org/2000/svg']);
    }
  });
});
