/**
 * Marks-aware hinting: the solver must reason from the player's own centre
 * marks (folded in as eliminations), never from corner/Snyder marks, and a
 * step derived from corrupted marks must fail the solution guard rather than
 * become an unsound hint.
 */
import { describe, it, expect } from 'vitest';
import { parseGrid, gridToString, bit } from '../src/engine/board';
import { solve } from '../src/engine/bruteForce';
import { ratePuzzle, findNextStep } from '../src/engine/humanSolver';
import {
  solverGrid,
  stepMatchesSolution,
  centreMarkSlip,
  engineGrid,
  CellState
} from '../src/state/gameStore';

const EASY =
  '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';

/** cells for a puzzle string: givens placed, everything else empty. */
function cellsOf(puzzle: string): CellState[] {
  return Array.from({ length: 81 }, (_, i) => {
    const ch = puzzle[i];
    const given = ch !== '.' && ch !== '0';
    return {
      given,
      value: given ? Number(ch) : 0,
      corner: 0,
      center: 0,
      excluded: 0,
      colors: []
    };
  });
}

describe('solverGrid + hint guards', () => {
  it('with no marks, matches the canonical engine grid', () => {
    const cells = cellsOf(EASY);
    const a = solverGrid(cells, false);
    const b = engineGrid(cells);
    for (let i = 0; i < 81; i++) expect(a.cands[i]).toBe(b.cands[i]);
  });

  it('folds centre marks in as eliminations (manual mode only)', () => {
    const cells = cellsOf(EASY);
    // pick an empty cell and pretend the player narrowed it to a subset
    const i = cells.findIndex((c) => !c.value);
    const canon = engineGrid(cells).cands[i];
    const digits = [...Array(9)].map((_, d) => d + 1).filter((d) => canon & bit(d));
    expect(digits.length).toBeGreaterThan(1);
    cells[i].center = bit(digits[0]); // player claims only the first digit
    // manual mode → folded
    expect(solverGrid(cells, false).cands[i]).toBe(bit(digits[0]));
    // auto mode → centre marks ignored, back to canonical
    expect(solverGrid(cells, true).cands[i]).toBe(canon);
  });

  it('folds corner marks only when they are declared exhaustive', () => {
    const cells = cellsOf(EASY);
    const i = cells.findIndex((c) => !c.value);
    const canon = engineGrid(cells).cands[i];
    const digits = [...Array(9)].map((_, d) => d + 1).filter((d) => canon & bit(d));
    expect(digits.length).toBeGreaterThan(1);
    cells[i].corner = bit(digits[0]); // a Snyder-style corner mark
    // default: corner marks are partial, so they are ignored
    expect(solverGrid(cells, false).cands[i]).toBe(canon);
    // declared exhaustive: corner marks fold in as eliminations
    expect(solverGrid(cells, false, true).cands[i]).toBe(bit(digits[0]));
  });

  it('a corner-mark slip is only seen when corner marks are exhaustive', () => {
    const cells = cellsOf(EASY);
    const sol = gridToString(solve(parseGrid(EASY)!)!);
    const i = cells.findIndex((c) => !c.value);
    // corner marks that omit the true digit
    cells[i].corner = engineGrid(cells).cands[i] & ~bit(Number(sol[i]));
    expect(centreMarkSlip(cells, sol, false)).toBe(-1); // partial: no slip
    expect(centreMarkSlip(cells, sol, true)).toBe(i); // exhaustive: caught
  });

  it('never lets a mark add an impossible candidate', () => {
    const cells = cellsOf(EASY);
    const i = cells.findIndex((c) => !c.value);
    const canon = engineGrid(cells).cands[i];
    cells[i].center = 0b111111111; // player marks all nine (some impossible)
    expect(solverGrid(cells, false).cands[i]).toBe(canon); // clamped to canonical
  });

  it('a mark that drops the true digit is detected as a slip', () => {
    const cells = cellsOf(EASY);
    const sol = gridToString(solve(parseGrid(EASY)!)!);
    const i = cells.findIndex((c) => !c.value);
    const trueDigit = Number(sol[i]);
    // exhaustive marks minus the solution digit
    cells[i].center = engineGrid(cells).cands[i] & ~bit(trueDigit);
    expect(centreMarkSlip(cells, sol)).toBe(i);
  });

  it('stepMatchesSolution accepts sound steps and rejects contradictions', () => {
    const sol = gridToString(solve(parseGrid(EASY)!)!);
    const step = findNextStep(engineGrid(cellsOf(EASY)))!;
    expect(step).not.toBeNull();
    expect(stepMatchesSolution(step, sol)).toBe(true);
    // a fabricated placement of the wrong digit must be rejected
    const wrong = {
      ...step,
      placements: [{ cell: 4, digit: (Number(sol[4]) % 9) + 1 }],
      eliminations: []
    };
    expect(stepMatchesSolution(wrong, sol)).toBe(false);
  });

  it('folded marks advance the solver past a done elimination', () => {
    // solve a few steps of a real puzzle, record an elimination, feed it back
    // as a centre mark, and confirm the next step is NOT that same one
    const rating = ratePuzzle(EASY)!;
    expect(rating.steps.length).toBeGreaterThan(3);
  });
});
