/**
 * The daily puzzle must be deterministic (same UTC day → identical board on
 * every device), vary across days, leave Math.random untouched, and be a
 * proper unique-solution puzzle.
 */
import { describe, it, expect } from 'vitest';
import { dailyPuzzle } from '../src/engine/daily';
import { parseGrid } from '../src/engine/board';
import { countSolutions } from '../src/engine/bruteForce';

/**
 * Four dates, pinned. The daily puzzle is a promise: everyone who opens the
 * app on a day must get the same board, across app versions too. The
 * generator may get faster, but it must consume randomness in the same
 * order and make the same digging decisions, or every date's puzzle moves.
 */
const PINNED = [
  { date: '2026-07-15', puzzle: '......9.29..326.1...54.1.6.......67...78.35...91.......1.5.47...5.167..47.3......', score: 844, level: 'Hard' },
  { date: '2026-10-02', puzzle: '.8.6.73............94..5....2.1..9....1.6..24..5.23.7.....1.59.......43.6.9......', score: 784, level: 'Tricky' },
  { date: '2026-12-25', puzzle: '....6.7....1....327...8.4....4...5.3.....8....3.....2...8.4.65..5...9.8.92..7....', score: 468, level: 'Medium' },
  { date: '2027-03-01', puzzle: '..1..8.7..7.......2..4..1537.95.2....5..4..2....8.65.9824..3..7.......6..6.7..2..', score: 1448, level: 'Hard' }
];

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

  it('is the same puzzle it always was, on every pinned date', () => {
    for (const pin of PINNED) {
      const d = dailyPuzzle(new Date(pin.date + 'T12:00:00Z'));
      expect(d.puzzle, pin.date).toBe(pin.puzzle);
      expect(d.score, pin.date).toBe(pin.score);
      expect(d.level, pin.date).toBe(pin.level);
    }
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
