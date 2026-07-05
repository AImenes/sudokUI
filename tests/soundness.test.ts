import { describe, it, expect } from 'vitest';
import { Grid, parseGrid, gridToString, isSolved, cloneGrid } from '../src/engine/board';
import { solve } from '../src/engine/bruteForce';
import { generatePuzzle } from '../src/engine/generator';
import { findNextStep, applyStep } from '../src/engine/humanSolver';
import { Tech } from '../src/engine/ratings';

/**
 * Soundness harness: whatever technique fires, its placements must match the
 * unique solution and its eliminations must never remove the solution digit.
 * Any unsound finder fails here the moment it triggers.
 */
function verifySolvePath(puzzle: Grid): Set<Tech> {
  const solution = solve(cloneGrid(puzzle))!;
  expect(solution).not.toBeNull();
  const g = cloneGrid(puzzle);
  const seen = new Set<Tech>();
  for (let i = 0; i < 400 && !isSolved(g); i++) {
    const step = findNextStep(g);
    if (!step) break; // would need brute force; fine for soundness purposes
    seen.add(step.tech);
    for (const { cell, digit } of step.placements) {
      expect(
        solution.values[cell],
        `${step.tech} placed ${digit} in cell ${cell}, solution has ${solution.values[cell]}\n${gridToString(puzzle)}`
      ).toBe(digit);
    }
    for (const { cell, digit } of step.eliminations) {
      expect(
        solution.values[cell],
        `${step.tech} eliminated the SOLUTION digit ${digit} from cell ${cell}\n${gridToString(puzzle)}`
      ).not.toBe(digit);
    }
    applyStep(g, step);
  }
  return seen;
}

describe('technique soundness (no step may ever contradict the solution)', () => {
  it('holds across a batch of random puzzles', () => {
    const exercised = new Set<Tech>();
    for (let i = 0; i < 60; i++) {
      const puzzle = generatePuzzle(i % 2 ? 'rotational' : 'none');
      for (const t of verifySolvePath(puzzle)) exercised.add(t);
    }
    // eslint-disable-next-line no-console
    console.info('techniques exercised:', [...exercised].sort().join(', '));
    expect(exercised.size).toBeGreaterThan(5);
  });

  it('holds on known hard puzzles (forces advanced techniques)', () => {
    const HARD_PUZZLES = [
      // top1465-style minimal puzzles and other hard grids
      '52...6.........7.13...........4..8..6......5...........418.........3..2...87.....',
      '4.....8.5.3..........7......2.....6.....8.4......1.......6.3.7.5..2.....1.4......',
      '..53.....8......2..7..1.5..4....53...1..7...6..32...8..6.5....9..4....3......97..',
      '.......12........3..23..4....18....5.6..7.8.......9.....85.....9...4.5..47...6...',
      '.2..5.7..4..1....68....3...2....8..3.4..2.5.....6...1...2.9.....9......57.4...9..',
      '1....7.9..3..2...8..96..5....53..9...1..8...26....4...3......1..4......7..7...3..'
    ];
    const exercised = new Set<Tech>();
    for (const p of HARD_PUZZLES) {
      const g = parseGrid(p)!;
      if (!solve(cloneGrid(g))) continue; // guard against typos in fixtures
      for (const t of verifySolvePath(g)) exercised.add(t);
    }
    // eslint-disable-next-line no-console
    console.info('hard-puzzle techniques exercised:', [...exercised].sort().join(', '));
    expect(exercised.size).toBeGreaterThan(3);
  });
});
