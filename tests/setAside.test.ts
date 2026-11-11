/**
 * A game under way is never lost silently (docs/architecture.md, "A game is
 * never lost"; src/ui/links.ts; gameStore.ts, openOver): a link opened at
 * start-up or in the same tab, or Import, puts it aside in one saved slot
 * before another game opens, and Back to it swaps the two, so neither is
 * lost. The slot keeps whichever of two games holds more of the player's
 * work. A link or the Daily button asking for the game on the board, or
 * the one set aside, brings it back where it was left; only Restart starts
 * it again. A second custom entry, or a scan from one, keeps the game the
 * first was opened over, for Cancel; Restart there clears the typed
 * digits. Import reads the app's own links as the boot does: a position
 * with its entries and marks, a challenger's time, a day's daily. And
 * without the published dailies, no other board is passed off as the day's.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k)
};

// the published dailies, or none, as when the file cannot be fetched
const dailiesFile = vi.hoisted(() => ({ fails: false }));
vi.mock('../src/content/dailies', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/content/dailies')>();
  return { ...real, loadDailies: async () => (dailiesFile.fails ? null : real.loadDailies()) };
});

const { useGame, encodePosition, underWay, workOf } = await import('../src/state/gameStore');
const { useTelemetry } = await import('../src/state/telemetry');
const { useSettings } = await import('../src/state/settings');
const { useStats } = await import('../src/state/stats');
const { readAppLink } = await import('../src/content/share');
const { findUrl } = await import('../src/content/importLinks');
const { localDateKey, findDaily, dailyNumber } = await import('../src/content/dailies');
const real = await vi.importActual<typeof import('../src/content/dailies')>('../src/content/dailies');
const { startDaily, openAppLink } = await import('../src/ui/links');

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';
const HARD = '...6..9.1..95....4....4985..241....5....3....9....546..7549....3....12..1.2..3...';
const TODAY = localDateKey();
const OTHER_DAY = '2026-11-01';

beforeEach(() => {
  storage.clear();
  dailiesFile.fails = false;
  useSettings.setState({ dontCount: false, countPlays: false, practiceFastForward: false });
  useTelemetry.setState({ track: () => {} } as never);
  useStats.setState({ recordSolve: () => {} } as never);
  useGame.setState({ info: null, custom: false, customBackup: null, setAside: null, won: false, solved: false, history: [], future: [], notice: null, chain: null });
});

const g = () => useGame.getState();
/** correct digits in the first n empty cells, as the player enters them */
const play = (n: number, from = 0) => {
  const { puzzle, solution } = g().info!;
  const empty = [...puzzle].map((ch, i) => (ch === '.' ? i : -1)).filter((i) => i >= 0);
  for (const cell of empty.slice(from, from + n)) {
    g().select([cell], false);
    g().input(Number(solution[cell]));
  }
};
const entries = (cells = g().cells) => cells.filter((c) => !c.given && c.value).length;
/** a reload: the page starts again from only what was saved */
const reload = async () => {
  const saved = storage.get('sudokui-game-v1')!;
  useGame.setState({ info: null, custom: false, customBackup: null, setAside: null, won: false, history: [], future: [] });
  storage.set('sudokui-game-v1', saved);
  await useGame.persist.rehydrate();
};
const link = (address: string) => readAppLink(new URL(address))!;
const open = (address: string, from: 'boot' | 'tab' | 'import' = 'boot') => openAppLink(link(address), from);

describe('a link opened over a game under way', () => {
  it('puts the daily aside, saved, and Back to it brings it back with its entries and its time', async () => {
    expect(await startDaily()).toBe('started');
    const daily = findDaily((await real.loadDailies())!, TODAY);
    expect(g().info?.puzzle).toBe(daily?.puzzle);
    play(4);
    useGame.setState({ elapsedBefore: 65_000, startedAt: Date.now() });
    await reload();
    // a friend's challenge, opened in a new tab
    expect(await open(`https://sudokui.app/p/${EASY}?vs=300`)).toEqual({ opened: true });
    expect(g().info).toMatchObject({ puzzle: EASY, challenge: 300, fromLink: true });
    expect(g().setAside?.info?.dailyKey).toBe(TODAY);
    expect(entries(g().setAside!.cells)).toBe(4);
    expect(g().setAside?.hidden).toBeFalsy();
    // kept across a reload, as the game is
    await reload();
    expect(g().info?.puzzle).toBe(EASY);
    expect(g().setAside?.info?.dailyKey).toBe(TODAY);
    g().backToSetAside();
    expect(g().info).toMatchObject({ dailyKey: TODAY, dailyNo: dailyNumber(TODAY) });
    expect(entries()).toBe(4);
    expect(g().elapsedMs()).toBeGreaterThanOrEqual(65_000);
    // the challenge was never played: nothing to keep
    expect(g().setAside).toBeNull();
  });

  it('sets nothing aside when the game on the board is untouched or won', async () => {
    g().startGame(HARD, 1348, 'Hard');
    await open(`https://sudokui.app/p/${EASY}/`);
    expect(g().info?.puzzle).toBe(EASY);
    expect(g().setAside).toBeNull();
    play(81);
    expect(g().won).toBe(true);
    expect(underWay(g())).toBe(false);
    await open(`https://sudokui.app/p/${HARD}/`);
    expect(g().info?.puzzle).toBe(HARD);
    expect(g().setAside).toBeNull();
  });

  it('swaps on Back to it: the link’s game under way takes the slot, its note put away, and its link brings it back', async () => {
    g().startGame(HARD, 1348, 'Hard');
    play(3);
    await open(`https://sudokui.app/p/${EASY}/`);
    play(2);
    g().backToSetAside();
    expect(g().info?.puzzle).toBe(HARD);
    expect(entries()).toBe(3);
    expect(g().setAside?.info?.puzzle).toBe(EASY);
    expect(g().setAside?.hidden).toBe(true);
    // the friend's link again: that game, where it was left, and the other kept
    await open(`https://sudokui.app/p/${EASY}/`);
    expect(g().info?.puzzle).toBe(EASY);
    expect(entries()).toBe(2);
    expect(g().notice).toBe('Your game on this puzzle, where you left it');
    expect(g().setAside?.info?.puzzle).toBe(HARD);
    expect(entries(g().setAside!.cells)).toBe(3);
  });

  it('keeps in its one slot the game with more of the player’s work, the newer on a tie', async () => {
    g().startGame(HARD, 1348, 'Hard');
    play(5);
    await open(`https://sudokui.app/p/${EASY}/`);
    expect(g().setAside?.info?.puzzle).toBe(HARD);
    // fewer cells written on the link's game: the set-aside one stays
    play(2);
    await open('https://sudokui.app/daily/2026-11-01');
    expect(g().info?.dailyKey).toBe(OTHER_DAY);
    expect(g().setAside?.info?.puzzle).toBe(HARD);
    // as many: the newer takes the slot
    play(5);
    expect(workOf(g())).toBe(workOf(g().setAside!));
    await open(`https://sudokui.app/p/${EASY}/`);
    expect(g().setAside?.info?.dailyKey).toBe(OTHER_DAY);
  });

  it('a position link sets the game aside too, and opens with its entries, marks and colours', async () => {
    g().startGame(EASY, 196, 'Easy');
    play(3);
    const cells = g().cells.map((c) => ({ ...c, colors: [...c.colors] }));
    const empty = cells.findIndex((c) => !c.value);
    cells[empty].corner = 0b11;
    cells[empty + 1].colors = [2];
    const payload = encodePosition(cells, false);
    useGame.setState({ info: null, setAside: null });
    g().startGame(HARD, 1348, 'Hard');
    play(1);
    await open(`https://sudokui.app/p/${EASY}?b=easy&s=196#s=${payload}`);
    expect(g().info).toMatchObject({ puzzle: EASY, fromPosition: true, fromLink: true });
    expect(entries()).toBe(3);
    expect(g().cells[empty].corner).toBe(0b11);
    expect(g().cells[empty + 1].colors).toEqual([2]);
    expect(g().setAside?.info?.puzzle).toBe(HARD);
  });

  it('a link opened in the same tab after a reload, with no undo history, sets the game aside rather than refusing or replacing it', async () => {
    g().startGame(HARD, 1348, 'Hard');
    play(3);
    await reload();
    expect(g().history).toEqual([]);
    expect(await openAppLink(readAppLink({ pathname: '/', search: '', hash: `#p=${EASY}` })!, 'tab')).toEqual({ opened: true });
    expect(g().info?.puzzle).toBe(EASY);
    expect(entries(g().setAside!.cells)).toBe(3);
  });

  it('a puzzle being typed in goes aside with the game it was opened over: Back to it, then Cancel, brings that game back', async () => {
    g().startGame(HARD, 1348, 'Hard');
    play(3);
    g().startCustomEntry();
    g().select([0], false);
    g().input(5);
    await open(`https://sudokui.app/p/${EASY}/`);
    expect(g().custom).toBe(false);
    expect(g().setAside).toMatchObject({ custom: true, customBackup: { info: { puzzle: HARD } } });
    await reload();
    g().backToSetAside();
    expect(g().custom).toBe(true);
    expect(g().cells[0].value).toBe(5);
    g().cancelCustomEntry();
    expect(g().info?.puzzle).toBe(HARD);
    expect(entries()).toBe(3);
  });

  it('an empty entry board over nothing begun is not under way', () => {
    g().startGame(HARD, 1348, 'Hard');
    g().startCustomEntry();
    expect(underWay(g())).toBe(false);
    g().select([0], false);
    g().input(5);
    expect(underWay(g())).toBe(true);
  });
});

describe('the Daily button', () => {
  it('brings back today’s daily under way as it was: its entries and its time, no restart', async () => {
    await startDaily();
    play(3);
    useGame.setState({ elapsedBefore: 40_000, startedAt: Date.now() });
    expect(await startDaily()).toBe('resumed');
    expect(entries()).toBe(3);
    expect(g().elapsedMs()).toBeGreaterThanOrEqual(40_000);
    expect(g().notice).toBe('Today’s daily, where you left it');
  });

  it('brings back today’s daily from the slot, and puts the game on the board aside in its place', async () => {
    await startDaily();
    play(3);
    await open(`https://sudokui.app/p/${EASY}/`);
    play(1);
    expect(await startDaily()).toBe('resumed');
    expect(g().info?.dailyKey).toBe(TODAY);
    expect(entries()).toBe(3);
    expect(g().setAside?.info?.puzzle).toBe(EASY);
  });

  it('leaves a solved daily on the board; Restart is the way to play it again', async () => {
    await startDaily();
    play(81);
    expect(g().won).toBe(true);
    expect(await startDaily()).toBe('resumed');
    expect(g().won).toBe(true);
    expect(g().notice).toBe('You have solved this daily. Restart plays it again');
  });

  it('without the published list, says so and keeps the board, rather than passing another puzzle off as the day’s', async () => {
    g().startGame(HARD, 1348, 'Hard');
    play(2);
    dailiesFile.fails = true;
    expect(await startDaily()).toBe('unavailable');
    expect(g().info?.puzzle).toBe(HARD);
    expect(entries()).toBe(2);
    expect(g().notice).toBe('Today’s daily could not be loaded. Check the connection and try again');
    // a day before the published list began has none to load: derived from its date, as before
    expect(await startDaily('2026-01-05')).toBe('started');
    expect(g().info?.dailyKey).toBe('2026-01-05');
  });
});

describe('custom entry', () => {
  it('opened a second time keeps the first backup: Cancel brings back the game from before', () => {
    g().startGame(HARD, 1348, 'Hard', null, TODAY);
    play(4);
    g().startCustomEntry();
    g().select([0], false);
    g().input(5);
    g().startCustomEntry();
    g().cancelCustomEntry();
    expect(g().info).toMatchObject({ puzzle: HARD, dailyKey: TODAY });
    expect(entries()).toBe(4);
  });

  it('a scan from custom entry keeps it too', () => {
    g().startGame(HARD, 1348, 'Hard');
    play(4);
    g().startCustomEntry();
    g().loadScan([...EASY].map((ch) => (ch === '.' ? 0 : Number(ch))), [], 'data:,');
    expect(g().cells.filter((c) => c.value).length).toBeGreaterThan(17);
    g().cancelCustomEntry();
    expect(g().info?.puzzle).toBe(HARD);
    expect(entries()).toBe(4);
  });

  it('Restart clears the typed digits and keeps the game Cancel brings back', () => {
    g().startGame(HARD, 1348, 'Hard');
    play(2);
    g().startCustomEntry();
    for (const cell of [0, 1, 2]) {
      g().select([cell], false);
      g().input(cell + 1);
    }
    g().restart();
    expect(g().custom).toBe(true);
    expect(g().cells.some((c) => c.value)).toBe(false);
    expect(g().notice).toBe('Board cleared');
    g().cancelCustomEntry();
    expect(g().info?.puzzle).toBe(HARD);
    expect(entries()).toBe(2);
  });
});

describe('Import', () => {
  /** text pasted into Import, read as the dialog reads it (src/ui/Dialogs.tsx) */
  const paste = (text: string) => {
    const url = findUrl(text.trim());
    const own = url && readAppLink(url);
    return own ? openAppLink(own, 'import') : null;
  };

  it('reads a Position link whole: its entries and marks', async () => {
    g().startGame(EASY, 196, 'Easy');
    play(5);
    const cells = g().cells.map((c) => ({ ...c, colors: [...c.colors] }));
    const empty = cells.findIndex((c) => !c.value);
    cells[empty].center = 0b101;
    const payload = encodePosition(cells, false);
    useGame.setState({ info: null });
    g().startGame(HARD, 1348, 'Hard');
    play(1);
    expect(await paste(`https://sudokui.app/p/${EASY}?b=easy&s=196#s=${payload}`)).toEqual({ opened: true });
    expect(entries()).toBe(5);
    expect(g().cells[empty].center).toBe(0b101);
    expect(g().notice).toBe('Shared position loaded, with entries, marks and colours');
    // and the game under way it opened over is kept
    expect(g().setAside?.info?.puzzle).toBe(HARD);
  });

  it('keeps a challenge’s time to beat', async () => {
    expect(await paste(`https://sudokui.app/p/${EASY}?b=easy&s=196&vs=300`)).toEqual({ opened: true });
    expect(g().info).toMatchObject({ puzzle: EASY, challenge: 300, fromLink: true });
    expect(g().notice).toBe('A challenge: solve it faster than 5:00');
  });

  it('opens a daily’s share line as that day’s daily, with its time to beat', async () => {
    const no = dailyNumber(TODAY);
    expect(await paste(`sudokUI Daily #${no} · Medium (1100) · 7:41 · unassisted · https://sudokui.app/daily/${TODAY}?vs=461`)).toEqual({ opened: true });
    expect(g().info).toMatchObject({ dailyKey: TODAY, dailyNo: no, challenge: 461 });
  });

  it('opens the puzzle under a cut-off position link, and says why its marks are not there', async () => {
    g().startGame(EASY, 196, 'Easy');
    play(5);
    const payload = encodePosition(g().cells, false);
    useGame.setState({ info: null });
    expect(await paste(`https://sudokui.app/p/${EASY}/#s=${payload.slice(0, 40)}`)).toEqual({ opened: true });
    expect(g().info?.puzzle).toBe(EASY);
    expect(g().notice).toBe('This link looks cut off, so the entries and marks it shared could not be loaded');
  });

  it('refuses a share link whose puzzle cannot be played, with the reason', async () => {
    const r = await paste(`https://sudokui.app/p/${'.'.repeat(81)}/`);
    expect(r?.opened).toBe(false);
    expect(r?.refused).toBeTruthy();
  });

  it('a puzzle string sets a game under way aside, and the puzzle set aside comes back where it was left', () => {
    g().startGame(HARD, 1348, 'Hard');
    play(3);
    expect(g().importPuzzle(EASY)).toBeNull();
    expect(g().info?.puzzle).toBe(EASY);
    expect(g().setAside?.info?.puzzle).toBe(HARD);
    expect(g().importPuzzle(HARD)).toBeNull();
    expect(g().info?.puzzle).toBe(HARD);
    expect(entries()).toBe(3);
  });
});

describe('the app’s own addresses, read one way', () => {
  it('reads a position, a daily, a share address and a bare #p=', () => {
    expect(readAppLink({ pathname: `/p/${EASY}`, search: '?b=easy&vs=90', hash: '#s=abc' })).toEqual({
      position: 'abc',
      puzzle: { cells: EASY, share: true, vs: 90 }
    });
    expect(readAppLink({ pathname: '/nb/daily/2026-11-01', search: '?vs=461', hash: '' })).toEqual({ daily: { date: OTHER_DAY, vs: 461 } });
    expect(readAppLink({ pathname: '/', search: '', hash: '#daily' }, '2026-11-11')).toEqual({ daily: { date: '2026-11-11' } });
    expect(readAppLink({ pathname: '/', search: '', hash: `#p=${EASY.replace(/\./g, '0')}` })).toEqual({ puzzle: { cells: EASY, share: false } });
    // a bare #p= that is not 81 cells, the Learn pages' other deep links, and no link at all
    expect(readAppLink({ pathname: '/', search: '', hash: '#p=123' })).toBeNull();
    expect(readAppLink({ pathname: '/', search: '', hash: '#learn=X_WING' })).toBeNull();
    expect(readAppLink({ pathname: '/', search: '', hash: '' })).toBeNull();
  });
});
