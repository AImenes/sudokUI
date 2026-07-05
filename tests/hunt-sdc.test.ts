import { describe, it, expect } from 'vitest';
import { cloneGrid, isSolved, parseGrid } from '../src/engine/board';
import { solve } from '../src/engine/bruteForce';
import { generatePuzzle } from '../src/engine/generator';
import { findNextStep, applyStep } from '../src/engine/humanSolver';

// One-off hunt: prove Sue de Coq fires on a real puzzle and is sound.
describe('sue de coq hunt', () => {
  it('finds and validates a real Sue de Coq occurrence', { timeout: 300_000 }, () => {
    let found = 0;
    for (let i = 0; i < 3000 && found < 2; i++) {
      const puzzle = generatePuzzle('none');
      const solution = solve(cloneGrid(puzzle));
      if (!solution) continue;
      const g = cloneGrid(puzzle);
      for (let s = 0; s < 400 && !isSolved(g); s++) {
        const step = findNextStep(g);
        if (!step) break;
        if (step.tech === 'SUE_DE_COQ') {
          found++;
          for (const { cell, digit } of step.eliminations) {
            expect(solution.values[cell], step.description).not.toBe(digit);
          }
          // eslint-disable-next-line no-console
          console.info(`SDC #${found} at puzzle ${i}: ${step.description}`);
        }
        applyStep(g, step);
      }
    }
    expect(found, 'no Sue de Coq found in 3000 puzzles').toBeGreaterThan(0);
  });
});
