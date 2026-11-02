import { Grid, UNITS, digitsOf, popcount, cellName, boxOf } from '../board';
import { Step, CellDigit } from '../steps';
import { combinations } from './subsets';
import { tr, listAnd, unitName } from '../text';

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
 *
 * The hint colours the digits by where they are locked, as HoDoKu does
 * (docs/hint-readability-2026-11.md M3): the line and its digits (D's) in
 * the pattern's colour, the box and its digits (E's) in the acts-through
 * colour, with the line's band solid and the box's dashed, and the digit
 * only C holds as the exception; its walk names C, D and E and why each
 * digit is locked where it is (H1).
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
              return sueDeCoqStep(g, line, b, C, D, E, V, elims);
            }
          }
        }
      }
    }
  }
  return null;
}

/** the step: C where the line meets box b, D in the line, E in the box, V the digits C holds */
function sueDeCoqStep(g: Grid, line: number, b: number, C: number[], D: number, E: number, V: number, elims: CellDigit[]): Step {
  const dMask = g.cands[D];
  const eMask = g.cands[E];
  // the digit only C holds (C of three cells), locked in the line and the box alike
  const xMask = V & ~dMask & ~eMask;
  const where = (cells: number[], mask: number) => cells.flatMap((cell) => digitsOf(g.cands[cell] & mask).map((digit) => ({ cell, digit })));
  const [a, bb] = digitsOf(dMask);
  const [c, d] = digitsOf(eMask);
  const [x] = digitsOf(xMask);
  const lineName = unitName(line);
  const box = unitName(18 + b);
  const [nD, nE] = [cellName(D), cellName(E)];
  const cells = listAnd(C.map(cellName));
  const three = C.length === 3;
  return {
    tech: 'SUE_DE_COQ',
    placements: [],
    eliminations: elims,
    primary: [...where(C, dMask), ...where([D], dMask)],
    secondary: [...where(C, eMask), ...where([E], eMask)],
    ...(xMask && { fins: where(C, xMask) }),
    units: [
      { unit: line, role: 'primary' },
      { unit: 18 + b, role: 'secondary' }
    ],
    labels: {
      primary: tr`${a} and ${bb} in ${lineName}: one in ${nD}, the other where it meets ${box}`,
      secondary: tr`${c} and ${d} in ${box}: one in ${nE}, the other where it meets ${lineName}`,
      ...(xMask && { fins: tr`${x}: where ${lineName} meets ${box}, so in both` })
    },
    walk: {
      frames: [
        { text: tr`In ${lineName}, ${nD} holds only ${a} and ${bb}. Whichever it is, ${cells} can take at most one of ${a} and ${bb}.`, show: ['primary'] },
        {
          text: three
            ? tr`The three cells are in ${box} too, where ${nE} holds only ${c} and ${d}, so they can take at most one of ${c} and ${d} as well.`
            : tr`The two cells are in ${box} too, where ${nE} holds only ${c} and ${d}, so they can take at most one of ${c} and ${d} as well. They hold no other digit, and two cells need two digits: one of ${a} and ${bb}, and one of ${c} and ${d}.`,
          show: ['secondary']
        },
        ...(three
          ? [
              {
                text: tr`Their only other digit is ${x}, which they can take at most once. Three cells need three digits, so they hold one of ${a} and ${bb}, one of ${c} and ${d}, and the ${x}.`,
                show: ['fins' as const]
              }
            ]
          : [])
      ],
      lead: three
        ? tr`Then ${nD} and the three cells hold both ${a} and ${bb}, ${nE} and the three cells both ${c} and ${d}, and the three cells the ${x}.`
        : tr`Then ${nD} and the two cells hold both ${a} and ${bb}, and ${nE} and the two cells both ${c} and ${d}.`
    },
    description: three
      ? tr`Sue de Coq: ${cells}, in both ${lineName} and ${box}, hold only ${listAnd(digitsOf(V))}. ${nD} in ${lineName} takes ${a} or ${bb}, and ${nE} in ${box} takes ${c} or ${d}, so the three cells hold one of ${a} and ${bb}, one of ${c} and ${d}, and the ${x}. The other cells of ${lineName} outside ${box} lose ${listAnd(digitsOf(dMask | xMask))}, and those of ${box} outside ${lineName} lose ${listAnd(digitsOf(eMask | xMask))}.`
      : tr`Sue de Coq: ${cells}, in both ${lineName} and ${box}, hold only ${listAnd(digitsOf(V))}. ${nD} in ${lineName} takes ${a} or ${bb}, and ${nE} in ${box} takes ${c} or ${d}, so the two cells hold one of ${a} and ${bb} and one of ${c} and ${d}. The other cells of ${lineName} outside ${box} lose ${listAnd(digitsOf(dMask))}, and those of ${box} outside ${lineName} lose ${listAnd(digitsOf(eMask))}.`
  };
}
