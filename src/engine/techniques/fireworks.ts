import { Grid, UNITS, bit, digitsOf, popcount, boxOf, rowOf, colOf, cellName } from '../board';
import { Step, CellDigit } from '../steps';

/**
 * Fireworks (sudokuwiki.org/Fireworks), the triple form.
 *
 * Take a cross cell A = (r,c) in box b, a row wing B in row r outside b, and
 * a column wing C in column c outside b. A digit d (unsolved in both row r
 * and column c) "fires" on {A,B,C} when its row-r candidates outside the box
 * are confined to {B} and its column-c candidates outside the box to {C}.
 *
 * Lemma: such a digit must occupy A, B or C. Proof: d's row-r instance is at
 * B or inside box b; d's column-c instance is at C or inside box b. If both
 * are inside b they are the box's single d, which then lies in row r AND
 * column c — that is A. So d ∈ {A, B, C}.
 *
 * Three such digits on the SAME three cells form a locked set: each needs
 * one of the three cells, so the cells hold exactly those digits — every
 * other candidate in A, B, C is eliminated.
 */
export function findFireworks(g: Grid): Step | null {
  for (let b = 0; b < 9; b++) {
    for (const A of UNITS[18 + b]) {
      if (g.values[A] !== 0) continue;
      const r = rowOf(A);
      const c = colOf(A);
      const rowOutside = UNITS[r].filter((x) => boxOf(x) !== b);
      const colOutside = UNITS[9 + c].filter((x) => boxOf(x) !== b);

      for (const B of rowOutside) {
        if (g.values[B] !== 0) continue;
        for (const C of colOutside) {
          if (g.values[C] !== 0) continue;

          // digits confined to {B} in the row-outside and {C} in the column-outside
          let dMask = 0;
          for (let d = 1; d <= 9; d++) {
            const m = bit(d);
            if (UNITS[r].some((x) => g.values[x] === d)) continue; // solved in row
            if (UNITS[9 + c].some((x) => g.values[x] === d)) continue; // solved in col
            if (rowOutside.some((x) => x !== B && g.values[x] === 0 && g.cands[x] & m)) continue;
            if (colOutside.some((x) => x !== C && g.values[x] === 0 && g.cands[x] & m)) continue;
            dMask |= m;
          }
          if (popcount(dMask) !== 3) continue;
          // every locked digit must be available in at least one of the cells
          const cells = [A, B, C];
          if (
            digitsOf(dMask).some((d) => !cells.some((x) => g.cands[x] & bit(d)))
          ) {
            continue; // broken position; leave it to check/other techniques
          }
          const elims: CellDigit[] = [];
          for (const x of cells) {
            for (const d of digitsOf(g.cands[x] & ~dMask)) elims.push({ cell: x, digit: d });
          }
          if (!elims.length) continue;
          return {
            tech: 'FIREWORKS',
            placements: [],
            eliminations: elims,
            primary: cells.flatMap((cell) =>
              digitsOf(g.cands[cell] & dMask).map((digit) => ({ cell, digit }))
            ),
            description: `Fireworks: digits ${digitsOf(dMask).join('/')} each must land on one of ${cellName(A)} (cross), ${cellName(B)} (row wing) or ${cellName(C)} (column wing), locking those three cells — all other candidates there are removed.`
          };
        }
      }
    }
  }
  return null;
}
