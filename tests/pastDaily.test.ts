/**
 * Another day's daily on the board (src/content/dailies.ts, pastDailyOn;
 * the note in src/ui/App.tsx, PastDailyNote): the app resumes the last
 * game when it opens, at the daily's own address, so a player coming back
 * the next day, or anyone opening an old daily's link, is told which day's
 * daily it is, with the way to today's. Never for today's daily or any
 * other game; put away, it stays away for that game, across a restart and
 * a reload, and comes back with the next game that is another day's daily.
 * The day is written the player's way, in each language.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'node:process';

const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k)
};

const { useGame } = await import('../src/state/gameStore');
const { useTelemetry } = await import('../src/state/telemetry');
const { pastDailyOn, dayName } = await import('../src/content/dailies');
const { makeTranslator } = await import('../src/content/i18n');
const nb = (await import('../src/content/locales/app.nb')).default;
const es = (await import('../src/content/locales/app.es')).default;

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';
const TODAY = '2026-11-04';

beforeEach(() => {
  storage.clear();
  useTelemetry.setState({ track: () => {} } as never);
  useGame.setState({ info: null, won: false, solved: false, history: [], future: [], custom: false });
});

/** a published daily on the board, as startDaily opens one (src/ui/App.tsx) */
const openDaily = (date: string, no: number) => {
  useGame.getState().startGame(EASY, 196, 'Easy', null, date);
  useGame.setState((s) => ({ info: s.info && { ...s.info, dailyNo: no } }));
};
const shown = () => pastDailyOn(useGame.getState().info, TODAY);

describe('the note that the daily is another day’s', () => {
  it('shows for a published daily of another day, past or ahead', () => {
    openDaily('2026-10-30', 24);
    expect(shown()).toBe('2026-10-30');
    openDaily('2026-12-01', 56);
    expect(shown()).toBe('2026-12-01');
  });

  it('never shows for today’s daily', () => {
    openDaily(TODAY, 29);
    expect(shown()).toBeNull();
  });

  it('shows from the next day on for the daily that was today’s', () => {
    openDaily(TODAY, 29);
    expect(pastDailyOn(useGame.getState().info, '2026-11-05')).toBe(TODAY);
  });

  it('never shows for a game that is no published daily', () => {
    expect(shown()).toBeNull();
    useGame.getState().startGame(EASY, 196, 'Easy');
    expect(shown()).toBeNull();
    // a day the published list does not cover: its puzzle is derived from the date, with no number
    useGame.getState().startGame(EASY, 196, 'Easy', null, '2026-10-30');
    expect(shown()).toBeNull();
  });

  it('shows for a solved daily too, whose win screen is left as it is', () => {
    openDaily('2026-10-30', 24);
    useGame.setState({ won: true, solved: true });
    expect(shown()).toBe('2026-10-30');
  });

  it('stays away for the game once put away, across a restart and a reload', async () => {
    openDaily('2026-10-30', 24);
    useGame.getState().hidePastDaily();
    expect(shown()).toBeNull();
    useGame.getState().restart();
    expect(useGame.getState().info?.dailyNo).toBe(24);
    expect(shown()).toBeNull();
    // a fresh page knows only what was saved
    const saved = storage.get('sudokui-game-v1')!;
    useGame.setState({ info: null });
    storage.set('sudokui-game-v1', saved);
    await useGame.persist.rehydrate();
    expect(useGame.getState().info?.dailyKey).toBe('2026-10-30');
    expect(shown()).toBeNull();
  });

  it('comes back with the next game that is another day’s daily, the same one opened again included', () => {
    openDaily('2026-10-30', 24);
    useGame.getState().hidePastDaily();
    openDaily('2026-10-31', 25);
    expect(shown()).toBe('2026-10-31');
    useGame.getState().hidePastDaily();
    useGame.getState().startGame(EASY, 196, 'Easy');
    openDaily('2026-10-31', 25);
    expect(shown()).toBe('2026-10-31');
  });

  it('puts nothing away when there is no game', () => {
    useGame.getState().hidePastDaily();
    expect(useGame.getState().info).toBeNull();
  });
});

describe('the day, written the player’s way', () => {
  const T = { en: makeTranslator('en'), nb: makeTranslator('nb', nb), es: makeTranslator('es', es) };

  it('names the day and the month in each language, the year only when it is not this one', () => {
    expect(dayName('2026-10-30', T.en.locale, TODAY)).toBe('30 October');
    expect(dayName('2026-10-30', T.nb.locale, TODAY)).toBe('30. oktober');
    expect(dayName('2026-10-30', T.es.locale, TODAY)).toBe('30 de octubre');
    expect(dayName('2027-01-02', T.en.locale, TODAY)).toBe('2 January 2027');
    expect(dayName('2027-01-02', T.nb.locale, TODAY)).toBe('2. januar 2027');
    expect(dayName('2027-01-02', T.es.locale, TODAY)).toBe('2 de enero de 2027');
  });

  it('is the same day wherever the player is', () => {
    // the key is the day itself: west of Greenwich its UTC midnight is
    // still the evening before, and the name must not follow it there
    const before = env.TZ;
    try {
      for (const tz of ['America/Los_Angeles', 'Pacific/Kiritimati', 'UTC']) {
        env.TZ = tz;
        expect(dayName('2026-10-30', 'en-GB', TODAY), tz).toBe('30 October');
      }
    } finally {
      if (before === undefined) delete env.TZ;
      else env.TZ = before;
    }
  });

  it('reads as a sentence in each language', () => {
    const date = '30 October';
    expect(T.en('The daily of {date}', { date })).toBe('The daily of 30 October');
    expect(T.nb('The daily of {date}', { date: dayName('2026-10-30', T.nb.locale, TODAY) })).toBe('Oppgaven for 30. oktober');
    expect(T.es('The daily of {date}', { date: dayName('2026-10-30', T.es.locale, TODAY) })).toBe('El sudoku del 30 de octubre');
    expect([T.en('Today’s daily'), T.nb('Today’s daily'), T.es('Today’s daily')]).toEqual(['Today’s daily', 'Dagens oppgave', 'El sudoku de hoy']);
  });

  it('leaves a key that is no date as it is', () => {
    expect(dayName('someday', 'en-GB', TODAY)).toBe('someday');
  });
});
