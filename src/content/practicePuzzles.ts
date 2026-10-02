// Practice puzzles for the rarest techniques, found by
// scripts/measure-frequency.ts over millions of generated puzzles. Each one
// needs its technique with nothing harder before it, exactly as the
// browser's generator pools practice puzzles; for these techniques that
// generator would take minutes, so they ship ready and are fetched only
// when asked for. The worker serves one through a random isomorphism and
// rates the result (docs/generator.md), so no two sessions get the same
// board.
import type { PoolEntry } from '../engine/worker';
import { Tech } from '../engine/ratings';

export type StoredPractice = Partial<Record<Tech, PoolEntry[]>>;

/** the technique's saved puzzles in random order, or none when none is saved */
export async function practiceSeeds(tech: Tech): Promise<string[]> {
  const stored = (await import('./practicePuzzles.json')).default as StoredPractice;
  const puzzles = (stored[tech] ?? []).map((e) => e.puzzle);
  for (let i = puzzles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [puzzles[i], puzzles[j]] = [puzzles[j], puzzles[i]];
  }
  return puzzles;
}
