/**
 * The daily puzzle must be deterministic (same UTC day → identical board on
 * every device), vary across days, leave Math.random untouched, and be a
 * proper unique-solution puzzle.
 */
import { describe, it, expect } from 'vitest';
import { dailyPuzzle } from '../src/engine/daily';
import { parseGrid } from '../src/engine/board';
import { countSolutions } from '../src/engine/bruteForce';

describe('daily puzzle', () => {
  it('is identical for the same UTC day, on repeated derivation', () => {
    const a = dailyPuzzle(new Date('2026-07-15T03:00:00Z'));
    const b = dailyPuzzle(new Date('2026-07-15T22:59:00Z')); // same UTC day
    expect(a.dateKey).toBe('2026-07-15');
    expect(b.puzzle).toBe(a.puzzle);
    expect(b.score).toBe(a.score);
    expect(b.level).toBe(a.level);
  });

  it('changes from one day to the next', () => {
    const a = dailyPuzzle(new Date('2026-07-15T12:00:00Z'));
    const b = dailyPuzzle(new Date('2026-07-16T12:00:00Z'));
    expect(b.puzzle).not.toBe(a.puzzle);
  });

  it('produces a valid unique-solution puzzle and restores Math.random', () => {
    const original = Math.random;
    const d = dailyPuzzle(new Date('2026-07-17T12:00:00Z'));
    expect(Math.random).toBe(original);
    expect(d.puzzle).toHaveLength(81);
    expect(countSolutions(parseGrid(d.puzzle)!, 2)).toBe(1);
    expect(d.score).toBeGreaterThan(0);
  });
});
