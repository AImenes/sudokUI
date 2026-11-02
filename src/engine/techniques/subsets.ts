import {
  Grid,
  UNITS,
  CELL_UNITS,
  bit,
  digitsOf,
  popcount,
  cellName
} from '../board';
import { Step, CellDigit } from '../steps';
import { Tech } from '../ratings';
import { tr, countWord, joinAnd, listAnd, unitName } from '../text';

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

/** a subset technique's name, as the guide gives it in the current language */
function subsetName(tech: Tech): string {
  switch (tech) {
    case 'NAKED_PAIR':
      return tr`Naked Pair`;
    case 'NAKED_TRIPLE':
      return tr`Naked Triple`;
    case 'NAKED_QUADRUPLE':
      return tr`Naked Quadruple`;
    case 'LOCKED_PAIR':
      return tr`Locked Pair`;
    case 'LOCKED_TRIPLE':
      return tr`Locked Triple`;
    case 'HIDDEN_PAIR':
      return tr`Hidden Pair`;
    case 'HIDDEN_TRIPLE':
      return tr`Hidden Triple`;
    case 'HIDDEN_QUADRUPLE':
      return tr`Hidden Quadruple`;
    default:
      return tech;
  }
}

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
      const digits = listAnd(digitsOf(mask));
      const houses = [...unitsWithElims].map(unitName);
      const cells = listAnd(combo.map(cellName));
      // each cell holds every digit of the set, or they hold them only between them (a triple where no cell holds all three)
      const each = combo.every((c) => g.cands[c] === mask);
      // the walk in the finder's own words (the readability report's H1): the
      // cells and the digits they hold, then why the digits go elsewhere; the
      // digits as a player says them (L1)
      const [h1, h2] = houses;
      const first =
        houses.length === 2
          ? each
            ? tr`In ${h1} and ${h2}, ${cells} hold only ${digits}.`
            : tr`In ${h1} and ${h2}, ${cells} hold only ${digits} between them.`
          : each
            ? tr`In ${h1}, ${cells} hold only ${digits}.`
            : tr`In ${h1}, ${cells} hold only ${digits} between them.`;
      return {
        tech,
        placements: [],
        eliminations: elims,
        primary: combo.flatMap((cell) =>
          digitsOf(g.cands[cell]).map((digit) => ({ cell, digit }))
        ),
        // the houses the set clears: both, for a locked set in an intersection
        units: [...unitsWithElims].map((unit) => ({ unit, role: 'primary' as const })),
        labels: {
          // the count in a word, beside the digits (countWord)
          primary:
            houses.length === 2
              ? tr`${countWord(size)} cells that hold only ${digits} between them, in ${houses[0]} and ${houses[1]}`
              : tr`${countWord(size)} cells that hold only ${digits} between them, in ${joinAnd(houses)}`
        },
        walk: {
          frames: [{ text: first, show: ['primary'] }],
          lead:
            houses.length === 2
              ? tr`They must be ${digits}, one each: these digits can go nowhere else in ${h1} or ${h2}.`
              : tr`They must be ${digits}, one each: these digits can go nowhere else in ${h1}.`
        },
        description:
          houses.length === 2
            ? each
              ? tr`${subsetName(tech)}: in ${h1} and ${h2}, ${cells} hold only ${digits}, so these digits can go nowhere else in ${h1} or ${h2}.`
              : tr`${subsetName(tech)}: in ${h1} and ${h2}, ${cells} hold only ${digits} between them, so these digits can go nowhere else in ${h1} or ${h2}.`
            : each
              ? tr`${subsetName(tech)}: in ${h1}, ${cells} hold only ${digits}, so these digits can go nowhere else in ${h1}.`
              : tr`${subsetName(tech)}: in ${h1}, ${cells} hold only ${digits} between them, so these digits can go nowhere else in ${h1}.`
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
      const house = unitName(u);
      const digits = listAnd(digitCombo);
      const names = listAnd(cells.map(cellName));
      // what each cell that loses a candidate keeps, cells that keep the same
      // digits named together, in reading order (the readability report's M20)
      const keeps = new Map<string, { kept: number[]; cells: number[] }>();
      for (const c of cells) {
        if (!(g.cands[c] & ~dmask)) continue;
        const kept = digitsOf(g.cands[c] & dmask);
        (keeps.get(kept.join()) ?? keeps.set(kept.join(), { kept, cells: [] }).get(kept.join())!).cells.push(c);
      }
      const kept = [...keeps.values()].map(({ kept: ds, cells: cs }) =>
        cs.length === 1 ? tr`${cellName(cs[0])} keeps only ${listAnd(ds)}` : tr`${listAnd(cs.map(cellName))} keep only ${listAnd(ds)}`
      );
      return {
        tech,
        placements: [],
        eliminations: elims,
        primary: cells.flatMap((cell) =>
          digitsOf(g.cands[cell] & dmask).map((digit) => ({ cell, digit }))
        ),
        units: [{ unit: u, role: 'primary' }],
        labels: {
          primary: tr`the only ${countWord(size)} cells of ${house} where ${digits} can go`
        },
        // the walk in the finder's own words (H1): where the digits can go,
        // then what the cells keep; the digits as a player says them (L1)
        walk: {
          frames: [{ text: tr`In ${house}, the digits ${digits} can go only in ${names}.`, show: ['primary'] }],
          lead: tr`They must be ${digits}, one each, and hold nothing else: ${kept.join('; ')}.`
        },
        description: tr`${subsetName(tech)}: in ${house}, the digits ${digits} can go only in ${names}, so these cells can hold nothing else.`
      };
    }
  }
  return null;
}
