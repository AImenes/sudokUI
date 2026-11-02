// A picture of the player's own board, to post where solvers talk: the
// position as it stands, its candidates as the board shows them (the same
// candidates the pencil-mark grid writes, src/content/textGrid.ts), the
// player's colours, and a hint drawn as the board draws it, in full or at
// the walk's frame shown. Drawn by the Learn diagrams' renderer
// (src/content/boardSvg.ts), always light, with system fonts and nothing
// fetched: the SVG holds no link, no image and no foreign object, so a
// canvas turns it into a PNG on the device, offline (src/ui/boardPng.ts).
// Pure: the store, the Share dialog and the tests all call it the same way.
import { bit } from '../engine/board';
import type { Step } from '../engine/steps';
import type { Frame } from '../engine/hintFrames';
import type { MarkContract } from '../state/gameStore';
import { boardSvg } from './boardSvg';
import type { BoardPicture } from './boardSvg';
import { frameMarks } from './hintMarks';
import { shownCandidates } from './textGrid';
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
  markContract: MarkContract;
  /** the candidates, as the board shows them; on unless false. Off, only the digits a hint marks */
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

/**
 * The board the picture draws: its digits, which are givens, and each
 * empty cell's candidates as the board shows them (shownCandidates), with
 * every digit the hint marks in the frame shown besides, as the board adds
 * them (a mark with no digit says nothing)
 */
export function pictureOf(p: PositionPicture): BoardPicture {
  const solved = (cell: number) => p.cells[cell].value > 0;
  const shown = p.candidates === false ? p.cells.map(() => 0) : shownCandidates(p.cells, p.autoCandidates, p.markContract);
  const marks = p.step ? frameMarks(p.step, p.frame ?? null, solved).cands : new Map<number, Map<number, unknown>>();
  return {
    puzzle: p.cells.map((c) => (c.given && c.value ? c.value : 0)).join(''),
    stepIndex: 0,
    values: p.cells.map((c) => c.value).join(''),
    cands: shown.map((mask, cell) => (solved(cell) ? 0 : [...(marks.get(cell)?.keys() ?? [])].reduce((m, d) => m | bit(d), mask))),
    step: p.step ?? null
  };
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
