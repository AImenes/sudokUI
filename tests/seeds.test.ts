/**
 * The seed library is stored data, held to the engine like the saved
 * practice puzzles: every seed is a proper puzzle of its band, minimal
 * (as pairs when symmetric),
 * passes the band's filters, and its stored rating is what the solver
 * gives it today. scripts/build-seeds.ts finds and saves them.
 */
import { describe, it, expect } from 'vitest';
import { parseGrid } from '../src/engine/board';
import { countSolutions } from '../src/engine/bruteForce';
import { ratePuzzle } from '../src/engine/humanSolver';
import { isMinimal, hasSymmetry, fitForLevel, cleanTechniques } from '../src/engine/generator';
import { Level } from '../src/engine/ratings';
import type { PoolEntry } from '../src/engine/worker';
import { SEEDED_LEVELS, SEEDS_PER_LEVEL, StoredSeeds } from '../src/content/seeds';
import stored from '../src/content/seeds.json';

const entries = Object.entries(stored as StoredSeeds) as [Level, PoolEntry[]][];

describe('seed library', () => {
  it('covers every seeded band, and only those, without duplicates', () => {
    expect(entries.map(([level]) => level).sort()).toEqual([...SEEDED_LEVELS].sort());
    for (const [level, list] of entries) {
      expect(list.length, level).toBeGreaterThan(0);
      expect(list.length, level).toBeLessThanOrEqual(SEEDS_PER_LEVEL);
      expect(new Set(list.map((e) => e.puzzle)).size, `${level}: no duplicates`).toBe(list.length);
    }
  });

  for (const [level, list] of entries) {
    it(`${level}: every seed is proper, minimal, in the band, and rated as stored`, { timeout: 300_000 }, () => {
      for (const e of list) {
        expect(e.puzzle).toMatch(/^[0-9.]{81}$/);
        const grid = parseGrid(e.puzzle)!;
        expect(countSolutions(grid, 2), `${e.puzzle}: proper`).toBe(1);
        // minimal, or with symmetry minimal as pairs (docs/generator.md)
        const symmetry = hasSymmetry(grid, 'rotational') ? 'rotational' : 'none';
        expect(isMinimal(grid, symmetry), `${e.puzzle}: minimal (${symmetry})`).toBe(true);
        const rating = ratePuzzle(e.puzzle);
        expect(rating, 'a valid puzzle').not.toBeNull();
        expect(rating!.solvable, 'solved by techniques alone').toBe(true);
        expect(rating!.level, e.puzzle).toBe(level);
        expect(rating!.score, e.puzzle).toBe(e.score);
        expect(fitForLevel(e.puzzle, rating!), `${e.puzzle}: fit`).toBe(true);
        expect(cleanTechniques(rating!), e.puzzle).toEqual(e.techs);
      }
    });
  }
});
