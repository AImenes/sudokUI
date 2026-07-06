import { Grid, bit, digitsOf, popcount, sees, cellNames, cellName } from '../board';
import { Step, CellDigit } from '../steps';

/**
 * Extended Unique Rectangles (sudokuwiki.org/Extended_Unique_Rectangles).
 *
 * Six unsolved cells in two parallel lines of the same chute — two columns of
 * one stack crossing three rows in three different bands, or two rows of one
 * band crossing three columns in three different stacks — so each line-pair
 * sits inside one box and the formation spans exactly three boxes.
 *
 * If all six cells were restricted to one trio of digits {x,y,z}, any
 * completion would put all three digits in each long line, and swapping the
 * two cells of every line-pair would yield a second valid solution (rows,
 * columns and boxes all keep the same digit sets). A proper puzzle cannot
 * contain that, so:
 *
 * - Type 1: exactly one cell carries extra candidates → that cell must take
 *   one of the extras; the trio digits are removed from it.
 * - Type 2: the extras are a single digit z (in any number of cells) → some
 *   cell must take z; z is removed from outside cells seeing all z-cells.
 */
export function findExtendedRectangle(g: Grid): Step | null {
  for (const columns of [true, false]) {
    for (let chute = 0; chute < 3; chute++) {
      // the two parallel lines within the chute (3 choose 2)
      for (const [l1, l2] of [
        [0, 1],
        [0, 2],
        [1, 2]
      ]) {
        const lineA = chute * 3 + l1;
        const lineB = chute * 3 + l2;
        // one crossing line from each of the three perpendicular chutes
        for (let p0 = 0; p0 < 3; p0++) {
          for (let p1 = 3; p1 < 6; p1++) {
            for (let p2 = 6; p2 < 9; p2++) {
              const cells: number[] = [];
              for (const cross of [p0, p1, p2]) {
                for (const line of [lineA, lineB]) {
                  cells.push(columns ? cross * 9 + line : line * 9 + cross);
                }
              }
              if (cells.some((c) => g.values[c] !== 0)) continue;
              const step = checkFormation(g, cells);
              if (step) return step;
            }
          }
        }
      }
    }
  }
  return null;
}

function checkFormation(g: Grid, cells: number[]): Step | null {
  let union = 0;
  for (const c of cells) union |= g.cands[c];
  if (popcount(union) < 4) return null; // no extras -> nothing to conclude

  // Type 1: exactly one cell has candidates outside the trio of the other five
  for (const extrasCell of cells) {
    let trio = 0;
    for (const c of cells) if (c !== extrasCell) trio |= g.cands[c];
    if (popcount(trio) !== 3) continue;
    if (!(g.cands[extrasCell] & trio)) continue; // must participate in the pattern
    const elims: CellDigit[] = digitsOf(g.cands[extrasCell] & trio).map((digit) => ({
      cell: extrasCell,
      digit
    }));
    if (!elims.length || !(g.cands[extrasCell] & ~trio)) continue;
    return {
      tech: 'EXTENDED_RECTANGLE',
      placements: [],
      eliminations: elims,
      primary: cells
        .filter((c) => c !== extrasCell)
        .flatMap((cell) => digitsOf(g.cands[cell]).map((digit) => ({ cell, digit }))),
      description: `Extended Rectangle Type 1: ${cellNames(cells)} would form a deadly ${digitsOf(trio).join('')} loop; ${cellName(extrasCell)} must take one of its extra candidates.`
    };
  }

  // Type 2: the extras are one single digit z spread over 2+ cells
  for (const z of digitsOf(union)) {
    const trio = union & ~bit(z);
    if (popcount(trio) !== 3) continue;
    if (!cells.every((c) => (g.cands[c] & ~(trio | bit(z))) === 0)) continue;
    const zCells = cells.filter((c) => g.cands[c] & bit(z));
    if (zCells.length < 2) continue; // single z-cell is Type 1
    const elims: CellDigit[] = [];
    for (let c = 0; c < 81; c++) {
      if (g.values[c] !== 0 || cells.includes(c)) continue;
      if (!(g.cands[c] & bit(z))) continue;
      if (zCells.every((zc) => sees(c, zc))) elims.push({ cell: c, digit: z });
    }
    if (!elims.length) continue;
    return {
      tech: 'EXTENDED_RECTANGLE',
      placements: [],
      eliminations: elims,
      primary: cells.flatMap((cell) =>
        digitsOf(g.cands[cell] & trio).map((digit) => ({ cell, digit }))
      ),
      secondary: zCells.map((cell) => ({ cell, digit: z })),
      description: `Extended Rectangle Type 2: to avoid a deadly ${digitsOf(trio).join('')} loop in ${cellNames(cells)}, one of ${cellNames(zCells)} must be ${z}, so ${z} is removed from cells seeing all of them.`
    };
  }
  return null;
}
