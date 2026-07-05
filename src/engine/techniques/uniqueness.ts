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
import { combinations } from './subsets';

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

export function findUniqueness(g: Grid, type: 1 | 2 | 3 | 4 | 5 | 6): Step | null {
  for (const rect of rectangles(g)) {
    const { cells, x, y } = rect;
    const pairMask = bit(x) | bit(y);
    const exact = cells.filter((c) => g.cands[c] === pairMask);
    const extra = cells.filter((c) => g.cands[c] !== pairMask);

    if (type === 3 && exact.length === 2 && extra.length === 2) {
      const step = uniqueness3(g, rect, pairMask, extra);
      if (step) return step;
    }

    if (type === 5 && exact.length <= 2 && extra.length >= 2) {
      const step = uniqueness5(g, rect, pairMask, exact, extra);
      if (step) return step;
    }

    if (type === 6 && exact.length === 2 && extra.length === 2) {
      const step = uniqueness6(g, rect, pairMask, exact, extra);
      if (step) return step;
    }

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

/**
 * UR Type 3: the two roof extras form a "pseudo cell"; combined with k other
 * cells in a unit shared by both roofs it can complete a naked subset, whose
 * digits are then removed from the rest of that unit.
 */
function uniqueness3(g: Grid, rect: Rect, pairMask: number, extra: number[]): Step | null {
  const [e1, e2] = extra;
  const E = (g.cands[e1] | g.cands[e2]) & ~pairMask;
  if (popcount(E) < 2) return null;
  const shared = CELL_UNITS[e1].filter((u) => CELL_UNITS[e2].includes(u));
  for (const u of shared) {
    const others = UNITS[u].filter(
      (c) => g.values[c] === 0 && !rect.cells.includes(c)
    );
    for (const k of [1, 2, 3]) {
      if (others.length < k + 1) continue; // need at least one cell left to eliminate from
      for (const S of combinations(others, k)) {
        let mask = E;
        for (const c of S) mask |= g.cands[c];
        if (popcount(mask) !== k + 1) continue;
        const elims: CellDigit[] = [];
        for (const c of others) {
          if (S.includes(c)) continue;
          for (const d of digitsOf(g.cands[c] & mask)) elims.push({ cell: c, digit: d });
        }
        if (!elims.length) continue;
        return {
          tech: 'UNIQUENESS_3',
          placements: [],
          eliminations: elims,
          primary: rect.cells.flatMap((cell) => [
            { cell, digit: rect.x },
            { cell, digit: rect.y }
          ]),
          secondary: S.flatMap((cell) =>
            digitsOf(g.cands[cell]).map((digit) => ({ cell, digit }))
          ),
          description: `Unique Rectangle Type 3: the roof extras of ${cellNames(rect.cells)} act as one pseudo-cell and form a locked set with ${cellNames(S)}, clearing those digits from the rest of the unit.`
        };
      }
    }
  }
  return null;
}

/** UR Type 5: three corners carry the same single extra digit z; one of them
 *  must be z, so z falls from cells seeing all of them. */
function uniqueness5(
  g: Grid,
  rect: Rect,
  pairMask: number,
  exact: number[],
  extra: number[]
): Step | null {
  if (exact.length !== 1 || extra.length !== 3) return null;
  const zMasks = extra.map((c) => g.cands[c] & ~pairMask);
  if (zMasks.some((m) => popcount(m) !== 1)) return null;
  if (zMasks[0] !== zMasks[1] || zMasks[1] !== zMasks[2]) return null;
  const z = digitsOf(zMasks[0])[0];
  const elims: CellDigit[] = [];
  for (let c = 0; c < 81; c++) {
    if (g.values[c] !== 0 || rect.cells.includes(c)) continue;
    if (!(g.cands[c] & bit(z))) continue;
    if (extra.every((e) => sees(c, e))) elims.push({ cell: c, digit: z });
  }
  if (!elims.length) return null;
  return {
    tech: 'UNIQUENESS_5',
    placements: [],
    eliminations: elims,
    primary: rect.cells.flatMap((cell) => [
      { cell, digit: rect.x },
      { cell, digit: rect.y }
    ]),
    secondary: extra.map((cell) => ({ cell, digit: z })),
    description: `Unique Rectangle Type 5: one of ${cellNames(extra)} must be ${z} to avoid the deadly pattern, so ${z} is removed from cells seeing all of them.`
  };
}

/**
 * UR Type 6: the bivalue corners lie on a diagonal. If one pair digit is
 * confined to the rectangle in both rows (or both columns), placing it in a
 * roof corner forces the deadly pattern, so it falls from both roof corners.
 */
function uniqueness6(
  g: Grid,
  rect: Rect,
  pairMask: number,
  exact: number[],
  extra: number[]
): Step | null {
  const [f1, f2] = exact;
  if (rowOf(f1) === rowOf(f2) || colOf(f1) === colOf(f2)) return null; // diagonal only
  const rows = [rowOf(rect.cells[0]), rowOf(rect.cells[2])];
  const cols = [colOf(rect.cells[0]), colOf(rect.cells[1])];
  for (const d of [rect.x, rect.y]) {
    const confined = (units: number[]) =>
      units.every((u) =>
        UNITS[u].every(
          (c) =>
            rect.cells.includes(c) || g.values[c] !== 0 || !(g.cands[c] & bit(d))
        )
      );
    const rowsStrong = confined(rows);
    const colsStrong = confined(cols.map((c) => 9 + c));
    if (!rowsStrong && !colsStrong) continue;
    const elims = extra
      .filter((c) => g.cands[c] & bit(d))
      .map((cell) => ({ cell, digit: d }));
    if (!elims.length) continue;
    return {
      tech: 'UNIQUENESS_6',
      placements: [],
      eliminations: elims,
      primary: rect.cells.flatMap((cell) => [
        { cell, digit: rect.x },
        { cell, digit: rect.y }
      ]),
      description: `Unique Rectangle Type 6: ${d} is confined to the rectangle in both ${rowsStrong ? 'rows' : 'columns'}; placing it in a roof corner would force the deadly pattern, so ${d} is removed from ${cellNames(extra)}.`
    };
  }
  return null;
}

/**
 * Hidden Rectangle: one corner is bivalue {x,y}. If y is confined to the
 * rectangle in the opposite corner's row and column, that corner cannot be x.
 */
export function findHiddenRectangle(g: Grid): Step | null {
  for (const rect of rectangles(g)) {
    const { cells, x, y } = rect;
    const pairMask = bit(x) | bit(y);
    // corners: [0]=r1c1 [1]=r1c2 [2]=r2c1 [3]=r2c2; diagonals (0,3) and (1,2)
    for (const [ai, bi] of [
      [0, 3],
      [3, 0],
      [1, 2],
      [2, 1]
    ]) {
      const A = cells[ai];
      const B = cells[bi];
      if (g.cands[A] !== pairMask) continue;
      const rowMate = cells.find((c) => c !== B && rowOf(c) === rowOf(B))!;
      const colMate = cells.find((c) => c !== B && colOf(c) === colOf(B))!;
      for (const [strong, weak] of [
        [x, y],
        [y, x]
      ]) {
        const sb = bit(strong);
        const rowConfined = UNITS[rowOf(B)].every(
          (c) => c === B || c === rowMate || g.values[c] !== 0 || !(g.cands[c] & sb)
        );
        const colConfined = UNITS[9 + colOf(B)].every(
          (c) => c === B || c === colMate || g.values[c] !== 0 || !(g.cands[c] & sb)
        );
        if (!rowConfined || !colConfined) continue;
        if (!(g.cands[B] & bit(weak))) continue;
        return {
          tech: 'HIDDEN_RECTANGLE',
          placements: [],
          eliminations: [{ cell: B, digit: weak }],
          primary: cells.flatMap((cell) => [
            { cell, digit: x },
            { cell, digit: y }
          ]),
          secondary: [{ cell: A, digit: strong }],
          description: `Hidden Rectangle: ${cellName(A)} holds only ${x}${y}, and ${strong} is confined to the rectangle in ${cellName(B)}'s row and column; ${cellName(B)} cannot be ${weak} or the deadly pattern appears.`
        };
      }
    }
  }
  return null;
}

/**
 * Avoidable Rectangles: solved, non-given cells must not complete an
 * interchangeable rectangle (the puzzle would not have been unique).
 */
export function findAvoidableRectangle(g: Grid, type: 1 | 2): Step | null {
  for (let r1 = 0; r1 < 8; r1++) {
    for (let r2 = r1 + 1; r2 < 9; r2++) {
      const sameBand = Math.floor(r1 / 3) === Math.floor(r2 / 3);
      for (let c1 = 0; c1 < 8; c1++) {
        for (let c2 = c1 + 1; c2 < 9; c2++) {
          const sameStack = Math.floor(c1 / 3) === Math.floor(c2 / 3);
          if (sameBand === sameStack) continue;
          const cells = [r1 * 9 + c1, r1 * 9 + c2, r2 * 9 + c1, r2 * 9 + c2];
          const solved = cells.filter((c) => g.values[c] !== 0);
          if (solved.some((c) => g.given[c])) continue; // only user-deducible cells count
          const unsolved = cells.filter((c) => g.values[c] === 0);
          const diagOf = (c: number) =>
            cells.find((d) => rowOf(d) !== rowOf(c) && colOf(d) !== colOf(c))!;

          if (type === 1 && solved.length === 3 && unsolved.length === 1) {
            const U = unsolved[0];
            const D = diagOf(U);
            const adj = solved.filter((c) => c !== D);
            const a = g.values[D];
            if (g.values[adj[0]] !== g.values[adj[1]] || g.values[adj[0]] === a) continue;
            if (!(g.cands[U] & bit(a))) continue;
            return {
              tech: 'AVOIDABLE_RECTANGLE_1',
              placements: [],
              eliminations: [{ cell: U, digit: a }],
              primary: [{ cell: U, digit: a }],
              description: `Avoidable Rectangle Type 1: setting ${cellName(U)} to ${a} would complete an interchangeable rectangle of solved (non-given) cells, contradicting the puzzle's unique solution.`
            };
          }

          if (type === 2 && solved.length === 2 && unsolved.length === 2) {
            const [p1, p2] = solved;
            if (rowOf(p1) !== rowOf(p2) && colOf(p1) !== colOf(p2)) continue; // must be adjacent
            if (g.values[p1] === g.values[p2]) continue;
            const [u1, u2] = unsolved;
            const dv1 = g.values[diagOf(u1)];
            const dv2 = g.values[diagOf(u2)];
            const extra1 = g.cands[u1] & ~bit(dv1);
            const extra2 = g.cands[u2] & ~bit(dv2);
            // each roof: exactly {deadly digit, c} with the same extra c
            if (!(g.cands[u1] & bit(dv1)) || !(g.cands[u2] & bit(dv2))) continue;
            if (popcount(extra1) !== 1 || extra1 !== extra2) continue;
            const cDigit = digitsOf(extra1)[0];
            const elims: CellDigit[] = [];
            for (let c = 0; c < 81; c++) {
              if (g.values[c] !== 0 || c === u1 || c === u2) continue;
              if (!(g.cands[c] & bit(cDigit))) continue;
              if (sees(c, u1) && sees(c, u2)) elims.push({ cell: c, digit: cDigit });
            }
            if (!elims.length) continue;
            return {
              tech: 'AVOIDABLE_RECTANGLE_2',
              placements: [],
              eliminations: elims,
              primary: [
                { cell: u1, digit: cDigit },
                { cell: u2, digit: cDigit }
              ],
              description: `Avoidable Rectangle Type 2: to avoid an interchangeable rectangle with the solved cells ${cellNames(solved)}, one of ${cellName(u1)}/${cellName(u2)} must be ${cDigit}, so ${cDigit} is removed from cells seeing both.`
            };
          }
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
