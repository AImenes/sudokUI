import { Grid, UNITS, bit, rowOf, colOf, boxOf, cellNames } from '../board';
import { Step, CellDigit } from '../steps';

/**
 * Locked Candidates Type 1 (Pointing): all candidates of a digit in a box
 * lie on one line -> eliminate from the rest of the line.
 */
export function findLockedCandidates1(g: Grid): Step | null {
  for (let b = 0; b < 9; b++) {
    const boxCells = UNITS[18 + b];
    for (let d = 1; d <= 9; d++) {
      const mask = bit(d);
      const cells = boxCells.filter((c) => g.values[c] === 0 && g.cands[c] & mask);
      if (cells.length < 2) continue;
      for (const lineOf of [rowOf, colOf]) {
        const line = lineOf(cells[0]);
        if (!cells.every((c) => lineOf(c) === line)) continue;
        const lineUnit = UNITS[lineOf === rowOf ? line : 9 + line];
        const elims: CellDigit[] = lineUnit
          .filter((c) => boxOf(c) !== b && g.values[c] === 0 && g.cands[c] & mask)
          .map((cell) => ({ cell, digit: d }));
        if (elims.length) {
          return {
            tech: 'LOCKED_CANDIDATES_1',
            placements: [],
            eliminations: elims,
            primary: cells.map((cell) => ({ cell, digit: d })),
            description: `Locked Candidates (Pointing): in box ${b + 1}, digit ${d} is confined to ${cellNames(cells)}, so it can be removed from the rest of the ${lineOf === rowOf ? 'row' : 'column'}.`
          };
        }
      }
    }
  }
  return null;
}

/**
 * Locked Candidates Type 2 (Claiming): all candidates of a digit in a line
 * lie in one box -> eliminate from the rest of the box.
 */
export function findLockedCandidates2(g: Grid): Step | null {
  for (let u = 0; u < 18; u++) {
    const lineCells = UNITS[u];
    for (let d = 1; d <= 9; d++) {
      const mask = bit(d);
      const cells = lineCells.filter((c) => g.values[c] === 0 && g.cands[c] & mask);
      if (cells.length < 2) continue;
      const b = boxOf(cells[0]);
      if (!cells.every((c) => boxOf(c) === b)) continue;
      const elims: CellDigit[] = UNITS[18 + b]
        .filter((c) => !lineCells.includes(c) && g.values[c] === 0 && g.cands[c] & mask)
        .map((cell) => ({ cell, digit: d }));
      if (elims.length) {
        return {
          tech: 'LOCKED_CANDIDATES_2',
          placements: [],
          eliminations: elims,
          primary: cells.map((cell) => ({ cell, digit: d })),
          description: `Locked Candidates (Claiming): in ${u < 9 ? `row ${u + 1}` : `column ${u - 8}`}, digit ${d} is confined to box ${b + 1}, so it can be removed from the rest of the box.`
        };
      }
    }
  }
  return null;
}
