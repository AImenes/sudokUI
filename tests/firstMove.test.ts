/**
 * A game is counted as begun the first time its board shows anything
 * beyond the givens, not when it opens (src/state/gameStore.ts,
 * countFirstMove): the app's own first game, a link opened and never
 * played, and a practice puzzle send no start; a digit, a mark, a colour,
 * the chain trainer's candidates, or a shared position or pasted grid
 * opening with any of these, counts one, once. A restart of a game under
 * way, or the same puzzle chosen again, is the same game until it is
 * solved; a puzzle played again after a solve is a new one. Nothing about
 * counting is saved: a game resumed from storage counts as begun when its
 * board shows a move. A device left out of the counts marks nothing, and
 * a game it played on is counted when the switch goes off. A solve undone
 * and solved again is recorded and counted once, across a reload too: the
 * save holds whether the game was solved (the player's own record), never
 * whether it was counted.
 */
import { describe, it, expect, beforeEach } from 'vitest';

const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k)
};

const { useGame, encodePosition } = await import('../src/state/gameStore');
const { useTelemetry } = await import('../src/state/telemetry');
const { useSettings } = await import('../src/state/settings');
const { useStats } = await import('../src/state/stats');

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';
const EMPTY = [...EASY].map((ch, i) => (ch === '.' ? i : -1)).filter((i) => i >= 0);

/** what the counting saw: every call to track, in order */
let tracked: string[] = [];
/** the solves that went into the band record */
let solves = 0;

beforeEach(() => {
  storage.clear();
  tracked = [];
  useSettings.setState({ dontCount: false, countPlays: false, practiceFastForward: false });
  // each test starts with no game on the board, so no start carries over
  useGame.setState({ info: null, counted: false, solved: false, won: false, history: [], future: [] });
  solves = 0;
  useStats.setState({ recordSolve: () => void solves++ } as never);
  useTelemetry.setState({ track: (event: string) => void tracked.push(event) } as never);
});

/** a digit in a cell, as the player enters it */
const play = (cell: number, digit: number) => {
  useGame.getState().select([cell], false);
  useGame.getState().input(digit);
};
const solution = () => useGame.getState().info!.solution;
/** a reload: the page starts again, with no game in memory, from only what was saved */
const reload = async () => {
  const saved = storage.get('sudokui-game-v1')!;
  const before = useGame.getState().counted;
  useGame.setState({ info: null, counted: !before, solved: false, won: false, history: [], future: [] });
  storage.set('sudokui-game-v1', saved);
  await useGame.persist.rehydrate();
};

describe('a game begun', () => {
  it('is counted at the first move, once, not when the game opens', () => {
    useGame.getState().startGame(EASY, 196, 'Beginner');
    expect(tracked).toEqual([]);
    play(EMPTY[0], Number(solution()[EMPTY[0]]));
    expect(tracked).toEqual(['started']);
    play(EMPTY[1], Number(solution()[EMPTY[1]]));
    useGame.getState().undo();
    play(EMPTY[1], Number(solution()[EMPTY[1]]));
    expect(tracked).toEqual(['started']);
    expect(useGame.getState().counted).toBe(true);
  });

  it('counts a mark or a colour as a first move too', () => {
    useGame.getState().startGame(EASY, 196, 'Beginner');
    useGame.getState().select([EMPTY[0]], false);
    useGame.getState().input(4, 'corner');
    expect(tracked).toEqual(['started']);
    useGame.getState().startGame(EASY.replace('..3', '4.3'), 196, 'Beginner');
    useGame.getState().select([2], false);
    useGame.getState().input(1, 'color');
    expect(tracked).toEqual(['started', 'started']);
  });

  it('is not counted again after a restart of the game under way, or the same daily chosen again', () => {
    useGame.getState().startGame(EASY, 196, 'Beginner', null, '2026-10-21');
    play(EMPTY[0], Number(solution()[EMPTY[0]]));
    useGame.getState().restart();
    expect(useGame.getState().counted).toBe(true);
    play(EMPTY[0], Number(solution()[EMPTY[0]]));
    expect(tracked).toEqual(['started']);
    // New game > Daily puzzle while that daily is under way: the board
    // starts over, and it is still the same game
    useGame.getState().startGame(EASY, 196, 'Beginner', null, '2026-10-21');
    expect(useGame.getState().counted).toBe(true);
    play(EMPTY[1], Number(solution()[EMPTY[1]]));
    expect(tracked).toEqual(['started']);
  });

  it('saves nothing for counting, and is not counted again after a reload of a game begun', async () => {
    useGame.getState().startGame(EASY, 196, 'Beginner');
    play(EMPTY[0], Number(solution()[EMPTY[0]]));
    expect(tracked).toEqual(['started']);
    expect(storage.get('sudokui-game-v1')).not.toMatch(/counted/);
    // a fresh page knows nothing but what was saved (a save from before
    // this change looks the same: no flag, a move on the board)
    await reload();
    expect(useGame.getState().counted).toBe(true);
    play(EMPTY[1], Number(solution()[EMPTY[1]]));
    expect(tracked).toEqual(['started']);
  });

  it('counts a game resumed from storage at its first move when nothing had been played', async () => {
    useGame.getState().startGame(EASY, 196, 'Beginner');
    await reload();
    expect(useGame.getState().counted).toBe(false);
    expect(tracked).toEqual([]);
    play(EMPTY[0], Number(solution()[EMPTY[0]]));
    expect(tracked).toEqual(['started']);
  });

  it('marks nothing while the device is left out, so the start goes ahead of the solve when the switch goes off', () => {
    useSettings.setState({ dontCount: true });
    useGame.getState().startGame(EASY, 196, 'Beginner');
    play(EMPTY[0], Number(solution()[EMPTY[0]]));
    expect(useGame.getState().counted).toBe(false);
    useSettings.setState({ dontCount: false });
    for (const cell of EMPTY.slice(1)) play(cell, Number(solution()[cell]));
    expect(useGame.getState().won).toBe(true);
    expect(tracked).toEqual(['started', 'completed']);
  });

  it('counts a puzzle played again after its solve as a new game', () => {
    useGame.getState().startGame(EASY, 196, 'Beginner');
    for (const cell of EMPTY) play(cell, Number(solution()[cell]));
    expect(useGame.getState().won).toBe(true);
    expect(tracked).toEqual(['started', 'completed']);
    useGame.getState().restart();
    expect(useGame.getState().counted).toBeFalsy();
    play(EMPTY[0], Number(solution()[EMPTY[0]]));
    expect(tracked).toEqual(['started', 'completed', 'started']);
  });

  it('counts a game restarted before its first move at that move, not at the restart', () => {
    useGame.getState().startGame(EASY, 196, 'Beginner');
    useGame.getState().restart();
    expect(useGame.getState().counted).toBe(false);
    expect(tracked).toEqual([]);
    play(EMPTY[0], Number(solution()[EMPTY[0]]));
    expect(tracked).toEqual(['started']);
  });

  it('counts a shared position with entries when it opens, once, and its solve after a reload', async () => {
    useGame.getState().startGame(EASY, 196, 'Beginner');
    const sol = solution();
    const cells = useGame.getState().cells.map((c) => ({ ...c, colors: [...c.colors] }));
    cells[EMPTY[0]].value = Number(sol[EMPTY[0]]);
    const encoded = encodePosition(cells, false);
    useGame.setState({ info: null, counted: false, history: [] });
    expect(useGame.getState().loadPosition(encoded)).toBe(true);
    expect(tracked).toEqual(['started']);
    await reload();
    expect(useGame.getState().counted).toBe(true);
    for (const cell of EMPTY.slice(1)) play(cell, Number(sol[cell]));
    expect(useGame.getState().won).toBe(true);
    expect(tracked).toEqual(['started', 'completed']);
  });

  it('counts a pasted pencil-mark grid when it opens', () => {
    const values = [...EASY].map((ch) => (ch === '.' ? 0 : Number(ch)));
    expect(useGame.getState().importText({ values, given: values.map(Boolean), cands: values.map((v) => (v ? 0 : 0x1ff)) })).toBeNull();
    expect(tracked).toEqual(['started']);
    play(EMPTY[0], Number(solution()[EMPTY[0]]));
    expect(tracked).toEqual(['started']);
  });

  it('keeps the start ahead of the solve when a game played while left out is reloaded and then counted', async () => {
    useSettings.setState({ dontCount: true });
    useGame.getState().startGame(EASY, 196, 'Beginner');
    play(EMPTY[0], Number(solution()[EMPTY[0]]));
    await reload();
    expect(useGame.getState().counted).toBe(false);
    useSettings.setState({ dontCount: false });
    for (const cell of EMPTY.slice(1)) play(cell, Number(solution()[cell]));
    expect(tracked).toEqual(['started', 'completed']);
  });

  it('does not take a resumed practice game as counted, so the same puzzle played for real counts', async () => {
    useSettings.setState({ practiceFastForward: true });
    useGame.getState().startGame(EASY, 196, 'Beginner', 'HIDDEN_SINGLE');
    await reload();
    expect(useGame.getState().counted).toBe(false);
    expect(useGame.getState().importPuzzle(EASY)).toBeNull();
    expect(useGame.getState().counted).toBe(false);
    play(EMPTY[0], Number(solution()[EMPTY[0]]));
    expect(tracked).toEqual(['started']);
  });

  it('counts a game begun by opening the chain trainer, which switches candidates on, and not again after a reload', async () => {
    useGame.getState().startGame(EASY, 196, 'Beginner');
    useGame.getState().startChain();
    useGame.getState().endChain();
    expect(tracked).toEqual(['started']);
    await reload();
    expect(useGame.getState().counted).toBe(true);
    for (const cell of EMPTY) play(cell, Number(solution()[cell]));
    expect(tracked).toEqual(['started', 'completed']);
  });

  it('counts a game played while left out the moment the switch goes off, so a reload before the next move loses nothing', async () => {
    useSettings.setState({ dontCount: true });
    useGame.getState().startGame(EASY, 196, 'Beginner');
    play(EMPTY[0], Number(solution()[EMPTY[0]]));
    expect(tracked).toEqual([]);
    useSettings.setState({ dontCount: false });
    expect(tracked).toEqual(['started']);
    await reload();
    for (const cell of EMPTY.slice(1)) play(cell, Number(solution()[cell]));
    expect(tracked).toEqual(['started', 'completed']);
  });

  it('counts a shared position that opens with only a colour on it when it opens', () => {
    useGame.getState().startGame(EASY, 196, 'Beginner');
    const cells = useGame.getState().cells.map((c) => ({ ...c, colors: [...c.colors] }));
    cells[EMPTY[0]].colors = [2];
    const encoded = encodePosition(cells, false);
    useGame.setState({ info: null, counted: false, history: [] });
    expect(useGame.getState().loadPosition(encoded)).toBe(true);
    expect(tracked).toEqual(['started']);
  });

  it('never counts a practice puzzle', () => {
    useGame.getState().startGame(EASY, 196, 'Beginner', 'HIDDEN_SINGLE');
    play(EMPTY[0], Number(solution()[EMPTY[0]]));
    expect(tracked).toEqual([]);
  });
});

describe('a game solved', () => {
  /** every digit but the last, then the last: the puzzle solved */
  const solveAll = () => {
    for (const cell of EMPTY) play(cell, Number(solution()[cell]));
    expect(useGame.getState().won).toBe(true);
  };
  /** Undo takes the winning digit back; Resume, as the pause button offers */
  const undoWin = () => {
    useGame.getState().undo();
    expect(useGame.getState().won).toBe(false);
    if (useGame.getState().paused) useGame.getState().togglePause();
  };
  const last = () => EMPTY[EMPTY.length - 1];

  it('is recorded and counted once when undone and the same digit is put back', () => {
    useGame.getState().startGame(EASY, 196, 'Beginner');
    solveAll();
    undoWin();
    play(last(), Number(solution()[last()]));
    expect(useGame.getState().won).toBe(true);
    expect(solves).toBe(1);
    expect(tracked).toEqual(['started', 'completed']);
  });

  it('wins again on Redo of the winning digit, recorded and counted once', () => {
    useGame.getState().startGame(EASY, 196, 'Beginner');
    solveAll();
    useGame.getState().undo();
    expect(useGame.getState().won).toBe(false);
    useGame.getState().redo();
    expect(useGame.getState().won).toBe(true);
    expect(useGame.getState().paused).toBe(true);
    expect(solves).toBe(1);
    expect(tracked).toEqual(['started', 'completed']);
  });

  it('makes a puzzle solved, undone and Restarted a new game, as the privacy page says', () => {
    useGame.getState().startGame(EASY, 196, 'Beginner');
    solveAll();
    undoWin();
    useGame.getState().restart();
    expect(useGame.getState().counted).toBe(false);
    solveAll();
    expect(solves).toBe(2);
    expect(tracked).toEqual(['started', 'completed', 'started', 'completed']);
  });

  it('counts a solved puzzle Restarted while won, and solved again, as a second game', () => {
    useGame.getState().startGame(EASY, 196, 'Beginner');
    solveAll();
    useGame.getState().restart();
    solveAll();
    expect(solves).toBe(2);
    expect(tracked).toEqual(['started', 'completed', 'started', 'completed']);
  });

  it('records the solve once on a device left out of the counts, which counts nothing', () => {
    useSettings.setState({ dontCount: true });
    useGame.getState().startGame(EASY, 196, 'Beginner');
    solveAll();
    undoWin();
    play(last(), Number(solution()[last()]));
    expect(useGame.getState().won).toBe(true);
    expect(solves).toBe(1);
    // no start, and one call for the solve, which the real track() drops
    // on a left-out device (tests/telemetryStore.test.ts)
    expect(tracked).toEqual(['completed']);
  });

  it('takes a won game resumed from storage as solved', async () => {
    useGame.getState().startGame(EASY, 196, 'Beginner');
    solveAll();
    await reload();
    expect(useGame.getState().solved).toBe(true);
    expect(useGame.getState().won).toBe(true);
  });

  it('takes a won game saved before solved was kept as solved: Steps and a re-solve record nothing more', async () => {
    useGame.getState().startGame(EASY, 196, 'Beginner');
    solveAll();
    // a save from before 21 October 2026 has no solved key
    const old = JSON.parse(storage.get('sudokui-game-v1')!);
    delete old.state.solved;
    storage.set('sudokui-game-v1', JSON.stringify(old));
    await reload();
    expect(useGame.getState().solved).toBe(true);
    // Steps on a won game takes the board back to the start, and the win with it
    useGame.getState().jumpToStep(0);
    expect(useGame.getState().won).toBe(false);
    if (useGame.getState().paused) useGame.getState().togglePause();
    solveAll();
    expect(solves).toBe(1);
    expect(tracked).toEqual(['started', 'completed']);
  });

  it('remembers a solve undone across a reload: the digit put back records nothing more', async () => {
    useGame.getState().startGame(EASY, 196, 'Beginner');
    solveAll();
    undoWin();
    await reload();
    expect(useGame.getState().won).toBe(false);
    expect(useGame.getState().solved).toBe(true);
    if (useGame.getState().paused) useGame.getState().togglePause();
    play(last(), Number(solution()[last()]));
    expect(useGame.getState().won).toBe(true);
    expect(solves).toBe(1);
    expect(tracked).toEqual(['started', 'completed']);
  });

  it('makes a puzzle solved, undone, reloaded and Restarted a new game', async () => {
    useGame.getState().startGame(EASY, 196, 'Beginner');
    solveAll();
    undoWin();
    await reload();
    useGame.getState().restart();
    expect(useGame.getState().counted).toBe(false);
    expect(useGame.getState().solved).toBe(false);
    solveAll();
    expect(solves).toBe(2);
    expect(tracked).toEqual(['started', 'completed', 'started', 'completed']);
  });

  it('sends no start for a game solved while left out, after the switch goes off and the win is undone', () => {
    useSettings.setState({ dontCount: true });
    useGame.getState().startGame(EASY, 196, 'Beginner');
    solveAll();
    useSettings.setState({ dontCount: false });
    undoWin();
    useGame.getState().select([EMPTY[0]], false);
    useGame.getState().redo();
    expect(useGame.getState().won).toBe(true);
    expect(solves).toBe(1);
    // only the left-out solve's call, which the real track() drops
    expect(tracked).toEqual(['completed']);
  });
});

describe('custom entry', () => {
  it('counts the game Cancel brings back when it was played on while left out and the switch went off meanwhile', () => {
    useSettings.setState({ dontCount: true });
    useGame.getState().startGame(EASY, 196, 'Beginner');
    play(EMPTY[0], Number(solution()[EMPTY[0]]));
    useGame.getState().startCustomEntry();
    useSettings.setState({ dontCount: false });
    expect(tracked).toEqual([]);
    useGame.getState().cancelCustomEntry();
    expect(tracked).toEqual(['started']);
    expect(useGame.getState().counted).toBe(true);
  });
});
