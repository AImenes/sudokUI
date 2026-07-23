import { describe, it, expect } from 'vitest';
import { Grid, emptyGrid, cloneGrid, isSolved, gridToString, bit } from '../src/engine/board';
import { solve } from '../src/engine/bruteForce';
import { generatePuzzle } from '../src/engine/generator';
import { findNextStep, applyStep } from '../src/engine/humanSolver';
import { Step } from '../src/engine/steps';
import { findSimpleColors, findMultiColors } from '../src/engine/techniques/coloring';
import { findMedusa3d } from '../src/engine/techniques/medusa';

/**
 * The colouring family (Simple Colors, Multi Colors, 3D Medusa) explains
 * itself with the on-screen hues: blue/gold parities, red eliminations,
 * purple bridge colours. These tests pin that vocabulary and the link trees
 * so the prose can never drift from what the board shows.
 */

/** every link endpoint must be a live candidate of the current grid */
function expectLinksReal(g: Grid, step: Step, context: string) {
  for (const l of step.links ?? []) {
    for (const { cell, digit } of [...l.from, ...l.to]) {
      expect(g.values[cell], context).toBe(0);
      expect((g.cands[cell] & bit(digit)) !== 0, context).toBe(true);
    }
  }
}

/**
 * Deterministic single-digit chain: 7s only at r1c2, r1c5, r1c8, r5c2, r5c8.
 * Conjugate links: r1c2-r5c2 (col 2), r5c2-r5c8 (row 5), r5c8-r1c8 (col 8).
 * Row 1 holds three 7s, so the middle one (r1c5) stays outside the chain and
 * sees both chain ends, which carry opposite colours: a colour trap.
 */
function chainGrid(): Grid {
  const g = emptyGrid();
  const keep = new Set([1, 4, 7, 37, 43]);
  for (let c = 0; c < 81; c++) {
    if (!keep.has(c)) g.cands[c] &= ~bit(7);
  }
  return g;
}

describe('coloring visual explanations', () => {
  it('Simple Colors trap: names the blue and gold witnesses, links the chain', () => {
    const step = findSimpleColors(chainGrid());
    expect(step).not.toBeNull();
    expect(step!.tech).toBe('SIMPLE_COLORS');
    expect(step!.eliminations).toEqual([{ cell: 4, digit: 7 }]);
    // the trapped 7 must see one chain end of each colour, never the same twice
    const m = step!.description.match(/The 7 in r1c5 sees a blue 7 in (r1c[28]) and a gold 7 in (r1c[28])/);
    expect(m, step!.description).not.toBeNull();
    expect(m![1]).not.toBe(m![2]);
    // the chain of 4 cells is drawn as its 3 conjugate links, all strong
    expect(step!.links).toHaveLength(3);
    expect(step!.links!.every((l) => l.strong)).toBe(true);
    const chain = new Set([1, 7, 37, 43]);
    for (const l of step!.links!) {
      expect(chain.has(l.from[0].cell)).toBe(true);
      expect(chain.has(l.to[0].cell)).toBe(true);
    }
  });

  it('3D Medusa rule 4: bivalue hop joins the cluster, witnesses named', () => {
    const g = chainGrid();
    g.cands[37] = bit(7) | bit(9); // r5c2 becomes bivalue {7,9}: an in-cell link
    const step = findMedusa3d(g);
    expect(step).not.toBeNull();
    expect(step!.tech).toBe('MEDUSA_3D');
    expect(step!.eliminations).toEqual([{ cell: 4, digit: 7 }]);
    const m = step!.description.match(/The 7 in r1c5 sees a blue 7 in (r1c[28]) and a gold 7 in (r1c[28])/);
    expect(m, step!.description).not.toBeNull();
    expect(m![1]).not.toBe(m![2]);
    // 5 nodes (four 7s + the 9), so 4 spanning-tree links, all strong
    expect((step!.primary ?? []).length + (step!.secondary ?? []).length).toBe(5);
    expect(step!.links).toHaveLength(4);
    expect(step!.links!.every((l) => l.strong)).toBe(true);
    const inCell = step!.links!.filter((l) => l.from[0].cell === l.to[0].cell);
    expect(inCell).toHaveLength(1);
    expect(inCell[0].from[0].cell).toBe(37);
    expectLinksReal(g, step!, step!.description);
  });

  it('hunts the colouring family on real puzzles: sound, linked, hue-named', { timeout: 300_000 }, () => {
    const found: Record<string, number> = { SIMPLE_COLORS: 0, MULTI_COLORS: 0, MEDUSA_3D: 0 };
    const probes: [string, (g: Grid) => Step | null][] = [
      ['SIMPLE_COLORS', findSimpleColors],
      ['MULTI_COLORS', findMultiColors],
      ['MEDUSA_3D', findMedusa3d]
    ];
    const done = () =>
      found.SIMPLE_COLORS >= 3 && found.MEDUSA_3D >= 2 && found.MULTI_COLORS >= 1;

    for (let i = 0; i < 150 && !done(); i++) {
      const puzzle = generatePuzzle(i % 2 ? 'rotational' : 'none');
      const solution = solve(cloneGrid(puzzle));
      if (!solution) continue;
      const g = cloneGrid(puzzle);
      for (let s = 0; s < 200 && !isSolved(g); s++) {
        for (const [name, probe] of probes) {
          const hit = probe(g);
          if (!hit) continue;
          found[name]++;
          const context = `${name}: ${hit.description}\n${gridToString(puzzle)}`;
          for (const { cell, digit } of hit.eliminations) {
            expect(solution.values[cell], context).not.toBe(digit);
          }
          expectLinksReal(g, hit, context);
          expect(hit.links!.length, context).toBeGreaterThan(0);
          // the prose must speak in the board's hues
          expect(hit.description, context).toMatch(/blue|gold|red/);
          if (name === 'MULTI_COLORS') {
            expect(hit.description, context).toContain('purple');
            expect(hit.links!.some((l) => !l.strong), context).toBe(true);
          }
        }
        const step = findNextStep(g);
        if (!step) break;
        applyStep(g, step);
      }
    }
    // eslint-disable-next-line no-console
    console.info('coloring family counts:', found);
    expect(found.SIMPLE_COLORS).toBeGreaterThan(0);
    expect(found.MEDUSA_3D).toBeGreaterThan(0);
  });
});
