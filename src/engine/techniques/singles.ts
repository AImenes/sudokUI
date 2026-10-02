import { Grid, UNITS, PEERS, bit, digitsOf, cellName, popcount, rowOf, colOf, boxOf } from '../board';
import { Step, CellDigit, UnitBand } from '../steps';

/**
 * Singles — the placement techniques every solve is built on.
 *
 * - Full House: a unit with one empty cell left; the missing digit goes there.
 * - Naked Single: a cell with exactly one candidate.
 * - Hidden Single: a digit with exactly one possible cell in some unit.
 */

const UNIT_NAMES = [
  ...Array.from({ length: 9 }, (_, i) => `row ${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `column ${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `box ${i + 1}`)
];

/** the Full House step for the last empty cell of a house */
export function fullHouseStep(u: number, empty: number, digit: number): Step {
  return {
    tech: 'FULL_HOUSE',
    placements: [{ cell: empty, digit }],
    eliminations: [],
    units: [{ unit: u, role: 'primary' }],
    labels: { primary: `${UNIT_NAMES[u]}, with one cell left` },
    description: `Full House: ${cellName(empty)} is the last empty cell in ${UNIT_NAMES[u]}, so it must be ${digit}.`
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
  // the why: every other digit already sits in the cell's row, column
  // or box; one such peer per digit is shown
  const others: CellDigit[] = [];
  for (let e = 1; e <= 9; e++) {
    if (e === digit) continue;
    const p = PEERS[cell].find((q) => g.values[q] === e);
    if (p !== undefined) others.push({ cell: p, digit: e });
  }
  return {
    tech: 'NAKED_SINGLE',
    placements: [{ cell, digit }],
    eliminations: [],
    primary: [{ cell, digit }],
    secondary: others,
    labels: {
      primary: 'the cell with one candidate left',
      secondary: 'the other eight digits, each already in its row, column or box'
    },
    description: `Naked Single: ${cellName(cell)} has only one candidate left, ${digit}.`
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
  {
    {
      {
        // crosshatching: every other empty cell of the house is ruled out
        // by a placed d that sees it; those ds are shown, and the line (or
        // box) each one shades across the house
        const blockers = new Map<number, CellDigit>();
        const bands: UnitBand[] = [{ unit: u, role: 'primary' }];
        const shaded = new Set<number>([u]);
        for (const x of UNITS[u]) {
          if (x === pos || g.values[x] !== 0) continue;
          const holders = PEERS[x].filter((p) => g.values[p] === d);
          // a blocker on the cell's row or column reads best; a box one otherwise
          const blocker =
            holders.find((p) => rowOf(p) === rowOf(x) || colOf(p) === colOf(x)) ?? holders[0];
          if (blocker === undefined) continue;
          blockers.set(blocker, { cell: blocker, digit: d });
          const across =
            rowOf(blocker) === rowOf(x) ? rowOf(x) : colOf(blocker) === colOf(x) ? 9 + colOf(x) : 18 + boxOf(x);
          if (!shaded.has(across)) {
            shaded.add(across);
            bands.push({ unit: across, role: 'secondary' });
          }
        }
        return {
          tech: 'HIDDEN_SINGLE',
          placements: [{ cell: pos, digit: d }],
          eliminations: [],
          primary: [{ cell: pos, digit: d }],
          secondary: [...blockers.values()],
          units: bands,
          labels: {
            primary: `${UNIT_NAMES[u]}: ${d} has one place left in it`,
            secondary: `the ${d}s that rule out its other cells, shaded along their lines`
          },
          description: `Hidden Single: ${d} fits only in ${cellName(pos)} within ${UNIT_NAMES[u]}.`
        };
      }
    }
  }
}
