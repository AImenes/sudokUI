/**
 * Hints without uniqueness, where the game passes the setting on: the
 * engine's half of the promise (nothing found without uniqueness leans on
 * one solution) is tests/soundnessNoUniqueness.test.ts; this file holds the
 * game store to asking for it. A Steps row clicked replays the path the
 * dialog listed, the one without uniqueness, not the engine's own; the
 * credit of a move goes to the worker with uniqueness left out (through a
 * stand-in Worker, since node has none, that answers as the real one does);
 * and a hint or a Check proof found while uniqueness was on keeps the
 * record of it when the setting goes off, while whatever is asked after
 * obeys the new setting (the record is what a report of it says:
 * tests/hintWith.test.ts). What only the browser shows, Scan's list and a
 * Steps row clicked through the dialog, is in the smoke test
 * (tests/e2e/smoke.spec.ts, "with uniqueness off, hints, Steps and Scan
 * find another way").
 *
 * One KNOWN FINDING is kept at the end as it.fails, with the property it
 * breaks: practice that jumps to its technique gets there through the
 * engine's own order, uniqueness included, whatever the setting.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';

const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k)
};

const { parseGrid, gridToString, bit, cellName, PEERS } = await import('../src/engine/board');
type Grid = import('../src/engine/board').Grid;
const { findNextStep, findAllSteps, applyStep } = await import('../src/engine/humanSolver');
const { TECHS, SOLVE_ORDER, NO_UNIQUENESS_ORDER } = await import('../src/engine/ratings');
type Tech = import('../src/engine/ratings').Tech;
type Step = import('../src/engine/steps').Step;
const { serveJustify } = await import('../src/engine/worker');
type WorkerRequest = import('../src/engine/worker').WorkerRequest;
const { useGame, solvePath, contractGrid } = await import('../src/state/gameStore');
const { useSettings } = await import('../src/state/settings');
const { useStats } = await import('../src/state/stats');
const practice = (await import('../src/content/practicePuzzles.json')).default as Record<string, { puzzle: string }[]>;

const isUniqueness = (t: Tech) => TECHS[t].category === 'Uniqueness';
const key = (s: Step | null | undefined) =>
  s ? `${s.tech} +${s.placements.map((p) => `${p.digit}${cellName(p.cell)}`).join(',')} -${s.eliminations.map((e) => `${e.digit}${cellName(e.cell)}`).join(',')}` : 'none';

/** the puzzle Cracking the Cryptic solved with chains where our engine takes a unique rectangle (tests/uniquenessSetting.test.ts) */
const CTC = '1...........6......6.935.....234..6.3....1..2.......84.5..6......1..2.9.8......71';

/** the clock justify reads stands still: only its step budget bounds it (tests/soundnessNoUniqueness.test.ts) */
const stillClock = () => vi.spyOn(performance, 'now').mockReturnValue(0);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useSettings.getState().set({ useUniqueness: true, practiceFastForward: true, dontCount: false });
});

/** the board the store shows, as the engine reads it (auto candidates on) */
const shown = (): Grid => contractGrid(useGame.getState().cells, useGame.getState().autoCandidates, useGame.getState().markContract);

/** the puzzle with the path's first k steps applied */
function replayed(puzzle: string, steps: Step[], k: number): Grid {
  const g = parseGrid(puzzle)!;
  for (const step of steps.slice(0, k)) applyStep(g, step);
  return g;
}

const sameBoard = (a: Grid, b: Grid) => gridToString(a) === gridToString(b) && a.cands.every((m, i) => a.values[i] !== 0 || m === b.cands[i]);

/** the CTC paths with uniqueness and without, and the index where they part: a unique rectangle on one, a finned swordfish on the other */
function ctcPaths() {
  const on = solvePath(CTC, SOLVE_ORDER);
  const off = solvePath(CTC, NO_UNIQUENESS_ORDER);
  let split = 0;
  while (split < on.length && key(on[split]) === key(off[split])) split++;
  expect([on[split].tech, off[split].tech]).toEqual(['UNIQUENESS_3', 'FINNED_SWORDFISH']);
  return { on, off, split };
}

describe('Steps, with uniqueness off', () => {
  it('a row clicked sets the board to the path the dialog listed, without uniqueness, and the hint there is that row', () => {
    useSettings.getState().set({ useUniqueness: false, dontCount: true });
    useGame.getState().startGame(CTC, 0, 'Extreme');
    const { on, off, split } = ctcPaths();
    // the row after the paths part: the two orders' boards differ there
    const k = split + 1;
    expect(isUniqueness(off[k].tech)).toBe(false);
    expect(sameBoard(replayed(CTC, off, k), replayed(CTC, on, k))).toBe(false);
    useGame.getState().jumpToStep(k);
    expect(sameBoard(shown(), replayed(CTC, off, k)), 'the board is the path without uniqueness').toBe(true);
    useGame.getState().requestHint();
    expect(key(useGame.getState().hint)).toBe(key(off[k]));
    // with uniqueness on, the same row number is the engine's own path
    useSettings.getState().set({ useUniqueness: true });
    useGame.getState().jumpToStep(k);
    expect(sameBoard(shown(), replayed(CTC, on, k))).toBe(true);
  });
});

/**
 * A Worker that answers in-process as src/engine/worker.ts does, and keeps
 * every message the game sent it
 */
class StandInWorker {
  static sent: WorkerRequest[] = [];
  private listeners = new Map<string, Set<(e: { data: unknown }) => void>>();
  addEventListener(type: string, fn: (e: { data: unknown }) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }
  removeEventListener(type: string, fn: (e: { data: unknown }) => void) {
    this.listeners.get(type)?.delete(fn);
  }
  postMessage(req: WorkerRequest) {
    StandInWorker.sent.push(req);
    if (req.kind !== 'justify') return;
    serveJustify(req, (data) => queueMicrotask(() => this.listeners.get('message')?.forEach((fn) => fn({ data }))));
  }
  terminate() {}
}

describe('the credit of a move', () => {
  it('goes to the worker with uniqueness left out when it is off, and is never credited to the family', async () => {
    stillClock();
    vi.stubGlobal('Worker', StandInWorker);
    useSettings.getState().set({ dontCount: true });
    const { split } = ctcPaths();
    const credited: Record<string, Partial<Record<Tech, number>>> = {};
    for (const useUniqueness of [true, false]) {
      // the board just before the unique rectangle, auto candidates on
      useSettings.getState().set({ useUniqueness: true });
      useGame.getState().startGame(CTC, 0, 'Extreme');
      useGame.getState().jumpToStep(split);
      const ur = findNextStep(shown(), SOLVE_ORDER)!;
      expect(ur.tech).toBe('UNIQUENESS_3');
      const { cell, digit } = ur.eliminations[0];
      // the player strikes the candidate the rectangle removes, by hand
      useSettings.getState().set({ useUniqueness });
      StandInWorker.sent = [];
      useGame.getState().select([cell], false);
      useGame.getState().input(digit, 'corner');
      expect(useGame.getState().cells[cell].excluded & bit(digit)).not.toBe(0);
      await new Promise((r) => setTimeout(r, 0));
      expect(StandInWorker.sent).toEqual([expect.objectContaining({ kind: 'justify', move: { cell, digit, placed: false }, noUniqueness: !useUniqueness })]);
      credited[String(useUniqueness)] = { ...useStats.getState().game.unaided };
    }
    // with uniqueness on, the stand-in credits the rectangle: it answers as the worker does
    expect(credited.true).toEqual({ UNIQUENESS_3: 1 });
    // off, the same stroke is credited to another technique, or to none
    expect((Object.keys(credited.false) as Tech[]).filter(isUniqueness)).toEqual([]);
  });
});

describe('the setting changed during a game', () => {
  it('a hint found with uniqueness on keeps that record; the next hint obeys the setting', () => {
    useSettings.getState().set({ useUniqueness: true, dontCount: true });
    useGame.getState().startGame(CTC, 0, 'Extreme');
    const { split } = ctcPaths();
    useGame.getState().jumpToStep(split);
    useGame.getState().requestHint();
    expect(useGame.getState().hint?.tech).toBe('UNIQUENESS_3');
    useSettings.getState().set({ useUniqueness: false });
    // still on screen, and a report of it says it was found with uniqueness on
    expect(useGame.getState().hint?.tech).toBe('UNIQUENESS_3');
    expect(useGame.getState().hintWith?.useUniqueness).toBe(true);
    useGame.getState().dismissHint();
    useGame.getState().requestHint();
    expect(useGame.getState().hint?.tech).toBe('FINNED_SWORDFISH');
    expect(useGame.getState().hintWith?.useUniqueness).toBe(false);
  });

  it('a proof found by Check with uniqueness on keeps that record; Check run again obeys the setting', () => {
    stillClock();
    // a wrong 4 in r2c4 whose shortest proof, with uniqueness on, is a unique rectangle (Type 2)
    const puzzle = '9..6..87.7...8.3...5...96..4.2.6..5...........1..9.2.7..49...3...5.4...6.87..1..4';
    const values = '9..6..87.7..48.39.2587396414.286.159..9...4.3.1..9.2.7124976538395248716687351924';
    const board = () => {
      useGame.getState().startGame(puzzle, 0, 'Hard');
      const cells = useGame.getState().cells.map((c, i) => ({ ...c, value: c.given ? c.value : values[i] === '.' ? 0 : Number(values[i]) }));
      useGame.setState({ cells });
      expect(cells[12].value).toBe(4);
      expect(useGame.getState().info!.solution[12]).not.toBe('4');
    };
    useSettings.getState().set({ useUniqueness: true, dontCount: true });
    board();
    useGame.getState().check();
    expect(useGame.getState().proofs.map((p) => [p.cell, p.tech, p.useUniqueness])).toEqual([[12, 'UNIQUENESS_2', true]]);
    useSettings.getState().set({ useUniqueness: false });
    // Check again: a proof without the family, found under the setting now
    const kept = useGame.getState().proofs;
    useGame.getState().check();
    const [again] = useGame.getState().proofs;
    expect(again.useUniqueness).toBe(false);
    expect(again.tech).not.toBeNull();
    expect(again.steps.some((s) => isUniqueness(s.tech))).toBe(false);
    // the proof found before, shown after the setting went off, says what it was found under
    useGame.setState({ proofs: kept });
    useGame.getState().showProof(0);
    expect(useGame.getState().hint?.tech).toBe('UNIQUENESS_2');
    expect(useGame.getState().hintWith?.useUniqueness).toBe(true);
  });
});

/**
 * Practice jumps to its technique (settings.practiceFastForward, on by
 * default) by playing the engine's own order up to it, SOLVE_ORDER in
 * src/state/gameStore.ts startGame, and writes every removal on the way as
 * a struck candidate: unique rectangles too, with uniqueness off. On this
 * stored Multi Colors puzzle a Unique Rectangle Type 4 strikes 9 from r5c5
 * and r5c7 on the way; the hint on the board it opens, without uniqueness,
 * is the Multi Colors that removes 9 from r9c8, and with those two 9s put
 * back no technique without uniqueness finds it. The deduction is true
 * (the puzzle has one solution), but the player who turned uniqueness off
 * is shown a board, and a hint, that rest on it. Of the 240 stored practice
 * puzzles for techniques outside the family, 51 open on a board a
 * uniqueness step cut; on 6 the hint shown rests on such a cut. Since
 * October 2026 Settings says so ("skip the steps the standard solver plays
 * first, uniqueness included"), so nothing is promised that is not kept;
 * jumping in the player's own order is open work, and on 2 of those 6
 * puzzles that order never reaches the technique, so it needs another
 * puzzle rather than a shorter jump.
 */
describe('KNOWN FINDING: practice that jumps to its technique gets there through uniqueness, with uniqueness off', () => {
  const PUZZLE = '1...3...2.8972.......6..17....5...136.......597...4....31..2.......4723.7...6...1';
  const R5C5 = 40;
  const R5C7 = 42;

  /** the candidates the uniqueness family struck on the engine's own way to the technique */
  function struckByUniqueness(puzzle: string, tech: Tech): { cell: number; digit: number }[] {
    const g = parseGrid(puzzle)!;
    const struck: { cell: number; digit: number }[] = [];
    for (let guard = 0; guard < 200; guard++) {
      const step = findNextStep(g, SOLVE_ORDER);
      if (!step || step.tech === tech) break;
      if (isUniqueness(step.tech)) struck.push(...step.eliminations.filter(({ cell, digit }) => g.cands[cell] & bit(digit)));
      applyStep(g, step);
    }
    return struck;
  }

  /** the board shown, with the candidates only uniqueness struck put back where nothing else rules them out */
  function withoutThoseCuts(struck: { cell: number; digit: number }[]): Grid {
    const g = shown();
    for (const { cell, digit } of struck) if (!g.values[cell] && !PEERS[cell].some((p) => g.values[p] === digit)) g.cands[cell] |= bit(digit);
    return g;
  }

  function openPractice() {
    useSettings.getState().set({ useUniqueness: false, practiceFastForward: true, dontCount: true });
    useGame.getState().startGame(PUZZLE, 0, 'Hard', 'MULTI_COLORS');
    useGame.getState().requestHint();
  }

  it('the case: a stored Multi Colors puzzle, a UR Type 4 on the way, and the hint that rests on it', () => {
    expect(practice.MULTI_COLORS.map((e) => e.puzzle)).toContain(PUZZLE);
    expect(struckByUniqueness(PUZZLE, 'MULTI_COLORS')).toEqual([
      { cell: R5C5, digit: 9 },
      { cell: R5C7, digit: 9 }
    ]);
    openPractice();
    const s = useGame.getState();
    expect(s.autoCandidates).toBe(true);
    for (const cell of [R5C5, R5C7]) {
      expect(s.cells[cell].value).toBe(0);
      expect(s.cells[cell].excluded & bit(9)).not.toBe(0);
    }
    expect(key(s.hint)).toBe('MULTI_COLORS + -9r9c8');
    expect(findAllSteps(withoutThoseCuts(struckByUniqueness(PUZZLE, 'MULTI_COLORS')), NO_UNIQUENESS_ORDER).map(key)).not.toContain(key(s.hint));
  });

  it.fails('FINDING: with uniqueness off, the hint on the practice board does not rest on a candidate only uniqueness struck', () => {
    openPractice();
    const hint = useGame.getState().hint;
    if (hint) expect(findAllSteps(withoutThoseCuts(struckByUniqueness(PUZZLE, 'MULTI_COLORS')), NO_UNIQUENESS_ORDER).map(key)).toContain(key(hint));
  });
});
