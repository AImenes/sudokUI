// Fast bitmask backtracking solver: solution finding and counting.
//
// Before every branch the solver propagates singles to a fixpoint: a cell
// with one candidate takes it (naked single), a digit with one place in a
// unit goes there (hidden single). Both are forced, so the solution count
// is untouched, and the search tree of a uniqueness proof shrinks by an
// order of magnitude. This is what makes digging a puzzle fast
// (docs/generator.md).
import { Grid, cloneGrid, popcount, setValue, isSolved, UNITS, ALL_CANDS } from './board';

/**
 * Place every naked and hidden single, in place, until none is left.
 *
 * @returns false when the grid is contradictory: an empty cell with no
 *   candidate, or a digit with no place left in some unit
 */
function propagate(g: Grid): boolean {
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < 81; i++) {
      if (g.values[i]) continue;
      const m = g.cands[i];
      if (m === 0) return false;
      if ((m & (m - 1)) === 0) {
        setValue(g, i, 32 - Math.clz32(m));
        changed = true;
      }
    }
    for (let u = 0; u < 27; u++) {
      const unit = UNITS[u];
      // once: digits with at least one place; twice: with at least two
      let once = 0;
      let twice = 0;
      let solved = 0;
      for (let k = 0; k < 9; k++) {
        const c = unit[k];
        const v = g.values[c];
        if (v) {
          solved |= 1 << (v - 1);
        } else {
          const m = g.cands[c];
          twice |= once & m;
          once |= m;
        }
      }
      if ((solved | once) !== ALL_CANDS) return false;
      const singles = once & ~twice;
      if (singles) {
        // one placement per unit per pass: the others are recomputed next
        // pass from fresh candidates (two digits sharing one last cell is a
        // contradiction the next pass reports)
        const low = singles & -singles;
        const d = 32 - Math.clz32(low);
        for (let k = 0; k < 9; k++) {
          const c = unit[k];
          if (!g.values[c] && g.cands[c] & low) {
            setValue(g, c, d);
            break;
          }
        }
        changed = true;
      }
    }
  }
  return true;
}

/**
 * Minimum-remaining-values heuristic: the empty cell with the fewest
 * candidates, which keeps the backtracking tree small. Called after
 * propagation, so every empty cell has at least two candidates.
 *
 * @returns the cell index, or `-1` if the grid is full (solved)
 */
function findBestCell(g: Grid): number {
  let best = -1;
  let bestCount = 10;
  for (let i = 0; i < 81; i++) {
    if (g.values[i] !== 0) continue;
    const n = popcount(g.cands[i]);
    if (n < bestCount) {
      bestCount = n;
      best = i;
      if (n === 2) return best;
    }
  }
  return best;
}

/**
 * Count the grid's solutions, stopping early once `limit` is reached.
 * `countSolutions(g, 2)` is the standard uniqueness check: 0 = unsolvable,
 * 1 = proper puzzle, 2 = ambiguous.
 *
 * @param g - grid to solve; not mutated
 * @param limit - stop counting at this many solutions (default 2)
 * @returns the number of solutions found, capped at `limit`
 */
export function countSolutions(g: Grid, limit = 2): number {
  let count = 0;
  const rec = (grid: Grid): void => {
    if (!propagate(grid)) return;
    const cell = findBestCell(grid);
    if (cell === -1) {
      count++;
      return;
    }
    let mask = grid.cands[cell];
    while (mask) {
      const low = mask & -mask;
      mask &= mask - 1;
      const next = cloneGrid(grid);
      setValue(next, cell, 32 - Math.clz32(low));
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
    if (!propagate(grid)) return null;
    const cell = findBestCell(grid);
    if (cell === -1) return grid;
    let mask = grid.cands[cell];
    while (mask) {
      const low = mask & -mask;
      mask &= mask - 1;
      const next = cloneGrid(grid);
      setValue(next, cell, 32 - Math.clz32(low));
      const res = rec(next);
      if (res) return res;
    }
    return null;
  };
  const res = rec(cloneGrid(g));
  return res && isSolved(res) ? res : null;
}

/** True iff the grid has at least one solution. */
export function isSolvable(g: Grid): boolean {
  return solve(g) !== null;
}

/** True iff the grid has exactly one solution (a proper puzzle). */
export function hasUniqueSolution(g: Grid): boolean {
  return countSolutions(g, 2) === 1;
}
