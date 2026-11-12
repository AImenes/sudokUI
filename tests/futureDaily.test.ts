/**
 * The future-daily lock (the owner's decision of 12 November 2026;
 * src/content/dailies.ts, dailyLocked; src/ui/links.ts): a daily whose day
 * is after the player's local today opens nothing over the board, however
 * it is asked for (its address, a #daily or share link, Import, the Daily
 * button, the past-daily note, a reload, Back or Forward all go through
 * startDaily or openAppLink), and the toast says when it opens. Today's
 * daily and every earlier one open as before, and once the day comes, its
 * daily opens.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k)
};

const { useGame } = await import('../src/state/gameStore');
const { useTelemetry } = await import('../src/state/telemetry');
const { useSettings } = await import('../src/state/settings');
const { useStats } = await import('../src/state/stats');
const { readAppLink } = await import('../src/content/share');
const { dailyLocked, dayAfter, findDaily, loadDailies, EARLY_DAYS } = await import('../src/content/dailies');
const { startDaily, openAppLink, lockedLine, holds } = await import('../src/ui/links');

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';
/** the player's local noon on a day, so no time zone moves the date */
const at = (date: string) => vi.setSystemTime(new Date(`${date}T12:00:00`));

beforeEach(() => {
  storage.clear();
  at('2026-11-12');
  useSettings.setState({ dontCount: false, countPlays: false, practiceFastForward: false, lang: 'en' });
  useTelemetry.setState({ track: () => {} } as never);
  useStats.setState({ recordSolve: () => {} } as never);
  useGame.setState({
    info: null,
    custom: false,
    customBackup: null,
    setAside: null,
    won: false,
    solved: false,
    history: [],
    future: [],
    notice: null,
    letGo: null,
    away: false,
    chain: null
  });
});
afterEach(() => vi.useRealTimers());

const g = () => useGame.getState();
const link = (address: string) => readAppLink(new URL(address))!;
/** a game under way on the board: an easy puzzle with two digits in */
const underWay = () => {
  g().startGame(EASY, 100, 'Easy');
  const { puzzle, solution } = g().info!;
  const empty = [...puzzle].map((ch, i) => (ch === '.' ? i : -1)).filter((i) => i >= 0);
  for (const cell of empty.slice(0, 2)) {
    g().select([cell], false);
    g().input(Number(solution[cell]));
  }
  return g().info;
};

describe('the one check', () => {
  it('locks a day after the player’s local today, and nothing else', () => {
    expect(dailyLocked('2026-11-13', '2026-11-12')).toBe(true);
    expect(dailyLocked('2027-01-01', '2026-12-31')).toBe(true);
    expect(dailyLocked('2026-11-12', '2026-11-12')).toBe(false);
    expect(dailyLocked('2026-11-11', '2026-11-12')).toBe(false);
    expect(dailyLocked('2026-10-07', '2026-11-12')).toBe(false);
    // no date at all is no day to lock (the address names no daily)
    expect(dailyLocked('2026-11-31', '2026-11-12')).toBe(false);
    expect(dailyLocked('tomorrow', '2026-11-12')).toBe(false);
    // the player's today by default
    expect(dailyLocked('2026-11-13')).toBe(true);
    expect(dailyLocked('2026-11-12')).toBe(false);
  });

  it('knows the day after, over a month’s and a year’s end', () => {
    expect(dayAfter('2026-11-12')).toBe('2026-11-13');
    expect(dayAfter('2026-11-30')).toBe('2026-12-01');
    expect(dayAfter('2026-12-31')).toBe('2027-01-01');
    expect(dayAfter('2028-02-28')).toBe('2028-02-29');
  });

  it('says when the day’s daily opens, in plain words', () => {
    expect(lockedLine('2026-11-13', '2026-11-12')).toBe('Tomorrow’s daily opens at midnight');
    expect(lockedLine('2026-11-20', '2026-11-12')).toBe('That daily opens on 20 November');
    expect(lockedLine('2027-01-03', '2026-11-12')).toBe('That daily opens on 3 January 2027');
  });

  it('leaves the server its day of grace: it knows only UTC, and UTC+14 is a day ahead of it', () => {
    expect(EARLY_DAYS).toBe(1);
  });
});

describe('a daily after today', () => {
  it('opens nothing from the Daily button’s own path, and the board stays as it is', async () => {
    const was = underWay();
    expect(await startDaily('2026-11-13')).toBe('locked');
    expect(g().info).toBe(was);
    expect(g().setAside).toBeNull();
    expect(g().notice).toBe('Tomorrow’s daily opens at midnight');
    expect(await startDaily('2026-11-20')).toBe('locked');
    expect(g().notice).toBe('That daily opens on 20 November');
  });

  it('opens nothing by its address, at start-up or in the tab, and says when it opens', async () => {
    const was = underWay();
    for (const from of ['boot', 'tab'] as const) {
      useGame.setState({ notice: null });
      expect(await openAppLink(link('https://sudokui.app/daily/2026-11-13'), from)).toEqual({ opened: false });
      expect(g().info).toBe(was);
      expect(g().setAside).toBeNull();
      expect(g().notice).toBe('Tomorrow’s daily opens at midnight');
    }
    // in another language's address, and with a challenger's time, the same
    useGame.setState({ notice: null });
    expect(await openAppLink(link('https://sudokui.app/nb/daily/2026-11-21?vs=300'), 'boot')).toEqual({ opened: false });
    expect(g().info).toBe(was);
    expect(g().info?.challenge).toBeUndefined();
    expect(g().notice).toBe('That daily opens on 21 November');
  });

  it('pasted into Import, is refused in the dialog’s own words', async () => {
    const was = underWay();
    useGame.setState({ notice: null });
    expect(await openAppLink(link('https://sudokui.app/daily/2026-11-13'), 'import')).toEqual({
      opened: false,
      refused: 'Tomorrow’s daily opens at midnight'
    });
    expect(g().info).toBe(was);
    expect(g().notice).toBeNull();
  });

  it('leaves a copy of it already on the board as it is, quietly, and it is a game this page holds', async () => {
    // a copy opened by an earlier build, before the lock, or one whose device clock went back: it stays where it is, never lost,
    // and its own address does not say on every reload that it has not opened
    const list = (await loadDailies())!;
    const tomorrow = findDaily(list, '2026-11-13')!;
    g().startGame(tomorrow.puzzle, tomorrow.score, tomorrow.level, null, '2026-11-13');
    const was = g().info;
    useGame.setState({ notice: null });
    expect(await openAppLink(link('https://sudokui.app/daily/2026-11-13'), 'boot')).toEqual({ opened: true });
    expect(g().info).toBe(was);
    expect(g().notice).toBeNull();
    // Import still says it has not opened, and opens nothing
    expect(await openAppLink(link('https://sudokui.app/daily/2026-11-13'), 'import')).toEqual({ opened: false, refused: 'Tomorrow’s daily opens at midnight' });
    // Back and Forward bring back only what the page holds: that copy, as it is
    expect(holds(link('https://sudokui.app/daily/2026-11-13'))).toBe(true);
  });

  it('opens nothing for a position shared on its address, and lets no game go', async () => {
    underWay();
    const before = g().info;
    // a Position link of tomorrow's daily, as the Share dialog makes it: /daily/<date>#s=… (its board, with one entry)
    const list = (await loadDailies())!;
    const tomorrow = findDaily(list, '2026-11-13')!;
    const { encodePosition } = await import('../src/state/gameStore');
    const cells = [...tomorrow.puzzle].map((ch) => ({
      value: ch === '.' ? 0 : Number(ch), given: ch !== '.', corner: 0, center: 0, excluded: 0, colors: [] as number[]
    }));
    // a pencil mark of the sender's on the first empty cell
    cells[tomorrow.puzzle.indexOf('.')].corner = 0b11;
    const pos = link('https://sudokui.app/daily/2026-11-13#s=' + encodePosition(cells, false));
    expect(pos.position).toBeTruthy();
    expect(await openAppLink(pos, 'tab')).toEqual({ opened: false });
    expect(g().info).toBe(before);
    expect(g().setAside).toBeNull();
    expect(g().notice).toBe('Tomorrow’s daily opens at midnight');
    expect(await openAppLink(pos, 'import')).toEqual({ opened: false, refused: 'Tomorrow’s daily opens at midnight' });
    expect(g().info).toBe(before);
  });

  it('opens once its day comes', async () => {
    underWay();
    expect(await startDaily('2026-11-13')).toBe('locked');
    at('2026-11-13');
    expect(await startDaily('2026-11-13')).toBe('started');
    expect(g().info?.dailyKey).toBe('2026-11-13');
    // the game under way went aside, as for any opening
    expect(g().setAside?.info?.puzzle).toBe(EASY);
  });
});

describe('today’s daily and earlier ones', () => {
  it('open as before, by the Daily button, by address and by #daily', async () => {
    expect(await startDaily()).toBe('started');
    expect(g().info?.dailyKey).toBe('2026-11-12');
    expect(await openAppLink(link('https://sudokui.app/daily/2026-11-11'), 'tab')).toEqual({ opened: true });
    expect(g().info?.dailyKey).toBe('2026-11-11');
    expect(await openAppLink(link('https://sudokui.app/#daily'), 'tab')).toEqual({ opened: true });
    expect(g().info?.dailyKey).toBe('2026-11-12');
    expect(await openAppLink(link('https://sudokui.app/daily/2026-10-07'), 'import')).toEqual({ opened: true });
    expect(g().info?.dailyKey).toBe('2026-10-07');
  });

  it('#daily is the player’s today, so it is never locked', () => {
    at('2026-12-31');
    expect(link('https://sudokui.app/#daily').daily).toEqual({ date: '2026-12-31' });
  });
});
