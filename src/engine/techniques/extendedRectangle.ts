import { Grid, bit, digitsOf, popcount, sees, cellNames, cellName, rowOf, colOf } from '../board';
import { Step, CellDigit } from '../steps';
import { listAnd, tr } from '../text';
import { oneOfThemSees } from './uniqueness';

/** cells as prose writes them: "r8c1 and r9c9", "r8c1, r9c5 and r9c9" */
const named = (cells: number[]) => listAnd(cells.map(cellName));

/**
 * The walk's words for a formation (the readability report's H1): where
 * its six cells lie, and the swap that would give a second solution if
 * they held only the trio. Its two long lines are two rows (then each
 * column holds two of its cells, in one box) or two columns
 */
function formation(cells: number[]) {
  const rows = [...new Set(cells.map(rowOf))].sort((a, b) => a - b).map((r) => r + 1);
  const cols = [...new Set(cells.map(colOf))].sort((a, b) => a - b).map((c) => c + 1);
  const inRows = rows.length === 2;
  return {
    /** "In rows 8 and 9, across three boxes, {cells} hold only {trio}." */
    only: (some: number[], trio: string) =>
      inRows
        ? tr`In rows ${rows[0]} and ${rows[1]}, across three boxes, ${named(some)} hold only ${trio}.`
        : tr`In columns ${cols[0]} and ${cols[1]}, across three boxes, ${named(some)} hold only ${trio}.`,
    between: (trio: string) =>
      inRows
        ? tr`In rows ${rows[0]} and ${rows[1]}, across three boxes, ${named(cells)} hold ${trio} between them.`
        : tr`In columns ${cols[0]} and ${cols[1]}, across three boxes, ${named(cells)} hold ${trio} between them.`,
    swap: inRows
      ? tr`Swapping the two cells in each of columns ${cols[0]}, ${cols[1]} and ${cols[2]} at once would then give a second solution.`
      : tr`Swapping the two cells in each of rows ${rows[0]}, ${rows[1]} and ${rows[2]} at once would then give a second solution.`
  };
}

/** Type 1's walk: the five cells on the trio, the sixth's trio digits, and why they go */
function type1Walk(cells: number[], extrasCell: number, trio: number, elims: CellDigit[]): Step['walk'] {
  const shape = formation(cells);
  const t = listAnd(digitsOf(trio));
  const ds = elims.map((e) => e.digit);
  const x = cellName(extrasCell);
  const lead =
    ds.length === 1
      ? tr`If ${x} were ${ds[0]}, all six cells would hold only ${t}.`
      : ds.length === 2
        ? tr`If ${x} were ${ds[0]} or ${ds[1]}, all six cells would hold only ${t}.`
        : tr`If ${x} were ${ds[0]}, ${ds[1]} or ${ds[2]}, all six cells would hold only ${t}.`;
  return {
    frames: [
      { text: shape.only(cells.filter((c) => c !== extrasCell), t), show: ['primary'] },
      { text: tr`The sixth cell, ${x}, holds ${listAnd(ds)} as well, and other digits too.`, show: ['secondary'] }
    ],
    lead: `${lead} ${shape.swap}`
  };
}

/**
 * Type 1's description: the five cells on the trio, and the sixth's trio
 * digits, which would make the six a deadly pattern, removed
 */
function type1Text(cells: number[], extrasCell: number, trio: number, elims: CellDigit[]): string {
  const five = cellNames(cells.filter((c) => c !== extrasCell));
  const t = listAnd(digitsOf(trio));
  const x = cellName(extrasCell);
  const ds = elims.map((e) => e.digit);
  if (ds.length === 1) {
    return tr`Extended Rectangle: five of the six cells, ${five}, hold only ${t}. If ${x} were ${ds[0]} too, the six cells would form a deadly pattern, and the puzzle would have a second solution, so ${ds[0]} is removed from ${x}.`;
  }
  return ds.length === 2
    ? tr`Extended Rectangle: five of the six cells, ${five}, hold only ${t}. If ${x} were ${ds[0]} or ${ds[1]} too, the six cells would form a deadly pattern, and the puzzle would have a second solution, so ${ds[0]} and ${ds[1]} are removed from ${x}.`
    : tr`Extended Rectangle: five of the six cells, ${five}, hold only ${t}. If ${x} were ${ds[0]}, ${ds[1]} or ${ds[2]} too, the six cells would form a deadly pattern, and the puzzle would have a second solution, so ${ds[0]}, ${ds[1]} and ${ds[2]} are removed from ${x}.`;
}

/** Type 2's walk: the six cells on the trio, the extra digit's cells, and why the removals see them all */
function type2Walk(cells: number[], trio: number, z: number, zCells: number[], elims: CellDigit[]): Step['walk'] {
  const shape = formation(cells);
  const t = listAnd(digitsOf(trio));
  const lead =
    zCells.length === 2
      ? tr`If neither ${cellName(zCells[0])} nor ${cellName(zCells[1])} were ${z}, all six cells would hold only ${t}.`
      : tr`If none of ${named(zCells)} were ${z}, all six cells would hold only ${t}.`;
  return {
    frames: [
      { text: shape.between(t), show: ['primary'] },
      { text: tr`Their only other candidate is ${z}, in ${named(zCells)}.`, show: ['secondary'] }
    ],
    lead: `${lead} ${shape.swap} ${oneOfThemSees(z, zCells, elims)}`
  };
}

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
      // the sixth cell's would-be candidates, drawn before they go
      secondary: elims,
      // plain words (the readability report's L2): no "Type 1", which the
      // panel's title does not name, and a deadly pattern, not a "loop"
      labels: {
        primary: tr`five of the six cells, which hold only ${listAnd(digitsOf(trio))}`,
        secondary:
          elims.length === 1
            ? tr`${elims[0].digit} in ${cellName(extrasCell)}: it would complete the deadly pattern`
            : tr`${listAnd(elims.map((e) => e.digit))} in ${cellName(extrasCell)}: each would complete the deadly pattern`
      },
      walk: type1Walk(cells, extrasCell, trio, elims),
      description: type1Text(cells, extrasCell, trio, elims)
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
      labels: {
        primary: tr`the six cells: without the extra ${z}, they would form a deadly pattern on ${listAnd(digitsOf(trio))}`,
        secondary: tr`${z}, the extra candidate: one of these cells must be it`
      },
      walk: type2Walk(cells, trio, z, zCells, elims),
      description: tr`Extended Rectangle: to avoid a deadly pattern on ${listAnd(digitsOf(trio))} in ${cellNames(cells)}, one of ${cellNames(zCells)} must be ${z}, so ${z} is removed from cells seeing all of them.`
    };
  }
  return null;
}
