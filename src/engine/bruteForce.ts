// Fast bitmask backtracking solver: solution finding and counting.
import { Grid, cloneGrid, popcount, setValue, isSolved } from './board';

function findBestCell(g: Grid): number {
  let best = -1;
  let bestCount = 10;
  for (let i = 0; i < 81; i++) {
    if (g.values[i] !== 0) continue;
    const n = popcount(g.cands[i]);
    if (n === 0) return -2; // dead end
    if (n < bestCount) {
      bestCount = n;
      best = i;
      if (n === 1) return best;
    }
  }
  return best;
}

/** Count solutions up to `limit`. */
export function countSolutions(g: Grid, limit = 2): number {
  let count = 0;
  const rec = (grid: Grid): void => {
    if (count >= limit) return;
    const cell = findBestCell(grid);
    if (cell === -2) return;
    if (cell === -1) {
      count++;
      return;
    }
    let mask = grid.cands[cell];
    while (mask) {
      const low = mask & -mask;
      mask &= mask - 1;
      const digit = 32 - Math.clz32(low);
      const next = cloneGrid(grid);
      setValue(next, cell, digit);
      rec(next);
      if (count >= limit) return;
    }
  };
  rec(cloneGrid(g));
  return count;
}

/** Return a solution grid, or null if unsolvable. */
export function solve(g: Grid): Grid | null {
  const rec = (grid: Grid): Grid | null => {
    const cell = findBestCell(grid);
    if (cell === -2) return null;
    if (cell === -1) return grid;
    let mask = grid.cands[cell];
    while (mask) {
      const low = mask & -mask;
      mask &= mask - 1;
      const digit = 32 - Math.clz32(low);
      const next = cloneGrid(grid);
      setValue(next, cell, digit);
      const res = rec(next);
      if (res) return res;
    }
    return null;
  };
  const res = rec(cloneGrid(g));
  return res && isSolved(res) ? res : null;
}

export function hasUniqueSolution(g: Grid): boolean {
  return countSolutions(g, 2) === 1;
}
