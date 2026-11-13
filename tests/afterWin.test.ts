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
 * after a reload, the time the page is hidden does not count, and a game
 * under way pauses then (src/state/gameStore.ts, setAway; src/ui/App.tsx).
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

const { useGame, dailyResultOf, keptResultOf, solvePath, underWay, encodePosition } = await import('../src/state/gameStore');
const { useDailyStats } = await import('../src/state/dailyStats');
const { useSettings } = await import('../src/state/settings');
const { useStats } = await import('../src/state/stats');
const { useTelemetry } = await import('../src/state/telemetry');
const { dailyNumber, dailyDate, localDateKey } = await import('../src/content/dailies');

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';
const EMPTY = [...EASY].map((ch, i) => (ch === '.' ? i : -1)).filter((i) => i >= 0);
const LAST = EMPTY[EMPTY.length - 1];
const OTHER_PUZZLE = '8..6.2.5....89..6.67...5.......4.1.9.1.5.8.3.3.4.2.......7...92.3..89....9.2.4..6';
/** a Hard puzzle whose path meets an X-Wing, for a fast-forwarded practice */
const PRACTICE = '...6..9.1..95....4....4985..241....5....3....9....546..7549....3....12..1.2..3...';

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
    // the same solve, with the one time it was recorded with
    expect(useGame.getState().elapsedMs()).toBe(winMs);
    // and so by Undo and Redo of the winning digit
    useGame.getState().undo();
    vi.advanceTimersByTime(4000);
    useGame.getState().redo();
    expect(useGame.getState().won).toBe(true);
    expect(useGame.getState().elapsedMs()).toBe(winMs);
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
    // the clock stands at the solve's own time, not the time spent on the jump
    expect(g.elapsedMs()).toBe(winMs);
    vi.advanceTimersByTime(30_000);
    expect(useGame.getState().elapsedMs()).toBe(winMs);
    expect(useStats.getState().bands.Easy?.solves).toBe(1);
    // and Redo goes to the jump again, with its help
    useGame.getState().redo();
    expect(useGame.getState().won).toBe(false);
    expect(useGame.getState().assisted).toBe(true);
    useGame.getState().undo();
    expect(useGame.getState().won).toBe(true);
    expect(useGame.getState().assisted).toBe(false);
    expect(useGame.getState().elapsedMs()).toBe(winMs);
  });

  it('Redo of the jump after its Undo leaves a board to play on, not a pause card, the clock going on from the winning time', () => {
    useGame.getState().startGame(EASY, 196, 'Easy');
    solveAll();
    const winMs = useGame.getState().elapsedMs();
    useGame.getState().jumpToStep(3);
    useGame.getState().undo();
    expect(useGame.getState().paused).toBe(true);
    vi.advanceTimersByTime(10_000);
    useGame.getState().redo();
    const g = useGame.getState();
    expect(g.won).toBe(false);
    expect(g.paused).toBe(false);
    expect(g.elapsedMs()).toBe(winMs);
    vi.advanceTimersByTime(2000);
    expect(useGame.getState().elapsedMs()).toBe(winMs + 2000);
    const open = g.cells.findIndex((c) => !c.value);
    play(open, Number(solution()[open]));
    expect(useGame.getState().cells[open].value).toBe(Number(solution()[open]));
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
  // the day the clock is set to (beforeEach), not the day the tests run:
  // a daily of a later day is still to come, and sends nothing (countedWhen)
  const no = dailyNumber('2026-11-11')!;
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

  it('a solve undone and solved again is still the day’s own: its time is the one kept, and its win screen names no solve before', async () => {
    startDaily();
    solveAll();
    const first = useDailyStats.getState().played[no];
    expect(useGame.getState().dailyKept).toBe(true);
    // Steps, a jump, a while on it, then Ctrl+Z as its notice offers
    useGame.getState().jumpToStep(3);
    vi.advanceTimersByTime(6000);
    useGame.getState().undo();
    expect(useGame.getState().won).toBe(true);
    expect(Math.floor(useGame.getState().elapsedMs() / 1000)).toBe(first.seconds);
    expect(dailyResultOf(useGame.getState())?.seconds).toBe(first.seconds);
    // across a reload too
    await reload();
    expect(useGame.getState().dailyKept).toBe(true);
    expect(Math.floor(useGame.getState().elapsedMs() / 1000)).toBe(first.seconds);
    // a replay is not the day's own
    useGame.getState().restart();
    expect(useGame.getState().dailyKept).toBe(false);
    solveAll();
    expect(useGame.getState().dailyKept).toBe(false);
    expect(useDailyStats.getState().played[no]).toEqual(first);
  });

  it('a Steps jump on the solved daily, played on to the end, is still its own unassisted solve: unassisted, its time, sendable, across a reload and Back to it', async () => {
    startDaily();
    solveAll();
    const first = useDailyStats.getState().played[no];
    expect(useGame.getState().solvedAssisted).toBe(false);
    // Steps, a jump into the path (help, on the board it sets), a while
    // on it, and the rest of the board filled from there
    useGame.getState().jumpToStep(3);
    expect(useGame.getState().assisted).toBe(true);
    vi.advanceTimersByTime(20_000);
    for (const [cell, c] of useGame.getState().cells.entries()) if (!c.value) play(cell, Number(solution()[cell]));
    let g = useGame.getState();
    expect(g.won).toBe(true);
    // the same solve: its time, its help, and the day's own
    expect(g.assisted).toBe(false);
    expect(Math.floor(g.elapsedMs() / 1000)).toBe(first.seconds);
    expect(g.dailyKept).toBe(true);
    expect(dailyResultOf(g)).toMatchObject({ seconds: first.seconds, unassisted: true });
    expect(useDailyStats.getState().played[no]).toEqual(first);
    expect(useStats.getState().bands.Easy?.solves).toBe(1);
    await reload();
    g = useGame.getState();
    expect(g.assisted).toBe(false);
    expect(dailyResultOf(g)).toMatchObject({ seconds: first.seconds, unassisted: true });
    // put back in play again and kept aside while another game opens:
    // back on the board and solved, still that solve
    useGame.getState().jumpToStep(3);
    vi.advanceTimersByTime(5000);
    const daily = useGame.getState().info;
    useGame.getState().openOver(() => (useGame.getState().startGame(OTHER_PUZZLE, 1000, 'Medium'), true));
    expect(useGame.getState().setAside?.info).toEqual(daily);
    const free = useGame.getState().cells.findIndex((c) => !c.value);
    play(free, Number(solution()[free]));
    useGame.getState().backToSetAside();
    expect(useGame.getState().info).toEqual(daily);
    for (const [cell, c] of useGame.getState().cells.entries()) if (!c.value) play(cell, Number(solution()[cell]));
    g = useGame.getState();
    expect(g.won).toBe(true);
    expect(g.assisted).toBe(false);
    expect(g.dailyKept).toBe(true);
    expect(Math.floor(g.elapsedMs() / 1000)).toBe(first.seconds);
  });

  it('a solve undone and solved again with a hint sends its own solve: no hint, unassisted, and the hint goes in no tally', async () => {
    startDaily();
    solveAll();
    const first = useDailyStats.getState().played[no];
    expect(first.assisted).toBe(false);
    const tally = useStats.getState().game;
    // Undo of the last digit, then a hint that places it
    useGame.getState().undo();
    useGame.getState().requestHint();
    expect(useGame.getState().hint).not.toBeNull();
    useGame.getState().applyHint();
    let g = useGame.getState();
    expect(g.won).toBe(true);
    expect(g.assisted).toBe(false);
    // the board solved again took nothing from the hint: the solve's tally
    expect(useStats.getState().game).toEqual(tally);
    expect(dailyResultOf(g)).toMatchObject({ seconds: first.seconds, hints: 0, unassisted: true });
    await reload();
    g = useGame.getState();
    expect(dailyResultOf(g)).toMatchObject({ seconds: first.seconds, hints: 0, unassisted: true });
    expect(await useDailyStats.getState().submit(dailyResultOf(g)!)).toBe('accepted');
    expect(posts.map((p) => [p.seconds, p.hints, p.unassisted])).toEqual([[first.seconds, 0, true]]);
  });

  it('a Steps jump on the solved daily played to the end keeps the solve’s own marks for its verdict, and its moves and slips are no new work', async () => {
    startDaily();
    solveAll();
    let g = useGame.getState();
    expect(g.autoCandidates).toBe(false);
    expect(g.solvedAuto).toBe(false);
    const tally = useStats.getState().game;
    useGame.getState().jumpToStep(3);
    expect(useGame.getState().autoCandidates).toBe(true);
    // a slip on the board put back in play counts as no error of the solve
    const open = useGame.getState().cells.findIndex((c) => !c.value);
    const wrong = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((d) => d !== Number(solution()[open]))!;
    play(open, wrong);
    for (const [cell, c] of useGame.getState().cells.entries()) if (!c.given && c.value !== Number(solution()[cell])) play(cell, Number(solution()[cell]));
    g = useGame.getState();
    expect(g.won).toBe(true);
    expect(g.autoCandidates).toBe(true);
    // the solve was made with the player's own marks
    expect(g.solvedAuto).toBe(false);
    expect(useStats.getState().game).toEqual(tally);
    await reload();
    expect(useGame.getState().solvedAuto).toBe(false);
    // and so after Back to it from the slot
    useGame.getState().jumpToStep(3);
    useGame.getState().openOver(() => (useGame.getState().startGame(OTHER_PUZZLE, 1000, 'Medium'), true));
    expect(useGame.getState().setAside?.solvedAuto).toBe(false);
    useGame.getState().backToSetAside();
    expect(useGame.getState().solvedAuto).toBe(false);
  });

  it('a solve with help stays one with help when it is solved again', () => {
    startDaily();
    useGame.getState().markAssisted();
    solveAll();
    useGame.getState().undo();
    play(LAST, Number(solution()[LAST]));
    expect(useGame.getState().won).toBe(true);
    expect(useGame.getState().assisted).toBe(true);
    expect(dailyResultOf(useGame.getState())?.unassisted).toBe(false);
  });

  it('a won game saved before the solve’s time was kept has it at its saved time, and says nothing of being the day’s own', async () => {
    startDaily();
    solveAll();
    const winMs = useGame.getState().elapsedMs();
    const old = saved();
    delete old.solvedMs;
    delete old.dailyKept;
    storage.set('sudokui-game-v1', JSON.stringify({ state: old, version: 0 }));
    await reload();
    expect(useGame.getState().solvedMs).toBe(winMs);
    // the win screen tells it by its time, as before (VictoryDialog)
    expect(useGame.getState().dailyKept).toBeUndefined();
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

describe('a game read from the save again, as another page played it (src/main.tsx: the play taken back before this page acted)', () => {
  /** the save another page wrote: this game with four more digits on it */
  const otherWindowPlayed = () => {
    const other = saved();
    for (const cell of EMPTY.slice(0, 4)) other.cells[cell].value = Number(solution()[cell]);
    storage.set('sudokui-game-v1', JSON.stringify({ state: other, version: 0 }));
  };
  const filled = () => useGame.getState().cells.filter((c) => c.value).length;
  const GIVENS = 81 - EMPTY.length;

  it('comes in without this page’s undo steps, hint or Check marks', async () => {
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
    // Undo cannot bring back this page's older board
    useGame.getState().undo();
    expect(filled()).toBe(GIVENS + 4);
  });

  it('is not counted again as begun: the page that played it counted it', async () => {
    let started = 0;
    useSettings.setState({ dontCount: false });
    useTelemetry.setState({ track: (kind: string) => void (kind === 'started' && started++) } as never);
    // this page opened the puzzle and never played it
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

  it('a game under way pauses when the page is hidden, saved paused as it stood, and comes back behind the pause card', async () => {
    useGame.getState().startGame(EASY, 196, 'Easy');
    play(EMPTY[0], Number(solution()[EMPTY[0]]));
    // ten seconds of thinking, no move: the save still holds the last move's time
    vi.advanceTimersByTime(10_000);
    expect(saved().elapsedBefore).toBeLessThan(10_000);
    const before = useGame.getState().elapsedMs();
    useGame.getState().setAway(true);
    expect(saved().elapsedBefore).toBe(before);
    // the player's own pause: the pause card, and saved as one
    expect(useGame.getState().paused).toBe(true);
    expect(saved().paused).toBe(true);
    vi.advanceTimersByTime(600_000);
    expect(useGame.getState().elapsedMs()).toBe(before);
    // shown again: still paused, the clock still, until the player resumes
    useGame.getState().setAway(false);
    vi.advanceTimersByTime(3000);
    expect(useGame.getState().paused).toBe(true);
    expect(useGame.getState().elapsedMs()).toBe(before);
    useGame.getState().togglePause();
    vi.advanceTimersByTime(3000);
    expect(useGame.getState().elapsedMs()).toBe(before + 3000);
  });

  it('a page the system closed while hidden (or a reload) comes back paused at the time it stood', async () => {
    useGame.getState().startGame(EASY, 196, 'Easy');
    play(EMPTY[0], Number(solution()[EMPTY[0]]));
    vi.advanceTimersByTime(15_000);
    const before = useGame.getState().elapsedMs();
    useGame.getState().setAway(true);
    vi.advanceTimersByTime(3_600_000);
    await reload();
    expect(useGame.getState().paused).toBe(true);
    expect(useGame.getState().elapsedMs()).toBe(before);
    useGame.getState().togglePause();
    vi.advanceTimersByTime(2000);
    expect(useGame.getState().elapsedMs()).toBe(before + 2000);
  });

  it('a game not yet played on only stands still while the page is hidden, and runs on when shown', () => {
    useGame.getState().startGame(EASY, 196, 'Easy');
    vi.advanceTimersByTime(4000);
    const before = useGame.getState().elapsedMs();
    useGame.getState().setAway(true);
    expect(useGame.getState().paused).toBe(false);
    expect(saved().paused).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(useGame.getState().elapsedMs()).toBe(before);
    useGame.getState().setAway(false);
    vi.advanceTimersByTime(2000);
    expect(useGame.getState().elapsedMs()).toBe(before + 2000);
  });

  /** hidden, then shown: whether the game came back paused, and its clock stood still while away */
  const awayAndBack = () => {
    const before = useGame.getState().elapsedMs();
    useGame.getState().setAway(true);
    const paused = useGame.getState().paused;
    expect(saved().paused).toBe(paused);
    vi.advanceTimersByTime(60_000);
    expect(useGame.getState().elapsedMs()).toBe(before);
    useGame.getState().setAway(false);
    vi.advanceTimersByTime(2000);
    return { paused: useGame.getState().paused, ran: useGame.getState().elapsedMs() - before };
  };

  it('a shared position nobody touched only stands still while the page is hidden, and runs on; a move of the player’s pauses it', async () => {
    // someone's position: five digits of theirs on the board
    useGame.getState().startGame(EASY, 196, 'Easy');
    for (const cell of EMPTY.slice(0, 5)) play(cell, Number(solution()[cell]));
    const payload = encodePosition(useGame.getState().cells, false);
    useGame.getState().startGame(OTHER_PUZZLE, 1000, 'Medium');
    expect(useGame.getState().loadPosition(payload)).toBe(true);
    expect(underWay(useGame.getState())).toBe(false);
    expect(awayAndBack()).toEqual({ paused: false, ran: 2000 });
    // and across a reload, as the page left
    useGame.getState().setAway(true);
    await reload();
    expect(useGame.getState().paused).toBe(false);
    useGame.setState({ away: false });
    // the player's own digit: under way, paused when hidden
    play(EMPTY[5], Number(solution()[EMPTY[5]]));
    expect(awayAndBack()).toEqual({ paused: true, ran: 0 });
  });

  it('a fast-forwarded practice nobody touched only stands still while the page is hidden; a move of the player’s pauses it', () => {
    useSettings.setState({ practiceFastForward: true });
    useGame.getState().startGame(PRACTICE, 1348, 'Hard', 'X_WING');
    const g = useGame.getState();
    expect(g.autoCandidates).toBe(true);
    expect(g.cells.some((c) => !c.given && c.value)).toBe(true);
    expect(underWay(g)).toBe(false);
    expect(awayAndBack()).toEqual({ paused: false, ran: 2000 });
    // a digit of the player's on the app's position
    const open = g.cells.findIndex((c) => !c.value);
    play(open, Number(solution()[open]));
    expect(underWay(useGame.getState())).toBe(true);
    expect(awayAndBack()).toEqual({ paused: true, ran: 0 });
  });

  it('the chain trainer opened on a game nobody touched does not make it under way: it stands still, and comes back running after a reload', async () => {
    useGame.getState().startGame(EASY, 196, 'Easy');
    useGame.getState().startChain();
    expect(useGame.getState().autoCandidates).toBe(true);
    expect(awayAndBack()).toEqual({ paused: false, ran: 2000 });
    useGame.getState().setAway(true);
    await reload();
    expect(useGame.getState().autoCandidates).toBe(false);
    expect(useGame.getState().paused).toBe(false);
    useGame.setState({ away: false });
  });

  it('a puzzle being typed in is not paused when the page is hidden', () => {
    useGame.getState().startGame(EASY, 196, 'Easy');
    play(EMPTY[0], Number(solution()[EMPTY[0]]));
    useGame.setState({ custom: true });
    useGame.getState().setAway(true);
    expect(useGame.getState().paused).toBe(false);
    useGame.getState().setAway(false);
    useGame.setState({ custom: false });
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
