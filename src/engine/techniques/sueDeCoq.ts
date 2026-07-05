import { Grid, UNITS, bit, digitsOf, popcount, cellName, cellNames, boxOf } from '../board';
import { Step, CellDigit } from '../steps';
import { combinations } from './subsets';

/**
 * Sue de Coq (basic form, per sudokuwiki.org/Sue_De_Coq):
 *
 * - C: 2-3 empty cells in the intersection of a box and a line, with
 *   candidate union V where |V| = |C| + 2.
 * - D: a bivalue cell in the line outside the box, cands(D) ⊆ V.
 * - E: a bivalue cell in the box outside the line, cands(E) ⊆ V.
 * - cands(D) ∩ cands(E) = ∅.
 *
 * Then C∪{D,E} is |C|+2 cells holding exactly the |C|+2 digits of V, one
 * each. Digits of D (or V \ cands(E)) are confined to the line inside the
 * pattern -> removed from the rest of the line; digits of E (or
 * V \ cands(D)) are confined to the box -> removed from the rest of the box.
 */
export function findSueDeCoq(g: Grid): Step | null {
  for (let line = 0; line < 18; line++) {
    const lineCells = UNITS[line];
    // the three boxes this line crosses
    const boxes = [...new Set(lineCells.map(boxOf))];
    for (const b of boxes) {
      const inter = lineCells.filter(
        (c) => boxOf(c) === b && g.values[c] === 0
      );
      if (inter.length < 2) continue;
      for (const size of [2, 3]) {
        if (inter.length < size) continue;
        for (const C of combinations(inter, size)) {
          let V = 0;
          for (const c of C) V |= g.cands[c];
          if (popcount(V) !== size + 2) continue;

          const lineRest = lineCells.filter(
            (c) => boxOf(c) !== b && g.values[c] === 0
          );
          const boxRest = UNITS[18 + b].filter(
            (c) => !lineCells.includes(c) && g.values[c] === 0
          );
          for (const D of lineRest) {
            const dMask = g.cands[D];
            if (popcount(dMask) !== 2 || (dMask & ~V) !== 0) continue;
            for (const E of boxRest) {
              const eMask = g.cands[E];
              if (popcount(eMask) !== 2 || (eMask & ~V) !== 0) continue;
              if (dMask & eMask) continue;

              const lineDigits = dMask | (V & ~eMask); // confined to the line
              const boxDigits = eMask | (V & ~dMask); // confined to the box
              const elims: CellDigit[] = [];
              for (const c of lineRest) {
                if (c === D) continue;
                for (const d of digitsOf(g.cands[c] & lineDigits))
                  elims.push({ cell: c, digit: d });
              }
              for (const c of boxRest) {
                if (c === E) continue;
                for (const d of digitsOf(g.cands[c] & boxDigits))
                  elims.push({ cell: c, digit: d });
              }
              if (!elims.length) continue;
              return {
                tech: 'SUE_DE_COQ',
                placements: [],
                eliminations: elims,
                primary: C.flatMap((cell) =>
                  digitsOf(g.cands[cell]).map((digit) => ({ cell, digit }))
                ),
                secondary: [
                  ...digitsOf(dMask).map((digit) => ({ cell: D, digit })),
                  ...digitsOf(eMask).map((digit) => ({ cell: E, digit }))
                ],
                description: `Sue de Coq: ${cellNames(C)} (${digitsOf(V).join('')}) with ${cellName(D)} in the line and ${cellName(E)} in the box form a locked set; line digits are cleared from the rest of the line, box digits from the rest of the box.`
              };
            }
          }
        }
      }
    }
  }
  return null;
}
