// A picture of the player's own board, to post where solvers talk: the
// position as the player sees it, the candidates or the pencil marks as the
// board draws them, the player's colours, and a hint drawn as the board
// draws it, in full or at the walk's frame shown (without the walk's
// numbers on the arrows, which the board adds while walking). Drawn by the
// Learn diagrams' renderer (src/content/boardSvg.ts), always light, with
// system fonts and nothing fetched: the SVG holds no link, no image and no
// foreign object, so a canvas turns it into a PNG on the device, offline
// (src/ui/boardPng.ts). Pure: the store, the Share dialog and the tests all
// call it the same way.
import { bit } from '../engine/board';
import type { Step } from '../engine/steps';
import type { Frame } from '../engine/hintFrames';
import { boardSvg } from './boardSvg';
import type { BoardPicture } from './boardSvg';
import { frameMarks } from './hintMarks';
import { candidateLists } from './textGrid';
import type { MarkedCell } from './textGrid';

/** a cell as the picture needs it: the store's CellState has all of it */
export interface PictureCell extends MarkedCell {
  given: boolean;
  colors: readonly number[];
}

/** what to draw */
export interface PositionPicture {
  cells: readonly PictureCell[];
  autoCandidates: boolean;
  /**
   * what the board draws in its empty cells, on unless false: the auto
   * candidates with them on, the player's own pencil marks with them off.
   * Off, only the digits a hint marks
   */
  candidates?: boolean;
  /** the player's colours; off unless true */
  colours?: boolean;
  /** a hint, drawn as the board draws it */
  step?: Step | null;
  /** the walk's frame shown; the hint in full when absent */
  frame?: Frame | null;
  /** a line under the board, such as 'sudokui.app · Hard 1288'; none when absent */
  footer?: string;
  /** the picture's accessible name; never a technique's name, which the picture does not print */
  title?: string;
}

/** a cell without marks */
const BARE = { corner: 0, center: 0 };

/**
 * The board the picture draws, as the board draws it: its digits, which are
 * givens, and in each empty cell, with auto candidates on, the auto
 * candidates (the engine's, less the player's strikes); with them off, the
 * player's own corner and centre marks, whatever the marks' contract, laid
 * out as the board lays them out (`marks`); and, either way, every digit
 * the hint marks in the frame shown, as the board adds them (a mark with
 * no digit says nothing). With the candidates off, only those digits
 */
export function pictureOf(p: PositionPicture): BoardPicture {
  const solved = (cell: number) => p.cells[cell].value > 0;
  const own = p.candidates !== false && !p.autoCandidates;
  const shown =
    p.candidates === false
      ? p.cells.map(() => 0)
      : p.autoCandidates
        ? candidateLists(p.cells, true, 'unknown')
        : p.cells.map((c) => c.corner | c.center);
  const marks = p.step ? frameMarks(p.step, p.frame ?? null, solved).cands : new Map<number, Map<number, unknown>>();
  return {
    puzzle: p.cells.map((c) => (c.given && c.value ? c.value : 0)).join(''),
    stepIndex: 0,
    values: p.cells.map((c) => c.value).join(''),
    cands: shown.map((mask, cell) => (solved(cell) ? 0 : [...(marks.get(cell)?.keys() ?? [])].reduce((m, d) => m | bit(d), mask))),
    ...(own ? { marks: p.cells.map((c) => (c.value ? BARE : { corner: c.corner, center: c.center })) } : {}),
    step: p.step ?? null
  };
}

/** does the picture have anything to draw under its marks tick: candidates, or some pencil mark? */
export function hasMarksToDraw(cells: readonly PictureCell[], autoCandidates: boolean): boolean {
  return cells.some((c) => !c.value && (autoCandidates || (c.corner | c.center) !== 0));
}

/** the picture as an SVG document (src/content/boardSvg.ts) */
export function positionSvg(p: PositionPicture): string {
  return boardSvg(pictureOf(p), p.title ?? 'sudokUI', {
    frame: p.frame ?? null,
    colours: p.colours ? p.cells.map((c) => c.colors) : undefined,
    footer: p.footer
  });
}

/** the SVG's size in its own units, from its viewBox */
export function svgSize(svg: string): { width: number; height: number } {
  const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : { width: 0, height: 0 };
}
