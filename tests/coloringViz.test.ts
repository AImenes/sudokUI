import { describe, it, expect } from 'vitest';
import { Grid, emptyGrid, cloneGrid, isSolved, gridToString, bit } from '../src/engine/board';
import { solve } from '../src/engine/bruteForce';
import { generatePuzzle } from '../src/engine/generator';
import { findNextStep, applyStep } from '../src/engine/humanSolver';
import { Step, isTie } from '../src/engine/steps';
import { checkParity } from '../src/engine/truth';
import { findSimpleColors, findMultiColors } from '../src/engine/techniques/coloring';
import { findMedusa3d } from '../src/engine/techniques/medusa';
import { findRemotePair } from '../src/engine/techniques/chains';

/**
 * The colouring family (Simple Colors, Multi Colors, 3D Medusa, Remote
 * Pair) says its parity (docs/hint-drawing-colouring.md): each cluster's two
 * colours are dark and light purple, Multi Colors' second cluster dark and
 * light orange, joined by ties along its shortest drawn tree, and the
 * argument is weak ties, each with its sentence. These tests pin that model
 * and its words on small boards built by hand, and hunt the family on
 * generated puzzles, so the prose can never drift from what the board shows.
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

const at = (cell: number, digit = 7) => ({ cell, digit });

describe('coloring visual explanations', () => {
  it('Simple Colors trap: dark is the first 7 in reading order, the witnesses one of each shade', () => {
    const g = chainGrid();
    const step = findSimpleColors(g);
    expect(step).not.toBeNull();
    expect(step!.tech).toBe('SIMPLE_COLORS');
    expect(step!.truth).toBe('parity');
    expect(step!.eliminations).toEqual([at(4)]);
    // r1c2 is first: dark with r5c8, its partner across the cluster; light r1c8 and r5c2
    expect(step!.colouring).toEqual({ rule: 'trap', clusters: [{ dark: [at(1), at(43)], light: [at(7), at(37)] }] });
    expect(step!.description).toContain('The 7 in r1c5 sees a dark purple 7 in r1c2 and a light purple 7 in r1c8, so it is false either way.');
    // the chain of 4 cells is its 3 ties, strong and undirected, the first
    // with the cluster's sentence; then the two weak ties into the removal
    const ties = step!.links!.filter(isTie);
    const weak = step!.links!.filter((l) => !isTie(l));
    expect(ties).toHaveLength(3);
    expect(ties.map((l) => !!l.text)).toEqual([true, false, false]);
    const chain = new Set([1, 7, 37, 43]);
    for (const l of ties) {
      expect(chain.has(l.from[0].cell)).toBe(true);
      expect(chain.has(l.to[0].cell)).toBe(true);
    }
    expect(weak.map((l) => [l.from, l.to, l.strong, l.undirected])).toEqual([
      [[at(1)], [at(4)], false, true],
      [[at(7)], [at(4)], false, true]
    ]);
    expect(weak.map((l) => l.text)).toEqual([
      'If dark purple is true, the 7 in r1c2 is true, and the 7 in r1c5 goes.',
      'If light purple is true, the 7 in r1c8 is true, and the 7 in r1c5 goes. Either way it is false.'
    ]);
    expect(checkParity(step!, g.cands)).toEqual([]);
  });

  it('3D Medusa rule 4: the bivalue cell joins the cluster with a tie that draws nothing, the witnesses as the trap\'s', () => {
    const g = chainGrid();
    g.cands[37] = bit(7) | bit(9); // r5c2 becomes bivalue {7,9}: an in-cell link
    const step = findMedusa3d(g);
    expect(step).not.toBeNull();
    expect(step!.tech).toBe('MEDUSA_3D');
    expect(step!.colouring!.rule).toBe('medusa4');
    expect(step!.eliminations).toEqual([at(4)]);
    expect(step!.description).toContain('The 7 in r1c5 sees a dark purple 7 in r1c2 and a light purple 7 in r1c8, so it is false either way.');
    // 5 candidates (four 7s and the 9), so 4 ties of the tree, one of them inside r5c2
    const [cluster] = step!.colouring!.clusters;
    expect(cluster.dark.length + cluster.light.length).toBe(5);
    expect(cluster.dark).toContainEqual(at(37, 9));
    const ties = step!.links!.filter(isTie);
    const weak = step!.links!.filter((l) => !isTie(l));
    expect(ties).toHaveLength(4);
    const inCell = ties.filter((l) => l.from[0].cell === l.to[0].cell);
    expect(inCell).toHaveLength(1);
    expect(inCell[0].from[0].cell).toBe(37);
    expect(weak).toHaveLength(2);
    expect(weak.every((l) => !l.strong && l.undirected && l.to[0].cell === 4 && l.to[0].digit === 7)).toBe(true);
    expectLinksReal(g, step!, step!.description);
    expect(checkParity(step!, g.cands)).toEqual([]);
  });

  it('hunts the colouring family on real puzzles: sound, a parity checkParity clears, in the shades\' words', { timeout: 300_000 }, () => {
    const found: Record<string, number> = { SIMPLE_COLORS: 0, MULTI_COLORS: 0, MEDUSA_3D: 0, REMOTE_PAIR: 0 };
    const probes: [string, (g: Grid) => Step | null][] = [
      ['SIMPLE_COLORS', findSimpleColors],
      ['MULTI_COLORS', findMultiColors],
      ['MEDUSA_3D', findMedusa3d],
      ['REMOTE_PAIR', findRemotePair]
    ];
    const done = () => found.SIMPLE_COLORS >= 3 && found.MEDUSA_3D >= 2 && found.MULTI_COLORS >= 1 && found.REMOTE_PAIR >= 1;

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
          expect(hit.truth, context).toBe('parity');
          expect(checkParity(hit, g.cands), context).toEqual([]);
          // each cluster is one way true: every dark candidate, or every light one
          for (const cl of hit.colouring!.clusters) {
            const dark = new Set(cl.dark.map((x) => solution.values[x.cell] === x.digit));
            const light = new Set(cl.light.map((x) => solution.values[x.cell] === x.digit));
            expect([dark.size, light.size], context).toEqual([1, 1]);
            expect([...dark][0], context).not.toBe([...light][0]);
          }
          // the prose speaks in the board's shades, and in no old colour
          expect(hit.description, context).toMatch(/dark purple/);
          expect(hit.description, context).not.toMatch(/\b(blue|gold|red|violet|circled)\b/);
          if (name === 'MULTI_COLORS') {
            expect(hit.description, context).toMatch(/orange/);
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
