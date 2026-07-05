import { Grid, UNITS, bit, digitsOf, cellName, popcount } from '../board';
import { Step } from '../steps';

const UNIT_NAMES = [
  ...Array.from({ length: 9 }, (_, i) => `row ${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `column ${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `box ${i + 1}`)
];

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
      return {
        tech: 'FULL_HOUSE',
        placements: [{ cell: empty, digit }],
        eliminations: [],
        description: `Full House: ${cellName(empty)} is the last empty cell in ${UNIT_NAMES[u]}, so it must be ${digit}.`
      };
    }
  }
  return null;
}

export function findNakedSingle(g: Grid): Step | null {
  for (let cell = 0; cell < 81; cell++) {
    if (g.values[cell] === 0 && popcount(g.cands[cell]) === 1) {
      const digit = digitsOf(g.cands[cell])[0];
      return {
        tech: 'NAKED_SINGLE',
        placements: [{ cell, digit }],
        eliminations: [],
        description: `Naked Single: ${cellName(cell)} has only one candidate left, ${digit}.`
      };
    }
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
      if (count === 1) {
        return {
          tech: 'HIDDEN_SINGLE',
          placements: [{ cell: pos, digit: d }],
          eliminations: [],
          description: `Hidden Single: ${d} fits only in ${cellName(pos)} within ${UNIT_NAMES[u]}.`
        };
      }
    }
  }
  return null;
}
