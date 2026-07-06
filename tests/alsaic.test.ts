import { it, expect } from 'vitest';
import { cloneGrid, isSolved, gridToString } from '../src/engine/board';
import { solve } from '../src/engine/bruteForce';
import { generatePuzzle } from '../src/engine/generator';
import { findNextStep, applyStep } from '../src/engine/humanSolver';
import { findGroupedAic } from '../src/engine/techniques/groupedAic';

// prove the ALS-augmented chains fire with the AIC_ALS label and validate them
it('AIC with ALS nodes fires and is sound', { timeout: 300_000 }, () => {
  let alsHits = 0, groupHits = 0;
  for (let i = 0; i < 200 && alsHits < 5; i++) {
    const puzzle = generatePuzzle('none');
    const solution = solve(cloneGrid(puzzle));
    if (!solution) continue;
    const g = cloneGrid(puzzle);
    for (let s = 0; s < 200 && !isSolved(g); s++) {
      if (s % 3 === 0) {
        const hit = findGroupedAic(g);
        if (hit) {
          if (hit.tech === 'AIC_ALS') alsHits++;
          else groupHits++;
          for (const { cell, digit } of hit.placements) {
            expect(solution.values[cell], `${hit.tech} misplaced\n${gridToString(puzzle)}`).toBe(digit);
          }
          for (const { cell, digit } of hit.eliminations) {
            expect(solution.values[cell], `${hit.tech} killed a solution digit: ${hit.description}\n${gridToString(puzzle)}`).not.toBe(digit);
          }
        }
      }
      const step = findNextStep(g);
      if (!step) break;
      applyStep(g, step);
    }
  }
  console.info(JSON.stringify({ alsHits, groupHits }));
  expect(alsHits).toBeGreaterThan(0);
});
