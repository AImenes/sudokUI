import { describe, it, expect } from 'vitest';
import { Grid, cloneGrid, isSolved, gridToString } from '../src/engine/board';
import { solve } from '../src/engine/bruteForce';
import { generatePuzzle } from '../src/engine/generator';
import { findNextStep, applyStep } from '../src/engine/humanSolver';
import { Step } from '../src/engine/steps';
import { findNishio, findCellForcing, findUnitForcing } from '../src/engine/techniques/forcing';
import { findPatternOverlay } from '../src/engine/techniques/templates';
import { findAlsXyChain } from '../src/engine/techniques/als';
import { findAlignedPairExclusion } from '../src/engine/techniques/ape';
import { findFrankenFish } from '../src/engine/techniques/complexFish';
import { findGroupedXCycles } from '../src/engine/techniques/groupedXCycles';
import { findNiceLoop } from '../src/engine/techniques/aic';
import { findDigitForcing } from '../src/engine/techniques/forcing';
import { findGroupedAic, findGroupedNiceLoop } from '../src/engine/techniques/groupedAic';
import { findFireworks } from '../src/engine/techniques/fireworks';

/**
 * The expensive finders (forcing nets, pattern overlay) probed on a smaller
 * batch, every 4th solve position, validated against the brute-force
 * solution — placements must match it, eliminations must never hit it.
 */
const PROBES: Record<string, (g: Grid) => Step | null> = {
  NISHIO_FORCING_CHAIN: findNishio,
  CELL_FORCING_CHAIN: findCellForcing,
  UNIT_FORCING_CHAIN: findUnitForcing,
  PATTERN_OVERLAY: (g) => findPatternOverlay(g),
  ALS_XY_CHAIN: findAlsXyChain,
  ALIGNED_PAIR_EXCLUSION: findAlignedPairExclusion,
  FRANKEN_X_WING: (g) => findFrankenFish(g, 2),
  FRANKEN_SWORDFISH: (g) => findFrankenFish(g, 3),
  GROUPED_X_CYCLES: (g) => findGroupedXCycles(g),
  NICE_LOOP: (g) => findNiceLoop(g),
  DIGIT_FORCING_CHAIN: findDigitForcing,
  AIC_GROUPED: (g) => findGroupedAic(g),
  GROUPED_NICE_LOOP: (g) => findGroupedNiceLoop(g),
  FIREWORKS: findFireworks
};

const REQUIRED = [
  'NISHIO_FORCING_CHAIN',
  'CELL_FORCING_CHAIN',
  'UNIT_FORCING_CHAIN',
  'PATTERN_OVERLAY',
  'ALS_XY_CHAIN',
  'GROUPED_X_CYCLES',
  'NICE_LOOP',
  'DIGIT_FORCING_CHAIN',
  'AIC_GROUPED',
  'GROUPED_NICE_LOOP'
];

describe('heavy technique hunt + validation', () => {
  it('finds and validates the expensive finders on real puzzles', { timeout: 300_000 }, () => {
    const found: Record<string, number> = {};
    const done = () => REQUIRED.every((t) => (found[t] ?? 0) > 0);

    for (let i = 0; i < 120 && !done(); i++) {
      const puzzle = generatePuzzle(i % 2 ? 'rotational' : 'none');
      const solution = solve(cloneGrid(puzzle));
      if (!solution) continue;
      const g = cloneGrid(puzzle);
      for (let s = 0; s < 200 && !isSolved(g); s++) {
        if (s % 4 === 0) {
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
        }
        const step = findNextStep(g);
        if (!step) break;
        applyStep(g, step);
      }
    }
    // eslint-disable-next-line no-console
    console.info('heavy-technique validation counts:', found);
    for (const t of REQUIRED) {
      expect(found[t] ?? 0, `${t} never fired within budget`).toBeGreaterThan(0);
    }
  });
});
