import { Grid, PEERS, bit, digitsOf, popcount, sees, cellName } from '../board';
import { Step, CellDigit } from '../steps';
import { strongLinks } from './singleDigit';

/**
 * Wings — small pivot-and-pincer patterns built on bivalue cells.
 *
 * - XY-Wing: pivot XY sees pincers XZ and YZ; whichever value the pivot
 *   takes, some pincer becomes Z, so cells seeing both pincers lose Z.
 * - XYZ-Wing: like XY-Wing but the pivot also holds Z, so eliminations must
 *   additionally see the pivot.
 * - W-Wing: two XZ bivalue cells joined through a strong link on X; one of
 *   the two must be Z.
 * - WXYZ-Wing: four cells, four digits, one non-restricted digit Z that must
 *   land inside the pattern — an ALS argument in miniature.
 */

function collectZElims(
  g: Grid,
  z: number,
  mustSee: number[],
  exclude: number[]
): CellDigit[] {
  const elims: CellDigit[] = [];
  for (let c = 0; c < 81; c++) {
    if (g.values[c] !== 0 || exclude.includes(c)) continue;
    if (!(g.cands[c] & bit(z))) continue;
    if (mustSee.every((m) => sees(c, m))) elims.push({ cell: c, digit: z });
  }
  return elims;
}

export function findXYWing(g: Grid): Step | null {
  const bivalue: number[] = [];
  for (let c = 0; c < 81; c++) {
    if (g.values[c] === 0 && popcount(g.cands[c]) === 2) bivalue.push(c);
  }
  for (const pivot of bivalue) {
    const [x, y] = digitsOf(g.cands[pivot]);
    const wings = bivalue.filter((c) => c !== pivot && sees(c, pivot));
    for (const w1 of wings) {
      if (!(g.cands[w1] & bit(x)) || g.cands[w1] === g.cands[pivot]) continue;
      const z = digitsOf(g.cands[w1]).find((d) => d !== x)!;
      if (z === y) continue;
      for (const w2 of wings) {
        if (w2 === w1) continue;
        if (g.cands[w2] !== (bit(y) | bit(z))) continue;
        const elims = collectZElims(g, z, [w1, w2], [pivot, w1, w2]);
        if (!elims.length) continue;
        return {
          tech: 'XY_WING',
          placements: [],
          eliminations: elims,
          primary: [{ cell: pivot, digit: x }, { cell: pivot, digit: y }],
          secondary: [{ cell: w1, digit: z }, { cell: w2, digit: z }],
          description: `XY-Wing: pivot ${cellName(pivot)} (${x}${y}) with pincers ${cellName(w1)} (${x}${z}) and ${cellName(w2)} (${y}${z}); one pincer must be ${z}, so ${z} is removed from cells seeing both.`
        };
      }
    }
  }
  return null;
}

export function findXYZWing(g: Grid): Step | null {
  for (let pivot = 0; pivot < 81; pivot++) {
    if (g.values[pivot] !== 0 || popcount(g.cands[pivot]) !== 3) continue;
    const pivotMask = g.cands[pivot];
    const wings = PEERS[pivot].filter(
      (c) =>
        g.values[c] === 0 &&
        popcount(g.cands[c]) === 2 &&
        (g.cands[c] & pivotMask) === g.cands[c]
    );
    for (let i = 0; i < wings.length; i++) {
      for (let j = i + 1; j < wings.length; j++) {
        const shared = g.cands[wings[i]] & g.cands[wings[j]];
        if (popcount(shared) !== 1) continue;
        if ((g.cands[wings[i]] | g.cands[wings[j]]) !== pivotMask) continue;
        const z = digitsOf(shared)[0];
        const elims = collectZElims(g, z, [pivot, wings[i], wings[j]], [pivot, wings[i], wings[j]]);
        if (!elims.length) continue;
        return {
          tech: 'XYZ_WING',
          placements: [],
          eliminations: elims,
          primary: digitsOf(pivotMask).map((digit) => ({ cell: pivot, digit })),
          secondary: [
            { cell: wings[i], digit: z },
            { cell: wings[j], digit: z }
          ],
          description: `XYZ-Wing: pivot ${cellName(pivot)} with pincers ${cellName(wings[i])} and ${cellName(wings[j])}; ${z} is removed from cells seeing all three.`
        };
      }
    }
  }
  return null;
}

export function findWWing(g: Grid): Step | null {
  const bivalue: number[] = [];
  for (let c = 0; c < 81; c++) {
    if (g.values[c] === 0 && popcount(g.cands[c]) === 2) bivalue.push(c);
  }
  for (let i = 0; i < bivalue.length; i++) {
    for (let j = i + 1; j < bivalue.length; j++) {
      const A = bivalue[i];
      const B = bivalue[j];
      if (g.cands[A] !== g.cands[B] || sees(A, B)) continue;
      const [x, y] = digitsOf(g.cands[A]);
      for (const [linkDigit, elimDigit] of [
        [x, y],
        [y, x]
      ]) {
        for (const link of strongLinks(g, linkDigit)) {
          const ends = [link.a, link.b];
          if (ends.includes(A) || ends.includes(B)) continue;
          const [e1, e2] = ends;
          const connects =
            (sees(e1, A) && sees(e2, B)) || (sees(e1, B) && sees(e2, A));
          if (!connects) continue;
          const elims = collectZElims(g, elimDigit, [A, B], [A, B, e1, e2]);
          if (!elims.length) continue;
          return {
            tech: 'W_WING',
            placements: [],
            eliminations: elims,
            primary: [
              { cell: A, digit: elimDigit },
              { cell: B, digit: elimDigit }
            ],
            secondary: [
              { cell: e1, digit: linkDigit },
              { cell: e2, digit: linkDigit }
            ],
            chainCells: sees(e1, A) ? [A, e1, e2, B] : [A, e2, e1, B],
            description: `W-Wing: ${cellName(A)} and ${cellName(B)} both hold ${x}${y}; the strong link on ${linkDigit} (${cellName(e1)}–${cellName(e2)}) forces one of them to be ${elimDigit}, removing ${elimDigit} from cells seeing both.`
          };
        }
      }
    }
  }
  return null;
}
