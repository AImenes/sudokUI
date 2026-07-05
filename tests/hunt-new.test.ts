import { describe, it, expect } from 'vitest';
import { Grid, cloneGrid, isSolved, gridToString } from '../src/engine/board';
import { solve } from '../src/engine/bruteForce';
import { generatePuzzle } from '../src/engine/generator';
import { findNextStep, applyStep } from '../src/engine/humanSolver';
import { Step } from '../src/engine/steps';
import { findChuteRemotePair } from '../src/engine/techniques/chuteRemotePair';
import {
  findUniqueness,
  findHiddenRectangle,
  findAvoidableRectangle
} from '../src/engine/techniques/uniqueness';
import { findWxyzWing, findDeathBlossom } from '../src/engine/techniques/als';

/**
 * Every new finder is probed at EVERY position of every solve path (not just
 * when the solve order would pick it), and each hit is validated against the
 * brute-force solution. This exercises rare patterns far more often than a
 * normal solve would.
 */
const PROBES: Record<string, (g: Grid) => Step | null> = {
  CHUTE_REMOTE_PAIR: findChuteRemotePair,
  UNIQUENESS_3: (g) => findUniqueness(g, 3),
  UNIQUENESS_5: (g) => findUniqueness(g, 5),
  UNIQUENESS_6: (g) => findUniqueness(g, 6),
  HIDDEN_RECTANGLE: findHiddenRectangle,
  AVOIDABLE_RECTANGLE_1: (g) => findAvoidableRectangle(g, 1),
  AVOIDABLE_RECTANGLE_2: (g) => findAvoidableRectangle(g, 2),
  WXYZ_WING: findWxyzWing,
  DEATH_BLOSSOM: findDeathBlossom
};

// these are common enough that the budget MUST produce them
const REQUIRED = [
  'CHUTE_REMOTE_PAIR',
  'UNIQUENESS_3',
  'HIDDEN_RECTANGLE',
  'AVOIDABLE_RECTANGLE_1',
  'WXYZ_WING'
];

describe('new technique hunt + validation', () => {
  it('finds and validates the new finders on real puzzles', { timeout: 300_000 }, () => {
    const found: Record<string, number> = {};
    const done = () => REQUIRED.every((t) => (found[t] ?? 0) > 0);

    for (let i = 0; i < 500 && !done(); i++) {
      const puzzle = generatePuzzle(i % 2 ? 'rotational' : 'none');
      const solution = solve(cloneGrid(puzzle));
      if (!solution) continue;
      const g = cloneGrid(puzzle);
      for (let s = 0; s < 200 && !isSolved(g); s++) {
        for (const [name, probe] of Object.entries(PROBES)) {
          const hit = probe(g);
          if (!hit) continue;
          found[name] = (found[name] ?? 0) + 1;
          for (const { cell, digit } of hit.placements) {
            expect(
              solution.values[cell],
              `${name} misplaced: ${hit.description}\n${gridToString(puzzle)}`
            ).toBe(digit);
          }
          for (const { cell, digit } of hit.eliminations) {
            expect(
              solution.values[cell],
              `${name} eliminated a solution digit: ${hit.description}\n${gridToString(puzzle)}`
            ).not.toBe(digit);
          }
        }
        const step = findNextStep(g);
        if (!step) break;
        applyStep(g, step);
      }
    }
    // eslint-disable-next-line no-console
    console.info('new-technique validation counts:', found);
    for (const t of REQUIRED) {
      expect(found[t] ?? 0, `${t} never fired within budget`).toBeGreaterThan(0);
    }
  });
});
