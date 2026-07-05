import { Grid, bit, digitsOf, popcount, rowOf, colOf, boxOf, sees, cellName, cellNames } from '../board';
import { Step, CellDigit } from '../steps';

/**
 * Chute Remote Pairs (sudokuwiki.org/Chute_Remote_Pairs):
 *
 * Two bivalue cells with the same pair {a,b} in one chute (band of 3 rows or
 * stack of 3 columns), not seeing each other. Look at the 3 cells in the
 * remaining box ∩ remaining line of the chute. If only one of a/b occurs
 * there (as candidate or placed value), that digit can be removed from every
 * cell seeing both pair cells: placing it there would force both pair cells
 * to the other digit, leaving the first digit with no home in the third box.
 * If neither occurs, both digits can be removed.
 */
export function findChuteRemotePair(g: Grid): Step | null {
  const bivalue: number[] = [];
  for (let c = 0; c < 81; c++) {
    if (g.values[c] === 0 && popcount(g.cands[c]) === 2) bivalue.push(c);
  }
  for (let i = 0; i < bivalue.length; i++) {
    for (let j = i + 1; j < bivalue.length; j++) {
      const c1 = bivalue[i];
      const c2 = bivalue[j];
      if (g.cands[c1] !== g.cands[c2] || sees(c1, c2)) continue;
      const pairMask = g.cands[c1];

      for (const horizontal of [true, false]) {
        const lineOf = horizontal ? rowOf : colOf;
        const bandOf = (c: number) => Math.floor(lineOf(c) / 3);
        if (bandOf(c1) !== bandOf(c2)) continue; // must share the chute
        const l1 = lineOf(c1);
        const l2 = lineOf(c2);
        if (l1 === l2) continue; // handled: they'd see each other anyway
        const band = bandOf(c1);
        const l3 = [band * 3, band * 3 + 1, band * 3 + 2].find((l) => l !== l1 && l !== l2)!;
        const b1 = boxOf(c1);
        const b2 = boxOf(c2);
        if (b1 === b2) continue;
        const boxesInChute = horizontal
          ? [band * 3, band * 3 + 1, band * 3 + 2]
          : [band, 3 + band, 6 + band];
        const b3 = boxesInChute.find((b) => b !== b1 && b !== b2);
        if (b3 === undefined) continue;

        // the 3 cells of remaining box ∩ remaining line
        const mini: number[] = [];
        for (let k = 0; k < 9; k++) {
          const cell = horizontal ? l3 * 9 + k : k * 9 + l3;
          if (boxOf(cell) === b3) mini.push(cell);
        }
        // which of the pair digits occur there (candidate or placed value)?
        let present = 0;
        for (const cell of mini) {
          if (g.values[cell]) present |= bit(g.values[cell]) & pairMask;
          else present |= g.cands[cell] & pairMask;
        }
        if (popcount(present & pairMask) === 2) continue; // both present: nothing
        const elimMask = present === 0 ? pairMask : present;

        const elims: CellDigit[] = [];
        for (let c = 0; c < 81; c++) {
          if (c === c1 || c === c2 || g.values[c] !== 0) continue;
          if (!(g.cands[c] & elimMask)) continue;
          if (sees(c, c1) && sees(c, c2)) {
            for (const d of digitsOf(g.cands[c] & elimMask)) elims.push({ cell: c, digit: d });
          }
        }
        if (!elims.length) continue;
        const digits = digitsOf(pairMask);
        return {
          tech: 'CHUTE_REMOTE_PAIR',
          placements: [],
          eliminations: elims,
          primary: [c1, c2].flatMap((cell) => digits.map((digit) => ({ cell, digit }))),
          secondary: mini
            .filter((c) => g.values[c] === 0)
            .flatMap((cell) => digitsOf(g.cands[cell] & pairMask).map((digit) => ({ cell, digit }))),
          description: `Chute Remote Pair: ${cellName(c1)} and ${cellName(c2)} both hold ${digits.join('')} in one chute; ${digitsOf(elimMask).join(' and ')} ${popcount(elimMask) === 1 ? 'is' : 'are'} missing from ${cellNames(mini)}, so ${popcount(elimMask) === 1 ? 'it' : 'they'} can be removed from cells seeing both pair cells.`
        };
      }
    }
  }
  return null;
}
