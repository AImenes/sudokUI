/**
 * The figure a game shows follows the uniqueness setting as it changes
 * (src/state/playerRating.ts): a game opened by a player who does not use
 * uniqueness has its rating without it worked out by the worker (here a
 * stand-in, since tests have no Web Worker), and a player who switches the
 * setting mid-game sees the figure for the new setting.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { ratePuzzle } from '../src/engine/humanSolver';
import { NO_UNIQUENESS_ORDER } from '../src/engine/ratings';

const asked: string[] = [];
/** puzzles the stand-in worker cannot answer for, as a worker that died: how many times more */
const failing = new Map<string, number>();
vi.mock('../src/state/pools', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/state/pools')>();
  return {
    ...real,
    // the worker's answer, worked out here in the test
    ratePuzzleOff: async (puzzle: string) => {
      asked.push(puzzle);
      const fails = failing.get(puzzle) ?? 0;
      if (fails > 0) {
        failing.set(puzzle, fails - 1);
        return null;
      }
      const r = ratePuzzle(puzzle, NO_UNIQUENESS_ORDER);
      return r ? { score: r.score, level: r.level } : null;
    }
  };
});

import { useGame, shownRating } from '../src/state/gameStore';
import { useSettings } from '../src/state/settings';
import { followPlainRatings } from '../src/state/playerRating';

const WAPO = '.4......1...7.5...9...3.........15.6.....2..8.79......4.2....3...53..8...9..4...7';
const shown = () => shownRating(useGame.getState().info!, useSettings.getState().useUniqueness, useGame.getState().plainRatings);
const settle = () => new Promise((done) => setTimeout(done, 0));

beforeAll(() => followPlainRatings());
afterEach(() => useSettings.getState().set({ useUniqueness: true }));

describe('the figure a game shows, as the setting changes', () => {
  it("is HoDoKu's with uniqueness on, and asks the worker nothing", async () => {
    useGame.getState().startGame(WAPO, 1322, 'Unfair');
    await settle();
    expect(shown()).toMatchObject({ score: 1322, level: 'Unfair', plain: false });
    expect(asked).toEqual([]);
  });

  it('switched off mid-game: the worker is asked once, and the figure without uniqueness is shown', async () => {
    useSettings.getState().set({ useUniqueness: false });
    expect(shown()).toMatchObject({ score: 1322, pending: true });
    await settle();
    expect(asked).toEqual([WAPO]);
    expect(shown()).toMatchObject({ score: 2226, level: 'Extreme', plain: true, pending: false });
    // switched on again: HoDoKu's at once; off again: known, nothing asked
    useSettings.getState().set({ useUniqueness: true });
    expect(shown()).toMatchObject({ score: 1322, level: 'Unfair' });
    useSettings.getState().set({ useUniqueness: false });
    await settle();
    expect(shown().score).toBe(2226);
    expect(asked).toEqual([WAPO]);
  });

  it('a game opened with it off is worked out as it opens', async () => {
    useSettings.getState().set({ useUniqueness: false });
    const easy = '9.5.1...84....8..7...4...2..9.14...2..23.98..1...87.5..8...4...3..9....67...2.4.3';
    useGame.getState().startGame(easy, 454, 'Medium');
    await settle();
    expect(asked.at(-1)).toBe(easy);
    expect(shown()).toMatchObject({ score: 454, level: 'Medium', plain: true, pending: false });
  });

  it('a request the worker could not answer is asked once more, then the published figure stands, no longer on its way', async () => {
    useSettings.getState().set({ useUniqueness: false });
    const once = '1.2...6....5..1.7.6.4..7.51...3..1...6..9..3...3..6...38.2..7.5.2.5..4....6...2.8';
    failing.set(once, 1);
    useGame.getState().startGame(once, 1218, 'Hard');
    await settle();
    await settle();
    expect(asked.filter((p) => p === once)).toHaveLength(2);
    expect(shown()).toMatchObject({ level: 'Extreme', plain: true, pending: false });
    const never = '4.....8.5.3..........7......2.....6.....8.4......1.......6.3.7.5..2.....1.4......';
    failing.set(never, 2);
    useGame.getState().startGame(never, 9999, 'Extreme');
    await settle();
    await settle();
    expect(asked.filter((p) => p === never)).toHaveLength(2);
    expect(shown()).toMatchObject({ score: 9999, level: 'Extreme', plain: true, pending: false });
  });
});
