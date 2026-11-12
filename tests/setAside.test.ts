/**
 * A game under way is never lost silently (docs/architecture.md, "A game is
 * never lost"; src/ui/links.ts; gameStore.ts, openOver): a link opened at
 * start-up or in the same tab, or Import, puts it aside in one saved slot
 * before another game opens, and Back to it swaps the two, so neither is
 * lost, the note then offering the other. The slot keeps whichever of two
 * games holds more of the player's own work: what a shared position or a
 * fast-forwarded practice opened with is not theirs. A link or the Daily
 * button asking for the game on the board, the one set aside, or the one
 * behind a puzzle being typed in, brings it back where it was left; only
 * Restart starts it again. A second custom entry, or a scan from one,
 * keeps the game the first was opened over, for Cancel; Restart there
 * clears the typed digits. Import reads the app's own links (and only
 * those) as the boot does: a position with its entries and marks, a
 * challenger's time, a day's daily. And without the published dailies, no
 * other board is passed off as the day's.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

const { useGame, encodePosition, underWay, workOf, gameName, takeInSavedGame, askOthersWith, fetchOthersWith, forgetLetGo, reclaimOwnGame, gameKey, letGoLine } = await import('../src/state/gameStore');
const { useTelemetry } = await import('../src/state/telemetry');
const { useSettings } = await import('../src/state/settings');
const { useStats } = await import('../src/state/stats');
const { readAppLink, isAppAddress } = await import('../src/content/share');
const { findUrl } = await import('../src/content/importLinks');
const { localDateKey, findDaily, dailyNumber } = await import('../src/content/dailies');
const real = await vi.importActual<typeof import('../src/content/dailies')>('../src/content/dailies');
const { startDaily, openAppLink, backToKept } = await import('../src/ui/links');
const { boardCleared } = await import('../src/ui/ErrorBoundary');

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';
const HARD = '...6..9.1..95....4....4985..241....5....3....9....546..7549....3....12..1.2..3...';
const TODAY = localDateKey();
const OTHER_DAY = '2026-11-01';

beforeEach(() => {
  storage.clear();
  // a new page: nothing told yet, and no other window answers
  forgetLetGo();
  askOthersWith((_keys, answer) => answer(new Set()));
  fetchOthersWith((_want, answer) => answer(null));
  dailiesFile.fails = false;
  useSettings.setState({ dontCount: false, countPlays: false, practiceFastForward: false });
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
    ownHere: false,
    away: false,
    chain: null
  });
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
    backToKept();
    expect(g().info).toMatchObject({ dailyKey: TODAY, dailyNo: dailyNumber(TODAY) });
    expect(g().notice).toBe('Today’s daily, where you left it');
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

  it('swaps on Back to it: the link’s game under way takes the slot with its note shown, and its link brings it back with the other offered', async () => {
    g().startGame(HARD, 1348, 'Hard');
    play(3);
    await open(`https://sudokui.app/p/${EASY}/`);
    play(2);
    g().backToSetAside();
    expect(g().info?.puzzle).toBe(HARD);
    expect(entries()).toBe(3);
    expect(g().setAside?.info?.puzzle).toBe(EASY);
    // the note now offers the friend's game: either game is one tap away
    expect(g().setAside?.hidden).toBeFalsy();
    // the friend's link again: that game, where it was left, and the other
    // kept with its note shown, though it has no link of its own
    await open(`https://sudokui.app/p/${EASY}/`);
    expect(g().info?.puzzle).toBe(EASY);
    expect(entries()).toBe(2);
    expect(g().notice).toBe('Your game on this puzzle, where you left it');
    expect(g().setAside?.info?.puzzle).toBe(HARD);
    expect(entries(g().setAside!.cells)).toBe(3);
    expect(g().setAside?.hidden).toBeFalsy();
  });

  it('a kept game whose note was put away, and which stays in the slot over another, has its note shown again', async () => {
    g().startGame(HARD, 1348, 'Hard');
    play(5);
    await open(`https://sudokui.app/p/${EASY}/`);
    g().hideSetAside();
    play(2);
    await open('https://sudokui.app/daily/2026-11-01');
    expect(g().setAside?.info?.puzzle).toBe(HARD);
    expect(g().setAside?.hidden).toBeFalsy();
  });

  it('keeps in its one slot the game with more of the player’s work, the newer on a tie', async () => {
    g().startGame(HARD, 1348, 'Hard');
    play(5);
    await open(`https://sudokui.app/p/${EASY}/`);
    expect(g().setAside?.info?.puzzle).toBe(HARD);
    expect(g().letGo).toBeNull();
    // fewer cells written on the link's game: the set-aside one stays, and
    // the toast says which game went, with the notice that came with it
    play(2);
    await open('https://sudokui.app/daily/2026-11-01');
    expect(g().info?.dailyKey).toBe(OTHER_DAY);
    expect(g().setAside?.info?.puzzle).toBe(HARD);
    expect(g().letGo).toBe('Only one game in progress is kept at a time: your game on a shared puzzle is gone, your Hard game is kept');
    expect(g().notice).toBe(`The daily for ${OTHER_DAY}`);
    // as many: the newer takes the slot
    g().clearNotice();
    expect(g().letGo).toBeNull();
    play(5);
    expect(workOf(g())).toBe(workOf(g().setAside!));
    await open(`https://sudokui.app/p/${EASY}/`);
    expect(g().setAside?.info?.dailyKey).toBe(OTHER_DAY);
    expect(g().letGo).toBe(`Only one game in progress is kept at a time: your Hard game is gone, the daily for ${OTHER_DAY} is kept`);
  });

  it('names each game as the notes and the toasts do', async () => {
    const named = () => gameName(g());
    await startDaily();
    expect(named()).toBe('today’s daily');
    await startDaily(OTHER_DAY);
    expect(named()).toBe(`the daily for ${OTHER_DAY}`);
    g().startGame(HARD, 1348, 'Hard', 'NAKED_PAIR');
    expect(named()).toBe('your Naked Pair practice');
    await open(`https://sudokui.app/p/${EASY}/`);
    expect(named()).toBe('your game on a shared puzzle');
    g().startGame(HARD, 1348, 'Hard');
    expect(named()).toBe('your Hard game');
    g().startCustomEntry();
    expect(named()).toBe('the puzzle you were typing in');
    g().cancelCustomEntry();
    play(2);
    g().startCustomEntry();
    expect(named()).toBe('the puzzle you were typing in, with your Hard game behind it');
  });

  it('a Practice link or the Daily button over two games under way tells which one went', async () => {
    g().startGame(HARD, 1348, 'Hard');
    play(2);
    await open(`https://sudokui.app/p/${EASY}/`);
    play(4);
    await startDaily();
    expect(g().setAside?.info?.puzzle).toBe(EASY);
    expect(g().letGo).toBe('Only one game in progress is kept at a time: your Hard game is gone, your game on a shared puzzle is kept');
    // a Practice link opens through openOver as a link does (src/ui/Dialogs.tsx, useNewGame)
    g().clearNotice();
    play(1);
    g().openOver(() => (g().startGame(EASY, 196, 'Easy', 'NAKED_SINGLE'), true));
    expect(g().setAside?.info?.puzzle).toBe(EASY);
    expect(g().letGo).toBe('Only one game in progress is kept at a time: today’s daily is gone, your game on a shared puzzle is kept');
  });

  it('counts only the player’s own work: two links in a row, the first a friend’s position nobody touched, keep today’s daily', async () => {
    // a friend's position, with five entries and a mark of theirs on it
    g().startGame(EASY, 196, 'Easy');
    play(5);
    const cells = g().cells.map((c) => ({ ...c, colors: [...c.colors] }));
    cells[cells.findIndex((c) => !c.value)].corner = 0b110;
    const payload = encodePosition(cells, false);
    useGame.setState({ info: null });
    await startDaily();
    play(3);
    expect(g().setAside).toBeNull();
    await open(`https://sudokui.app/p/${EASY}?b=easy&s=196#s=${payload}`);
    expect(entries()).toBe(5);
    expect(g().setAside?.info?.dailyKey).toBe(TODAY);
    // the sender's entries and marks are theirs: nothing of the player's yet
    expect(underWay(g())).toBe(false);
    expect(workOf(g())).toBe(0);
    await reload();
    expect(underWay(g())).toBe(false);
    // a second friend's challenge: the daily stays in the slot
    await open(`https://sudokui.app/p/${HARD}?vs=600`);
    expect(g().info?.puzzle).toBe(HARD);
    expect(g().setAside?.info?.dailyKey).toBe(TODAY);
    expect(entries(g().setAside!.cells)).toBe(3);
  });

  it('a move on a shared position counts as one cell of work, not the sender’s five', async () => {
    g().startGame(EASY, 196, 'Easy');
    play(5);
    const payload = encodePosition(g().cells, false);
    useGame.setState({ info: null });
    g().startGame(HARD, 1348, 'Hard');
    play(3);
    await open(`https://sudokui.app/p/${EASY}/#s=${payload}`);
    play(1, 5);
    expect(underWay(g())).toBe(true);
    expect(workOf(g())).toBe(1);
    // the slot keeps the Hard game (3) over the position (1)
    await open('https://sudokui.app/daily/2026-11-01');
    expect(g().setAside?.info?.puzzle).toBe(HARD);
  });

  it('a practice puzzle fast-forwarded by the app is not under way until the player moves on it', () => {
    useSettings.setState({ practiceFastForward: true });
    g().startGame(HARD, 1348, 'Hard', 'NAKED_PAIR');
    expect(g().autoCandidates).toBe(true);
    expect(g().info?.opening).toBeTruthy();
    expect(underWay(g())).toBe(false);
    expect(workOf(g())).toBe(0);
    play(1);
    expect(underWay(g())).toBe(true);
    expect(workOf(g())).toBe(1);
    // started again, it opens as the app put it: nothing of the player's
    g().restart();
    expect(underWay(g())).toBe(false);
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

describe('a practice’s address', () => {
  it('brings back the practice kept in the slot at a reload, Back or Forward; Import plays the puzzle itself', async () => {
    g().startGame(HARD, 1348, 'Hard', 'X_WING');
    play(2);
    await open(`https://sudokui.app/p/${EASY}/`, 'tab');
    play(3);
    expect(g().setAside?.info?.practiceTech).toBe('X_WING');
    // the address bar back on the practice's puzzle (Back, then a reload)
    await open(`https://sudokui.app/p/${HARD}/?b=hard&s=1348`, 'boot');
    expect(g().info?.practiceTech).toBe('X_WING');
    expect(entries()).toBe(2);
    expect(g().setAside?.info?.puzzle).toBe(EASY);
    expect(g().notice).toBe('Your X-Wing practice, where you left it');
    expect(g().letGo).toBeNull();
    // Import of that puzzle: the puzzle itself, a game of its own
    g().backToSetAside();
    await open(`https://sudokui.app/p/${HARD}/`, 'import');
    expect(g().info?.puzzle).toBe(HARD);
    expect(g().info?.practiceTech).toBeNull();
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

  it('starts afresh a daily that has gone from the board: solved, then replaced by a link, or dropped by New', async () => {
    await startDaily();
    play(81);
    // a solved game is not kept
    await open(`https://sudokui.app/p/${EASY}/`);
    expect(g().setAside).toBeNull();
    expect(await startDaily()).toBe('started');
    expect(g().info?.dailyKey).toBe(TODAY);
    expect(g().won).toBe(false);
    expect(entries()).toBe(0);
    expect(g().notice).toBe(`Daily puzzle for ${TODAY}. Everyone gets this same board today`);
    // New and a level keeps nothing, under way or not
    play(3);
    g().startGame(HARD, 1348, 'Hard');
    expect(g().setAside).toBeNull();
    expect(await startDaily()).toBe('started');
    expect(entries()).toBe(0);
  });

  it('brings back today’s daily from behind a puzzle being typed in over it, never a second copy; the typed puzzle goes aside', async () => {
    await startDaily();
    play(7);
    useGame.setState({ elapsedBefore: 30_000, startedAt: Date.now() });
    g().startCustomEntry();
    g().select([0], false);
    g().input(5);
    expect(await startDaily()).toBe('resumed');
    expect(g().custom).toBe(false);
    expect(g().info?.dailyKey).toBe(TODAY);
    expect(entries()).toBe(7);
    expect(g().elapsedMs()).toBeGreaterThanOrEqual(30_000);
    expect(g().notice).toBe('Today’s daily, where you left it');
    // the typed digit is kept, without a second copy of the daily behind it
    expect(g().setAside).toMatchObject({ custom: true, customBackup: null });
    expect(g().setAside?.cells[0].value).toBe(5);
  });

  it('the daily’s own link at start-up does the same, and an empty entry board over it leaves nothing aside', async () => {
    await startDaily();
    play(4);
    g().startCustomEntry();
    await reload();
    expect(await open(`https://sudokui.app/daily/${TODAY}`)).toEqual({ opened: true });
    expect(g().info?.dailyKey).toBe(TODAY);
    expect(entries()).toBe(4);
    expect(g().setAside).toBeNull();
  });

  it('brings back today’s daily from behind a puzzle being typed in that a link set aside', async () => {
    await startDaily();
    play(6);
    g().startCustomEntry();
    g().select([0], false);
    g().input(5);
    await open(`https://sudokui.app/p/${EASY}/`);
    expect(g().setAside).toMatchObject({ custom: true, customBackup: { info: { dailyKey: TODAY } } });
    play(1);
    expect(await startDaily()).toBe('resumed');
    expect(g().info?.dailyKey).toBe(TODAY);
    expect(entries()).toBe(6);
    // the slot keeps one of the other two, the one with more work: the
    // friend's game (1 entry) on a tie with the typed puzzle (1 digit) is the newer
    expect(g().setAside?.info?.puzzle).toBe(EASY);
  });

  it('a link to the puzzle behind a puzzle being typed in brings that game back', async () => {
    g().startGame(HARD, 1348, 'Hard');
    play(3);
    g().startCustomEntry();
    await open(`https://sudokui.app/p/${HARD}/`);
    expect(g().custom).toBe(false);
    expect(g().info?.puzzle).toBe(HARD);
    expect(entries()).toBe(3);
    expect(g().notice).toBe('Your game on this puzzle, where you left it');
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

  /** a puzzle's givens typed onto the entry board */
  const typeIn = (puzzle: string) =>
    [...puzzle].forEach((ch, i) => {
      if (ch === '.') return;
      g().select([i], false);
      g().input(Number(ch));
    });

  it('Check & play keeps the game it was typed over in the slot, as a link would, and its own puzzle typed in brings it back', () => {
    g().startGame(HARD, 1348, 'Hard');
    play(3);
    g().startCustomEntry();
    typeIn(EASY);
    expect(g().finishCustomEntry()).toBeNull();
    expect(g().info?.puzzle).toBe(EASY);
    expect(g().setAside).toMatchObject({ info: { puzzle: HARD } });
    expect(entries(g().setAside!.cells)).toBe(3);
    expect(g().setAside?.hidden).toBeFalsy();
    expect(g().notice).toMatch(/^Puzzle checked: unique solution/);
    expect(g().letGo).toBeNull();
    backToKept();
    expect(g().info?.puzzle).toBe(HARD);
    expect(entries()).toBe(3);
    // the same puzzle typed in again: that game, where it was left
    g().startCustomEntry();
    typeIn(HARD);
    expect(g().finishCustomEntry()).toBeNull();
    expect(g().custom).toBe(false);
    expect(g().info?.puzzle).toBe(HARD);
    expect(entries()).toBe(3);
    expect(g().notice).toBe('Your game on this puzzle, where you left it');
    // a game not under way behind it is no loss: nothing is kept
    useGame.setState({ setAside: null });
    g().startGame(HARD, 1348, 'Hard');
    g().startCustomEntry();
    typeIn(EASY);
    expect(g().finishCustomEntry()).toBeNull();
    expect(g().setAside).toBeNull();
  });
});

describe('the error screen', () => {
  it('Clear the board and reload clears the game on the board and keeps the one set aside', async () => {
    await startDaily();
    play(4);
    await open(`https://sudokui.app/p/${EASY}/`);
    play(2);
    // what the button leaves, then the reload, from that alone
    const left = boardCleared(storage.get('sudokui-game-v1')!)!;
    useGame.setState({ ...useGame.getInitialState(), setAside: null });
    storage.set('sudokui-game-v1', left);
    await useGame.persist.rehydrate();
    expect(g().info).toBeNull();
    expect(entries()).toBe(0);
    expect(g().setAside?.info?.dailyKey).toBe(TODAY);
    expect(g().setAside?.hidden).toBeFalsy();
    backToKept();
    expect(g().info?.dailyKey).toBe(TODAY);
    expect(entries()).toBe(4);
    // with nothing aside, or a save that cannot be read, all of it goes
    expect(boardCleared(JSON.stringify({ state: { info: null, setAside: null }, version: 0 }))).toBeNull();
    expect(boardCleared('{"state":')).toBeNull();
    expect(boardCleared(null)).toBeNull();
  });

  it('the game behind a typed puzzle comes back from the error screen with its tally: its slips and moves from before the crash', async () => {
    g().startGame(EASY, 196, 'Easy');
    const { solution } = g().info!;
    const cell = [...EASY].findIndex((ch) => ch === '.');
    const wrong = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((d) => d !== Number(solution[cell]))!;
    g().select([cell], false);
    g().input(wrong);
    g().input(Number(solution[cell]));
    expect(useStats.getState().game.errors).toBe(1);
    g().startCustomEntry();
    g().select([0], false);
    g().input(5);
    const left = boardCleared(storage.get('sudokui-game-v1')!, storage.get('sudokui-stats-v1') ?? null)!;
    expect(JSON.parse(left).state.setAside.tally.errors).toBe(1);
    useGame.setState({ ...useGame.getInitialState(), setAside: null });
    storage.set('sudokui-game-v1', left);
    await useGame.persist.rehydrate();
    // the boot's new game starts a tally of its own; Back to it brings the kept one back
    g().startGame(HARD, 1348, 'Hard');
    expect(useStats.getState().game.errors).toBe(0);
    backToKept();
    expect(g().info?.puzzle).toBe(EASY);
    expect(useStats.getState().game.errors).toBe(1);
  });

  it('with the slot empty, keeps the game a puzzle being typed in was opened over, and the note offers it back', async () => {
    g().startGame(HARD, 1348, 'Hard');
    play(3);
    g().startCustomEntry();
    g().select([0], false);
    g().input(5);
    expect(g().setAside).toBeNull();
    const left = boardCleared(storage.get('sudokui-game-v1')!)!;
    expect(left).not.toBeNull();
    useGame.setState({ ...useGame.getInitialState(), setAside: null });
    storage.set('sudokui-game-v1', left);
    await useGame.persist.rehydrate();
    // the typed puzzle is gone, the game behind it kept
    expect(g().custom).toBe(false);
    expect(g().info).toBeNull();
    expect(g().setAside?.info?.puzzle).toBe(HARD);
    expect(g().setAside?.hidden).toBeFalsy();
    backToKept();
    expect(g().info?.puzzle).toBe(HARD);
    expect(entries()).toBe(3);
    expect(g().notice).toBe('Your game on this puzzle, where you left it');
    // a solved game behind it is not kept, as nowhere else
    const save = JSON.parse(storage.get('sudokui-game-v1')!);
    const solvedBehind = { ...save, state: { ...save.state, custom: true, setAside: null, customBackup: { ...save.state.setAside, won: true } } };
    expect(boardCleared(JSON.stringify(solvedBehind))).toBeNull();
    // and a game in the slot stays the one kept
    await open(`https://sudokui.app/p/${EASY}/`);
    g().startCustomEntry();
    g().select([0], false);
    g().input(5);
    const both = JSON.parse(storage.get('sudokui-game-v1')!).state;
    expect(both.setAside.info.puzzle).toBe(HARD);
    expect(JSON.parse(boardCleared(storage.get('sudokui-game-v1')!)!).state.setAside.info.puzzle).toBe(HARD);
  });

  it('a solved game put back in play behind a typed puzzle keeps its solve: back from the slot or the error screen, solved again, it is recorded once', async () => {
    let solves = 0;
    useStats.setState({ recordSolve: () => void solves++ } as never);
    /** solved, its last digit undone, then a typed puzzle over it */
    const solvedThenTyping = () => {
      g().startGame(EASY, 196, 'Easy');
      play(81);
      expect(g().won).toBe(true);
      g().undo();
      expect(g().solved).toBe(true);
      g().startCustomEntry();
      g().select([0], false);
      g().input(5);
    };
    const lastDigit = () => {
      const { solution } = g().info!;
      const cell = g().cells.findIndex((c) => !c.value);
      g().select([cell], false);
      g().input(Number(solution[cell]));
    };
    // a link sets the typed puzzle aside, and the link of the game behind it brings that back
    solvedThenTyping();
    const solvedMs = g().solvedMs;
    await open(`https://sudokui.app/p/${HARD}/`);
    expect(g().setAside?.custom).toBe(true);
    await open(`https://sudokui.app/p/${EASY}/`);
    expect(g().info?.puzzle).toBe(EASY);
    expect(g().solved).toBe(true);
    expect(g().solvedMs).toBe(solvedMs);
    lastDigit();
    expect(g().won).toBe(true);
    expect(g().elapsedMs()).toBe(solvedMs);
    expect(solves).toBe(1);
    // the error screen: the game behind the typed puzzle takes the slot with its solve
    solves = 0;
    useGame.setState({ setAside: null });
    solvedThenTyping();
    const left = boardCleared(storage.get('sudokui-game-v1')!)!;
    useGame.setState({ ...useGame.getInitialState(), setAside: null });
    storage.set('sudokui-game-v1', left);
    await useGame.persist.rehydrate();
    expect(g().setAside?.solved).toBe(true);
    g().startGame(HARD, 1348, 'Hard');
    backToKept();
    expect(g().info?.puzzle).toBe(EASY);
    expect(g().solved).toBe(true);
    lastDigit();
    expect(g().won).toBe(true);
    expect(solves).toBe(1);
    // a save from before the backup kept the solve: the save's own fields are the game behind's
    useGame.setState({ setAside: null });
    solvedThenTyping();
    const save = JSON.parse(storage.get('sudokui-game-v1')!);
    for (const key of ['solved', 'solvedMs', 'solvedAssisted', 'solvedAuto', 'dailyKept', 'practiceTarget', 'practiceFound']) delete save.state.customBackup[key];
    expect(JSON.parse(boardCleared(JSON.stringify(save))!).state.setAside).toMatchObject({ solved: true, solvedMs: g().solvedMs });
  });

  it('a practice behind a typed puzzle keeps its target through the error screen', async () => {
    g().startGame(HARD, 1348, 'Hard', 'X_WING');
    expect(g().practiceTarget).not.toBeNull();
    play(2);
    g().startCustomEntry();
    g().select([0], false);
    g().input(5);
    const left = boardCleared(storage.get('sudokui-game-v1')!)!;
    useGame.setState({ ...useGame.getInitialState(), setAside: null });
    storage.set('sudokui-game-v1', left);
    await useGame.persist.rehydrate();
    backToKept();
    expect(g().info?.practiceTech).toBe('X_WING');
    expect(g().practiceTarget).not.toBeNull();
  });

  it('a save that cannot be read is cleared whole', () => {
    expect(boardCleared('{"state":')).toBeNull();
    expect(boardCleared(null)).toBeNull();
  });
});

describe('Import', () => {
  /** text pasted into Import, read as the dialog reads it (src/ui/Dialogs.tsx) */
  const paste = (text: string) => {
    const url = findUrl(text.trim());
    const own = url && isAppAddress(url, 'localhost') && readAppLink(url);
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

  it('a position that cannot be read is refused in the dialog alone, not again behind it', async () => {
    g().startGame(HARD, 1348, 'Hard');
    play(2);
    const r = await openAppLink(readAppLink(new URL('https://sudokui.app/#s=abc'))!, 'import');
    expect(r).toEqual({ opened: false, refused: 'The entries and marks this link shared could not be read' });
    expect(g().notice).toBeNull();
    expect(g().info?.puzzle).toBe(HARD);
  });

  it('reads only the app’s own addresses: sudokui.app, or the host this copy is served from', () => {
    expect(isAppAddress(new URL('https://sudokui.app/#s=abc'), 'localhost:5173')).toBe(true);
    expect(isAppAddress(new URL('https://www.sudokui.app/p/x'), 'localhost:5173')).toBe(true);
    expect(isAppAddress(new URL('http://localhost:5173/daily/2026-11-01'), 'localhost:5173')).toBe(true);
    expect(isAppAddress(new URL('https://example.org/#s=abc'), 'localhost:5173')).toBe(false);
    expect(isAppAddress(new URL('https://notsudokui.app/p/x'), 'localhost:5173')).toBe(false);
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

describe('two windows of the app', () => {
  const KEY = 'sudokui-game-v1';
  // no other window answers unless a test gives one
  afterEach(() => askOthersWith((_keys, answer) => answer(new Set())));
  const savedState = () => JSON.parse(storage.get(KEY)!).state;
  /**
   * The app in another window (a new tab a chat app opened, a Learn page's
   * Practice in a new tab): it starts from the save, does what `fn` does,
   * and its save stays; this window's memory is as it was, and it has not
   * yet heard of that save (its storage event is the test's to give)
   */
  async function inOtherWindow(fn: () => Promise<void> | void): Promise<string> {
    const mine = useGame.getState();
    const before = storage.get(KEY)!;
    useGame.setState({ info: null, custom: false, customBackup: null, setAside: null, won: false, solved: false, history: [], future: [], away: false, ownHere: false, letGo: null, notice: null });
    storage.set(KEY, before);
    await useGame.persist.rehydrate();
    await fn();
    const theirs = storage.get(KEY)!;
    useGame.setState(mine, true);
    storage.set(KEY, theirs);
    return theirs;
  }
  /** what this window writes from here on */
  const writes = () => {
    const spy = vi.spyOn(globalThis.localStorage, 'setItem');
    return () => spy.mock.calls.filter(([k]) => k === KEY).length;
  };

  it('a link’s game played in a new tab is kept by the older tab beside its own, and saved when it is shown again', async () => {
    await startDaily();
    play(3);
    g().setAway(true);
    const theirs = await inOtherWindow(async () => {
      await open(`https://sudokui.app/p/${EASY}/`);
      play(5);
    });
    expect(JSON.parse(theirs).state).toMatchObject({ info: { puzzle: EASY }, setAside: { info: { dailyKey: TODAY } } });
    // the other tab's save, heard here while hidden: this tab keeps its daily, and the link's game too
    takeInSavedGame(theirs, true);
    expect(g().info?.dailyKey).toBe(TODAY);
    expect(entries()).toBe(3);
    expect(g().setAside?.info?.puzzle).toBe(EASY);
    expect(entries(g().setAside!.cells)).toBe(5);
    expect(g().setAside?.hidden).toBeFalsy();
    expect(g().letGo).toBeNull();
    // shown again, it saves both
    g().setAway(false);
    expect(savedState().info.dailyKey).toBe(TODAY);
    expect(entries(savedState().cells)).toBe(3);
    expect(savedState().setAside.info.puzzle).toBe(EASY);
    expect(entries(savedState().setAside.cells)).toBe(5);
    backToKept();
    expect(g().info?.puzzle).toBe(EASY);
    expect(entries()).toBe(5);
    expect(g().setAside?.info?.dailyKey).toBe(TODAY);
  });

  it('a window in front keeps its own board, and the other window’s game under way in its slot', async () => {
    await startDaily();
    play(3);
    const theirs = await inOtherWindow(async () => {
      await open(`https://sudokui.app/p/${EASY}/`);
      play(2);
    });
    takeInSavedGame(theirs, false);
    expect(g().info?.dailyKey).toBe(TODAY);
    expect(g().history).toHaveLength(3);
    expect(g().setAside?.info?.puzzle).toBe(EASY);
    expect(entries(g().setAside!.cells)).toBe(2);
    // its next move saves both
    play(1, 3);
    expect(entries(savedState().cells)).toBe(4);
    expect(entries(savedState().setAside.cells)).toBe(2);
  });

  it('the mirror: moves made on the daily in the older tab reach the copy the newer tab keeps aside', async () => {
    await startDaily();
    play(3);
    await open(`https://sudokui.app/p/${EASY}/`);
    play(5);
    // this is the newer tab now, hidden; the older one is shown and plays on the daily
    g().setAway(true);
    const theirs = await inOtherWindow(() => {
      g().backToSetAside();
      play(2, 3);
    });
    takeInSavedGame(theirs, true);
    expect(g().info?.puzzle).toBe(EASY);
    expect(entries()).toBe(5);
    expect(g().setAside?.info?.dailyKey).toBe(TODAY);
    expect(entries(g().setAside!.cells)).toBe(5);
    g().setAway(false);
    expect(entries(savedState().setAside.cells)).toBe(5);
  });

  it('keeps the game the other window put aside, unless it is the game on its own board', async () => {
    g().startGame(HARD, 1348, 'Hard');
    play(2);
    g().setAway(true);
    // there: a friend's game over the Hard one, then another day's daily
    // over both, nothing played on it: the friend's game is in that slot
    const theirs = await inOtherWindow(async () => {
      await open(`https://sudokui.app/p/${EASY}/`);
      play(3);
      await open(`https://sudokui.app/daily/${OTHER_DAY}`);
    });
    expect(JSON.parse(theirs).state).toMatchObject({ info: { dailyKey: OTHER_DAY }, setAside: { info: { puzzle: EASY } } });
    takeInSavedGame(theirs, true);
    expect(g().info?.puzzle).toBe(HARD);
    expect(g().setAside?.info?.puzzle).toBe(EASY);
    expect(entries(g().setAside!.cells)).toBe(3);
  });

  it('with three games under way, keeps one in the slot by the one-slot rule and says which went', async () => {
    g().startGame(HARD, 1348, 'Hard');
    play(2);
    g().setAway(true);
    const theirs = await inOtherWindow(async () => {
      await open(`https://sudokui.app/p/${EASY}/`);
      play(3);
      await open(`https://sudokui.app/daily/${OTHER_DAY}`);
      play(6);
    });
    takeInSavedGame(theirs, true);
    expect(g().info?.puzzle).toBe(HARD);
    expect(g().setAside?.info?.dailyKey).toBe(OTHER_DAY);
    expect(g().letGo).toBe(`Only one game in progress is kept at a time: your game on a shared puzzle is gone, the daily for ${OTHER_DAY} is kept`);
    // told once: the same save again says nothing more
    g().clearNotice();
    takeInSavedGame(theirs, true);
    expect(g().letGo).toBeNull();
  });

  it('never writes in answer to another window’s save: what it keeps goes into the save with its own next write', async () => {
    await startDaily();
    play(3);
    g().setAway(true);
    const theirs = await inOtherWindow(async () => {
      await open(`https://sudokui.app/p/${EASY}/`);
      play(5);
    });
    const count = writes();
    takeInSavedGame(theirs, true);
    takeInSavedGame(theirs, true);
    const state = JSON.parse(theirs).state;
    takeInSavedGame(JSON.stringify({ state: { ...state, paused: false, elapsedBefore: state.elapsedBefore + 5000 }, version: 0 }), true);
    takeInSavedGame(theirs, false);
    // a move there: the copy kept here is that board, in memory
    const moved = structuredClone(state);
    const cell = moved.cells.findIndex((c: { value: number }) => !c.value);
    moved.cells[cell].value = Number(moved.info.solution[cell]);
    takeInSavedGame(JSON.stringify({ state: moved, version: 0 }), true);
    expect(entries(g().setAside!.cells)).toBe(6);
    // paused there, its clock stands: the time it stood at is kept
    const paused = JSON.stringify({ state: { ...moved, paused: true, elapsedBefore: 90_000 }, version: 0 });
    storage.set(KEY, paused);
    takeInSavedGame(paused, true);
    expect(g().setAside?.elapsedBefore).toBe(90_000);
    // nothing written: the save is still the other window's own
    expect(count()).toBe(0);
    expect(storage.get(KEY)).toBe(paused);
    // shown again, this window's own write carries both
    g().setAway(false);
    expect(count()).toBe(1);
    expect(savedState().info.dailyKey).toBe(TODAY);
    expect(savedState().setAside).toMatchObject({ info: { puzzle: EASY }, elapsedBefore: 90_000 });
    vi.restoreAllMocks();
  });

  it('a tab reloaded while another tab has a game under way comes back to its own game, paused, with the other game kept and no word of a game gone', async () => {
    // tab 1: today's daily, two digits, then hidden (paused)
    await startDaily();
    play(2);
    g().setAway(true);
    // tab 2, from that save: a Learn page's Practice, three digits, then reloaded (the page goes: paused, saved)
    const theirs = await inOtherWindow(async () => {
      g().openOver(() => (g().startGame(HARD, 1348, 'Hard', 'X_WING'), true));
      play(3);
      g().setAway(true);
    });
    expect(JSON.parse(theirs).state).toMatchObject({ info: { practiceTech: 'X_WING' }, paused: true, setAside: { info: { dailyKey: TODAY } } });
    // tab 1 hears that save while hidden: it keeps the practice, and writes nothing
    const count = writes();
    takeInSavedGame(theirs, true);
    expect(g().info?.dailyKey).toBe(TODAY);
    expect(g().setAside?.info?.practiceTech).toBe('X_WING');
    expect(count()).toBe(0);
    vi.restoreAllMocks();
    // tab 2's new page finds its own save, and its address (the practice's puzzle) opens nothing new
    await reload();
    useGame.setState({ away: false });
    await openAppLink(readAppLink(new URL(`https://sudokui.app/p/${HARD}/`))!, 'boot');
    expect(g().info?.practiceTech).toBe('X_WING');
    expect(entries()).toBeGreaterThanOrEqual(3);
    expect(g().paused).toBe(true);
    expect(g().setAside?.info?.dailyKey).toBe(TODAY);
    expect(g().letGo).toBeNull();
  });

  it('a page that boots on another window’s save finds its own game in the slot and brings it back quietly, paused', async () => {
    // this tab: a practice under way; another tab: today's daily, kept with the practice in its slot, saved last
    g().startGame(HARD, 1348, 'Hard', 'X_WING');
    play(3);
    const own = gameKey(g());
    g().setAway(true);
    await inOtherWindow(async () => {
      await startDaily();
      play(2);
    });
    expect(savedState()).toMatchObject({ info: { dailyKey: TODAY }, setAside: { info: { practiceTech: 'X_WING' } } });
    await reload();
    useGame.setState({ away: false, notice: null });
    expect(reclaimOwnGame(own)).toBe(true);
    expect(g().info?.practiceTech).toBe('X_WING');
    expect(entries()).toBe(3);
    expect(g().paused).toBe(true);
    expect(g().practiceTarget).not.toBeNull();
    expect(g().setAside?.info?.dailyKey).toBe(TODAY);
    expect(entries(g().setAside!.cells)).toBe(2);
    expect(g().notice).toBeNull();
    expect(g().letGo).toBeNull();
    // its own game on the board already, or not in the slot: nothing happens
    expect(reclaimOwnGame(own)).toBe(false);
    expect(reclaimOwnGame(null)).toBe(false);
  });

  it('a game solved in the other window is no longer kept here: the older copy goes, with nothing said', async () => {
    g().startGame(HARD, 1348, 'Hard');
    play(2);
    await open(`https://sudokui.app/p/${EASY}/`);
    play(3);
    g().backToSetAside();
    // this window: Hard on the board, Easy (3 digits) in the slot
    expect(g().setAside?.info?.puzzle).toBe(EASY);
    g().setAway(true);
    const theirs = await inOtherWindow(() => {
      g().backToSetAside();
      const { solution } = g().info!;
      for (const [cell, c] of g().cells.entries()) {
        if (c.value) continue;
        g().select([cell], false);
        g().input(Number(solution[cell]));
      }
      expect(g().won).toBe(true);
    });
    takeInSavedGame(theirs, true);
    expect(g().info?.puzzle).toBe(HARD);
    expect(g().setAside).toBeNull();
    expect(g().letGo).toBeNull();
  });

  it('a game let go here that another window still has open is said to be there, not gone; one nobody has is gone', async () => {
    // the hidden window: Easy on its board (two digits), today's daily (three) kept
    await startDaily();
    play(3);
    await open(`https://sudokui.app/p/${EASY}/`);
    play(2);
    g().setAway(true);
    const held = [gameKey(g()), gameKey(g().setAside!)];
    const mine = storage.get(KEY)!;
    // a new tab opens a Hard puzzle over that save: Easy has the less work, and goes from that tab's slot
    askOthersWith((keys, answer) => answer(new Set(keys.filter((k) => held.includes(k)))));
    let line: string | null = null;
    await inOtherWindow(async () => {
      await open(`https://sudokui.app/p/${HARD}/`);
      line = g().letGo;
    });
    expect(line).toBe('Only one game in progress is kept in this tab: your game on a shared puzzle is still open in your other tab, today’s daily is kept here');
    // with nobody holding it (this window closed), it is gone
    askOthersWith((_keys, answer) => answer(new Set()));
    storage.set(KEY, mine);
    await inOtherWindow(async () => {
      await open(`https://sudokui.app/p/${HARD}/`);
      line = g().letGo;
    });
    expect(line).toBe('Only one game in progress is kept at a time: your game on a shared puzzle is gone, today’s daily is kept');
  });

  it('two games let go at once are named in one sentence', async () => {
    // this window: an X-Wing practice (two digits), then a friend's link (one digit) over it; hidden
    g().startGame(HARD, 1348, 'Hard', 'X_WING');
    play(2);
    await open(`https://sudokui.app/p/${EASY}/`);
    play(1);
    g().setAway(true);
    // the other window, from that save: a new Hard game on the same puzzle (three digits), then today's daily (four)
    const theirs = await inOtherWindow(async () => {
      g().startGame(HARD, 1348, 'Hard');
      play(3);
      await startDaily();
      play(4);
    });
    takeInSavedGame(theirs, true);
    expect(g().setAside?.info?.dailyKey).toBe(TODAY);
    expect(g().letGo).toBe('Only one game in progress is kept at a time: your X-Wing practice and your Hard game are gone, today’s daily is kept');
  });

  /** the game on this window's board as it would hand it over (gameStore.ts, heldCopy) */
  const copyOfBoard = () => {
    const s = g();
    return {
      info: s.info,
      cells: structuredClone(s.cells),
      autoCandidates: s.autoCandidates,
      elapsedBefore: s.elapsedMs(),
      won: s.won,
      solved: s.solved,
      assisted: s.assisted,
      markContract: s.markContract,
      practiceTarget: s.practiceTarget,
      practiceFound: s.practiceFound,
      tally: useStats.getState().game
    };
  };

  it('a fresh start of a game another window holds is another game: the hidden window keeps its own board and moves', async () => {
    // this window: a friend's game (four entries) kept, today's daily (three) on the board, hidden
    await open(`https://sudokui.app/p/${EASY}/`);
    play(4);
    await startDaily();
    play(3);
    const daily = gameKey(g());
    g().setAway(true);
    // the other window: a Hard link over that save lets the daily go (still open here), then the Daily button, with no window answering it
    askOthersWith((keys, answer) => answer(new Set(keys.filter((k) => k === daily))));
    let fresh = '';
    const theirs = await inOtherWindow(async () => {
      await open(`https://sudokui.app/p/${HARD}/`);
      expect(g().setAside?.info?.puzzle).toBe(EASY);
      await startDaily();
      expect(g().info?.dailyKey).toBe(TODAY);
      expect(entries()).toBe(0);
      fresh = gameKey(g());
      play(1);
    });
    expect(fresh).not.toBe(daily);
    // heard here while hidden: not the same game, so this window's daily and its moves stay
    takeInSavedGame(theirs, true);
    expect(gameKey(g())).toBe(daily);
    expect(entries()).toBe(3);
    expect(g().history).toHaveLength(3);
    // the one slot keeps the friend's game, with more work than the fresh copy
    expect(g().setAside?.info?.puzzle).toBe(EASY);
    expect(entries(g().setAside!.cells)).toBe(4);
    g().setAway(false);
    expect(savedState().info.dailyKey).toBe(TODAY);
    expect(entries(savedState().cells)).toBe(3);
  });

  it('the Daily button in another window plays on this window’s copy of the day’s daily, the same game, rather than starting a second one', async () => {
    await open(`https://sudokui.app/p/${EASY}/`);
    play(4);
    await startDaily();
    play(3);
    const daily = gameKey(g());
    const copy = copyOfBoard();
    g().setAway(true);
    // this window answers the other's ask, and hands its daily over
    askOthersWith((keys, answer) => answer(new Set(keys.filter((k) => k === daily))));
    fetchOthersWith((want, answer) => answer(want.key === daily || want.dailyKey === TODAY ? (copy as never) : null));
    const theirs = await inOtherWindow(async () => {
      await open(`https://sudokui.app/p/${HARD}/`);
      expect(await startDaily()).toBe('resumed');
      expect(gameKey(g())).toBe(daily);
      expect(entries()).toBe(3);
      expect(g().notice).toBe('Today’s daily, where you left it');
      play(1, 3);
    });
    // the same game: heard while hidden, this window plays on from it
    takeInSavedGame(theirs, true);
    expect(gameKey(g())).toBe(daily);
    expect(entries()).toBe(4);
    expect(g().setAside?.info?.puzzle).toBe(EASY);
    expect(entries(g().setAside!.cells)).toBe(4);
  });

  it('a link to a game let go here while another window had it brings that window’s copy over; a link in a window that let nothing go opens a game of its own', async () => {
    await startDaily();
    play(3);
    await open(`https://sudokui.app/p/${EASY}/`);
    play(2);
    const easy = gameKey(g());
    const copy = copyOfBoard();
    g().setAway(true);
    askOthersWith((keys, answer) => answer(new Set(keys.filter((k) => k === easy))));
    fetchOthersWith((want, answer) => answer(want.key === easy ? (copy as never) : null));
    await inOtherWindow(async () => {
      // Hard over that save: the friend's game goes from the slot, still open here
      await open(`https://sudokui.app/p/${HARD}/`);
      expect(g().setAside?.info?.dailyKey).toBe(TODAY);
      // the friend's link again, in the same tab: the copy this window has comes over
      await open(`https://sudokui.app/p/${EASY}/`, 'tab');
      expect(gameKey(g())).toBe(easy);
      expect(entries()).toBe(2);
      expect(g().notice).toBe('Your game on this puzzle, where you left it');
    });
    // nothing let go: a link asks no window, and opens a game of its own
    forgetLetGo();
    let asked = 0;
    fetchOthersWith((_want, answer) => (asked++, answer(null)));
    g().startGame(HARD, 1348, 'Hard');
    await open(`https://sudokui.app/p/${EASY}/`, 'tab');
    expect(asked).toBe(0);
    expect(gameKey(g())).not.toBe(easy);
  });

  it('a game said to be still open in another window is said to be gone once that window has closed and its last save drops it again', async () => {
    await startDaily();
    play(3);
    await open(`https://sudokui.app/p/${EASY}/`);
    play(2);
    g().setAway(true);
    const held = [gameKey(g()), gameKey(g().setAside!)];
    askOthersWith((keys, answer) => answer(new Set(keys.filter((k) => held.includes(k)))));
    let hard = '';
    let score = 0;
    const theirs = await inOtherWindow(async () => {
      await open(`https://sudokui.app/p/${HARD}/`);
      play(1);
      hard = gameKey(g());
      score = g().info!.score;
    });
    // that window still open: the Hard game is there, named apart from the friend's game on this board
    askOthersWith((keys, answer) => answer(new Set(keys.filter((k) => k === hard))));
    takeInSavedGame(theirs, true);
    expect(g().setAside?.info?.dailyKey).toBe(TODAY);
    expect(g().letGo).toBe(
      `Only one game in progress is kept in this tab: your game on a shared puzzle (HoDoKu rating ${score}) is still open in your other tab, today’s daily is kept here`
    );
    // it closes: its last save (paused there), and it holds nothing any more
    askOthersWith((_keys, answer) => answer(new Set()));
    const last = JSON.parse(theirs);
    last.state.paused = true;
    takeInSavedGame(JSON.stringify(last), true);
    expect(g().letGo).toBe(`Only one game in progress is kept at a time: your game on a shared puzzle (HoDoKu rating ${score}) is gone, today’s daily is kept`);
    // said once
    g().clearNotice();
    takeInSavedGame(JSON.stringify(last), true);
    expect(g().letGo).toBeNull();
  });

  it('moves made in another window on the game behind a puzzle typed here reach that copy, and no second copy of it takes the slot', async () => {
    g().startGame(EASY, 196, 'Easy');
    play(3);
    const early = storage.get(KEY)!;
    g().startCustomEntry();
    g().select([0], false);
    g().input(5);
    g().setAway(true);
    storage.set(KEY, early);
    const theirs = await inOtherWindow(() => play(2, 3));
    takeInSavedGame(theirs, true);
    expect(g().custom).toBe(true);
    expect(entries(g().customBackup!.cells)).toBe(5);
    expect(g().setAside).toBeNull();
    expect(g().letGo).toBeNull();
    g().cancelCustomEntry();
    expect(g().info?.puzzle).toBe(EASY);
    expect(entries()).toBe(5);
  });

  it('a game won in another window replaces the older copy kept here behind a puzzle being typed in: Cancel, or its link, brings it back solved, its solve counted once', async () => {
    let solves = 0;
    useStats.setState({ recordSolve: () => void solves++ } as never);
    const solveIt = () => {
      const { solution } = g().info!;
      for (const [cell, c] of g().cells.entries()) {
        if (c.value) continue;
        g().select([cell], false);
        g().input(Number(solution[cell]));
      }
      expect(g().won).toBe(true);
    };
    // on the board: a friend's game, three entries, then a puzzle typed over it; the other window had the game too
    g().startGame(EASY, 196, 'Easy');
    play(3);
    const early = storage.get(KEY)!;
    g().startCustomEntry();
    g().setAway(true);
    storage.set(KEY, early);
    const theirs = await inOtherWindow(solveIt);
    expect(solves).toBe(1);
    takeInSavedGame(theirs, true);
    expect(g().custom).toBe(true);
    expect(g().customBackup?.won).toBe(true);
    g().cancelCustomEntry();
    expect(g().info?.puzzle).toBe(EASY);
    expect(g().won).toBe(true);
    expect(g().solved).toBe(true);
    expect(solves).toBe(1);

    // in the slot: the typed puzzle (with a digit) set aside by a link, the friend's game behind it
    solves = 0;
    useGame.setState({ setAside: null, away: false });
    g().startGame(EASY, 196, 'Easy');
    play(3);
    const before = storage.get(KEY)!;
    g().startCustomEntry();
    g().select([0], false);
    g().input(5);
    await open(`https://sudokui.app/p/${HARD}/`);
    expect(g().setAside?.custom).toBe(true);
    g().setAway(true);
    const mine = storage.get(KEY)!;
    storage.set(KEY, before);
    const solvedThere = await inOtherWindow(solveIt);
    storage.set(KEY, mine);
    takeInSavedGame(solvedThere, true);
    expect(g().setAside?.custom).toBe(true);
    expect(g().setAside?.customBackup?.won).toBe(true);
    useGame.setState({ away: false });
    await open(`https://sudokui.app/p/${EASY}/`, 'tab');
    expect(g().info?.puzzle).toBe(EASY);
    expect(g().won).toBe(true);
    expect(solves).toBe(1);
  });

  it('two games of the same name are told apart by their rating', () => {
    const game = (puzzle: string, score: number) =>
      ({ info: { puzzle, solution: '', score, level: 'Hard', practiceTech: null }, cells: [], autoCandidates: false, elapsedBefore: 0, won: false }) as never;
    expect(letGoLine([game(HARD, 1348)], [], game(EASY, 1290))).toBe(
      'Only one game in progress is kept at a time: your Hard game (HoDoKu rating 1348) is gone, your Hard game (HoDoKu rating 1290) is kept'
    );
    expect(letGoLine([game(HARD, 1348)], [game(EASY, 1290)], { ...(game('x', 900) as object), info: { puzzle: 'x', solution: '', score: 900, level: 'Medium', practiceTech: null } } as never)).toBe(
      'Only one game in progress is kept at a time: your Hard game (HoDoKu rating 1348) is gone, your Medium game is kept. Only one game in progress is kept in this tab: your Hard game (HoDoKu rating 1290) is still open in your other tab, your Medium game is kept here.'
    );
  });

  it('a game just won here, its win screen still up, is not given up while hidden; put away, it is', async () => {
    g().startGame(EASY, 196, 'Easy');
    play(81);
    expect(g().won).toBe(true);
    expect(g().ownHere).toBe(true);
    g().setAway(true);
    const theirs = await inOtherWindow(async () => {
      await open(`https://sudokui.app/p/${HARD}/`);
      play(2);
    });
    takeInSavedGame(theirs, true);
    expect(g().info?.puzzle).toBe(EASY);
    expect(g().won).toBe(true);
    expect(g().setAside?.info?.puzzle).toBe(HARD);
    // the win screen put away (src/ui/App.tsx): the other window's next save comes in
    useGame.setState({ ownHere: false });
    storage.set(KEY, theirs);
    takeInSavedGame(theirs, true);
    expect(g().info?.puzzle).toBe(HARD);
    expect(entries()).toBe(2);
    expect(g().setAside).toBeNull();
  });

  it('a link opened here and not yet played is not given up while hidden; after a reload it is', async () => {
    await open(`https://sudokui.app/p/${EASY}/`);
    expect(g().ownHere).toBe(true);
    expect(underWay(g())).toBe(false);
    g().setAway(true);
    const theirs = await inOtherWindow(async () => {
      g().startGame(HARD, 1348, 'Hard');
      play(2);
    });
    takeInSavedGame(theirs, true);
    expect(g().info?.puzzle).toBe(EASY);
    expect(g().setAside?.info?.puzzle).toBe(HARD);
    // in memory only: a reload is a page of its own
    const mine = storage.get(KEY)!;
    await reload();
    expect(g().ownHere).toBe(false);
    expect(JSON.parse(mine).state.ownHere).toBeUndefined();
  });
});
