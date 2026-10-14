/**
 * Hints without uniqueness (settings.useUniqueness): the order hints, Steps,
 * Scan, the proofs and the credit of a move look for steps in
 * (hintOrder, src/engine/ratings.ts), and the rating that never changes.
 * The puzzle is the one Cracking the Cryptic solved with two chains,
 * declining the unique rectangle our engine reaches for at the same point.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { parseGrid } from '../src/engine/board';
import type { Grid } from '../src/engine/board';
import { findNextStep, findAllSteps, applyStep, ratePuzzle } from '../src/engine/humanSolver';
import { justify } from '../src/engine/justify';
import { TECHS, SOLVE_ORDER, NO_UNIQUENESS_ORDER, hintOrder } from '../src/engine/ratings';
import type { Tech } from '../src/engine/ratings';
import { useGame, solvePath } from '../src/state/gameStore';
import { useSettings } from '../src/state/settings';

const P = '1...........6......6.935.....234..6.3....1..2.......84.5..6......1..2.9.8......71';
const isUniqueness = (t: Tech) => TECHS[t].category === 'Uniqueness';

/** after singles, intersections and subsets: where the engine's cheapest step is a unique rectangle */
function stuck(): Grid {
  const g = parseGrid(P)!;
  const basic = SOLVE_ORDER.filter((t) => ['Singles', 'Intersections', 'Subsets'].includes(TECHS[t].category));
  for (;;) {
    const s = findNextStep(g, basic);
    if (!s) break;
    applyStep(g, s);
  }
  return g;
}

afterEach(() => useSettings.getState().set({ useUniqueness: true }));

describe('the order without uniqueness', () => {
  it('leaves out the uniqueness family and nothing else, in the same order', () => {
    expect(NO_UNIQUENESS_ORDER.some(isUniqueness)).toBe(false);
    expect(NO_UNIQUENESS_ORDER).toEqual(SOLVE_ORDER.filter((t) => !isUniqueness(t)));
    expect(SOLVE_ORDER.filter(isUniqueness)).toEqual(expect.arrayContaining(['UNIQUENESS_1', 'UNIQUENESS_3', 'HIDDEN_RECTANGLE', 'BUG_PLUS_1']));
    expect(hintOrder(true)).toBe(SOLVE_ORDER);
    expect(hintOrder(false)).toBe(NO_UNIQUENESS_ORDER);
  });

  it('finds another way where the engine reaches for a unique rectangle', () => {
    const g = stuck();
    expect(findNextStep(g)!.tech).toBe('UNIQUENESS_3');
    const other = findNextStep(g, NO_UNIQUENESS_ORDER)!;
    expect(isUniqueness(other.tech)).toBe(false);
    expect(other.tech).toBe(findAllSteps(g, NO_UNIQUENESS_ORDER)[0].tech);
    expect(findAllSteps(g, NO_UNIQUENESS_ORDER).some((s) => isUniqueness(s.tech))).toBe(false);
  });

  it('leaves the rating alone, and still solves the puzzle without uniqueness', () => {
    const r = ratePuzzle(P)!;
    expect(r.score).toBe(2172);
    expect(r.level).toBe('Extreme');
    const without = ratePuzzle(P, NO_UNIQUENESS_ORDER)!;
    expect(without.solvable).toBe(true);
    expect(without.steps.some((s) => isUniqueness(s.tech))).toBe(false);
  });

  it('never justifies a move with uniqueness when told not to', () => {
    const g = stuck();
    const ur = findNextStep(g)!;
    const e = ur.eliminations[0];
    const move = { cell: e.cell, digit: e.digit, placed: false };
    expect(justify(g, move).tech).toBe('UNIQUENESS_3');
    const j = justify(g, move, undefined, NO_UNIQUENESS_ORDER);
    expect(j.tech === null || !isUniqueness(j.tech)).toBe(true);
  });
});

describe('the setting in the game', () => {
  /** the game at the stuck position, auto candidates showing what the engine knows */
  function atStuckPosition() {
    useGame.getState().startGame(P, 2172, 'Extreme');
    const g = stuck();
    const values = Array.from(g.values).map((v) => (v ? String(v) : '.')).join('');
    const canonical = parseGrid(values)!;
    const cells = useGame.getState().cells.map((c, i) => ({
      ...c,
      value: g.values[i],
      excluded: g.values[i] ? 0 : canonical.cands[i] & ~g.cands[i]
    }));
    useGame.setState({ cells, autoCandidates: true, assisted: true, hint: null, hintStage: 'hidden' });
  }

  it('gives the unique rectangle as the hint with uniqueness on, another technique with it off', () => {
    atStuckPosition();
    useGame.getState().requestHint();
    expect(useGame.getState().hint?.tech).toBe('UNIQUENESS_3');
    useGame.getState().dismissHint();
    useSettings.getState().set({ useUniqueness: false });
    useGame.getState().requestHint();
    const hint = useGame.getState().hint;
    expect(hint).not.toBeNull();
    expect(isUniqueness(hint!.tech)).toBe(false);
  });

  it('lists Steps by the order asked for, and keeps both paths apart', () => {
    expect(solvePath(P).some((s) => s.tech === 'UNIQUENESS_3')).toBe(true);
    expect(solvePath(P, hintOrder(false)).some((s) => isUniqueness(s.tech))).toBe(false);
    // asked again, each order still answers with its own path
    expect(solvePath(P).some((s) => s.tech === 'UNIQUENESS_3')).toBe(true);
    expect(solvePath(P, hintOrder(false)).some((s) => isUniqueness(s.tech))).toBe(false);
  });
});
