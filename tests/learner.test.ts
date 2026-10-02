/**
 * The learner's loop in the game store: a practice puzzle knows the step
 * it was prepared for and says when the player's own move does what it
 * does; a wrong digit is counted and, on Check, proved wrong; hints are
 * counted as hints.
 */
import { describe, it, expect, beforeEach } from 'vitest';

const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k)
};

const { useGame, proveWrong, matchesTarget } = await import('../src/state/gameStore');
const { useSettings } = await import('../src/state/settings');
const { useStats } = await import('../src/state/stats');
const { EXAMPLES } = await import('../src/content/examples');
const { parseGrid, bit, PEERS } = await import('../src/engine/board');

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';

describe('practice target', () => {
  beforeEach(() => useSettings.getState().set({ practiceFastForward: true }));

  it('is the step the puzzle was fast-forwarded to, and the player can find it', () => {
    const ex = EXAMPLES.X_WING!;
    useGame.getState().startGame(ex.puzzle, 800, 'Hard', 'X_WING');
    const s = useGame.getState();
    expect(s.practiceTarget?.tech).toBe('X_WING');
    expect(s.practiceTarget?.eliminations).toEqual(ex.step.eliminations);
    expect(s.practiceFound).toBe(false);
    // strike one of the candidates the X-Wing removes
    const e = ex.step.eliminations[0];
    s.select([e.cell], false);
    s.setMode('center');
    s.input(e.digit);
    expect(useGame.getState().practiceFound).toBe(true);
    expect(useGame.getState().notice).toContain('You found the X-Wing');
    expect(useGame.getState().cells[e.cell].excluded & bit(e.digit)).toBeTruthy();
    useGame.getState().setMode('digit');
  });

  it('matches a placement, a removal, or a digit placed where the removals leave only it', () => {
    const g = parseGrid(EASY)!;
    const target = { tech: 'X_WING' as const, placements: [{ cell: 0, digit: 4 }], eliminations: [{ cell: 1, digit: 5 }], description: '' };
    expect(matchesTarget(target, g, { cell: 0, digit: 4, placed: true })).toBe(true);
    expect(matchesTarget(target, g, { cell: 1, digit: 5, placed: false })).toBe(true);
    expect(matchesTarget(target, g, { cell: 1, digit: 5, placed: true })).toBe(false);
    expect(matchesTarget(target, g, { cell: 2, digit: 4, placed: true })).toBe(false);
    // r1c2 holds {5,7}: with the 5 removed, placing 7 is the target's doing
    g.cands[1] = bit(5) | bit(7);
    expect(matchesTarget(target, g, { cell: 1, digit: 7, placed: true })).toBe(true);
  });
});

describe('mistakes', () => {
  it('a wrong digit is counted, and Check proves it wrong', () => {
    useGame.getState().startGame(EASY, 196, 'Beginner');
    expect(useStats.getState().game.errors).toBe(0);
    const s = useGame.getState();
    // r1c1 is 4; a 3 already sits in the row
    s.select([0], false);
    s.input(3);
    expect(useStats.getState().game.errors).toBe(1);
    useGame.getState().check();
    const after = useGame.getState();
    expect(after.errors).toEqual([0]);
    expect(after.proofs).toHaveLength(1);
    expect(after.proofs[0]).toMatchObject({ cell: 0, wrong: 3, right: 4, conflict: 2 });
    after.showProof(0);
    expect(useGame.getState().selection).toEqual([0, 2]);
    expect(useGame.getState().notice).toContain('r1c3 already holds it');
  });

  it('a wrong digit that is a candidate is proved wrong by a technique, and the proof can be shown', () => {
    const g = parseGrid(EASY)!;
    const sol = useGame.getState().info!.solution;
    // a cell with two candidates: the wrong one is a candidate, so a technique must remove it
    const cell = [...g.values].findIndex((v, i) => v === 0 && [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => g.cands[i] & bit(d)).length === 2);
    const wrong = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((d) => g.cands[cell] & bit(d) && d !== Number(sol[cell]))!;
    const cells = useGame.getState().cells.map((c) => ({ ...c, colors: [...c.colors] }));
    cells[cell].value = wrong;
    const proofs = proveWrong(cells, sol, [cell]);
    expect(proofs).toHaveLength(1);
    expect(proofs[0].conflict).toBeNull();
    expect(proofs[0].tech).not.toBeNull();
    expect(proofs[0].steps.length).toBeGreaterThan(0);
    const last = proofs[0].steps[proofs[0].steps.length - 1];
    // the shortest argument: a step or two, else the assumption followed to its contradiction
    if (proofs[0].trail) {
      expect(last.tech).toBe('NISHIO_FORCING_CHAIN');
      expect(last.links!.length).toBeGreaterThan(0);
      expect(last.fins!.length).toBeGreaterThan(0);
    } else {
      expect(proofs[0].steps.length).toBeLessThanOrEqual(2);
    }
    if (proofs[0].places) {
      expect(last.placements).toContainEqual({ cell, digit: Number(sol[cell]) });
    } else {
      // the digit goes by a removal, or by a placement in a peer
      const removed = last.eliminations.some((e) => e.cell === cell && e.digit === wrong);
      const placedInPeer = last.placements.some((q) => q.digit === wrong && PEERS[cell].includes(q.cell));
      expect(removed || placedInPeer).toBe(true);
    }
    useGame.setState({ cells, proofs, errors: [cell] });
    useGame.getState().showProof(0);
    const after = useGame.getState();
    expect(after.hint).toEqual(last);
    expect(after.hintStage).toBe('full');
    expect(after.cells[cell].value).toBe(0);
    expect(after.assisted).toBe(true);
  });

  it('an applied hint is counted as a hint', () => {
    useGame.getState().startGame(EASY, 196, 'Beginner');
    useGame.getState().requestHint();
    const tech = useGame.getState().hint!.tech;
    useGame.getState().applyHint();
    expect(useStats.getState().game.hinted[tech]).toBe(1);
    expect(useStats.getState().techs[tech]?.hinted).toBeGreaterThanOrEqual(1);
  });
});
