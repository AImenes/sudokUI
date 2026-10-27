// Where the app's board (src/ui/Grid.tsx) puts things, in its own units: a
// cell is 100 units, inside a 4-unit margin, and a cell's candidates sit on
// a 28-unit 3×3 pitch. The hint geometry (src/content/hintGeometry.ts) is
// told this through boardLayout, and the tests read the same layout.
import { SIZES, squareReach, hintDrawing } from '../content/hintGeometry';
import type { HintDrawing, Layout } from '../content/hintGeometry';
import { MARK } from '../content/hintPalette';
import { frameMarks, markedCandidates, placedKeys, squareKeys } from '../content/hintMarks';
import type { HintMarks } from '../content/hintMarks';
import type { CellDigit, Step } from '../engine/steps';

export const SIZE = 100;
export const M = 4; // outer margin

/** candidate position inside a cell (3x3 layout, digit 1 top-left): the text's baseline */
export const candX = (d: number) => 22 + ((d - 1) % 3) * 28;
export const candY = (d: number) => 30 + Math.floor((d - 1) / 3) * 28;

/** a placement's mark reaches out to its outer ring, at the size a small board draws it */
export const PLACED_RADIUS = (MARK.placeRingSmall + MARK.placeRingSmallStroke / 2) * SIZE;

/** how far a "one of these" square reaches along a direction (docs/hint-drawing-sets.md, decision 4): 13 on its axes, 15.5 at its corners */
export const squareReachOf = (dir: { x: number; y: number }) => squareReach(dir, MARK.oneOf * SIZE, MARK.oneOfRadius * SIZE);
/** a square's reach at its corners, the most it reaches: what keeps off it keeps off that */
export const SQUARE_RADIUS = squareReachOf({ x: Math.SQRT1_2, y: Math.SQRT1_2 });

/**
 * Whether a cell shows a digit at its place on the 3×3 grid, which a hint's
 * heads, start dots and walk numbers keep off (src/content/hintGeometry.ts):
 * with auto candidates on (`auto`, the cell's candidates), or in a cell the
 * hint marks (`marks`, which stays on the 3×3 through the walk), its
 * candidates and the digits the hint marks; otherwise the player's own
 * marks as Grid.tsx renderMarks draws them: corner marks alone, or five or
 * more centre marks, at their places; a centre line, or corner marks round
 * the edge with a centre line, runs through the cell, so every place there
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
  if (!c.corner && c.center) {
    let n = 0;
    for (let x = c.center; x; x &= x - 1) n++;
    return n >= 5 ? (c.center & b) !== 0 : true;
  }
  return !!(c.corner || c.center);
}

/**
 * Where the app board draws its candidates' marks, and which digits it
 * shows, for the hint geometry; `placed` the placements, whose outer ring
 * reaches further, and `squares` the candidates drawn as "one of these"
 * squares in any view of the hint (src/content/hintMarks.ts squareKeys),
 * which reach further at their corners
 */
export const boardLayout = (
  placed: Set<string> = new Set(),
  shown?: Layout['shown'],
  solved?: Layout['solved'],
  squares: Set<string> = new Set()
): Layout => {
  const radiusOf = (cd: { cell: number; digit: number }) =>
    placed.has(`${cd.cell}:${cd.digit}`) ? PLACED_RADIUS : squares.has(`${cd.cell}:${cd.digit}`) ? SQUARE_RADIUS : SIZES.r * SIZE;
  return {
    centre: ({ cell, digit }) => ({
      x: M + (cell % 9) * SIZE + candX(digit),
      y: M + Math.floor(cell / 9) * SIZE + candY(digit) - 7
    }),
    r: SIZES.r * SIZE,
    radiusOf,
    ...(squares.size ? { reach: (cd, dir) => (squares.has(`${cd.cell}:${cd.digit}`) ? squareReachOf(dir) : radiusOf(cd)) } : {}),
    ...(shown ? { shown } : {}),
    ...(solved ? { solved } : {}),
    cell: SIZE,
    bounds: { x0: M, y0: M, x1: M + 9 * SIZE, y1: M + 9 * SIZE }
  };
};

/** a hint's drawing on the app's board, and what it was worked out from */
export interface BoardDrawing extends HintDrawing {
  /** the full view's marks */
  full: HintMarks;
  /** every candidate they hold, which the arrows bend round */
  marks: CellDigit[];
  /** whether the board shows a digit at its place on a cell's 3×3 */
  shown: (cd: CellDigit) => boolean;
  /** the board's layout, the placements' rings and the squares any frame draws reaching further than a disc */
  layout: Layout;
}

/**
 * A hint's arrows, start dots and walk numbers, its groups' bars and its
 * sets' tiles and tabs, as the app's board works them out (src/ui/Grid.tsx
 * `drawing`; the drawing fixtures and the geometry tests call it too, so
 * they hold the board's own code): once for the whole hint, from the full
 * view's marks and every link, so an arrow the reader has followed never
 * moves as the walk goes on. An arrow bends round the hint's marks and
 * nothing else; a placement's mark reaches out to its outer ring, and a
 * square any frame draws further than a disc at its corners
 * (docs/hint-drawing-sets.md, decision 4); a head, a dot and a number keep
 * off the digits the board shows. `cellOf` a cell's digit and the player's
 * own marks, `auto` a cell's candidates when the board shows them all
 */
export function boardDrawing(
  step: Step,
  cellOf: (cell: number) => { value: number; corner: number; center: number },
  auto: ((cell: number) => number) | null
): BoardDrawing {
  const solved = (cell: number) => cellOf(cell).value > 0;
  const full = frameMarks(step, null, solved);
  const marks = markedCandidates(full);
  // a cell the hint marks shows its digits at their places on the 3×3
  const shown = (cd: CellDigit) => digitShown(cellOf(cd.cell), cd.digit, auto ? auto(cd.cell) : null, full.cands.get(cd.cell));
  const layout = boardLayout(placedKeys(full), shown, solved, squareKeys(step, solved));
  // the groups' bars and the sets' tiles and tabs first: the arrows, dots and numbers keep off them
  return { ...hintDrawing(step, layout, marks), full, marks, shown, layout };
}
