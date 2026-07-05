import {
  Grid,
  UNITS,
  CELL_UNITS,
  bit,
  digitsOf,
  popcount,
  cellNames,
  rowOf,
  colOf,
  boxOf
} from '../board';
import { Step, CellDigit } from '../steps';
import { Tech } from '../ratings';

export function combinations<T>(items: T[], k: number): T[][] {
  const out: T[][] = [];
  const rec = (start: number, acc: T[]) => {
    if (acc.length === k) {
      out.push([...acc]);
      return;
    }
    for (let i = start; i <= items.length - (k - acc.length); i++) {
      acc.push(items[i]);
      rec(i + 1, acc);
      acc.pop();
    }
  };
  rec(0, []);
  return out;
}

const SUBSET_NAMES = ['', '', 'Pair', 'Triple', 'Quadruple'];

/** All units (unit indices) containing every cell of `cells`. */
function sharedUnits(cells: number[]): number[] {
  const [first, ...rest] = cells;
  return CELL_UNITS[first].filter((u) => rest.every((c) => CELL_UNITS[c].includes(u)));
}

/**
 * Naked subsets. `locked` selects the locked variant (subset lies in a
 * box/line intersection and eliminates in both units) — HoDoKu rates those
 * separately and earlier.
 */
export function findNakedSubset(g: Grid, size: number, locked: boolean): Step | null {
  for (let u = 0; u < 27; u++) {
    const empty = UNITS[u].filter(
      (c) => g.values[c] === 0 && popcount(g.cands[c]) <= size
    );
    if (empty.length < size) continue;
    for (const combo of combinations(empty, size)) {
      let mask = 0;
      for (const c of combo) mask |= g.cands[c];
      if (popcount(mask) !== size) continue;
      const units = sharedUnits(combo);
      // collect eliminations across all shared units
      const elims: CellDigit[] = [];
      const seen = new Set<string>();
      const unitsWithElims = new Set<number>();
      for (const su of units) {
        for (const c of UNITS[su]) {
          if (combo.includes(c) || g.values[c] !== 0) continue;
          const hits = g.cands[c] & mask;
          if (!hits) continue;
          unitsWithElims.add(su);
          for (const d of digitsOf(hits)) {
            const key = `${c}-${d}`;
            if (!seen.has(key)) {
              seen.add(key);
              elims.push({ cell: c, digit: d });
            }
          }
        }
      }
      if (!elims.length) continue;
      const isLocked = units.length >= 2 && unitsWithElims.size >= 2 && size <= 3;
      if (isLocked !== locked) continue;
      const tech: Tech = locked
        ? size === 2
          ? 'LOCKED_PAIR'
          : 'LOCKED_TRIPLE'
        : (`NAKED_${['', '', 'PAIR', 'TRIPLE', 'QUADRUPLE'][size]}` as Tech);
      const digits = digitsOf(mask);
      return {
        tech,
        placements: [],
        eliminations: elims,
        primary: combo.flatMap((cell) =>
          digitsOf(g.cands[cell]).map((digit) => ({ cell, digit }))
        ),
        description: `${locked ? 'Locked' : 'Naked'} ${SUBSET_NAMES[size]}: cells ${cellNames(combo)} contain only ${digits.join('/')}, removing those digits from the cells they all see.`
      };
    }
  }
  return null;
}

export function findHiddenSubset(g: Grid, size: number): Step | null {
  for (let u = 0; u < 27; u++) {
    const empty = UNITS[u].filter((c) => g.values[c] === 0);
    if (empty.length <= size) continue; // otherwise it's a naked subset too
    // digits still missing in this unit
    const missing: number[] = [];
    for (let d = 1; d <= 9; d++) {
      if (empty.some((c) => g.cands[c] & bit(d))) missing.push(d);
    }
    if (missing.length <= size) continue;
    for (const digitCombo of combinations(missing, size)) {
      let dmask = 0;
      for (const d of digitCombo) dmask |= bit(d);
      const cells = empty.filter((c) => g.cands[c] & dmask);
      if (cells.length !== size) continue;
      const elims: CellDigit[] = [];
      for (const c of cells) {
        for (const d of digitsOf(g.cands[c] & ~dmask)) elims.push({ cell: c, digit: d });
      }
      if (!elims.length) continue;
      const tech = `HIDDEN_${['', '', 'PAIR', 'TRIPLE', 'QUADRUPLE'][size]}` as Tech;
      return {
        tech,
        placements: [],
        eliminations: elims,
        primary: cells.flatMap((cell) =>
          digitsOf(g.cands[cell] & dmask).map((digit) => ({ cell, digit }))
        ),
        description: `Hidden ${SUBSET_NAMES[size]}: in ${unitName(u)}, digits ${digitCombo.join('/')} fit only in ${cellNames(cells)}, so all other candidates there can be removed.`
      };
    }
  }
  return null;
}

export function unitName(u: number): string {
  if (u < 9) return `row ${u + 1}`;
  if (u < 18) return `column ${u - 8}`;
  return `box ${u - 17}`;
}
