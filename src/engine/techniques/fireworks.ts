import { Grid, UNITS, bit, digitsOf, popcount, boxOf, rowOf, colOf, cellName } from '../board';
import { Step, CellDigit } from '../steps';
import { tr, listAnd, unitName } from '../text';

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
 *
 * The hint (docs/hint-readability-2026-11.md, H1, M4 and L2) draws the row
 * and the column as dashed bands that cross at A, the wings' digits gold
 * in them and A's blue, and walks it line by line: outside the box, the
 * row has the digits only in B, then the column only in C, then why a
 * digit in neither wing is in A.
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
          return fireworksStep(g, b, A, B, C, dMask, elims);
        }
      }
    }
  }
  return null;
}

/**
 * What a wing's line has outside the box: the digits it holds there only
 * in the wing, and the ones it has not at all
 */
function wingText(g: Grid, box: string, line: string, wing: number, digits: number[]): string {
  const name = cellName(wing);
  const has = digits.filter((d) => g.cands[wing] & bit(d));
  const lacks = digits.filter((d) => !(g.cands[wing] & bit(d)));
  if (!lacks.length) return tr`Outside ${box}, ${line} has ${listAnd(has)} only in ${name}.`;
  if (lacks.length === 1) return tr`Outside ${box}, ${line} has ${listAnd(has)} only in ${name}, and no ${lacks[0]}.`;
  if (has.length) return tr`Outside ${box}, ${line} has ${has[0]} only in ${name}, and no ${lacks[0]} or ${lacks[1]}.`;
  return tr`Outside ${box}, ${line} has none of ${listAnd(lacks)}.`;
}

/**
 * The step: A where row r meets column c in box b, B the row's wing and C
 * the column's, outside the box, and the three digits they lock. The wings
 * are gold in their dashed line, A blue where the lines cross; the Copy
 * step line names the three cells' digits as one group, as it always did
 * (src/content/eureka.ts)
 */
function fireworksStep(g: Grid, b: number, A: number, B: number, C: number, dMask: number, elims: CellDigit[]): Step {
  const where = (cell: number) => digitsOf(g.cands[cell] & dMask).map((digit) => ({ cell, digit }));
  const digits = digitsOf(dMask);
  const [d1, d2, d3] = digits;
  const all = listAnd(digits);
  const [nA, nB, nC] = [A, B, C].map(cellName);
  const [r, c] = [rowOf(A), colOf(A)];
  const [row, col, box] = [unitName(r), unitName(9 + c), unitName(18 + b)];
  return {
    tech: 'FIREWORKS',
    placements: [],
    eliminations: elims,
    primary: where(A),
    secondary: [...where(B), ...where(C)],
    units: [
      { unit: r, role: 'secondary' },
      { unit: 9 + c, role: 'secondary' }
    ],
    labels: {
      primary: tr`the cross, where ${row} meets ${col}: whichever of ${all} is in neither wing is here`,
      secondary: tr`the wings: outside ${box}, each is the only cell of its row or column that can be ${d1}, ${d2} or ${d3}`
    },
    walk: {
      frames: [
        // the row's wing alone, named alone (G23); from the column's on, the wings
        {
          text: wingText(g, box, row, B, digits),
          show: ['secondary'],
          cells: [B],
          labels: { secondary: tr`the row's wing: the only cell of ${row} outside ${box} that can be ${d1}, ${d2} or ${d3}` }
        },
        { text: wingText(g, box, col, C, digits), show: ['secondary'], cells: [C] },
        { text: tr`If one of ${all} is in neither ${nB} nor ${nC}, ${row} and ${col} both have it in ${box}, which holds only one: so it is in ${nA}, where they cross.`, show: ['primary'], cells: [A] }
      ],
      lead: tr`Each of ${all} must be in one of ${listAnd([A, B, C].sort((x, y) => x - y).map(cellName))}, so these three cells hold only ${all}.`
    },
    description: tr`Outside ${box}, only ${nB} in ${row} and only ${nC} in ${col} can be ${d1}, ${d2} or ${d3}. So each of the three is in ${nB}, in ${nC} or in ${nA}, where the row and column cross, and these three cells hold nothing else.`
  };
}
