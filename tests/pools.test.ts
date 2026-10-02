/**
 * The pools, over a stand-in for localStorage: a puzzle is filed under its
 * band and every clean technique, a puzzle that fails its band's filters
 * is filed under its techniques only, and a puzzle taken from one pool
 * leaves them all, so nobody plays the same puzzle twice.
 */
import { describe, it, expect, beforeEach } from 'vitest';

const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k)
};

const { filePoolEntries, takePoolEntry, poolSize, levelKey, techKey } = await import('../src/state/pools');

const puzzle = (n: number) => String(n).padStart(81, '.');

describe('pools', () => {
  beforeEach(() => store.clear());

  it('file under the band and every technique, and take from all at once', () => {
    filePoolEntries([
      { puzzle: puzzle(1), score: 1200, level: 'Hard', techs: ['X_WING', 'NAKED_PAIR'], fit: true },
      { puzzle: puzzle(2), score: 1300, level: 'Hard', techs: ['X_WING'], fit: true }
    ]);
    expect(poolSize(levelKey('Hard'))).toBe(2);
    expect(poolSize(techKey('X_WING'))).toBe(2);
    expect(poolSize(techKey('NAKED_PAIR'))).toBe(1);
    const taken = takePoolEntry(techKey('NAKED_PAIR'));
    expect(taken?.puzzle).toBe(puzzle(1));
    expect(poolSize(techKey('NAKED_PAIR'))).toBe(0);
    expect(poolSize(levelKey('Hard'))).toBe(1);
    expect(poolSize(techKey('X_WING'))).toBe(1);
    expect(takePoolEntry(levelKey('Hard'))?.puzzle).toBe(puzzle(2));
    expect(takePoolEntry(levelKey('Hard'))).toBeNull();
  });

  it('a puzzle that fails its band filters is practice material only', () => {
    filePoolEntries([{ puzzle: puzzle(3), score: 1100, level: 'Tricky', techs: ['BUG_PLUS_1'], fit: false }]);
    expect(poolSize(levelKey('Tricky'))).toBe(0);
    expect(poolSize(techKey('BUG_PLUS_1'))).toBe(1);
  });

  it('never files a puzzle twice, and caps each pool', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      puzzle: puzzle(10 + i),
      score: 300,
      level: 'Beginner' as const,
      techs: [] as never[]
    }));
    filePoolEntries([...entries, ...entries]);
    expect(poolSize(levelKey('Beginner'))).toBe(8);
  });
});
