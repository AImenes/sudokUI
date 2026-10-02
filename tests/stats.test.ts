/**
 * The player's record (src/state/stats.ts): unaided and hinted uses per
 * technique, the game tally, band records, the daily streak, the "learn
 * next" order and the game summed up in a sentence.
 */
import { describe, it, expect, beforeEach } from 'vitest';

const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k)
};

const { useStats, dailyStreak, learnNextScore, gameSummary } = await import('../src/state/stats');

describe('stats', () => {
  beforeEach(() => useStats.getState().newGame());

  it('counts unaided and hinted uses per technique, and the game tally', () => {
    const s = useStats.getState();
    s.recordUnaided('NAKED_SINGLE');
    s.recordUnaided('NAKED_SINGLE');
    s.recordUnaided('X_WING');
    s.recordHinted('XY_WING');
    s.recordUnaided(null);
    s.recordError();
    const st = useStats.getState();
    expect(st.techs.NAKED_SINGLE?.unaided).toBe(2);
    expect(st.techs.X_WING?.unaided).toBe(1);
    expect(st.techs.XY_WING).toMatchObject({ unaided: 0, hinted: 1 });
    expect(st.techs.XY_WING?.lastUsed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(st.game).toEqual({ unaided: { NAKED_SINGLE: 2, X_WING: 1 }, hinted: { XY_WING: 1 }, errors: 1, beyond: 1 });
    useStats.getState().newGame();
    expect(useStats.getState().game.errors).toBe(0);
    expect(useStats.getState().techs.X_WING?.unaided).toBe(1);
    expect(JSON.parse(store.get('sudokui-stats-v1')!).state.techs.X_WING.unaided).toBe(1);
  });

  it('keeps band records and the daily days', () => {
    const s = useStats.getState();
    s.recordSolve('Hard', 600_000, false);
    s.recordSolve('Hard', 400_000, true, '2026-10-02');
    s.recordSolve('Hard', 500_000, true, '2026-10-02');
    const b = useStats.getState().bands.Hard!;
    expect(b).toEqual({ solves: 3, unassisted: 2, bestMs: 400_000, totalMs: 1_500_000 });
    expect(useStats.getState().dailyDays).toEqual(['2026-10-02']);
  });

  it('streak: days in a row ending today or yesterday', () => {
    const now = new Date('2026-10-02T12:00:00Z');
    expect(dailyStreak([], now)).toBe(0);
    expect(dailyStreak(['2026-10-02'], now)).toBe(1);
    expect(dailyStreak(['2026-09-30', '2026-10-01'], now)).toBe(2);
    expect(dailyStreak(['2026-09-29', '2026-09-30'], now)).toBe(0);
    expect(dailyStreak(['2026-09-28', '2026-09-30', '2026-10-01', '2026-10-02'], now)).toBe(3);
  });

  it('learn next: worth divided by unaided use', () => {
    expect(learnNextScore('X_WING', {})).toBeGreaterThan(0);
    expect(learnNextScore('X_WING', { X_WING: { unaided: 3, hinted: 0, lastUsed: '' } })).toBeCloseTo(learnNextScore('X_WING', {}) / 4);
  });

  it('sums a game up in a sentence', () => {
    expect(gameSummary({ unaided: {}, hinted: {}, errors: 0, beyond: 0 })).toBe('');
    expect(
      gameSummary({ unaided: { HIDDEN_SINGLE: 12, NAKED_SINGLE: 31, X_WING: 1 }, hinted: { XY_WING: 1 }, errors: 2, beyond: 1 })
    ).toBe(
      '45 moves of your own: 31 Naked Singles, 12 Hidden Singles, 1 X-Wing, and 1 move beyond the catalogue. From hints: 1 XY-Wing. 2 wrong digits.'
    );
  });
});
