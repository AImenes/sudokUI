import { Grid, UNITS, PEERS, bit, digitsOf, cellName, popcount, rowOf, colOf, boxOf } from '../board';
import { Step, CellDigit, UnitBand } from '../steps';
import { tr, unitName, listAnd } from '../text';

/**
 * Singles — the placement techniques every solve is built on.
 *
 * - Full House: a unit with one empty cell left; the missing digit goes there.
 * - Naked Single: a cell with exactly one candidate.
 * - Hidden Single: a digit with exactly one possible cell in some unit.
 */

/** a sentence that opens with a house's name ("row 4", "rad 4"), capitalised */
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** the Full House step for the last empty cell of a house */
export function fullHouseStep(u: number, empty: number, digit: number): Step {
  return {
    tech: 'FULL_HOUSE',
    placements: [{ cell: empty, digit }],
    eliminations: [],
    units: [{ unit: u, role: 'primary' }],
    labels: { primary: tr`${unitName(u)}, with one cell left` },
    // the walk in the finder's own words (the readability report's H1): the
    // house and what it lacks, then the placement
    walk: { frames: [{ text: capital(tr`${unitName(u)} has one empty cell, ${cellName(empty)}, and lacks only ${digit}.`), show: [] }] },
    description: tr`Full House: ${cellName(empty)} is the last empty cell in ${unitName(u)}, so it must be ${digit}.`
  };
}

export function findFullHouse(g: Grid): Step | null {
  for (let u = 0; u < 27; u++) {
    let empty = -1;
    let count = 0;
    for (const cell of UNITS[u]) {
      if (g.values[cell] === 0) {
        empty = cell;
        count++;
        if (count > 1) break;
      }
    }
    if (count === 1) {
      const digit = digitsOf(g.cands[empty])[0];
      if (!digit) continue; // broken grid
      return fullHouseStep(u, empty, digit);
    }
  }
  return null;
}

/** the Naked Single step for a cell with one candidate left */
export function nakedSingleStep(g: Grid, cell: number): Step {
  const digit = digitsOf(g.cands[cell])[0];
  // the why: the other digits already in the cell's row, column or box,
  // one such peer per digit; all eight of them, or fewer when earlier
  // removals ruled out the rest
  const others: CellDigit[] = [];
  for (let e = 1; e <= 9; e++) {
    if (e === digit) continue;
    const p = PEERS[cell].find((q) => g.values[q] === e);
    if (p !== undefined) others.push({ cell: p, digit: e });
  }
  const name = cellName(cell);
  // the digits no peer holds, which earlier removals ruled out of the cell
  const held = others.map((o) => o.digit);
  const gone = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((e) => e !== digit && !held.includes(e));
  // the walk (H1): the cell and its one candidate, then the digits its
  // houses hold, each drawn where it stands; the cell named in frame 1 (M8)
  const frames: NonNullable<Step['walk']>['frames'] = others.length
    ? [
        { text: tr`Only one candidate is left in ${name}: ${digit}.`, show: ['primary'] },
        {
          text:
            others.length === 8
              ? tr`The row, column and box of ${name} already hold the other eight digits.`
              : gone.length === 1
                ? tr`The row, column and box of ${name} already hold ${listAnd(held)}; ${gone[0]} was ruled out earlier.`
                : tr`The row, column and box of ${name} already hold ${listAnd(held)}; ${listAnd(gone)} were ruled out earlier.`,
          show: ['secondary']
        }
      ]
    : [{ text: tr`Only one candidate is left in ${name}: ${digit}; the others were ruled out earlier.`, show: ['primary'] }];
  return {
    tech: 'NAKED_SINGLE',
    placements: [{ cell, digit }],
    eliminations: [],
    primary: [{ cell, digit }],
    secondary: others,
    labels: {
      primary: tr`the cell with one candidate left`,
      secondary:
        others.length === 8
          ? tr`the other eight digits, each already in its row, column or box`
          : tr`the digits already in its row, column or box; its other candidates were ruled out earlier`
    },
    walk: { frames },
    description:
      others.length === 8
        ? tr`Naked Single: the row, column and box of ${name} already hold the other eight digits, so ${name} must be ${digit}.`
        : tr`Naked Single: ${name} has only one candidate left, ${digit}.`
  };
}

export function findNakedSingle(g: Grid): Step | null {
  for (let cell = 0; cell < 81; cell++) {
    if (g.values[cell] === 0 && popcount(g.cands[cell]) === 1) return nakedSingleStep(g, cell);
  }
  return null;
}

export function findHiddenSingle(g: Grid): Step | null {
  for (let u = 0; u < 27; u++) {
    for (let d = 1; d <= 9; d++) {
      const b = bit(d);
      let pos = -1;
      let count = 0;
      for (const cell of UNITS[u]) {
        if (g.values[cell] === 0 && g.cands[cell] & b) {
          pos = cell;
          count++;
          if (count > 1) break;
        }
      }
      if (count === 1) return hiddenSingleStep(g, u, d, pos);
    }
  }
  return null;
}

/** the Hidden Single step for digit d at its one place in house u */
export function hiddenSingleStep(g: Grid, u: number, d: number, pos: number): Step {
  // crosshatching: every other empty cell of the house is ruled out by a
  // placed d that sees it, or lost its d to an earlier removal; those ds
  // are shown, and the line (or box) each one shades across the house:
  // each band, with its ds
  const across = new Map<number, number[]>();
  const seen: number[] = [];
  const earlier: number[] = [];
  const others = UNITS[u].filter((x) => x !== pos && g.values[x] === 0);
  for (const x of others) {
    const holders = PEERS[x].filter((p) => g.values[p] === d);
    // a blocker on the cell's row or column reads best; a box one otherwise
    const blocker = holders.find((p) => rowOf(p) === rowOf(x) || colOf(p) === colOf(x)) ?? holders[0];
    if (blocker === undefined) {
      earlier.push(x);
      continue;
    }
    const line = rowOf(blocker) === rowOf(x) ? rowOf(x) : colOf(blocker) === colOf(x) ? 9 + colOf(x) : 18 + boxOf(x);
    across.set(line, [...(across.get(line) ?? []), blocker]);
    seen.push(blocker);
  }
  // a band whose cells in the house another band already shades says
  // nothing more (a column inside a box's band): it goes, the narrowest
  // first, with the d that shades only it
  const crossing = (line: number) => others.filter((x) => UNITS[line].includes(x));
  const kept = [...across.keys()];
  for (const line of [...kept].sort((a, b) => crossing(a).length - crossing(b).length)) {
    const rest = kept.filter((l) => l !== line);
    if (crossing(line).every((x) => rest.some((l) => UNITS[l].includes(x)))) kept.splice(kept.indexOf(line), 1);
  }
  const bands: UnitBand[] = [{ unit: u, role: 'primary' }, ...kept.map((unit) => ({ unit, role: 'secondary' as const }))];
  const shading = new Set(kept.flatMap((line) => across.get(line)!));
  const blockers = [...new Set(seen)].filter((p) => shading.has(p)).map((cell) => ({ cell, digit: d }));
  const house = unitName(u);
  const place = cellName(pos);
  // the walk (H1): the house and the one place its d has, then the ds that
  // rule out the rest of it, named by their cells, with the cells an
  // earlier removal ruled out; every band and every d shown is the same as
  // the full view's (M1, M9)
  const by = blockers.map((b) => cellName(b.cell));
  const rest = earlier.length ? listAnd(earlier.map(cellName)) : '';
  const frames: NonNullable<Step['walk']>['frames'] = !blockers.length
    ? [
        {
          text: others.length
            ? tr`In ${house}, the ${d} can go only in ${place}: it was already ruled out in every other empty cell.`
            : tr`In ${house}, the ${d} can go only in ${place}, its one empty cell.`,
          show: ['primary']
        }
      ]
    : [
        { text: tr`In ${house}, the ${d} can go only in ${place}.`, show: ['primary'] },
        {
          text: earlier.length
            ? by.length === 1
              ? tr`The ${d} in ${by[0]} rules out ${d} in every other empty cell of ${house} but ${rest}, where it was already ruled out.`
              : tr`The ${d}s in ${listAnd(by)} rule out ${d} in every other empty cell of ${house} but ${rest}, where it was already ruled out.`
            : by.length > 1
              ? tr`The ${d}s in ${listAnd(by)} rule out ${d} in every other empty cell of ${house}.`
              : others.length === 1
                ? tr`The ${d} in ${by[0]} rules out ${d} in ${cellName(others[0])}, the other empty cell of ${house}.`
                : tr`The ${d} in ${by[0]} rules out ${d} in every other empty cell of ${house}.`,
          show: ['secondary']
        }
      ];
  return {
    tech: 'HIDDEN_SINGLE',
    placements: [{ cell: pos, digit: d }],
    eliminations: [],
    primary: [{ cell: pos, digit: d }],
    secondary: blockers,
    units: bands,
    labels: {
      primary: tr`${house}: ${d} has one place left in it`,
      // all its other cells, or, where earlier removals ruled out some, the rest
      secondary: earlier.length
        ? tr`the ${d}s that rule out some of its other cells, shaded along their lines`
        : tr`the ${d}s that rule out its other cells, shaded along their lines`
    },
    walk: { frames },
    description: tr`Hidden Single: ${d} fits only in ${place} within ${house}.`
  };
}
