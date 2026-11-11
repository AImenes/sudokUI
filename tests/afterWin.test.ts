/**
 * A solved game, and the clock (the hunt of November 2026). Once a puzzle
 * is solved its solve is recorded as it was played: Check, Steps, Scan and
 * Auto candidates afterwards study the board, they do not make the solve
 * assisted, hide the daily's Send or change the win screen's words. Undo of
 * the winning digit, or a Steps jump off a solved board, puts the board
 * back in play, the clock going on from the winning time, and solving it
 * again is the same solve, recorded once. A daily solved again keeps its
 * first solve as the day's result, unless that one had help and the new
 * one had none. And the clock is saved when it matters: a pause comes back
 * after a reload, and the time the page is hidden does not count
 * (src/state/gameStore.ts, setAway; src/ui/App.tsx).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k)
};

/** every result sent, and the server's answer */
let posts: any[] = [];
(globalThis as any).fetch = async (_url: string, init?: RequestInit) => {
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  if (init?.method === 'POST') posts.push(body);
  const stats = { no: body?.no ?? 0, count: 3, median: 600, histogram: [[40, 3]] };
  return new Response(JSON.stringify({ ok: true, accepted: true, stats }), { status: 200, headers: { 'content-type': 'application/json' } });
};

const { useGame, dailyResultOf, keptResultOf, solvePath } = await import('../src/state/gameStore');
const { useDailyStats } = await import('../src/state/dailyStats');
const { useSettings } = await import('../src/state/settings');
const { useStats } = await import('../src/state/stats');
const { useTelemetry } = await import('../src/state/telemetry');
const { dailyNumber, dailyDate, localDateKey } = await import('../src/content/dailies');

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';
const EMPTY = [...EASY].map((ch, i) => (ch === '.' ? i : -1)).filter((i) => i >= 0);
const LAST = EMPTY[EMPTY.length - 1];

const play = (cell: number, digit: number) => {
  useGame.getState().select([cell], false);
  useGame.getState().input(digit);
};
const solution = () => useGame.getState().info!.solution;
/** every empty cell filled, a second apart: the puzzle solved */
const solveAll = () => {
  for (const cell of EMPTY) {
    vi.advanceTimersByTime(1000);
    play(cell, Number(solution()[cell]));
  }
  expect(useGame.getState().won).toBe(true);
};
const settle = () => new Promise((resolve) => queueMicrotask(() => queueMicrotask(() => resolve(null))));
/** a reload: the page starts again from only what was saved */
const reload = async () => {
  const saved = storage.get('sudokui-game-v1')!;
  useGame.setState({ info: null, solved: false, won: false, paused: false, away: false, elapsedBefore: 0, history: [], future: [] });
  storage.set('sudokui-game-v1', saved);
  await useGame.persist.rehydrate();
};
const saved = () => JSON.parse(storage.get('sudokui-game-v1')!).state;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(new Date(2026, 10, 11, 12, 0, 0));
  storage.clear();
  posts = [];
  useSettings.setState({ autoSendDaily: false, dontCount: true, confirmAssist: true });
  useTelemetry.setState({ track: () => {} } as never);
  useStats.setState({ bands: {}, dailyDays: [] });
  useDailyStats.setState({ tokens: {}, submitted: {}, pending: {}, stats: {}, played: {}, inFlight: {} });
  useGame.setState({ info: null, counted: false, solved: false, won: false, paused: false, away: false, history: [], future: [] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('a solved board', () => {
  it('keeps its solve unassisted when Check, Steps, Scan or Auto candidates are used on it', () => {
    useGame.getState().startGame(EASY, 196, 'Easy');
    solveAll();
    const g = useGame.getState();
    expect(g.assisted).toBe(false);
    g.check();
    expect(useGame.getState().assisted).toBe(false);
    expect(useGame.getState().errors).toEqual([]);
    // Steps opening, and Scan, mark the game they help with; this one is done
    g.markAssisted();
    g.showStep(solvePath(EASY)[0]);
    expect(useGame.getState().assisted).toBe(false);
    // Auto candidates has nothing to show on a solved board: it stays as it was, and so do the win screen's words
    g.toggleAutoCandidates();
    expect(useGame.getState().autoCandidates).toBe(false);
    expect(useGame.getState().assisted).toBe(false);
    // Hint, Chain and Fill did nothing on it before, and still do nothing
    g.requestHint();
    g.startChain();
    g.fillCandidates();
    expect(useGame.getState().assisted).toBe(false);
    expect(useGame.getState().won).toBe(true);
  });

  it('keeps a daily’s result unassisted, and its Send, after Check and Steps', () => {
    const no = dailyNumber(localDateKey())!;
    useGame.getState().startGame(EASY, 196, 'Easy', null, dailyDate(no));
    useGame.setState((s) => ({ info: s.info && { ...s.info, dailyNo: no } }));
    solveAll();
    useGame.getState().check();
    useGame.getState().markAssisted();
    expect(dailyResultOf(useGame.getState())?.unassisted).toBe(true);
    expect(useDailyStats.getState().played[no].assisted).toBe(false);
  });

  it('takes Check, Steps and Auto as help again once Undo has put it back in play', () => {
    useGame.getState().startGame(EASY, 196, 'Easy');
    solveAll();
    useGame.getState().undo();
    useGame.getState().check();
    expect(useGame.getState().assisted).toBe(true);
  });
});

describe('Undo or a Steps jump off a solved board', () => {
  it('Undo puts the board back in play, the clock going on from the winning time; solved again, it is recorded once', () => {
    useGame.getState().startGame(EASY, 196, 'Easy');
    solveAll();
    const winMs = useGame.getState().elapsedMs();
    expect(useStats.getState().bands.Easy?.solves).toBe(1);
    vi.advanceTimersByTime(5000);
    useGame.getState().undo();
    const g = useGame.getState();
    expect(g.won).toBe(false);
    expect(g.paused).toBe(false);
    expect(g.elapsedMs()).toBe(winMs);
    vi.advanceTimersByTime(2000);
    expect(useGame.getState().elapsedMs()).toBe(winMs + 2000);
    // the digit goes in again: no pause card, nothing refused
    play(LAST, Number(solution()[LAST]));
    expect(useGame.getState().cells[LAST].value).toBe(Number(solution()[LAST]));
    expect(useGame.getState().won).toBe(true);
    expect(useGame.getState().paused).toBe(true);
    expect(useStats.getState().bands.Easy?.solves).toBe(1);
  });

  it('a Steps jump puts the board back in play too, and its digits go in', () => {
    useGame.getState().startGame(EASY, 196, 'Easy');
    solveAll();
    useGame.getState().jumpToStep(3);
    const g = useGame.getState();
    expect(g.won).toBe(false);
    expect(g.paused).toBe(false);
    const open = g.cells.findIndex((c) => !c.value);
    play(open, Number(solution()[open]));
    expect(useGame.getState().cells[open].value).toBe(Number(solution()[open]));
  });

  it('Undo of a jump made on the solved board brings it back solved, as it was played: stopped, unassisted, recorded once', () => {
    useGame.getState().startGame(EASY, 196, 'Easy');
    solveAll();
    const winMs = useGame.getState().elapsedMs();
    useGame.getState().jumpToStep(3);
    expect(useGame.getState().assisted).toBe(true);
    vi.advanceTimersByTime(30_000);
    useGame.getState().undo();
    const g = useGame.getState();
    expect(g.cells.every((c, i) => c.value === Number(solution()[i]))).toBe(true);
    expect(g.won).toBe(true);
    expect(g.paused).toBe(true);
    expect(g.assisted).toBe(false);
    // the clock stands still at the time it stood when the board came back
    const back = g.elapsedMs();
    expect(back).toBe(winMs + 30_000);
    vi.advanceTimersByTime(30_000);
    expect(useGame.getState().elapsedMs()).toBe(back);
    expect(useStats.getState().bands.Easy?.solves).toBe(1);
    // and Redo goes to the jump again, with its help
    useGame.getState().redo();
    expect(useGame.getState().won).toBe(false);
    expect(useGame.getState().assisted).toBe(true);
    useGame.getState().undo();
    expect(useGame.getState().won).toBe(true);
    expect(useGame.getState().assisted).toBe(false);
  });

  it('a pause the player chose before a jump stays theirs', () => {
    useGame.getState().startGame(EASY, 196, 'Easy');
    play(EMPTY[0], Number(solution()[EMPTY[0]]));
    useGame.getState().togglePause();
    useGame.getState().undo();
    expect(useGame.getState().paused).toBe(true);
  });
});

describe('a daily solved again', () => {
  const no = dailyNumber(localDateKey())!;
  const startDaily = () => {
    useGame.getState().startGame(EASY, 196, 'Easy', null, dailyDate(no));
    useGame.setState((s) => ({ info: s.info && { ...s.info, dailyNo: no } }));
  };

  it('keeps the first solve as the day’s result, never sends the replay’s time, and counts the day once in the streak', async () => {
    // the first solve, with the switch off: kept, not sent
    startDaily();
    solveAll();
    const first = useDailyStats.getState().played[no];
    expect(first.assisted).toBe(false);
    // Restart: a new game, solved again, slower, with the switch on now
    useSettings.setState({ autoSendDaily: true });
    vi.advanceTimersByTime(60_000);
    useGame.getState().restart();
    vi.advanceTimersByTime(30_000);
    solveAll();
    await settle();
    expect(useGame.getState().won).toBe(true);
    expect(Math.floor(useGame.getState().elapsedMs() / 1000)).not.toBe(first.seconds);
    expect(useDailyStats.getState().played[no]).toEqual(first);
    // the first solve's time had never gone in: the switch sends it, as Send would
    expect(posts.map((p) => [p.seconds, p.unassisted, p.grid])).toEqual([[first.seconds, true, solution()]]);
    // the band record counts a second game, the streak the day once
    expect(useStats.getState().bands.Easy?.solves).toBe(2);
    expect(useStats.getState().dailyDays).toEqual([dailyDate(no)]);
  });

  it('a first solve never sent can still be sent once from the replay’s win screen, its own time', async () => {
    startDaily();
    solveAll();
    const first = useDailyStats.getState().played[no];
    useGame.getState().restart();
    vi.advanceTimersByTime(20_000);
    solveAll();
    await settle();
    // the switch off: nothing goes by itself
    expect(posts).toEqual([]);
    // what the win screen's Send sends for it (VictoryDialog)
    const result = keptResultOf(no, useDailyStats.getState().played[no], solution());
    expect(result).toEqual({ no, grid: solution(), seconds: first.seconds, hints: 0, unassisted: true });
    expect(await useDailyStats.getState().submit(result!)).toBe('accepted');
    expect(useDailyStats.getState().submitted[no]).toBe(first.seconds);
    expect(posts.map((p) => p.seconds)).toEqual([first.seconds]);
    // a solve with help kept has nothing to send
    expect(keptResultOf(no, { ...first, assisted: true }, solution())).toBeNull();
  });

  it('an assisted replay sends nothing by itself, the switch on', async () => {
    startDaily();
    solveAll();
    useSettings.setState({ autoSendDaily: true });
    useGame.getState().restart();
    useGame.getState().markAssisted();
    solveAll();
    await settle();
    expect(posts).toEqual([]);
  });

  it('takes an unassisted replay in place of a first solve with help, which never went in', async () => {
    startDaily();
    useGame.getState().markAssisted();
    solveAll();
    expect(useDailyStats.getState().played[no].assisted).toBe(true);
    useSettings.setState({ autoSendDaily: true });
    useGame.getState().restart();
    solveAll();
    await settle();
    const kept = useDailyStats.getState().played[no];
    expect(kept.assisted).toBe(false);
    expect(kept.seconds).toBe(Math.floor(useGame.getState().elapsedMs() / 1000));
    expect(posts.map((p) => p.seconds)).toEqual([kept.seconds]);
  });

  it('never replaces the time sent: a replay after a sent time sends nothing', async () => {
    startDaily();
    solveAll();
    await useDailyStats.getState().submit(dailyResultOf(useGame.getState())!);
    const sent = useDailyStats.getState().submitted[no];
    useSettings.setState({ autoSendDaily: true });
    useGame.getState().restart();
    solveAll();
    await settle();
    expect(posts).toHaveLength(1);
    expect(useDailyStats.getState().submitted[no]).toBe(sent);
  });
});

describe('a game another window saved', () => {
  /** the save another window wrote: this game with four more digits on it */
  const otherWindowPlayed = () => {
    const other = saved();
    for (const cell of EMPTY.slice(0, 4)) other.cells[cell].value = Number(solution()[cell]);
    storage.set('sudokui-game-v1', JSON.stringify({ state: other, version: 0 }));
  };
  const filled = () => useGame.getState().cells.filter((c) => c.value).length;
  const GIVENS = 81 - EMPTY.length;

  it('comes in without this window’s undo steps, hint or Check marks', async () => {
    useGame.getState().startGame(EASY, 196, 'Easy');
    play(EMPTY[0], Number(solution()[EMPTY[0]]));
    useGame.setState({ errors: [3] });
    otherWindowPlayed();
    await useGame.persist.rehydrate();
    const g = useGame.getState();
    expect(filled()).toBe(GIVENS + 4);
    expect(g.history).toEqual([]);
    expect(g.future).toEqual([]);
    expect(g.errors).toEqual([]);
    expect(g.hint).toBeNull();
    // Undo cannot bring back this window's older board
    useGame.getState().undo();
    expect(filled()).toBe(GIVENS + 4);
  });

  it('is not counted again as begun: the window that played it counted it', async () => {
    let started = 0;
    useSettings.setState({ dontCount: false });
    useTelemetry.setState({ track: (kind: string) => void (kind === 'started' && started++) } as never);
    // this window opened the puzzle and never played it
    useGame.getState().startGame(EASY, 196, 'Easy');
    otherWindowPlayed();
    await useGame.persist.rehydrate();
    expect(filled()).toBe(GIVENS + 4);
    expect(useGame.getState().counted).toBe(true);
    play(EMPTY[4], Number(solution()[EMPTY[4]]));
    expect(started).toBe(0);
  });
});

describe('the clock', () => {
  it('is saved with a pause, and a paused game comes back paused at its time', async () => {
    useGame.getState().startGame(EASY, 196, 'Easy');
    play(EMPTY[0], Number(solution()[EMPTY[0]]));
    vi.advanceTimersByTime(7000);
    useGame.getState().togglePause();
    const at = useGame.getState().elapsedMs();
    expect(saved().paused).toBe(true);
    expect(saved().elapsedBefore).toBe(at);
    vi.advanceTimersByTime(60_000);
    await reload();
    expect(useGame.getState().paused).toBe(true);
    expect(useGame.getState().elapsedMs()).toBe(at);
    vi.advanceTimersByTime(5000);
    expect(useGame.getState().elapsedMs()).toBe(at);
  });

  it('a game running when the page went comes back running, as before', async () => {
    useGame.getState().startGame(EASY, 196, 'Easy');
    play(EMPTY[0], Number(solution()[EMPTY[0]]));
    await reload();
    expect(useGame.getState().paused).toBe(false);
  });

  it('stops while the page is hidden, saved as it stood, and runs on when it is shown again', async () => {
    useGame.getState().startGame(EASY, 196, 'Easy');
    play(EMPTY[0], Number(solution()[EMPTY[0]]));
    // ten seconds of thinking, no move: the save still holds the last move's time
    vi.advanceTimersByTime(10_000);
    expect(saved().elapsedBefore).toBeLessThan(10_000);
    const before = useGame.getState().elapsedMs();
    useGame.getState().setAway(true);
    expect(saved().elapsedBefore).toBe(before);
    // not the player's pause: no pause card, and it is not saved as one
    expect(useGame.getState().paused).toBe(false);
    expect(saved().paused).toBe(false);
    vi.advanceTimersByTime(600_000);
    expect(useGame.getState().elapsedMs()).toBe(before);
    useGame.getState().setAway(false);
    vi.advanceTimersByTime(3000);
    expect(useGame.getState().elapsedMs()).toBe(before + 3000);
  });

  it('a page the system closed while hidden (or a reload) comes back at the time it stood, running', async () => {
    useGame.getState().startGame(EASY, 196, 'Easy');
    play(EMPTY[0], Number(solution()[EMPTY[0]]));
    vi.advanceTimersByTime(15_000);
    const before = useGame.getState().elapsedMs();
    useGame.getState().setAway(true);
    vi.advanceTimersByTime(3_600_000);
    await reload();
    expect(useGame.getState().paused).toBe(false);
    expect(useGame.getState().elapsedMs()).toBe(before);
    vi.advanceTimersByTime(2000);
    expect(useGame.getState().elapsedMs()).toBe(before + 2000);
  });

  it('a pause taken while the page is hidden, or a solve, is kept as it is', () => {
    useGame.getState().startGame(EASY, 196, 'Easy');
    play(EMPTY[0], Number(solution()[EMPTY[0]]));
    useGame.getState().togglePause();
    const paused = useGame.getState().elapsedMs();
    useGame.getState().setAway(true);
    useGame.getState().setAway(false);
    vi.advanceTimersByTime(5000);
    expect(useGame.getState().paused).toBe(true);
    expect(useGame.getState().elapsedMs()).toBe(paused);
    useGame.getState().togglePause();
    for (const cell of EMPTY.slice(1)) play(cell, Number(solution()[cell]));
    expect(useGame.getState().won).toBe(true);
    const won = useGame.getState().elapsedMs();
    useGame.getState().setAway(true);
    useGame.getState().setAway(false);
    vi.advanceTimersByTime(5000);
    expect(useGame.getState().elapsedMs()).toBe(won);
  });
});
