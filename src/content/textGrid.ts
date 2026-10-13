// A position as text, the way players pass one around: the pencil-mark
// grid every r/sudoku and Enjoy Sudoku post pastes (HoDoKu's "copy
// candidates", SudokuWiki's export), HoDoKu's library string, and the
// 81-character line with a candidate list after it. formatPencilGrid
// writes the first; parsePencilGrid reads all three, tolerant of the
// frames people draw by hand. Nothing here touches the store: a cell is
// whatever carries a value and its marks, so the engine, the tests and
// the browser test can all use it.
import { emptyGrid, setValue, bit, digitsOf, ALL_CANDS } from '../engine/board';
import type { MarkContract } from '../state/gameStore';

/** what a cell needs to be written: the store's CellState has all of it */
export interface MarkedCell {
  value: number;
  corner: number;
  center: number;
  excluded: number;
}

/** a position read from text */
export interface TextPosition {
  /** 81 values, 0 for an empty cell */
  values: number[];
  /**
   * which solved cells are givens: every one, unless the text tells placed
   * digits apart (a HoDoKu library string writes them +5)
   */
  given: boolean[];
  /**
   * a candidate mask per cell (bit 0 = digit 1; 0 for a solved cell), or
   * null when the text carries values only
   */
  cands: number[] | null;
}

/**
 * The candidates each empty cell shows, as the board shows them: the auto
 * candidates when they are on (the canonical set less the strikes), the
 * player's marks (corner and centre together) under the exhaustive
 * contract, and the canonical set for every other cell.
 */
export function shownCandidates(cells: readonly MarkedCell[], autoCandidates: boolean, contract: MarkContract): number[] {
  const g = emptyGrid();
  for (let i = 0; i < 81; i++) if (cells[i].value) setValue(g, i, cells[i].value);
  return cells.map((c, i) => {
    if (c.value) return 0;
    if (autoCandidates) return g.cands[i] & ~c.excluded;
    const marks = c.corner | c.center;
    return contract === 'exhaustive' && marks ? marks : g.cands[i];
  });
}

/**
 * The pencil-mark grid: nine rows of nine cells, a placed digit or the
 * cell's candidates in each, every column as wide as the longest cell,
 * the boxes framed the way HoDoKu draws them:
 *
 *   .------------.------------.------------.
 *   | 12   3  45 | 6   78  9  | 1   2   3  |
 *   :------------+------------+------------:
 *   '------------'------------'------------'
 */
export function formatPencilGrid(cells: readonly MarkedCell[], autoCandidates: boolean, contract: MarkContract): string {
  const cands = shownCandidates(cells, autoCandidates, contract);
  const texts = cells.map((c, i) => (c.value ? String(c.value) : digitsOf(cands[i]).join('') || '.'));
  const width = Math.max(...texts.map((t) => t.length));
  const bar = '-'.repeat(3 * width + 4);
  const frame = (left: string, mid: string, right: string) => `${left}${bar}${mid}${bar}${mid}${bar}${right}`;
  const lines = [frame('.', '.', '.')];
  for (let r = 0; r < 9; r++) {
    const boxes = [0, 3, 6].map((c0) => [0, 1, 2].map((k) => texts[r * 9 + c0 + k].padEnd(width)).join(' '));
    lines.push(`| ${boxes.join(' | ')} |`);
    if (r === 2 || r === 5) lines.push(frame(':', '+', ':'));
  }
  lines.push(frame("'", "'", "'"));
  return lines.join('\n');
}

/** a line that only draws a frame: .----.----. or +----+----+ or :----+----: */
const isFrameLine = (line: string) => /^[\s.:'*+|=_-]*$/.test(line) && /[-=_]/.test(line);

/** the mask of a run of digits, "1259" */
const maskOf = (run: string) => [...run].reduce((m, ch) => m | bit(Number(ch)), 0);

/** the canonical candidates of a position's values */
function canonical(values: number[]): number[] {
  const g = emptyGrid();
  for (let i = 0; i < 81; i++) if (values[i]) setValue(g, i, values[i]);
  return Array.from(g.cands, (c, i) => (values[i] ? 0 : c));
}

/**
 * A grid drawn in rows: nine lines of nine cells, a cell being a digit, a
 * run of candidates, or . or 0 for an empty cell with nothing written,
 * between whatever frame lines and | the writer drew. A grid of single
 * digits and dots is a puzzle: its values, no candidates.
 */
function parseRows(text: string): TextPosition | null {
  const rows: string[][] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || isFrameLine(line)) continue;
    // a row holds cells and the bars between boxes, nothing else (prose,
    // a caption, a chain under the grid, is skipped)
    const body = line.replace(/[|+:'*=_]/g, ' ');
    if (!/^[\s.0-9]+$/.test(body)) continue;
    const tokens = body.match(/[1-9]+|[.0]/g) ?? [];
    if (tokens.length === 9) rows.push(tokens);
  }
  if (rows.length !== 9) return null;
  const tokens = rows.flat();
  const values = tokens.map((t) => (t.length === 1 && t !== '.' ? Number(t) : 0));
  if (tokens.every((t) => t.length === 1)) return { values, given: values.map(Boolean), cands: null };
  const cands = tokens.map((t) => (t.length > 1 ? maskOf(t) : 0));
  return { values, given: values.map(Boolean), cands };
}

/**
 * HoDoKu's library string, :0000:x:<81 cells>:<deleted candidates>:...:
 * where a cell placed by the solver is written +5 and the deleted
 * candidates are dRC codes (418 = 4 removed from r1c8), so the position
 * is the canonical candidates of the values less those.
 */
function parseLibrary(text: string): TextPosition | null {
  const m = /^:\d{4}:[^:]*:([+0-9.]+):([^:]*)(?::.*)?$/s.exec(text.trim());
  if (!m) return null;
  const values: number[] = [];
  const given: boolean[] = [];
  for (let i = 0; i < m[1].length; i++) {
    const ch = m[1][i];
    if (ch === '+') continue;
    values.push(ch === '.' || ch === '0' ? 0 : Number(ch));
    given.push(ch !== '.' && ch !== '0' && m[1][i - 1] !== '+');
  }
  if (values.length !== 81) return null;
  const cands = canonical(values);
  for (const [, d, r, c] of m[2].matchAll(/(?:^|\s)-?([1-9])([1-9])([1-9])(?=\s|$)/g)) {
    cands[(Number(r) - 1) * 9 + Number(c) - 1] &= ~bit(Number(d));
  }
  return { values, given, cands };
}

/**
 * The 81-character line with its candidates after it: either one token per
 * cell (the digit, or the candidates of an empty cell), or dRC codes of
 * the candidates deleted from the canonical set, as the library string
 * lists them. A bare line is left to the puzzle import.
 */
function parseLineWithCandidates(text: string): TextPosition | null {
  const m = /^\s*([0-9.]{81})\s+(\S[\s\S]*)$/.exec(text);
  if (!m) return null;
  const values = [...m[1]].map((ch) => (ch === '.' ? 0 : Number(ch)));
  const tokens = m[2].trim().split(/\s+/);
  const given = values.map(Boolean);
  if (tokens.length === 81 && tokens.every((t) => /^(?:[1-9]+|[.0])$/.test(t))) {
    // the line already says which cells are solved, so a single digit in
    // an empty cell is its one candidate
    const cands = tokens.map((t, i) => (values[i] || t === '.' || t === '0' ? 0 : maskOf(t)));
    return { values, given, cands };
  }
  if (tokens.every((t) => /^-?[1-9]{3}$/.test(t))) {
    const cands = canonical(values);
    for (const t of tokens) {
      const [d, r, c] = t.replace('-', '').split('').map(Number);
      cands[(r - 1) * 9 + c - 1] &= ~bit(d);
    }
    return { values, given, cands };
  }
  return null;
}

/**
 * A position from text, or null: a pencil-mark grid (with or without its
 * frame, drawn with .-| or +-|, a placed digit as one digit and candidates
 * as a run of them), a HoDoKu library string, or the 81-character line
 * followed by a candidate list. A grid of digits and dots alone is a
 * puzzle without candidates; a bare 81-character line is not a position
 * at all (the puzzle import reads it).
 */
export function parsePencilGrid(text: string): TextPosition | null {
  const position = parseLibrary(text) ?? parseRows(text) ?? parseLineWithCandidates(text);
  if (!position) return null;
  if (position.cands) {
    // a candidate list is only as good as its cells: a solved cell has none,
    // and nothing written in a cell means nothing is known about it
    position.cands = position.cands.map((m, i) => (position.values[i] ? 0 : m & ALL_CANDS));
  }
  return position;
}

/**
 * The puzzle a text carries as 81 characters of digits and dots, or null:
 * the frame lines of a drawn grid are dropped first, so their dots do not
 * count as cells, and every other character that is not a cell is ignored.
 */
export function puzzleStringOf(text: string): string | null {
  const chars = text
    .split(/\r?\n/)
    .filter((line) => !isFrameLine(line.trim()))
    .join('')
    .replace(/[^0-9.]/g, '');
  return chars.length === 81 ? chars : null;
}

/** does the text look like a grid drawn in rows, so a failure is worth explaining as one? */
export function looksLikeGrid(text: string): boolean {
  return text.split(/\r?\n/).filter((line) => /\d/.test(line)).length >= 5;
}
