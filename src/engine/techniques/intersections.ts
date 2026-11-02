import { Grid, UNITS, bit, rowOf, colOf, boxOf, cellName } from '../board';
import { Step, CellDigit } from '../steps';
import { tr, unitName, listAnd } from '../text';

/**
 * Locked Candidates' walk in its finder's own words (the readability
 * report's H1): the house where the digit has two or three places, then
 * the house they share, which loses the digit everywhere else; each house
 * is drawn with its frame (M1)
 */
function lockedWalk(house: number, cells: number[], d: number, shared: number): NonNullable<Step['walk']> {
  const there = unitName(shared);
  return {
    frames: [
      { text: tr`In ${unitName(house)}, the only cells that can take ${d} are ${listAnd(cells.map(cellName))}.`, show: ['primary'] },
      {
        text:
          cells.length === 2
            ? tr`One of them must be ${d}, and both lie in ${there}, so no other cell of ${there} can be ${d}.`
            : tr`One of them must be ${d}, and all three lie in ${there}, so no other cell of ${there} can be ${d}.`,
        show: ['secondary']
      }
    ]
  };
}

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
          const onRow = lineOf === rowOf;
          const box = unitName(18 + b);
          const lineUnitIndex = onRow ? line : 9 + line;
          const lineName = unitName(lineUnitIndex);
          return {
            tech: 'LOCKED_CANDIDATES_1',
            placements: [],
            eliminations: elims,
            primary: cells.map((cell) => ({ cell, digit: d })),
            units: [
              { unit: 18 + b, role: 'primary' },
              { unit: lineUnitIndex, role: 'secondary' }
            ],
            labels: {
              primary: onRow ? tr`${box}: every ${d} in it sits on one row` : tr`${box}: every ${d} in it sits on one column`,
              secondary: tr`${lineName}, which loses ${d} outside ${box}`
            },
            walk: lockedWalk(18 + b, cells, d, lineUnitIndex),
            description: tr`Locked Candidates (Pointing): in ${box}, every ${d} lies in ${lineName}, so no other cell of ${lineName} can be ${d}.`
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
        const lineName = unitName(u);
        const box = unitName(18 + b);
        return {
          tech: 'LOCKED_CANDIDATES_2',
          placements: [],
          eliminations: elims,
          primary: cells.map((cell) => ({ cell, digit: d })),
          units: [
            { unit: u, role: 'primary' },
            { unit: 18 + b, role: 'secondary' }
          ],
          labels: {
            primary: tr`${lineName}: every ${d} in it sits in one box`,
            secondary: tr`${box}, which loses ${d} outside ${lineName}`
          },
          walk: lockedWalk(u, cells, d, 18 + b),
          description: tr`Locked Candidates (Claiming): in ${lineName}, every ${d} lies in ${box}, so no other cell of ${box} can be ${d}.`
        };
      }
    }
  }
  return null;
}
