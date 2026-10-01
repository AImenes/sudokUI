// Practice puzzles for the rarest techniques, found by
// scripts/measure-frequency.ts over millions of generated puzzles. Each one
// needs its technique with nothing harder before it, exactly as the
// browser's generator pools practice puzzles; for these techniques that
// generator would take minutes, so they ship ready and are fetched only
// when asked for.
import type { PoolEntry } from '../engine/worker';
import { Tech } from '../engine/ratings';

export type StoredPractice = Partial<Record<Tech, PoolEntry[]>>;

const TURN_KEY = 'sudokui-practice-turn';

/** the next saved puzzle for the technique, taking turns; null when none is saved */
export async function storedPractice(tech: Tech): Promise<PoolEntry | null> {
  const stored = (await import('./practicePuzzles.json')).default as StoredPractice;
  const list = stored[tech];
  if (!list || list.length === 0) return null;
  let turn = 0;
  try {
    turn = Number(localStorage.getItem(`${TURN_KEY}:${tech}`)) || 0;
    localStorage.setItem(`${TURN_KEY}:${tech}`, String(turn + 1));
  } catch {
    /* storage is only there to avoid repeats */
  }
  return list[turn % list.length];
}
