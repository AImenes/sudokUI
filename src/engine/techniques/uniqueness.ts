import {
  Grid,
  UNITS,
  CELL_UNITS,
  bit,
  digitsOf,
  popcount,
  sees,
  cellName,
  cellNames,
  rowOf,
  colOf
} from '../board';
import { Step, CellDigit } from '../steps';

interface Rect {
  cells: [number, number, number, number]; // r1c1, r1c2, r2c1, r2c2
  x: number;
  y: number;
}

/** Rectangles spanning exactly two boxes where all four cells hold pair {x,y}. */
function* rectangles(g: Grid): Generator<Rect> {
  for (let r1 = 0; r1 < 8; r1++) {
    for (let r2 = r1 + 1; r2 < 9; r2++) {
      const sameBand = Math.floor(r1 / 3) === Math.floor(r2 / 3);
      for (let c1 = 0; c1 < 8; c1++) {
        for (let c2 = c1 + 1; c2 < 9; c2++) {
          const sameStack = Math.floor(c1 / 3) === Math.floor(c2 / 3);
          if (sameBand === sameStack) continue; // must span exactly 2 boxes
          const cells: [number, number, number, number] = [
            r1 * 9 + c1,
            r1 * 9 + c2,
            r2 * 9 + c1,
            r2 * 9 + c2
          ];
          if (cells.some((c) => g.values[c] !== 0)) continue;
          const common = cells.reduce((m, c) => m & g.cands[c], 0x1ff);
          if (popcount(common) < 2) continue;
          const pairs = digitsOf(common);
          for (let i = 0; i < pairs.length; i++) {
            for (let j = i + 1; j < pairs.length; j++) {
              yield { cells, x: pairs[i], y: pairs[j] };
            }
          }
        }
      }
    }
  }
}

export function findUniqueness(g: Grid, type: 1 | 2 | 4): Step | null {
  for (const rect of rectangles(g)) {
    const { cells, x, y } = rect;
    const pairMask = bit(x) | bit(y);
    const exact = cells.filter((c) => g.cands[c] === pairMask);
    const extra = cells.filter((c) => g.cands[c] !== pairMask);

    if (type === 1 && exact.length === 3 && extra.length === 1) {
      const target = extra[0];
      const elims = digitsOf(g.cands[target] & pairMask).map((digit) => ({
        cell: target,
        digit
      }));
      if (elims.length) {
        return {
          tech: 'UNIQUENESS_1',
          placements: [],
          eliminations: elims,
          primary: exact.flatMap((cell) => [
            { cell, digit: x },
            { cell, digit: y }
          ]),
          description: `Unique Rectangle Type 1: ${cellNames(cells)} would form a deadly pattern on ${x}/${y}; ${cellName(target)} cannot be ${x} or ${y}.`
        };
      }
    }

    if (type === 2 && exact.length === 2 && extra.length === 2) {
      const [e1, e2] = extra;
      const extras1 = g.cands[e1] & ~pairMask;
      const extras2 = g.cands[e2] & ~pairMask;
      if (extras1 !== extras2 || popcount(extras1) !== 1) continue;
      const z = digitsOf(extras1)[0];
      const elims: CellDigit[] = [];
      for (let c = 0; c < 81; c++) {
        if (g.values[c] !== 0 || cells.includes(c)) continue;
        if (!(g.cands[c] & bit(z))) continue;
        if (sees(c, e1) && sees(c, e2)) elims.push({ cell: c, digit: z });
      }
      if (elims.length) {
        return {
          tech: 'UNIQUENESS_2',
          placements: [],
          eliminations: elims,
          primary: cells.flatMap((cell) => [
            { cell, digit: x },
            { cell, digit: y }
          ]),
          secondary: [
            { cell: e1, digit: z },
            { cell: e2, digit: z }
          ],
          description: `Unique Rectangle Type 2: to avoid the deadly pattern on ${x}/${y}, one of ${cellName(e1)}/${cellName(e2)} must be ${z}, so ${z} is removed from cells seeing both.`
        };
      }
    }

    if (type === 4 && exact.length === 2 && extra.length === 2) {
      const [e1, e2] = extra;
      const shared = CELL_UNITS[e1].filter((u) => CELL_UNITS[e2].includes(u));
      for (const [keep, kill] of [
        [x, y],
        [y, x]
      ]) {
        // if `keep` is confined to the two roof cells in a shared unit,
        // then `kill` can be removed from both roof cells
        const confined = shared.some((u) =>
          UNITS[u].every(
            (c) =>
              c === e1 ||
              c === e2 ||
              g.values[c] !== 0 ||
              !(g.cands[c] & bit(keep))
          )
        );
        if (!confined) continue;
        const elims = [e1, e2]
          .filter((c) => g.cands[c] & bit(kill))
          .map((cell) => ({ cell, digit: kill }));
        if (elims.length) {
          return {
            tech: 'UNIQUENESS_4',
            placements: [],
            eliminations: elims,
            primary: cells.flatMap((cell) => [
              { cell, digit: x },
              { cell, digit: y }
            ]),
            description: `Unique Rectangle Type 4: ${keep} is locked into ${cellName(e1)}/${cellName(e2)}; keeping ${kill} there would force the deadly pattern, so ${kill} is removed from both.`
          };
        }
      }
    }
  }
  return null;
}

/** BUG+1: if all cells were bivalue the puzzle would have two solutions;
 *  the single trivalue cell must take the digit occurring three times. */
export function findBugPlus1(g: Grid): Step | null {
  let triCell = -1;
  for (let c = 0; c < 81; c++) {
    if (g.values[c] !== 0) continue;
    const n = popcount(g.cands[c]);
    if (n === 2) continue;
    if (n === 3 && triCell === -1) triCell = c;
    else return null;
  }
  if (triCell === -1) return null;
  for (const d of digitsOf(g.cands[triCell])) {
    const counts = CELL_UNITS[triCell].map(
      (u) =>
        UNITS[u].filter((c) => g.values[c] === 0 && g.cands[c] & bit(d)).length
    );
    if (counts.every((n) => n === 3)) {
      return {
        tech: 'BUG_PLUS_1',
        placements: [{ cell: triCell, digit: d }],
        eliminations: [],
        primary: [{ cell: triCell, digit: d }],
        description: `BUG+1: removing ${d} from ${cellName(triCell)} would leave a bivalue grid with two solutions, so ${cellName(triCell)} must be ${d}.`
      };
    }
  }
  return null;
}
