/**
 * The saved practice puzzles are stored data, held to the engine like the
 * worked examples: every puzzle must need its technique with nothing harder
 * before it, and its stored rating must be what the solver gives it today.
 * scripts/measure-frequency.ts finds and saves them.
 */
import { describe, it, expect } from 'vitest';
import { ratePuzzle } from '../src/engine/humanSolver';
import { cleanTechniques } from '../src/engine/generator';
import { PRACTICE_TECHS, Tech } from '../src/engine/ratings';
import type { PoolEntry } from '../src/engine/worker';
import type { StoredPractice } from '../src/content/practicePuzzles';
import stored from '../src/content/practicePuzzles.json';

const entries = Object.entries(stored as StoredPractice) as [Tech, PoolEntry[]][];

describe('saved practice puzzles', () => {
  it('are kept only for techniques that can be practised', () => {
    for (const [tech, list] of entries) {
      expect(PRACTICE_TECHS, tech).toContain(tech);
      expect(list.length, tech).toBeGreaterThan(0);
      expect(new Set(list.map((e) => e.puzzle)).size, `${tech}: no duplicates`).toBe(list.length);
    }
  });

  for (const [tech, list] of entries) {
    it(`${tech}: every puzzle needs it, with nothing harder first`, { timeout: 120_000 }, () => {
      for (const e of list) {
        expect(e.puzzle).toMatch(/^[0-9.]{81}$/);
        const rating = ratePuzzle(e.puzzle);
        expect(rating, 'a valid puzzle').not.toBeNull();
        expect(rating!.solvable, 'solved by techniques alone').toBe(true);
        expect(cleanTechniques(rating!), e.puzzle).toContain(tech);
        expect(rating!.score).toBe(e.score);
        expect(rating!.level).toBe(e.level);
      }
    });
  }
});
