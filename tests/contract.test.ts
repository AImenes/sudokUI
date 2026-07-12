/**
 * The candidate contract: hints must continue from the player's own manual
 * marks once declared exhaustive, never invent impossible candidates, never
 * reason from a mark set that lost its true digit, and never emit a step
 * that contradicts the solution. This is the regression suite for the
 * "hints re-suggested eliminations I had already made by hand" bug.
 */
import { describe, it, expect } from 'vitest';
import { parseGrid, gridToString, cloneGrid, bit } from '../src/engine/board';
import { solve } from '../src/engine/bruteForce';
import { findNextStep, applyStep } from '../src/engine/humanSolver';
import { generatePuzzle } from '../src/engine/generator';
import {
  contractGrid,
  engineGrid,
  hasManualMarks,
  markSlip,
  stepMatchesSolution,
  CellState
} from '../src/state/gameStore';

const EASY =
  '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';

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

describe('candidate contract', () => {
  it('open contract and bare boards match the canonical grid', () => {
    const cells = cellsOf(EASY);
    expect(hasManualMarks(cells)).toBe(false);
    const canon = engineGrid(cells);
    for (const contract of ['unknown', 'open', 'exhaustive'] as const) {
      const g = contractGrid(cells, false, contract);
      for (let i = 0; i < 81; i++) expect(g.cands[i]).toBe(canon.cands[i]);
    }
  });

  it('exhaustive contract folds marks per cell, corner and centre alike', () => {
    const cells = cellsOf(EASY);
    const canon = engineGrid(cells);
    const [a, b] = cells.map((c, i) => (!c.value ? i : -1)).filter((i) => i >= 0);
    const dA = [...Array(9)].map((_, d) => d + 1).filter((d) => canon.cands[a] & bit(d));
    const dB = [...Array(9)].map((_, d) => d + 1).filter((d) => canon.cands[b] & bit(d));
    cells[a].center = bit(dA[0]) | bit(dA[1]); // centre pair
    cells[b].corner = bit(dB[0]) | bit(dB[1]); // corner pair — same meaning
    const g = contractGrid(cells, false, 'exhaustive');
    expect(g.cands[a]).toBe(bit(dA[0]) | bit(dA[1]));
    expect(g.cands[b]).toBe(bit(dB[0]) | bit(dB[1]));
    // unmarked cells stay canonical; open contract ignores the marks
    const open = contractGrid(cells, false, 'open');
    expect(open.cands[a]).toBe(canon.cands[a]);
    // auto mode ignores marks regardless of contract
    const auto = contractGrid(cells, true, 'exhaustive');
    expect(auto.cands[a]).toBe(canon.cands[a]);
  });

  it('marks can only narrow — impossible digits never enter, cells never zero', () => {
    const cells = cellsOf(EASY);
    const canon = engineGrid(cells);
    const i = cells.findIndex((c) => !c.value);
    cells[i].center = 0b111111111; // all nine claimed, some impossible
    expect(contractGrid(cells, false, 'exhaustive').cands[i]).toBe(canon.cands[i]);
    // marks fully disjoint from the canonical set: cell keeps canonical
    const impossible = 0b111111111 & ~canon.cands[i];
    if (impossible) {
      cells[i].center = impossible;
      expect(contractGrid(cells, false, 'exhaustive').cands[i]).toBe(canon.cands[i]);
    }
  });

  it('detects a mark set that lost its true digit, in either layer', () => {
    const sol = gridToString(solve(parseGrid(EASY)!)!);
    const cells = cellsOf(EASY);
    const canon = engineGrid(cells);
    const i = cells.findIndex((c, k) => !c.value && (canon.cands[k] & ~bit(Number(sol[k]))) !== 0);
    expect(markSlip(cells, sol)).toBe(-1); // no marks, no slip
    cells[i].corner = canon.cands[i] & ~bit(Number(sol[i]));
    expect(markSlip(cells, sol)).toBe(i);
  });

  it('stepMatchesSolution accepts sound steps and rejects contradictions', () => {
    const sol = gridToString(solve(parseGrid(EASY)!)!);
    const step = findNextStep(engineGrid(cellsOf(EASY)))!;
    expect(step).not.toBeNull();
    expect(stepMatchesSolution(step, sol)).toBe(true);
    const wrongPlace = { ...step, placements: [{ cell: 4, digit: (Number(sol[4]) % 9) + 1 }], eliminations: [] };
    expect(stepMatchesSolution(wrongPlace, sol)).toBe(false);
    const wrongElim = { ...step, placements: [], eliminations: [{ cell: 4, digit: Number(sol[4]) }] };
    expect(stepMatchesSolution(wrongElim, sol)).toBe(false);
  });

  it("REGRESSION: an elimination done by hand is not re-suggested (Anders's bug)", () => {
    // find a real puzzle whose path contains an elimination-only step
    for (let t = 0; t < 80; t++) {
      const g0 = generatePuzzle(t % 2 ? 'rotational' : 'none');
      const g = cloneGrid(g0);
      let elimStep = null;
      for (let k = 0; k < 60; k++) {
        const step = findNextStep(g);
        if (!step) break;
        if (step.placements.length === 0 && step.eliminations.length > 0) {
          elimStep = step;
          break;
        }
        applyStep(g, step);
      }
      if (!elimStep) continue;
      // rebuild the position as manual play: values placed, exhaustive
      // corner marks (Anders-style), with the elimination done BY HAND
      const cells: CellState[] = Array.from({ length: 81 }, (_, i) => ({
        given: g0.given[i] === 1,
        value: g.values[i],
        corner: 0,
        center: 0,
        excluded: 0,
        colors: []
      }));
      const canon = engineGrid(cells);
      for (let i = 0; i < 81; i++) if (!cells[i].value) cells[i].corner = canon.cands[i];
      for (const { cell, digit } of elimStep.eliminations) cells[cell].corner &= ~bit(digit);
      // the old behaviour (canonical grid) re-suggests the exact same step…
      const before = findNextStep(engineGrid(cells))!;
      expect(before.tech).toBe(elimStep.tech);
      expect(before.eliminations).toEqual(elimStep.eliminations);
      // …the exhaustive contract has moved past it
      const after = findNextStep(contractGrid(cells, false, 'exhaustive'))!;
      expect(
        after.tech === elimStep.tech &&
          JSON.stringify(after.eliminations) === JSON.stringify(elimStep.eliminations)
      ).toBe(false);
      return;
    }
    throw new Error('no elimination-only step found in 80 generated puzzles');
  });
});
