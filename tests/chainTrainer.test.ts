/**
 * The chain trainer (src/engine/chainTrainer.ts): links classified as the
 * AIC vocabulary has them, alternation enforced, the conclusions those of
 * the engine's own chains, and the step drawn like a hint.
 */
import { describe, it, expect } from 'vitest';
import { parseGrid, gridFromValues, bit } from '../src/engine/board';
import { classifyLink, extend, conclusions, chainStep, statement, nextLinks, EMPTY_CHAIN, Chain } from '../src/engine/chainTrainer';
import { EXAMPLES } from '../src/content/examples';

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';

function exampleGrid(tech: keyof typeof EXAMPLES) {
  const ex = EXAMPLES[tech]!;
  const g = gridFromValues(ex.values.split('').map(Number));
  for (let i = 0; i < 81; i++) if (!g.values[i]) g.cands[i] = ex.cands[i];
  return { g, step: ex.step };
}

describe('links', () => {
  it('bivalue cell: strong; a third candidate makes it weak; different digits elsewhere: none', () => {
    const g = parseGrid(EASY)!;
    const bivalue = [...g.values].findIndex((v, i) => v === 0 && [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => g.cands[i] & bit(d)).length === 2);
    const [d1, d2] = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => g.cands[bivalue] & bit(d));
    expect(classifyLink(g, { cell: bivalue, digit: d1 }, { cell: bivalue, digit: d2 }).kind).toBe('strong');
    const trivalue = [...g.values].findIndex((v, i) => v === 0 && [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => g.cands[i] & bit(d)).length >= 3);
    const [e1, e2] = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => g.cands[trivalue] & bit(d));
    expect(classifyLink(g, { cell: trivalue, digit: e1 }, { cell: trivalue, digit: e2 }).kind).toBe('weak');
    expect(classifyLink(g, { cell: bivalue, digit: d1 }, { cell: bivalue, digit: d1 }).kind).toBeNull();
    expect(classifyLink(g, { cell: 0, digit: 9 }, { cell: 1, digit: 9 }).kind).toBeNull(); // not candidates
  });

  it('the engine’s own chains are accepted link by link and reach their eliminations', () => {
    for (const tech of ['X_CHAIN', 'XY_CHAIN', 'AIC'] as const) {
      const { g, step } = exampleGrid(tech);
      const links = step.links!;
      if (!links.every((l) => l.from.length === 1 && l.to.length === 1)) continue;
      let chain: Chain = EMPTY_CHAIN;
      const nodes = [links[0].from[0], ...links.map((l) => l.to[0])];
      for (const node of nodes) {
        const r = extend(g, chain, node);
        expect(r.ok, `${tech}: ${r.message}`).toBe(true);
        chain = r.chain;
      }
      expect(chain.links.length % 2).toBe(1);
      const found = conclusions(g, chain);
      for (const e of step.eliminations) expect(found, tech).toContainEqual(e);
      const drawn = chainStep(g, chain);
      expect(drawn.links).toHaveLength(chain.links.length);
      expect(drawn.description).toContain('One of the two ends is true');
      expect(statement(chain)).toMatch(/^If the \d in r\dc\d is false, then/);
    }
  });

  it('refuses a weak link where a strong one is needed, a repeat, and a non-link', () => {
    const { g, step } = exampleGrid('X_CHAIN');
    const first = step.links![0].from[0];
    let chain = extend(g, EMPTY_CHAIN, first).chain;
    // a cell that sees the start but is not its conjugate: weak where strong is needed
    const weakCell = [...Array(81).keys()].find((c) => {
      const v = classifyLink(g, first, { cell: c, digit: first.digit });
      return v.kind === 'weak';
    });
    if (weakCell !== undefined) {
      const r = extend(g, chain, { cell: weakCell, digit: first.digit });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/needs a strong link/);
    }
    expect(extend(g, chain, first).ok).toBe(false);
    chain = extend(g, chain, step.links![0].to[0]).chain;
    expect(chain.links).toEqual(['strong']);
    expect(chainStep(g, chain).description).toContain('One of the two ends is true');
    chain = { nodes: chain.nodes, links: chain.links.concat('weak') };
    expect(conclusions(g, { nodes: [...chain.nodes, first], links: chain.links })).toEqual([]);
  });

  it('closes a loop on the engine’s own Nice Loop, and every weak link then removes', () => {
    const { g, step } = exampleGrid('NICE_LOOP');
    let chain: Chain = EMPTY_CHAIN;
    const nodes = [step.links![0].from[0], ...step.links!.map((l) => l.to[0])];
    for (const node of nodes) {
      const r = extend(g, chain, node);
      expect(r.ok, r.message).toBe(true);
      chain = r.chain;
    }
    expect(chain.closed).toBe(true);
    expect(extend(g, chain, nodes[1]).ok).toBe(false);
    const found = conclusions(g, chain);
    for (const e of step.eliminations) expect(found).toContainEqual(e);
    expect(chainStep(g, chain).tech).toMatch(/NICE_LOOP|X_CYCLES/);
    expect(statement(chain)).toContain('again, as assumed');
  });

  it('suggests the candidates that link to the last one, and draws the goal', () => {
    const { g, step } = exampleGrid('AIC');
    const nodes = [step.links![0].from[0], ...step.links!.map((l) => l.to[0])];
    let chain = extend(g, EMPTY_CHAIN, nodes[0]).chain;
    expect(nextLinks(g, chain).strong).toContainEqual(nodes[1]);
    expect(nextLinks(g, chain).weak).toEqual([]); // a strong link is needed first
    chain = extend(g, chain, nodes[1]).chain;
    const next = nextLinks(g, chain);
    expect([...next.strong, ...next.weak]).toContainEqual(nodes[2]);
    const drawn = chainStep(g, chain, { suggest: true, goal: step.eliminations });
    expect(drawn.secondary).toContainEqual(nodes[2]);
    expect(drawn.fins).toEqual(step.eliminations);
    expect(drawn.labels?.fins).toMatch(/goal/);
  });
});
