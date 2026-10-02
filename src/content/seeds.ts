// Seed puzzles for the bands the generator cannot serve a waiting player
// in time (docs/generator.md), found by scripts/build-seeds.ts and held to
// the engine by tests/seeds.test.ts. A seed is never played as stored: the
// worker serves it through a random isomorphism and rates the result. The
// file is fetched only when a seed is needed.
import type { PoolEntry } from '../engine/worker';
import { Level } from '../engine/ratings';

export type StoredSeeds = Partial<Record<Level, PoolEntry[]>>;

/**
 * The bands served from seeds while their pool is empty: those whose
 * expected generation time is over the budget of one second, with room
 * for a phone being slower than the machine that measured it.
 */
export const SEEDED_LEVELS: Level[] = ['Unfair', 'Extreme', 'Nightmare'];

/** seeds kept per band */
export const SEEDS_PER_LEVEL = 48;

export async function loadSeeds(): Promise<StoredSeeds> {
  // a file that cannot be fetched (a deploy moved on, a flaky network)
  // means no seeds: the generator takes longer, the game still starts
  try {
    return (await import('./seeds.json')).default as StoredSeeds;
  } catch {
    return {};
  }
}

/** the band's seed puzzles in random order, or none for an unseeded band */
export async function seedPuzzles(level: Level): Promise<string[]> {
  if (!SEEDED_LEVELS.includes(level)) return [];
  const list = (await loadSeeds())[level] ?? [];
  const puzzles = list.map((e) => e.puzzle);
  for (let i = puzzles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [puzzles[i], puzzles[j]] = [puzzles[j], puzzles[i]];
  }
  return puzzles;
}
