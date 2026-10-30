import { it, expect } from 'vitest';
import { cloneGrid, isSolved, gridToString } from '../src/engine/board';
import { solve } from '../src/engine/bruteForce';
import { generatePuzzle } from '../src/engine/generator';
import { findNextStep, findStep, applyStep } from '../src/engine/humanSolver';
import { findGroupedAic } from '../src/engine/techniques/groupedAic';
import type { Tech } from '../src/engine/ratings';
import { wordProblems } from './setWords';
import { derivationProblems } from './chainSets';

// prove the ALS-augmented chains fire with the AIC_ALS label and validate
// them; and that their walk tells each set as the design does
// (docs/hint-drawing-sets.md, decision 17; tests/setWords.ts): introduced in
// a frame of its own before the chain reaches it, every link of it in its
// words, never the plain sentence for two digits
it('AIC with ALS nodes fires, is sound, and walks its sets in their own words', { timeout: 300_000 }, () => {
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
          expect(wordProblems(hit), `${hit.tech}: ${hit.description}\n${gridToString(g)}`).toEqual([]);
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

// the ALS patterns as the chains they are, and Death Blossom with its
// branches (docs/hint-drawing-sets.md, decisions 11, 13 and 15), as generated
// puzzles offer them where the solver needs more than a single: sound, every
// link true to the solution (no strong link without a true end, no weak link
// with two), their truth as tests/chainSets.ts holds it, and their walks in
// their own words
it('the ALS patterns fire as sound chains, Death Blossom with sound branches, and walk in their own words', { timeout: 300_000 }, () => {
  const TECHS: Tech[] = ['ALS_XZ', 'ALS_XY_WING', 'ALS_XY_CHAIN', 'DEATH_BLOSSOM'];
  const hits: Record<string, number> = {};
  for (let i = 0; i < 80 && TECHS.some((t) => (hits[t] ?? 0) < 3); i++) {
    const puzzle = generatePuzzle(i % 2 ? 'rotational' : 'none');
    const solution = solve(cloneGrid(puzzle));
    if (!solution) continue;
    const g = cloneGrid(puzzle);
    for (let s = 0; s < 200 && !isSolved(g); s++) {
      const step = findNextStep(g);
      if (!step) break;
      if (!['FULL_HOUSE', 'NAKED_SINGLE', 'HIDDEN_SINGLE'].includes(step.tech)) {
        for (const tech of TECHS) {
          if ((hits[tech] ?? 0) >= 3) continue;
          const hit = findStep(tech, g);
          if (!hit) continue;
          hits[tech] = (hits[tech] ?? 0) + 1;
          const at = `${tech}: ${hit.description}\n${gridToString(g)}`;
          for (const { cell, digit } of hit.eliminations) expect(solution.values[cell], `${at}: killed a solution digit`).not.toBe(digit);
          const holds = (node: { cell: number; digit: number }[]) => node.some((cd) => solution.values[cd.cell] === cd.digit);
          for (const l of hit.links ?? []) {
            if (l.strong) expect(holds(l.from) || holds(l.to), `${at}: a strong link with no true end`).toBe(true);
            else expect(holds(l.from) && holds(l.to), `${at}: a weak link with two true ends`).toBe(false);
          }
          expect(derivationProblems(hit, (c) => g.values[c] > 0), at).toEqual([]);
          expect(wordProblems(hit), at).toEqual([]);
        }
      }
      applyStep(g, step);
    }
  }
  console.info(JSON.stringify(hits));
  for (const tech of TECHS) expect(hits[tech], tech).toBeGreaterThan(0);
});
