/**
 * The rating follows the player's uniqueness setting (docs/architecture.md,
 * "The rating follows the uniqueness setting"): what the game shows, the
 * worker's rating without uniqueness, the pools a player who does not use
 * uniqueness takes a level from, and the level a puzzle is generated for.
 * The Washington Post puzzle of November 2026 rates Unfair 1322 with
 * uniqueness and Extreme 2226 without.
 */
import { describe, it, expect, beforeEach, afterEach, vi, onTestFinished } from 'vitest';
import { serve, serveRate, WorkerResponse, PoolEntry, toEntry } from '../src/engine/worker';
import { ratePuzzle } from '../src/engine/humanSolver';
import { NO_UNIQUENESS_ORDER, inPick } from '../src/engine/ratings';
import { shownRating, useGame, GameInfo } from '../src/state/gameStore';
import { useSettings } from '../src/state/settings';
import { ratingNote } from '../src/ui/ratingNote';
import { translator } from '../src/content/i18n';
import { filePoolEntries, takePoolEntry, poolSize, levelKey, plainLevelKey, levelPoolKey } from '../src/state/pools';

const WAPO = '.4......1...7.5...9...3.........15.6.....2..8.79......4.2....3...53..8...9..4...7';

/** run a request to the end, slices back to back */
function run(req: Parameters<typeof serve>[0]) {
  const out: WorkerResponse[] = [];
  const queue: (() => void)[] = [];
  serve(req, (m) => out.push(m), (next) => queue.push(next), () => false);
  while (queue.length) queue.shift()!();
  return out;
}
const answer = (out: WorkerResponse[]): PoolEntry => {
  const done = out.filter((m) => m.type === 'done') as Extract<WorkerResponse, { type: 'done' }>[];
  expect(done).toHaveLength(1);
  return done[0].entry;
};

const info = (extra: Partial<GameInfo> = {}): GameInfo => ({
  puzzle: WAPO,
  solution: '',
  score: 1322,
  level: 'Unfair',
  practiceTech: null,
  ...extra
});

describe('the rating a game shows', () => {
  const plain = { [WAPO]: { score: 2226, level: 'Extreme' as const } };

  it("is HoDoKu's for a player who uses uniqueness", () => {
    expect(shownRating(info(), true, plain)).toEqual({ score: 1322, level: 'Unfair', plain: false, pending: false, published: null });
  });

  it('is the rating without uniqueness for a player who does not, HoDoKu\'s standing in, pending, until the worker has it', () => {
    expect(shownRating(info(), false, {})).toEqual({ score: 1322, level: 'Unfair', plain: true, pending: true, published: null });
    expect(shownRating(info(), false, plain)).toEqual({ score: 2226, level: 'Extreme', plain: true, pending: false, published: null });
  });

  it("names the published rating of a daily or a door where the player's own differs, and only there", () => {
    expect(shownRating(info({ dailyKey: '2026-11-25' }), false, plain).published).toEqual({ score: 1322, level: 'Unfair' });
    expect(shownRating(info({ adventYear: 2026, adventDoor: 3 }), false, plain).published).toEqual({ score: 1322, level: 'Unfair' });
    const same = { [WAPO]: { score: 1322, level: 'Unfair' as const } };
    expect(shownRating(info({ dailyKey: '2026-11-25' }), false, same).published).toBeNull();
  });

  it("keeps HoDoKu's for a practice puzzle of a uniqueness technique", () => {
    expect(shownRating(info({ practiceTech: 'UNIQUENESS_3' }), false, plain).score).toBe(1322);
    expect(shownRating(info({ practiceTech: 'X_CHAIN' }), false, plain).score).toBe(2226);
  });

  it('says in a few words where it is not plain HoDoKu\'s, and that a published rating differs', () => {
    const t = translator();
    expect(ratingNote(t, shownRating(info(), true, plain), info())).toBeNull();
    expect(ratingNote(t, shownRating(info(), false, {}), info())).toBeNull();
    expect(ratingNote(t, shownRating(info(), false, plain), info())).toBe('Rated without uniqueness techniques, as you play.');
    const daily = info({ dailyKey: '2026-11-25' });
    expect(ratingNote(t, shownRating(daily, false, plain), daily)).toBe(
      'Rated without uniqueness techniques, as you play. The published rating is Unfair, 1322.'
    );
    // the same figure either way: nothing to say
    const same = { [WAPO]: { score: 1322, level: 'Unfair' as const } };
    expect(ratingNote(t, shownRating(daily, false, same), daily)).toBeNull();
  });

  it('is kept in the store by puzzle, in memory only', () => {
    useGame.getState().setPlainRating(WAPO, { score: 2226, level: 'Extreme' });
    expect(useGame.getState().plainRatings[WAPO]).toEqual({ score: 2226, level: 'Extreme' });
    const partialize = useGame.persist.getOptions().partialize!;
    expect(Object.keys(partialize(useGame.getState()) as object)).not.toContain('plainRatings');
  });
});

describe("the worker's rating without uniqueness", () => {
  it('rates a puzzle in full, with or without uniqueness, off the main thread', { timeout: 120_000 }, () => {
    const out: WorkerResponse[] = [];
    serveRate({ id: 1, kind: 'rate', puzzle: WAPO, noUniqueness: true }, (m) => out.push(m));
    serveRate({ id: 2, kind: 'rate', puzzle: WAPO, noUniqueness: false }, (m) => out.push(m));
    serveRate({ id: 3, kind: 'rate', puzzle: '1'.repeat(81), noUniqueness: true }, (m) => out.push(m));
    expect(out).toEqual([
      { id: 1, type: 'rated', rating: { score: 2226, level: 'Extreme' } },
      { id: 2, type: 'rated', rating: { score: 1322, level: 'Unfair' } },
      { id: 3, type: 'rated', rating: null }
    ]);
  });

  it("gives an entry its rating without uniqueness: its own where the path takes no uniqueness step, the one worked out where it does", () => {
    const r = ratePuzzle(WAPO)!;
    expect(toEntry({ puzzle: WAPO, rating: r }).plain).toBeUndefined();
    const without = ratePuzzle(WAPO, NO_UNIQUENESS_ORDER)!;
    expect(toEntry({ puzzle: WAPO, rating: r }, without).plain).toEqual({ score: 2226, level: 'Extreme', fit: expect.any(Boolean) });
    const easy = ratePuzzle('9.5.1...84....8..7...4...2..9.14...2..23.98..1...87.5..8...4...3..9....67...2.4.3')!;
    expect(toEntry({ puzzle: '9.5.1...84....8..7...4...2..9.14...2..23.98..1...87.5..8...4...3..9....67...2.4.3', rating: easy }).plain).toEqual({
      score: easy.score,
      level: easy.level,
      fit: true
    });
  });
});

describe('a level for a player who does not use uniqueness', () => {
  it('is served from a seed only where the level holds without uniqueness, rated both ways', { timeout: 120_000 }, () => {
    // the Washington Post puzzle as a seed: Unfair with uniqueness, Extreme without.
    // The worker serves a seed in a random disguise (transformPuzzle), and the
    // solver's path, so the rating, can change with the disguise: about 1 in
    // 10 disguises of this puzzle rate Extreme even with uniqueness. Pinned to
    // one disguise (every random draw 0), which rates Unfair 1352 with
    // uniqueness and Extreme 2512 without, so the test does not depend on luck.
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    onTestFinished(() => random.mockRestore());
    const unfair = answer(run({ id: 1, kind: 'level', level: 'Unfair', urgent: true, seeds: [WAPO], maxAttempts: 0 }));
    expect(unfair.level).toBe('Unfair');
    const failed = run({ id: 2, kind: 'level', level: 'Unfair', urgent: true, seeds: [WAPO], maxAttempts: 0, noUniqueness: true });
    expect(failed.filter((m) => m.type === 'done')).toEqual([]);
    const extreme = answer(run({ id: 3, kind: 'level', level: 'Extreme', urgent: true, seeds: [WAPO], maxAttempts: 0, noUniqueness: true }));
    expect(extreme.plain!.level).toBe('Extreme');
    // its HoDoKu rating too, for the game's info and what leaves the app
    expect({ score: extreme.score, level: extreme.level }).toEqual((({ score, level }) => ({ score, level }))(ratePuzzle(extreme.puzzle)!));
    expect({ score: extreme.plain!.score, level: extreme.plain!.level }).toEqual(
      (({ score, level }) => ({ score, level }))(ratePuzzle(extreme.puzzle, NO_UNIQUENESS_ORDER)!)
    );
  });

  it('is generated so that the level holds without uniqueness, the HoDoKu rating carried beside it', { timeout: 120_000 }, () => {
    for (const level of ['Hard', 'Unfair'] as const) {
      const out = run({ id: 4, kind: 'level', level, urgent: true, maxAttempts: 4000, noUniqueness: true });
      const entry = answer(out);
      const without = ratePuzzle(entry.puzzle, NO_UNIQUENESS_ORDER)!;
      expect(inPick(level, without.level, without.score), entry.puzzle).toBe(true);
      expect(entry.plain).toEqual({ score: without.score, level: without.level, fit: true });
      expect(entry.score).toBe(ratePuzzle(entry.puzzle)!.score);
      // a waiting player's candidates, rated without uniqueness only, are not pooled
      expect(out.some((m) => m.type === 'candidates')).toBe(false);
    }
  });

  it('a background top-up rates every candidate both ways where its path takes a uniqueness step', { timeout: 120_000 }, () => {
    // a Nightmare is rare enough that most of the attempts are pooled as candidates.
    // The puzzles are drawn at random, and a Nightmare met in the first few
    // attempts ends the run early, so the draws are pinned to one sequence
    // (mulberry32, seed 7) and the test does not depend on luck.
    let state = 7;
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    });
    onTestFinished(() => random.mockRestore());
    const out = run({ id: 5, kind: 'level', level: 'Nightmare', maxAttempts: 30, noUniqueness: true });
    const entries = out.flatMap((m) => (m.type === 'candidates' ? m.entries : m.type === 'done' ? [m.entry] : []));
    expect(entries.length).toBeGreaterThan(5);
    for (const e of entries.slice(0, 40)) {
      const without = ratePuzzle(e.puzzle, NO_UNIQUENESS_ORDER)!;
      expect(e.plain, e.puzzle).toEqual({ score: without.score, level: without.level, fit: expect.any(Boolean) });
    }
  });
});

describe('the pools by the setting', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k)
    };
  });
  afterEach(() => useSettings.getState().set({ useUniqueness: true }));

  it('file a puzzle by its level without uniqueness too, where that is known, and take it out of every pool', () => {
    const p = (n: number) => WAPO.slice(0, 80) + String(n % 10);
    filePoolEntries([
      { puzzle: p(1), score: 1322, level: 'Unfair', techs: [], fit: true, plain: { score: 2226, level: 'Extreme', fit: true } },
      { puzzle: p(2), score: 1100, level: 'Hard', techs: [], fit: true }
    ]);
    expect(poolSize(levelKey('Unfair'))).toBe(1);
    expect(poolSize(plainLevelKey('Extreme'))).toBe(1);
    expect(poolSize(plainLevelKey('Unfair'))).toBe(0);
    // with no rating without uniqueness, a puzzle is never served by level to such a player
    expect(poolSize(plainLevelKey('Hard'))).toBe(0);
    expect(levelPoolKey('Extreme', false)).toBe(plainLevelKey('Extreme'));
    expect(levelPoolKey('Extreme', true)).toBe(levelKey('Extreme'));
    expect(takePoolEntry(levelPoolKey('Extreme', false))?.puzzle).toBe(p(1));
    expect(poolSize(levelKey('Unfair'))).toBe(0);
  });
});
