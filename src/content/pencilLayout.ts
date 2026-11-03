// How a cell's own pencil marks are laid out: the one rule the app's board
// (src/ui/Grid.tsx renderMarks) and the picture of it a player shares
// (src/content/boardSvg.ts, given the marks by src/content/boardImage.ts)
// both draw by, in the board's units: a cell is 100, its 3×3 places on a
// 28-unit pitch (src/ui/boardLayout.ts candX, candY). A drawing in other
// units scales these.

/**
 * How a cell's marks are drawn when no hint marks the cell (one that does
 * puts both layers and the hint's digits on the 3×3 grid). Chosen so
 * nothing ever overlaps:
 *
 * - 'grid': corner marks alone, each digit at its place on the 3×3 grid;
 * - 'line': up to four centre marks alone, a line in the middle, as a note reads;
 * - 'list': five or more centre marks alone, at their places on the 3×3,
 *   as a full list reads;
 * - 'edge': both layers, the corner marks round the edge (PERIMETER) and
 *   the centre marks a line in the middle.
 */
export type PencilLayout = 'none' | 'grid' | 'line' | 'list' | 'edge';

const count = (mask: number) => {
  let n = 0;
  for (let x = mask; x; x &= x - 1) n++;
  return n;
};

export function pencilLayout(corner: number, center: number): PencilLayout {
  if (corner && center) return 'edge';
  if (corner) return 'grid';
  if (center) return count(center) <= 4 ? 'line' : 'list';
  return 'none';
}

/** the size of a digit on the 3×3 grid */
export const GRID_SIZE = 23;

/** Perimeter slots for corner marks when a cell ALSO holds centre marks —
 *  the classic SudokuPad arrangement, keeping the middle free for the
 *  centre line. Filled in digit order; each is a digit's centre across and
 *  its baseline. */
export const PERIMETER: readonly (readonly [number, number])[] = [
  [21, 30], // top-left
  [79, 30], // top-right
  [21, 92], // bottom-left
  [79, 92], // bottom-right
  [50, 30], // top-middle
  [50, 92], // bottom-middle
  [21, 62], // left-middle
  [79, 62] // right-middle
];

/** the size of a corner mark round the edge */
export const EDGE_SIZE = 21;

/** a line of up to four centre marks, alone or beside corner marks: its size and its baseline */
export const LINE_SIZE = 26;
export const LINE_Y = 58;

/** five or more centre marks beside corner marks: a smaller line, so it fits between them, and its baseline */
export const longLineSize = (n: number) => Math.min(22, 118 / n + 4);
export const LONG_LINE_Y = 57;

/**
 * Whether a cell shows a digit at its place on the 3×3 grid, which a hint's
 * heads, start dots and walk numbers keep off (src/content/hintGeometry.ts):
 * with auto candidates on (`auto`, the cell's candidates), or in a cell the
 * hint marks (`marks`, which stays on the 3×3 through the walk), its
 * candidates and the digits the hint marks; otherwise the player's own
 * marks as they are laid out above: corner marks alone, or five or more
 * centre marks, at their places; a centre line, or corner marks round the
 * edge with a centre line, runs through the cell, so every place there
 * counts as taken
 */
export function digitShown(
  c: { value: number; corner: number; center: number },
  digit: number,
  auto: number | null,
  marks?: { has(digit: number): boolean }
): boolean {
  if (c.value) return false;
  const b = 1 << (digit - 1);
  if (auto !== null || marks) return !!marks?.has(digit) || ((auto ?? c.corner | c.center) & b) !== 0;
  if (c.corner && !c.center) return (c.corner & b) !== 0;
  if (!c.corner && c.center) return count(c.center) >= 5 ? (c.center & b) !== 0 : true;
  return !!(c.corner || c.center);
}
