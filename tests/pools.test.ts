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

const { filePoolEntries, takePoolEntry, poolSize, levelKey, techKey, practisable } = await import('../src/state/pools');

const puzzle = (n: number) => String(n).padStart(81, '.');

describe('pools', () => {
  beforeEach(() => store.clear());

  it('file under the band and every technique, and take from all at once', () => {
    // Tricky is within the practice ceiling of both techniques
    filePoolEntries([
      { puzzle: puzzle(1), score: 700, level: 'Tricky', techs: ['X_WING', 'NAKED_PAIR'], fit: true },
      { puzzle: puzzle(2), score: 750, level: 'Tricky', techs: ['X_WING'], fit: true }
    ]);
    expect(poolSize(levelKey('Tricky'))).toBe(2);
    expect(poolSize(techKey('X_WING'))).toBe(2);
    expect(poolSize(techKey('NAKED_PAIR'))).toBe(1);
    const taken = takePoolEntry(techKey('NAKED_PAIR'));
    expect(taken?.puzzle).toBe(puzzle(1));
    expect(poolSize(techKey('NAKED_PAIR'))).toBe(0);
    expect(poolSize(levelKey('Tricky'))).toBe(1);
    expect(poolSize(techKey('X_WING'))).toBe(1);
    expect(takePoolEntry(levelKey('Tricky'))?.puzzle).toBe(puzzle(2));
    expect(takePoolEntry(levelKey('Tricky'))).toBeNull();
  });

  it('a puzzle that fails its band filters is practice material only', () => {
    filePoolEntries([{ puzzle: puzzle(3), score: 1100, level: 'Tricky', techs: ['BUG_PLUS_1'], fit: false }]);
    expect(poolSize(levelKey('Tricky'))).toBe(0);
    expect(poolSize(techKey('BUG_PLUS_1'))).toBe(1);
  });

  it('files a puzzle under a technique only within that technique\'s practice ceiling', () => {
    // an X-Wing (Hard class) may be practised in a puzzle up to Unfair; an AIC up to the top
    const nightmare = { puzzle: puzzle(4), score: 3000, level: 'Nightmare' as const, techs: ['X_WING' as const, 'AIC' as const], fit: true };
    expect(practisable(nightmare, 'X_WING')).toBe(false);
    expect(practisable(nightmare, 'AIC')).toBe(true);
    filePoolEntries([nightmare]);
    expect(poolSize(levelKey('Nightmare'))).toBe(1);
    expect(poolSize(techKey('X_WING'))).toBe(0);
    expect(poolSize(techKey('AIC'))).toBe(1);
    // a pool filed before the ceiling existed: the taker may refuse an entry, which then stays
    filePoolEntries([{ puzzle: puzzle(5), score: 700, level: 'Hard', techs: ['X_WING'], fit: true }]);
    expect(takePoolEntry(techKey('X_WING'), (e) => e.level !== 'Hard')).toBeNull();
    expect(poolSize(techKey('X_WING'))).toBe(1);
    expect(takePoolEntry(techKey('X_WING'), (e) => practisable(e, 'X_WING'))?.puzzle).toBe(puzzle(5));
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
