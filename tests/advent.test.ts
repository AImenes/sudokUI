/**
 * The advent calendar in the app (docs/advent-calendar.md; the doors
 * themselves are tests/adventDoors.test.ts's): a door's address, and the
 * doors as games (src/ui/links.ts, startDoor; gameStore.ts). A door opens
 * on its day by the player's local date and never before, by its address,
 * a link, Import, Back, Forward or the calendar, by the lock that keeps a
 * daily whose day has not come (tests/futureDaily.test.ts) and with a
 * toast of the same style; an earlier door stays open until 31 December;
 * a door game in progress is never lost, and comes back when its door is
 * asked for again, in January too; its solve is kept with the dailies'
 * solves, and its time goes only when the player taps Send.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k)
};

const { ADVENT_BASE, adventNo, doorDate, parseAdventUrl, adventPath, ADVENT_PATH } = await import('../src/content/advent');
const doors = (await import('../src/content/advent.json')).default as import('../src/content/advent').AdventDoor[];
const { readAppLink } = await import('../src/content/share');
const { APP_NAVIGATION } = await import('../src/content/home');
const { STATIC_ROUTES } = await import('../src/content/staticRoutes');
const { langOfPath } = await import('../src/content/i18n');
const { useGame, gameName, kindOf, countedOf, countedClosed, dailyResultOf } = await import('../src/state/gameStore');
const { useTelemetry } = await import('../src/state/telemetry');
const { useSettings } = await import('../src/state/settings');
const { useStats } = await import('../src/state/stats');
const { useDailyStats } = await import('../src/state/dailyStats');
const { startDoor, openAppLink, backToKept, holds, backTo, doorLocked, lockedLine } = await import('../src/ui/links');

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';

describe('a door’s address', () => {
  it('is /advent/<year>/<door> in each language, read as the app reads its links', () => {
    expect(adventPath('en', 2026, 5)).toBe('/advent/2026/5');
    expect(adventPath('nb', 2026, 5)).toBe('/nb/advent/2026/5');
    expect(adventPath('es', 2026, 24, 252)).toBe('/es/advent/2026/24?vs=252');
    expect(parseAdventUrl({ pathname: '/nb/advent/2026/5/', search: '?vs=90' })).toEqual({ lang: 'nb', year: 2026, door: 5, vs: 90 });
    for (const bad of ['/advent/2026/0', '/advent/2026/25', '/advent/26/5', '/advent/2026/', '/advent/', '/de/advent/2026/5'])
      expect(parseAdventUrl({ pathname: bad }), bad).toBeNull();
    expect(readAppLink(new URL('https://sudokui.app/advent/2026/7'))).toEqual({ advent: { year: 2026, door: 7 } });
    expect(readAppLink(new URL('https://sudokui.app/es/advent/2026/7?vs=300'))).toEqual({ advent: { year: 2026, door: 7, vs: 300 } });
  });

  it('is the app’s own address: the service worker answers it with the app, in its language, and no static page takes it', () => {
    for (const path of ['/advent/2026/5', '/nb/advent/2026/5', '/es/advent/2026/24/', '/advent/2026/5?vs=90']) {
      expect(APP_NAVIGATION.test(path), path).toBe(true);
      expect(STATIC_ROUTES.test(path), path).toBe(false);
      expect(ADVENT_PATH.test(path.split('?')[0]), path).toBe(true);
    }
    expect(langOfPath('/nb/advent/2026/5')).toBe('nb');
    expect(langOfPath('/es/advent/2026/5/')).toBe('es');
    expect(langOfPath('/advent/2026/5')).toBeNull();
  });
});

// ---- door games -------------------------------------------------------------

/** the player's local today, by the device's clock */
const today = (date: string) => vi.setSystemTime(new Date(`${date}T12:00:00`));
const g = () => useGame.getState();
/** correct digits in the first n empty cells, as the player enters them */
const play = (n: number) => {
  const { puzzle, solution } = g().info!;
  // (the cells still empty: a digit entered again would take it off)
  const empty = [...puzzle].map((ch, i) => (ch === '.' && !g().cells[i].value ? i : -1)).filter((i) => i >= 0);
  for (const cell of empty.slice(0, n)) {
    g().select([cell], false);
    g().input(Number(solution[cell]));
  }
};
const open = (address: string, from: 'boot' | 'tab' | 'import' = 'boot') => openAppLink(readAppLink(new URL(address))!, from);
const tracked: unknown[][] = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  storage.clear();
  tracked.length = 0;
  useSettings.setState({ dontCount: false, countPlays: false, practiceFastForward: false, autoSendDaily: false, lang: 'en' });
  useTelemetry.setState({ track: (...args: unknown[]) => void tracked.push(args) } as never);
  useStats.setState({ recordSolve: () => {} } as never);
  useDailyStats.setState({ played: {}, pending: {}, submitted: {}, tokens: {}, inFlight: {}, stats: {} });
  useGame.setState({ info: null, custom: false, customBackup: null, setAside: null, won: false, solved: false, history: [], future: [], notice: null, letGo: null, away: false, chain: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('a door as a game', () => {
  it('opens on its day: door 1 on 1 December, as the same published board, named as the notes name it', async () => {
    today('2026-12-01');
    expect(await startDoor(2026, 1)).toBe('started');
    expect(g().info).toMatchObject({ puzzle: doors[0].puzzle, score: doors[0].score, level: doors[0].level, adventYear: 2026, adventDoor: 1 });
    expect(g().info!.dailyKey).toBeUndefined();
    expect(kindOf(g().info!)).toBe('advent');
    expect(gameName(g())).toBe('door 1 of the advent calendar');
    expect(g().notice).toBe('Door 1 of the advent calendar. Everyone gets this same board');
    expect(countedOf(g().info)).toEqual({ no: 302601, date: '2026-12-01', door: { year: 2026, door: 1 } });
  });

  it('refuses a door whose day has not come, by the calendar, its address and Import, and puts nothing over the game under way', async () => {
    today('2026-12-01');
    g().startGame(EASY, 196, 'Easy');
    play(3);
    const before = g().cells.map((c) => c.value).join('');
    expect(await startDoor(2026, 2)).toBe('locked');
    // tomorrow's door, as tomorrow's daily: at midnight
    expect(g().notice).toBe('Door 2 of the advent calendar opens at midnight');
    // by its address at start-up the toast says it, as for a daily whose day has not come
    useGame.setState({ notice: null });
    expect(await open('https://sudokui.app/advent/2026/24')).toEqual({ opened: false });
    expect(g().notice).toBe('Door 24 of the advent calendar opens on 24 December');
    // a position on the locked door's puzzle is not played either
    expect((await open(`https://sudokui.app/advent/2026/9#s=${'x'.repeat(10)}`, 'tab')).opened).toBe(false);
    const imported = await open('https://sudokui.app/nb/advent/2026/3', 'import');
    expect(imported).toEqual({ opened: false, refused: 'Door 3 of the advent calendar opens on 3 December' });
    expect(g().info?.puzzle).toBe(EASY);
    expect(g().cells.map((c) => c.value).join('')).toBe(before);
    expect(g().setAside).toBeNull();
    // in November the calendar has not opened at all
    today('2026-11-20');
    expect(doorLocked(2026, 1)).toBe('Door 1 of the advent calendar opens on 1 December');
  });

  it('opens an earlier door on 10 December over a game under way, which is kept, and brings the door back when asked again', async () => {
    today('2026-12-10');
    g().startGame(EASY, 196, 'Easy');
    play(4);
    expect(await open('https://sudokui.app/advent/2026/3', 'tab')).toEqual({ opened: true });
    expect(g().info).toMatchObject({ adventYear: 2026, adventDoor: 3, puzzle: doors[2].puzzle });
    expect(g().setAside?.info?.puzzle).toBe(EASY);
    play(2);
    // the calendar again: the door where it was left, never a second copy
    expect(await startDoor(2026, 3)).toBe('resumed');
    expect(g().notice).toBe('Door 3 of the advent calendar, where you left it');
    expect(g().cells.filter((c) => !c.given && c.value)).toHaveLength(2);
    // back to the kept game, and the door takes the slot
    backToKept();
    expect(g().info?.puzzle).toBe(EASY);
    expect(g().setAside?.info?.adventDoor).toBe(3);
    expect(g().notice).toBe('Back to your Easy game, where you left it');
    expect(holds(readAppLink(new URL('https://sudokui.app/advent/2026/3'))!)).toBe(true);
    // its address (Back or Forward) swaps it back where it was left
    expect(backTo(readAppLink(new URL('https://sudokui.app/advent/2026/3'))!)).toBe(true);
    expect(g().info?.adventDoor).toBe(3);
    expect(g().cells.filter((c) => !c.given && c.value)).toHaveLength(2);
    expect(g().notice).toBe('Back to door 3 of the advent calendar, where you left it');
  });

  it('keeps a door game in progress from 1 January, which can be finished, while no door opens', async () => {
    today('2026-12-31');
    await startDoor(2026, 20);
    play(5);
    today('2027-01-01');
    expect(await startDoor(2026, 21)).toBe('locked');
    expect(g().notice).toBe('The advent calendar is closed until November');
    expect(g().info?.adventDoor).toBe(20);
    // asked for again (its address, a reload), it is the player's own game, and comes back
    expect(await open('https://sudokui.app/advent/2026/20')).toEqual({ opened: true });
    expect(g().info?.adventDoor).toBe(20);
    expect(await startDoor(2026, 20)).toBe('resumed');
    play(81);
    expect(g().won).toBe(true);
    // solved, kept on the device; its time no longer counts, so nothing offers it
    expect(useDailyStats.getState().played[adventNo(2026, 20)]).toMatchObject({ date: '2026-12-20', level: doors[19].level });
    expect(countedClosed(countedOf(g().info)!)).toBe(true);
  });

  it('is kept with the dailies’ solves when solved, counted with its door, and never sent by the daily switch', async () => {
    today('2026-12-05');
    useSettings.setState({ autoSendDaily: true });
    const submit = vi.fn(async () => 'accepted' as const);
    useDailyStats.setState({ submit } as never);
    await startDoor(2026, 5);
    play(81);
    expect(g().won).toBe(true);
    const no = adventNo(2026, 5);
    expect(useDailyStats.getState().played[no]).toMatchObject({ date: '2026-12-05', level: doors[4].level, score: doors[4].score, assisted: false });
    expect(g().dailyKept).toBe(true);
    // the switch is for daily times: a door's goes by Send alone
    expect(submit).not.toHaveBeenCalled();
    expect(dailyResultOf(g())).toMatchObject({ no, unassisted: true, hints: 0, grid: g().info!.solution });
    expect(tracked).toEqual([
      ['started', doors[4].level, 0, 'advent', 5],
      ['completed', doors[4].level, expect.any(Number), 'advent', 5]
    ]);
    // its time counts on its day and up to a week late, not later
    for (const [day, open] of [['2026-12-05', true], ['2026-12-12', true], ['2026-12-13', false]] as const) {
      today(day);
      expect(countedClosed(countedOf(g().info)!), day).toBe(!open);
    }
  });

  it('locks a door as a daily is locked, with one style of toast', () => {
    today('2026-11-12');
    expect(lockedLine('2026-12-01', '2026-11-30', 1)).toBe('Door 1 of the advent calendar opens at midnight');
    expect(lockedLine('2026-12-05', '2026-11-12', 5)).toBe('Door 5 of the advent calendar opens on 5 December');
    expect(lockedLine('2026-11-13', '2026-11-12')).toBe('Tomorrow’s daily opens at midnight');
    expect(lockedLine('2026-11-20', '2026-11-12')).toBe('That daily opens on 20 November');
    // a calendar still to come says its year
    expect(doorLocked(2027, 3, '2026-12-10')).toBe('Door 3 of the advent calendar opens on 3 December 2027');
    // another year's door, while a calendar is there; and none once it has closed
    expect(doorLocked(2026, 3, '2027-11-20', false)).toBe('That door is from another year’s advent calendar');
    expect(doorLocked(2026, 3, '2027-01-05', false)).toBe('The advent calendar is closed until November');
    // a door game the player holds goes on after its calendar closes, never before its day
    expect(doorLocked(2026, 3, '2027-01-05', true)).toBeNull();
    expect(doorLocked(2026, 3, '2026-12-02', true)).toBe('Door 3 of the advent calendar opens at midnight');
  });

  it('leaves a door whose day has not come where it is, even one this page holds (the clock went back): on the board quietly, in the slot by its link, Back and Forward', async () => {
    // opened on its day, then the device's clock put back a day
    today('2026-12-06');
    g().startGame(EASY, 196, 'Easy');
    play(3);
    expect(await startDoor(2026, 6)).toBe('started');
    play(2);
    today('2026-12-05');
    // on the board: its address, a reload, says nothing and changes nothing
    useGame.setState({ notice: null });
    const was = g().info;
    expect(await open('https://sudokui.app/advent/2026/6')).toEqual({ opened: true });
    expect(g().info).toBe(was);
    expect(g().notice).toBeNull();
    // set aside for the kept game: its link does not bring it onto the board, nor does Back
    backToKept();
    expect(g().info?.puzzle).toBe(EASY);
    expect(g().setAside?.info?.adventDoor).toBe(6);
    const link = readAppLink(new URL('https://sudokui.app/advent/2026/6'))!;
    expect(await openAppLink(link, 'tab')).toEqual({ opened: false });
    expect(g().notice).toBe('Door 6 of the advent calendar opens at midnight');
    expect(g().info?.puzzle).toBe(EASY);
    expect(holds(link)).toBe(true);
    expect(backTo(link)).toBe(false);
    expect(g().info?.puzzle).toBe(EASY);
    // never lost: it stays in the slot, and Back to it brings it
    expect(g().setAside?.info?.adventDoor).toBe(6);
    backToKept();
    expect(g().info?.adventDoor).toBe(6);
    expect(g().cells.filter((c) => !c.given && c.value)).toHaveLength(2);
  });

  it('keeps a door, restarted, the same door', async () => {
    today('2026-12-08');
    await startDoor(2026, 8);
    play(2);
    g().restart();
    expect(g().info).toMatchObject({ adventYear: 2026, adventDoor: 8 });
  });

  it('keeps the doors apart from the dailies’ solves, so a calendar of doors never pushes a day out', () => {
    const played = useDailyStats.getState();
    for (let no = 1; no <= 31; no++) played.recordPlayed(no, { date: '2026-10-07', level: 'Easy', score: 100, seconds: 60, assisted: false });
    for (let door = 1; door <= 24; door++) played.recordPlayed(adventNo(2026, door), { date: doorDate(2026, door), level: 'Easy', score: 100, seconds: 60, assisted: false });
    const kept = Object.keys(useDailyStats.getState().played).map(Number);
    expect(kept.filter((n) => n < ADVENT_BASE)).toHaveLength(31);
    expect(kept.filter((n) => n > ADVENT_BASE)).toHaveLength(24);
  });
});
