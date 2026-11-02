import { Grid, UNITS, bit, digitsOf, popcount, rowOf, colOf, boxOf, sees, cellName, cellNames } from '../board';
import { Step, CellDigit } from '../steps';
import { tr, listAnd, unitName } from '../text';

/**
 * Chute Remote Pairs (sudokuwiki.org/Chute_Remote_Pairs):
 *
 * Two bivalue cells with the same pair {a,b} in one chute (band of 3 rows or
 * stack of 3 columns), not seeing each other. Look at the 3 cells in the
 * remaining box ∩ remaining line of the chute. If digit a occurs nowhere in
 * them (neither as candidate nor placed value), the remaining box must place
 * its a on one of the two pair lines, which forces that line's pair cell to
 * b. At least one pair cell is therefore b, so b, the digit that DOES occur
 * in those 3 cells, can be removed from every cell seeing both pair cells.
 * If neither digit occurs, the argument runs both ways: the pair cells hold
 * opposite digits and both can be removed.
 *
 * The hint draws what the argument rests on (docs/hint-readability-2026-11.md
 * H2): the pair in the pattern's colour, the third box as a dashed band with
 * its candidates of the missing digit in gold (all in the pair's lines), and
 * the digit the pair cells lose to the removals in the exception's colour,
 * one of which is true; its walk goes pair > the mini-line's missing digit >
 * the either/or > the removal (H1).
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
        return chuteStep(g, c1, c2, horizontal, l3, b3, mini, present, elims);
      }
    }
  }
  return null;
}

/** the step for a pair c1, c2 whose third box b3 lacks a pair digit in its mini-line (the pair digits there: present) */
function chuteStep(
  g: Grid,
  c1: number,
  c2: number,
  horizontal: boolean,
  l3: number,
  b3: number,
  mini: number[],
  present: number,
  elims: CellDigit[]
): Step {
  const pairMask = g.cands[c1];
  const lineOf = horizontal ? rowOf : colOf;
  const house = (l: number) => unitName(horizontal ? l : 9 + l);
  // the pair cells in the order of their lines, for the words
  const [p1, p2] = lineOf(c1) < lineOf(c2) ? [c1, c2] : [c2, c1];
  const [n1, n2] = [cellName(p1), cellName(p2)];
  // in reading order where the words do not follow the lines
  const [f1, f2] = [cellName(c1), cellName(c2)];
  const [L1, L2] = [house(lineOf(p1)), house(lineOf(p2))];
  const third = house(l3);
  const box = unitName(18 + b3);
  const [a, b] = digitsOf(pairMask);
  const missingMask = pairMask & ~present;
  // present === 0: neither digit is in the mini-line, and both go
  const both = present === 0;
  const [m] = digitsOf(missingMask);
  const [r] = digitsOf(present);
  const lo = Math.floor(l3 / 3) * 3 + 1;
  const hi = lo + 2;
  const miniNames = cellNames(mini);
  const pair = horizontal
    ? tr`${f1} and ${f2} hold only ${a} and ${b}, in different rows and boxes of rows ${lo}-${hi}.`
    : tr`${f1} and ${f2} hold only ${a} and ${b}, in different columns and boxes of columns ${lo}-${hi}.`;
  const description = both
    ? horizontal
      ? tr`Chute Remote Pair: ${f1} and ${f2} hold only ${a} and ${b}, in different rows and boxes of rows ${lo}-${hi}. In ${box}, ${third} (${miniNames}) has neither ${a} nor ${b}, so the box's ${a} and ${b} each lie in ${L1} or ${L2}, and each makes the pair cell in its row the other digit: one pair cell is ${a} and the other ${b}. So both ${a} and ${b} are removed from every cell that sees both pair cells.`
      : tr`Chute Remote Pair: ${f1} and ${f2} hold only ${a} and ${b}, in different columns and boxes of columns ${lo}-${hi}. In ${box}, ${third} (${miniNames}) has neither ${a} nor ${b}, so the box's ${a} and ${b} each lie in ${L1} or ${L2}, and each makes the pair cell in its column the other digit: one pair cell is ${a} and the other ${b}. So both ${a} and ${b} are removed from every cell that sees both pair cells.`
    : horizontal
      ? tr`Chute Remote Pair: ${f1} and ${f2} hold only ${a} and ${b}, in different rows and boxes of rows ${lo}-${hi}. In ${box}, ${third} (${miniNames}) has no ${m}, so the box's ${m} is in ${L1} or ${L2}, and the pair cell in that row cannot be ${m}: it is ${r}. One pair cell is therefore ${r}, so ${r} is removed from every cell that sees both.`
      : tr`Chute Remote Pair: ${f1} and ${f2} hold only ${a} and ${b}, in different columns and boxes of columns ${lo}-${hi}. In ${box}, ${third} (${miniNames}) has no ${m}, so the box's ${m} is in ${L1} or ${L2}, and the pair cell in that column cannot be ${m}: it is ${r}. One pair cell is therefore ${r}, so ${r} is removed from every cell that sees both.`;
  // the third box's candidates of the missing digit or digits: all in the pair's lines
  const boxCands = UNITS[18 + b3]
    .filter((cell) => g.values[cell] === 0)
    .flatMap((cell) => digitsOf(g.cands[cell] & missingMask).map((digit) => ({ cell, digit })));
  // the cells that lose a digit, in reading order
  const losing = [...new Set(elims.map((e) => e.cell))].sort((x, y) => x - y).map(cellName);
  return {
    tech: 'CHUTE_REMOTE_PAIR',
    placements: [],
    eliminations: elims,
    primary: [c1, c2].flatMap((cell) => [a, b].map((digit) => ({ cell, digit }))),
    secondary: boxCands,
    // the digit the pair cells lose to the removals, one of them true: the
    // pattern's until the walk frame that tells why, then the exception's
    fins: [p1, p2].flatMap((cell) => digitsOf(both ? pairMask : present).map((digit) => ({ cell, digit }))),
    units: [{ unit: 18 + b3, role: 'secondary' }],
    labels: {
      primary: horizontal
        ? tr`the pair: only ${a} and ${b} in both cells, in different rows and boxes of rows ${lo}-${hi}`
        : tr`the pair: only ${a} and ${b} in both cells, in different columns and boxes of columns ${lo}-${hi}`,
      secondary: both
        ? horizontal
          ? tr`${box}'s ${a}s and ${b}s: all in the pair's rows`
          : tr`${box}'s ${a}s and ${b}s: all in the pair's columns`
        : horizontal
          ? tr`${box}'s ${m}s: all in the pair's rows`
          : tr`${box}'s ${m}s: all in the pair's columns`,
      fins: both ? tr`the pair: one cell is ${a}, the other ${b}` : tr`${r} in the pair: one of the two cells is ${r}`
    },
    walk: {
      frames: [
        { text: pair, show: ['primary'] },
        {
          text: both
            ? tr`In ${box}, ${third} has neither ${a} nor ${b}, so the box's ${a} and ${b} each lie in ${L1} or ${L2}.`
            : tr`In ${box}, ${third} has no ${m}, so the box's ${m} is in ${L1} or ${L2}.`,
          show: ['secondary']
        },
        {
          text: both
            ? tr`If ${box}'s ${a} is in ${L1}, ${n1} is ${b}, and the box's ${b} must then be in ${L2}, so ${n2} is ${a}; if its ${a} is in ${L2}, the other way round. Either way one pair cell is ${a} and the other ${b}.`
            : tr`If ${box}'s ${m} is in ${L1}, ${n1} cannot be ${m} and is ${r}; if it is in ${L2}, ${n2} is ${r}. Either way one of the two is ${r}.`,
          show: ['fins']
        }
      ],
      lead: losing.length === 1 ? tr`${losing[0]} sees both pair cells.` : tr`${listAnd(losing)} see both pair cells.`
    },
    // the forum line names the pair digits in the mini-line, as it always did
    copyOnly: mini
      .filter((c) => g.values[c] === 0)
      .flatMap((cell) => digitsOf(g.cands[cell] & pairMask).map((digit) => ({ cell, digit }))),
    description
  };
}
