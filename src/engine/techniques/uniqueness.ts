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
import { listAnd, tr, unitName } from '../text';

/*
 * The walks (step.walk, the readability report's H1): frame 1 the
 * rectangle, all of it, naming its floor (the corners holding only the
 * pair) and its roof (the corners holding more); frame 2 what the argument
 * adds (the roof's extra digit, the key digit gold, G5); the conclusion
 * opening with why the pattern would be deadly: with only the pair in all
 * four corners, none of them a given, the corners could swap and the
 * puzzle would have two solutions. The roles, and so the drawing and the
 * Copy step line, are as they were.
 */

/** cells as prose writes them: "r5c2 and r6c2", "r5c9, r8c8 and r8c9" */
const named = (cells: number[]) => listAnd(cells.map(cellName));

/** frame 1 of a unique rectangle whose floor and roof are two corners each */
function floorAndRoof(x: number, y: number, floor: number[], roof: number[]): string {
  return tr`${x} and ${y} are candidates in all four corners of the rectangle: the floor, ${named(floor)}, holds only these two, and the roof, ${named(roof)}, holds other digits too.`;
}

/**
 * After the why: one of the cells holding the extra digit z must be z, and
 * every removal sees all of them (UR Types 2 and 5, Avoidable Rectangle
 * Type 2, Extended Rectangle Type 2)
 */
export function oneOfThemSees(z: number, holders: number[], elims: CellDigit[]): string {
  const seeing = [...new Set(elims.map((e) => e.cell))];
  const e = named(seeing);
  if (holders.length === 2) {
    return seeing.length === 1 ? tr`One of them must therefore be ${z}, and ${e} sees both.` : tr`One of them must therefore be ${z}, and ${e} each see both.`;
  }
  return seeing.length === 1 ? tr`One of them must therefore be ${z}, and ${e} sees all of them.` : tr`One of them must therefore be ${z}, and ${e} each see all of them.`;
}

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
          // the fourth corner's would-be candidates, drawn before they go (as Avoidable Rectangle Type 1's)
          secondary: elims,
          labels: {
            primary: tr`the three corners holding only ${x}/${y}`,
            secondary: tr`${x} and ${y} in the fourth corner: either would complete the deadly pattern`
          },
          walk: {
            frames: [
              { text: tr`Three corners of a rectangle, ${named(exact)}, hold only ${x} and ${y}.`, show: ['primary'] },
              { text: tr`The fourth corner, ${cellName(target)}, holds ${x} and ${y} as well, and other digits too.`, show: ['secondary'] }
            ],
            lead: tr`If ${cellName(target)} were ${x} or ${y}, all four corners would hold only ${x} and ${y}; they could swap, and the puzzle would have two solutions.`
          },
          description: tr`Unique Rectangle Type 1: ${cellNames(cells)} would form a deadly pattern on ${x}/${y}; ${cellName(target)} cannot be ${x} or ${y}.`
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
          labels: {
            primary: tr`the rectangle: ${x}/${y} in all four corners`,
            secondary: tr`${z}, the roof's extra candidate: one of the two roof cells must be it`
          },
          walk: {
            frames: [
              { text: floorAndRoof(x, y, exact, extra), show: ['primary'] },
              { text: tr`Each of ${named(extra)} holds just one other digit, the same one: ${z}.`, show: ['secondary'] }
            ],
            lead: `${tr`If neither ${cellName(e1)} nor ${cellName(e2)} were ${z}, all four corners would hold only ${x} and ${y}; they could swap, and the puzzle would have two solutions.`} ${oneOfThemSees(z, extra, elims)}`
          },
          description: tr`Unique Rectangle Type 2: to avoid the deadly pattern on ${x}/${y}, one of ${cellName(e1)}/${cellName(e2)} must be ${z}, so ${z} is removed from cells seeing both.`
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
        const confined = shared.find((u) =>
          UNITS[u].every(
            (c) =>
              c === e1 ||
              c === e2 ||
              g.values[c] !== 0 ||
              !(g.cands[c] & bit(keep))
          )
        );
        if (confined === undefined) continue;
        const elims = [e1, e2]
          .filter((c) => g.cands[c] & bit(kill))
          .map((cell) => ({ cell, digit: kill }));
        if (elims.length) {
          return {
            tech: 'UNIQUENESS_4',
            placements: [],
            eliminations: elims,
            // the rectangle; the roof's `keep` is also secondary, drawn in
            // its own colour with the house it is locked into from the frame
            // that shows that colour (src/content/hintMarks.ts)
            primary: cells.flatMap((cell) => [x, y].map((digit) => ({ cell, digit }))),
            secondary: [e1, e2].map((cell) => ({ cell, digit: keep })),
            units: [{ unit: confined, role: 'secondary' }],
            labels: {
              primary: tr`the rectangle: ${x}/${y} in all four corners`,
              secondary: tr`${keep} in ${unitName(confined)}: only in the roof, so one of ${cellName(e1)}, ${cellName(e2)} is ${keep}`
            },
            walk: {
              frames: [
                { text: floorAndRoof(x, y, exact, extra), show: ['primary'] },
                { text: tr`In ${unitName(confined)}, ${keep} is a candidate only in the roof, so ${cellName(e1)} or ${cellName(e2)} is ${keep}.`, show: ['secondary'] }
              ],
              lead: tr`If ${cellName(e1)} or ${cellName(e2)} were ${kill}, the other would be ${keep}, and all four corners would hold only ${x} and ${y}; they could swap, and the puzzle would have two solutions.`
            },
            description: tr`Unique Rectangle Type 4: ${keep} is locked into ${cellName(e1)}/${cellName(e2)}; keeping ${kill} there would force the deadly pattern, so ${kill} is removed from ${cellName(e1)} and ${cellName(e2)}.`
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
        // the digits the roof's extras and S fill in the house, one roof cell
        // taking an extra: the digits, the roof, the house and the cells named
        const digits = listAnd(digitsOf(mask));
        const extras = listAnd(digitsOf(E));
        const roof = cellNames([e1, e2]);
        const cells = cellNames(S);
        const house = unitName(u);
        const deadly = cellNames(rect.cells);
        const [x, y] = [rect.x, rect.y];
        const floor = rect.cells.filter((c) => !extra.includes(c));
        const why = tr`If neither roof cell took one of its extras, all four corners would hold only ${x} and ${y}; they could swap, and the puzzle would have two solutions.`;
        return {
          tech: 'UNIQUENESS_3',
          placements: [],
          eliminations: elims,
          primary: rect.cells.flatMap((cell) => [
            { cell, digit: rect.x },
            { cell, digit: rect.y }
          ]),
          secondary: [
            ...[e1, e2].flatMap((cell) => digitsOf(g.cands[cell] & ~pairMask).map((digit) => ({ cell, digit }))),
            ...S.flatMap((cell) => digitsOf(g.cands[cell]).map((digit) => ({ cell, digit })))
          ],
          units: [{ unit: u, role: 'secondary' }],
          // the roof's extras and the cells beside them, in plain words: one
          // roof cell must take an extra, so with the cells beside it the
          // digits fill as many cells as there are digits (the readability
          // report's L2: no "pseudo-cell", no cell "read as one")
          labels: {
            primary: tr`the rectangle: ${rect.x}/${rect.y} in all four corners`,
            secondary:
              k === 1
                ? tr`${digits}: the roof must take one, and ${cells} holds only these, so they go nowhere else in ${house}`
                : tr`${digits}: the roof must take one of its extras, and ${cells} hold only these, so they go nowhere else in ${house}`
          },
          walk: {
            frames: [
              { text: floorAndRoof(x, y, floor, [e1, e2]), show: ['primary'] },
              {
                text:
                  k === 1
                    ? tr`The roof's extras are ${extras}, and ${named(S)}, also in ${house}, holds only ${digits}.`
                    : tr`The roof's extras are ${extras}, and ${named(S)}, also in ${house}, hold only ${digits} between them.`,
                show: ['secondary']
              }
            ],
            lead:
              k === 1
                ? `${why} ${tr`A roof cell must therefore take one of its extras, and ${named(S)} holds only ${digits}, so ${digits} go in the roof and ${named(S)}, and nowhere else in ${house}.`}`
                : `${why} ${tr`A roof cell must therefore take one of its extras, and ${named(S)} hold only ${digits} between them, so ${digits} go in the roof and ${named(S)}, and nowhere else in ${house}.`}`
          },
          description:
            k === 1
              ? tr`Unique Rectangle Type 3: ${deadly} would form a deadly pattern on ${x}/${y}, so one of the roof cells ${roof} must take one of the roof's extras (${extras}), and ${cells} holds only ${digits}. So ${digits} go in the roof and ${cells}, and nowhere else in ${house}.`
              : tr`Unique Rectangle Type 3: ${deadly} would form a deadly pattern on ${x}/${y}, so one of the roof cells ${roof} must take one of the roof's extras (${extras}), and ${cells} hold only ${digits} between them. So ${digits} go in the roof and ${cells}, and nowhere else in ${house}.`
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
    labels: {
      primary: tr`the rectangle: ${rect.x}/${rect.y} in all four corners`,
      secondary: tr`${z} in the roof cells: one of them must be it`
    },
    walk: {
      frames: [
        {
          text: tr`${rect.x} and ${rect.y} are candidates in all four corners of the rectangle: ${named(exact)} holds only these two, and ${named(extra)} hold other digits too.`,
          show: ['primary']
        },
        { text: tr`Each of ${named(extra)} holds just one other digit, the same one: ${z}.`, show: ['secondary'] }
      ],
      lead: `${tr`If none of ${named(extra)} were ${z}, all four corners would hold only ${rect.x} and ${rect.y}; they could swap, and the puzzle would have two solutions.`} ${oneOfThemSees(z, extra, elims)}`
    },
    description: tr`Unique Rectangle Type 5: one of ${cellNames(extra)} must be ${z} to avoid the deadly pattern, so ${z} is removed from cells seeing all of them.`
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
    // the rectangle, its d also in their own colour with the two lines it
    // is confined to the rectangle in, from the frame that shows that colour
    const other = d === rect.x ? rect.y : rect.x;
    const [a, b] = rowsStrong ? rows : cols;
    return {
      tech: 'UNIQUENESS_6',
      placements: [],
      eliminations: elims,
      primary: rect.cells.flatMap((cell) => [other, d].map((digit) => ({ cell, digit }))),
      secondary: rect.cells.map((cell) => ({ cell, digit: d })),
      units: (rowsStrong ? rows : cols.map((c) => 9 + c)).map((unit) => ({ unit, role: 'secondary' as const })),
      labels: {
        primary: tr`the rectangle: ${rect.x}/${rect.y} in all four corners`,
        secondary: rowsStrong
          ? tr`${d} in rows ${a + 1} and ${b + 1}: only in the rectangle, so on one diagonal`
          : tr`${d} in columns ${a + 1} and ${b + 1}: only in the rectangle, so on one diagonal`
      },
      walk: {
        frames: [
          { text: floorAndRoof(rect.x, rect.y, exact, extra), show: ['primary'] },
          {
            text: rowsStrong
              ? tr`Rows ${a + 1} and ${b + 1} have ${d} only in the rectangle, so their two ${d}s lie on the same diagonal.`
              : tr`Columns ${a + 1} and ${b + 1} have ${d} only in the rectangle, so their two ${d}s lie on the same diagonal.`,
            show: ['secondary']
          }
        ],
        lead: tr`If ${cellName(extra[0])} or ${cellName(extra[1])} were ${d}, both would be, and ${named(exact)} would both be ${other}: all four corners would hold only ${rect.x} and ${rect.y}; they could swap, and the puzzle would have two solutions.`
      },
      description: rowsStrong
        ? tr`Unique Rectangle Type 6: ${d} is confined to the rectangle in both rows; placing it in a roof corner would force the deadly pattern, so ${d} is removed from ${cellNames(extra)}.`
        : tr`Unique Rectangle Type 6: ${d} is confined to the rectangle in both columns; placing it in a roof corner would force the deadly pattern, so ${d} is removed from ${cellNames(extra)}.`
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
        // the rectangle; the strong digit in B's row and column, which lies
        // there only in the rectangle, also in its own colour with that row
        // and column, from the frame that shows that colour
        const confined = [B, rowMate, colMate];
        return {
          tech: 'HIDDEN_RECTANGLE',
          placements: [],
          eliminations: [{ cell: B, digit: weak }],
          primary: cells.flatMap((cell) => [x, y].map((digit) => ({ cell, digit }))),
          secondary: confined.map((cell) => ({ cell, digit: strong })),
          units: [
            { unit: rowOf(B), role: 'secondary' },
            { unit: 9 + colOf(B), role: 'secondary' }
          ],
          labels: {
            primary: tr`the rectangle: ${x}/${y} in all four corners`,
            secondary: tr`${strong} in ${unitName(rowOf(B))} and in ${unitName(9 + colOf(B))}: only in the rectangle`
          },
          walk: {
            frames: [
              { text: tr`${x} and ${y} are candidates in all four corners of the rectangle, and ${cellName(A)} holds only these two.`, show: ['primary'] },
              {
                text: tr`In ${unitName(rowOf(B))} and in ${unitName(9 + colOf(B))}, which cross at ${cellName(B)}, ${strong} is a candidate only in the rectangle.`,
                show: ['secondary']
              }
            ],
            lead: tr`If ${cellName(B)} were ${weak}, ${unitName(rowOf(B))} would have its ${strong} in ${cellName(rowMate)} and ${unitName(9 + colOf(B))} its ${strong} in ${cellName(colMate)}, so ${cellName(A)}, which sees both, would be ${weak}: all four corners would hold only ${x} and ${y}; they could swap, and the puzzle would have two solutions.`
          },
          description: tr`Hidden Rectangle: ${cellName(A)} holds only ${x}/${y}, and ${strong} is confined to the rectangle in ${cellName(B)}'s row and column; ${cellName(B)} cannot be ${weak} or the deadly pattern appears.`
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
              // the three solved corners, shown by their digits
              primary: solved.map((cell) => ({ cell, digit: g.values[cell] })),
              secondary: [{ cell: U, digit: a }],
              labels: {
                primary: tr`the three solved corners, none of them a given`,
                secondary: tr`the cell that would complete the rectangle with ${a}`
              },
              walk: {
                frames: [
                  {
                    text: tr`Three corners of a rectangle are solved, none of them a given: ${named(adj)} are ${g.values[adj[0]]}, and ${cellName(D)} is ${a}.`,
                    show: ['primary']
                  },
                  { text: tr`The fourth corner, ${cellName(U)}, still has ${a} as a candidate.`, show: ['secondary'] }
                ],
                lead: tr`If ${cellName(U)} were ${a}, all four corners would hold only ${Math.min(a, g.values[adj[0]])} and ${Math.max(a, g.values[adj[0]])}, none of them a given; they could swap, and the puzzle would have two solutions.`
              },
              description: tr`Avoidable Rectangle Type 1: setting ${cellName(U)} to ${a} would complete an interchangeable rectangle of solved (non-given) cells, contradicting the puzzle's unique solution.`
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
              // the rectangle first, as Type 1 and the Unique Rectangles draw
              // it: the two solved corners, shown by their digits, and the
              // candidates that would complete it; then the extra digit
              primary: [
                ...solved.map((cell) => ({ cell, digit: g.values[cell] })),
                { cell: u1, digit: dv1 },
                { cell: u2, digit: dv2 }
              ],
              secondary: [
                { cell: u1, digit: cDigit },
                { cell: u2, digit: cDigit }
              ],
              labels: {
                primary: tr`the two solved corners, neither of them a given, and the ${Math.min(dv1, dv2)} and ${Math.max(dv1, dv2)} that would complete the rectangle`,
                secondary: tr`${cDigit} in the two unsolved corners: one of them must be it`
              },
              walk: {
                frames: [
                  {
                    text: tr`Two corners of a rectangle are solved, neither of them a given: ${cellName(p1)} is ${g.values[p1]} and ${cellName(p2)} is ${g.values[p2]}; of the other two, ${cellName(u1)} could be ${dv1} and ${cellName(u2)} could be ${dv2}.`,
                    show: ['primary']
                  },
                  { text: tr`Each of ${named([u1, u2])} holds just one other digit, the same one: ${cDigit}.`, show: ['secondary'] }
                ],
                lead: `${tr`If neither ${cellName(u1)} nor ${cellName(u2)} were ${cDigit}, they would be ${dv1} and ${dv2}, and all four corners would hold only ${Math.min(dv1, dv2)} and ${Math.max(dv1, dv2)}, none of them a given; they could swap, and the puzzle would have two solutions.`} ${oneOfThemSees(cDigit, [u1, u2], elims)}`
              },
              description: tr`Avoidable Rectangle Type 2: to avoid an interchangeable rectangle with the solved cells ${cellNames(solved)}, one of ${cellName(u1)}/${cellName(u2)} must be ${cDigit}, so ${cDigit} is removed from cells seeing both.`
            };
          }
        }
      }
    }
  }
  return null;
}

/**
 * BUG+1: if all cells were bivalue, each candidate twice in each of its
 * houses (a bivalue universal grave), every cell could take its other
 * candidate at once and the puzzle would have two solutions; the single
 * trivalue cell must take the digit occurring three times. Without that
 * digit the grid must be such a grave: a house where a digit is a
 * candidate once (a hidden single, which a solve path takes first, but
 * Scan lists beside it) makes it none, and the placement unproven (two
 * such finds along the practice paths placed a digit the solution does
 * not have)
 */
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
    if (!counts.every((n) => n === 3)) continue;
    const without = (c: number) => (c === triCell ? g.cands[c] & ~bit(d) : g.cands[c]);
    const grave = UNITS.every((unit) => {
      for (let e = 1; e <= 9; e++) {
        const n = unit.filter((c) => g.values[c] === 0 && without(c) & bit(e)).length;
        if (n !== 0 && n !== 2) return false;
      }
      return true;
    });
    if (!grave) continue;
    const cell = cellName(triCell);
    const [row, col, box] = CELL_UNITS[triCell].map(unitName);
    return {
      tech: 'BUG_PLUS_1',
      placements: [{ cell: triCell, digit: d }],
      eliminations: [],
      primary: [{ cell: triCell, digit: d }],
      units: CELL_UNITS[triCell].map((unit) => ({ unit, role: 'secondary' as const })),
      labels: {
        primary: tr`the one cell with three candidates; ${d} is the extra`,
        secondary: tr`its row, column and box, each holding ${d} three times`
      },
      walk: {
        frames: [
          { text: tr`Every unsolved cell but ${cell} holds exactly two candidates; ${cell} holds three.`, show: ['primary'] },
          { text: tr`In ${row}, ${col} and ${box}, which meet at ${cell}, ${d} is a candidate in three cells each.`, show: ['secondary'] }
        ],
        lead: tr`Without the ${d} in ${cell}, every unsolved cell would hold two candidates, each found twice in its row, column and box. That is a deadly pattern: every cell could take its other candidate at once, and the puzzle would have two solutions.`
      },
      // the BUG idea in plain words (docs/hint-readability-2026-11.md L2): a
      // grave has no solution or several, never exactly one
      description: tr`BUG+1: every unsolved cell but ${cell} holds exactly two candidates. Without its ${d}, ${cell} would too, and each candidate would be found twice in its row, column and box: a deadly pattern, which cannot have just one solution. So ${cell} must be ${d}.`
    };
  }
  return null;
}
