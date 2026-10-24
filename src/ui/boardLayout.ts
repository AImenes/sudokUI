// Where the app's board (src/ui/Grid.tsx) puts things, in its own units: a
// cell is 100 units, inside a 4-unit margin, and a cell's candidates sit on
// a 28-unit 3×3 pitch. The hint geometry (src/content/hintGeometry.ts) is
// told this through boardLayout, and the tests read the same layout.
import { SIZES } from '../content/hintGeometry';
import type { Layout } from '../content/hintGeometry';
import { MARK } from '../content/hintPalette';

export const SIZE = 100;
export const M = 4; // outer margin

/** candidate position inside a cell (3x3 layout, digit 1 top-left): the text's baseline */
export const candX = (d: number) => 22 + ((d - 1) % 3) * 28;
export const candY = (d: number) => 30 + Math.floor((d - 1) / 3) * 28;

/** a placement's mark reaches out to its outer ring, at the size a small board draws it */
export const PLACED_RADIUS = (MARK.placeRingSmall + MARK.placeRingSmallStroke / 2) * SIZE;

/** where the app board draws its candidates' marks, and which digits it shows, for the hint geometry */
export const boardLayout = (placed: Set<string> = new Set(), shown?: Layout['shown'], solved?: Layout['solved']): Layout => ({
  centre: ({ cell, digit }) => ({
    x: M + (cell % 9) * SIZE + candX(digit),
    y: M + Math.floor(cell / 9) * SIZE + candY(digit) - 7
  }),
  r: SIZES.r * SIZE,
  radiusOf: (cd) => (placed.has(`${cd.cell}:${cd.digit}`) ? PLACED_RADIUS : SIZES.r * SIZE),
  ...(shown ? { shown } : {}),
  ...(solved ? { solved } : {}),
  cell: SIZE,
  bounds: { x0: M, y0: M, x1: M + 9 * SIZE, y1: M + 9 * SIZE }
});
