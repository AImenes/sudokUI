/**
 * The brute force solver propagates singles before every branch. Forced
 * placements cannot change the number of solutions, so its counts must
 * agree with a plain backtracking counter on every grid: proper puzzles,
 * ambiguous ones, contradictory ones.
 */
import { describe, it, expect } from 'vitest';
import { Grid, gridFromValues, cloneGrid, setValue, parseGrid, isSolved, bit, UNITS } from '../src/engine/board';
import { countSolutions, solve, isSolvable } from '../src/engine/bruteForce';
import { generateFullGrid } from '../src/engine/generator';

/** the simplest counter there is: no heuristics, no propagation */
function naiveCount(g: Grid, limit: number): number {
  let count = 0;
  const rec = (grid: Grid): void => {
    if (count >= limit) return;
    let cell = -1;
    for (let i = 0; i < 81; i++) {
      if (grid.values[i] === 0) {
        cell = i;
        break;
      }
    }
    if (cell === -1) {
      count++;
      return;
    }
    for (let d = 1; d <= 9; d++) {
      if (!(grid.cands[cell] & bit(d))) continue;
      const next = cloneGrid(grid);
      setValue(next, cell, d);
      rec(next);
      if (count >= limit) return;
    }
  };
  rec(cloneGrid(g));
  return count;
}

/** a random partial grid: a full grid with n clues kept, sometimes corrupted */
function randomGrid(n: number, corrupt: boolean): Grid {
  const values = new Uint8Array(generateFullGrid().values);
  const cells = Array.from({ length: 81 }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  for (const c of cells.slice(n)) values[c] = 0;
  if (corrupt) {
    // change one clue to a digit its unit does not hold yet, so the grid
    // is still well formed but usually has no solution
    const kept = cells.slice(0, n);
    const c = kept[Math.floor(Math.random() * kept.length)];
    for (let d = 1; d <= 9; d++) {
      if (d === values[c]) continue;
      const clash = UNITS.some(
        (u) => u.includes(c) && u.some((x) => x !== c && values[x] === d)
      );
      if (!clash) {
        values[c] = d;
        break;
      }
    }
  }
  return gridFromValues(values);
}

describe('brute force with propagation', () => {
  it('counts exactly what plain backtracking counts', { timeout: 120_000 }, () => {
    let zero = 0;
    let one = 0;
    let many = 0;
    for (let i = 0; i < 120; i++) {
      // 30 clues and more keep the naive counter honest in time
      const g = randomGrid(30 + Math.floor(Math.random() * 20), i % 4 === 0);
      const want = naiveCount(g, 3);
      expect(countSolutions(g, 3)).toBe(want);
      expect(isSolvable(g)).toBe(want > 0);
      if (want === 0) zero++;
      else if (want === 1) one++;
      else many++;
    }
    // the sample must have exercised all three outcomes
    expect(zero).toBeGreaterThan(0);
    expect(one).toBeGreaterThan(0);
    expect(many).toBeGreaterThan(0);
  });

  it('solves a known puzzle and a sparse one', () => {
    const easy = parseGrid('003020600900305001001806400008102900700000008006708200002609500800203009005010300')!;
    expect(solve(easy)).not.toBeNull();
    expect(isSolved(solve(easy)!)).toBe(true);
    // a 17-clue puzzle: the solver must branch, and still count exactly one
    const sparse = parseGrid('000000010400000000020000000000050407008000300001090000300400200050100000000806000')!;
    expect(countSolutions(sparse, 2)).toBe(1);
  });

  it('reports a contradiction instead of a solution', () => {
    // two 5s in the first row: no solution can exist
    const g = parseGrid('500000005000000000000000000000000000000000000000000000000000000000000000000000000')!;
    expect(countSolutions(g, 2)).toBe(0);
    expect(solve(g)).toBeNull();
  });
});
