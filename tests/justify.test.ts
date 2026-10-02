/**
 * What justifies a move (src/engine/justify.ts): a single is credited
 * directly, a move that needs eliminations first is credited with the
 * hardest technique on the shortest path the solver finds to it, a wrong
 * move is justified by nothing, and the budget is honoured.
 */
import { describe, it, expect } from 'vitest';
import { gridFromValues, parseGrid, bit } from '../src/engine/board';
import { justify, singleAt } from '../src/engine/justify';
import { EXAMPLES } from '../src/content/examples';
import { TECHS } from '../src/engine/ratings';

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';

function exampleGrid(tech: keyof typeof EXAMPLES) {
  const ex = EXAMPLES[tech]!;
  const g = gridFromValues(ex.values.split('').map(Number));
  for (let i = 0; i < 81; i++) if (!g.values[i]) g.cands[i] = ex.cands[i];
  return { g, step: ex.step };
}

describe('justify', () => {
  it('credits a single directly, with the step built for that cell', () => {
    const g = parseGrid(EASY)!;
    let found = 0;
    for (let cell = 0; cell < 81; cell++) {
      if (g.values[cell]) continue;
      for (let d = 1; d <= 9; d++) {
        const single = singleAt(g, cell, d);
        if (!single) continue;
        found++;
        expect(['FULL_HOUSE', 'NAKED_SINGLE', 'HIDDEN_SINGLE']).toContain(single.tech);
        expect(single.placements).toEqual([{ cell, digit: d }]);
        const j = justify(g, { cell, digit: d, placed: true });
        expect(j.direct).toBe(true);
        expect(j.tech).toBe(single.tech);
        expect(j.steps).toHaveLength(1);
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it('credits a removal with the technique that makes it', () => {
    for (const tech of ['X_WING', 'NAKED_PAIR', 'HIDDEN_PAIR', 'SKYSCRAPER'] as const) {
      const { g, step } = exampleGrid(tech);
      const e = step.eliminations[0];
      const j = justify(g, { cell: e.cell, digit: e.digit, placed: false });
      expect(j.tech, tech).toBe(tech);
      expect(j.direct).toBe(false);
      expect(j.steps.map((s) => s.tech)).toEqual([tech]);
    }
  });

  it('credits a placement that needs an elimination first with the harder step', () => {
    // in the XY-Wing example, r2c8 becomes a single once the wing has fired
    const { g } = exampleGrid('XY_WING');
    expect(singleAt(g, 16, 6)).toBeNull();
    const j = justify(g, { cell: 16, digit: 6, placed: true });
    expect(j.tech).toBe('XY_WING');
    expect(j.direct).toBe(false);
    expect(j.steps).toHaveLength(2);
    expect(j.steps[1].placements).toEqual([{ cell: 16, digit: 6 }]);
    expect(TECHS[j.steps[0].tech].index).toBeGreaterThan(TECHS[j.steps[1].tech].index);
  });

  it('justifies a wrong move by nothing', () => {
    const { g, step } = exampleGrid('X_WING');
    const e = step.eliminations[0];
    expect(g.cands[e.cell] & bit(e.digit)).toBeTruthy();
    const j = justify(g, { cell: e.cell, digit: e.digit, placed: true });
    expect(j.tech).toBeNull();
    expect(j.steps).toEqual([]);
  });

  it('gives up at the budget, and on a cell already solved or a digit already gone', () => {
    const { g, step } = exampleGrid('X_WING');
    const e = step.eliminations[0];
    expect(justify(g, { cell: e.cell, digit: e.digit, placed: false }, { steps: 0, ms: 100 }).tech).toBeNull();
    const solved = [...g.values].findIndex((v) => v !== 0);
    expect(justify(g, { cell: solved, digit: g.values[solved], placed: true }).tech).toBeNull();
    const empty = [...g.values].findIndex((v) => v === 0);
    const gone = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((d) => !(g.cands[empty] & bit(d)))!;
    expect(justify(g, { cell: empty, digit: gone, placed: false }).tech).toBeNull();
  });
});
