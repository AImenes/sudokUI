import { describe, it, expect } from 'vitest';
import { generateWhere, requiresTechnique } from '../src/engine/generator';
import { ratePuzzle } from '../src/engine/humanSolver';
import { PRACTICE_TECHS, TECHS } from '../src/engine/ratings';

describe('practice generation', () => {
  // A handful of common techniques should be findable within a modest budget.
  const targets = ['NAKED_PAIR', 'HIDDEN_PAIR', 'LOCKED_CANDIDATES_1', 'X_WING'] as const;

  for (const tech of targets) {
    it(`generates a puzzle that requires ${TECHS[tech].name}`, () => {
      const res = generateWhere(requiresTechnique(tech), 400);
      expect(res, `no ${tech} puzzle in budget`).not.toBeNull();
      expect(res!.rating.techniques[tech]).toBeGreaterThan(0);
      // and the recorded rating reproduces on a fresh solve
      const again = ratePuzzle(res!.puzzle)!;
      expect(again.techniques[tech]).toBeGreaterThan(0);
    });
  }

  it('every practice technique is implemented and enabled', () => {
    for (const tech of PRACTICE_TECHS) {
      expect(TECHS[tech].implemented).toBe(true);
      expect(TECHS[tech].enabled).toBe(true);
    }
  });
});
