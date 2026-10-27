/**
 * The chain trainer (src/engine/chainTrainer.ts): links classified as the
 * AIC vocabulary has them, alternation enforced, the conclusions those of
 * the engine's own chains, and the step drawn like a hint.
 */
import { describe, it, expect } from 'vitest';
import { parseGrid, gridFromValues, bit } from '../src/engine/board';
import { classifyLink, extend, conclusions, chainStep, statement, nextLinks, buildable, EMPTY_CHAIN, Chain } from '../src/engine/chainTrainer';
import { findNextStep, findStep, applyStep } from '../src/engine/humanSolver';
import { isTie } from '../src/engine/steps';
import type { CellDigit, Step } from '../src/engine/steps';
import { PARITY_FIXTURES } from './parityFixtures';
import { deriveTruth } from '../src/engine/truth';
import { hintMarks } from '../src/content/hintMarks';
import { EXAMPLES } from '../src/content/examples';
import { SET_TECHS } from './chainSets';

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
      // drawn as used, so every node's truth reads off the links: the start
      // false, strong links into true nodes, weak ones into false nodes
      // (docs/hint-drawing.md G8), whatever each pair's real kind
      expect(drawn.links!.map((l) => l.strong)).toEqual(chain.links.map((_, i) => i % 2 === 0));
      expect(deriveTruth(drawn)!.problems, tech).toEqual([]);
      // so the trainer draws its nodes true and false, from a false first node
      const marks = hintMarks(drawn, { solved: () => false });
      const truths = nodes.map((n) => marks.cands.get(n.cell)?.get(n.digit));
      expect(truths.every((x) => x === 'true' || x === 'false' || x === 'elim'), tech).toBe(true);
      expect(truths[0], tech).toBe('false');
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
    // a goal candidate the player removed some other way is no longer drawn
    const gone = step.eliminations[0];
    const g2 = structuredClone(g);
    g2.cands[gone.cell] &= ~bit(gone.digit);
    const rest = chainStep(g2, chain, { goal: step.eliminations }).fins ?? [];
    expect(rest).not.toContainEqual(gone);
    expect(rest).toHaveLength(step.eliminations.length - 1);
  });
});

describe('what the trainer can take as its goal (Build it yourself)', () => {
  /** the ties' path from one candidate to another: a colouring's spanning tree has one */
  function tiePath(step: Step, from: CellDigit, to: CellDigit): CellDigit[] {
    const key = (x: CellDigit) => `${x.cell}:${x.digit}`;
    const next = new Map<string, CellDigit[]>();
    for (const l of step.links!.filter(isTie)) {
      const [a, b] = [l.from[0], l.to[0]];
      next.set(key(a), [...(next.get(key(a)) ?? []), b]);
      next.set(key(b), [...(next.get(key(b)) ?? []), a]);
    }
    const back = new Map<string, CellDigit | null>([[key(from), null]]);
    const queue = [from];
    while (queue.length) {
      const x = queue.shift()!;
      for (const y of next.get(key(x)) ?? []) {
        if (back.has(key(y))) continue;
        back.set(key(y), x);
        queue.push(y);
      }
    }
    const path: CellDigit[] = [];
    for (let x: CellDigit | null | undefined = to; x; x = back.get(key(x))) path.unshift(x);
    return path;
  }

  it("takes a colouring by its ties, whatever its weak ties join: 3D Medusa rule 3's one weak tie from a cell's two shades", () => {
    // a 3D Medusa practice position where main offered the button
    const g = parseGrid('....1.63..5.......2...73....9......8..7.......8..4...7.2..38..554.....9....92.7..')!;
    for (let k = 0; k < 27; k++) applyStep(g, findNextStep(g)!);
    const step = findNextStep(g)!;
    expect([step.tech, step.colouring?.rule]).toEqual(['MEDUSA_3D', 'medusa3']);
    const argument = step.links!.filter((l) => !isTie(l));
    expect(argument.map((l) => [l.from.length, l.to.length])).toEqual([[2, 1]]);
    expect(buildable(step)).toBe(true);
    // and the trainer builds it, along the ties from the cell's dark candidate to its light one
    const [dark, light] = argument[0].from;
    const path = tiePath(step, dark, light);
    expect(path.length).toBeGreaterThan(2);
    let chain: Chain = EMPTY_CHAIN;
    for (const node of path) {
      const r = extend(g, chain, node);
      expect(r.ok, r.message).toBe(true);
      chain = r.chain;
    }
    expect(conclusions(g, chain)).toEqual(expect.arrayContaining(step.eliminations));
  });

  it('takes every shape of colouring, and still no chain through a group or a set, and nothing without links', () => {
    for (const f of PARITY_FIXTURES) expect(buildable(f.step), f.name).toBe(true);
    for (const tech of ['SIMPLE_COLORS', 'MULTI_COLORS', 'MEDUSA_3D', 'REMOTE_PAIR', 'X_CHAIN', 'XY_CHAIN', 'AIC'] as const) {
      expect(buildable(EXAMPLES[tech]!.step), tech).toBe(true);
    }
    // every technique whose step names sets, the ALS family too: an ALS-XZ's,
    // an ALS-XY-Wing's and a Death Blossom's links between sets may be single
    // candidates, but no tap builds a set's own link (docs/hint-drawing-sets.md, decision 21)
    for (const tech of SET_TECHS) {
      const { step } = EXAMPLES[tech]!;
      expect(step.sets?.length, tech).toBeGreaterThan(0);
      expect(buildable(step), tech).toBe(false);
    }
    expect(buildable(EXAMPLES.NAKED_PAIR!.step)).toBe(false);
    expect(buildable(null)).toBe(false);
  });

  it('refuses a step for its sets alone, whatever its links', () => {
    const { step } = EXAMPLES.AIC!;
    expect(buildable(step)).toBe(true);
    // the stored ALS-XZ's set A on a chain of single candidates
    const set = EXAMPLES.ALS_XZ!.step.sets![0];
    expect(buildable({ ...step, sets: [set] })).toBe(false);
    expect(buildable({ ...step, sets: [] })).toBe(true);
    // by its sets, not its name: an AIC with ALS whose only "set" is a bivalue
    // cell names no set (decision 14), and the trainer builds that cell's link
    const g = parseGrid('4..1.27.......3..45.7.9...3..45..62..8.....4..25..43..7...4.9.12..3.......67.9..2')!;
    for (let i = 0; i < 10; i++) applyStep(g, findNextStep(g)!);
    const oneCell = findStep('AIC_GROUPED', g)!;
    expect([oneCell.tech, oneCell.sets]).toEqual(['AIC_ALS', undefined]);
    expect(buildable(oneCell)).toBe(true);
  });
});

describe("the trainer's goal note (Build it yourself)", () => {
  it('names the goal by what the board shows, never by a colour, which now means a colouring\'s parity, in every language', async () => {
    const { useGame } = await import('../src/state/gameStore');
    const { useSettings } = await import('../src/state/settings');
    const { useLocales } = await import('../src/content/i18n');
    const nb = (await import('../src/content/locales/app.nb')).default;
    const es = (await import('../src/content/locales/app.es')).default;
    useLocales.setState({ loaded: { nb, es } });
    const before = useSettings.getState().lang;
    const said = {
      en: 'Goal: remove 4 from r1c1, 7 from r1c2 (marked on the board as you build). Tap a candidate to start.',
      nb: 'Mål: fjern 4 fra r1c1, 7 fra r1c2 (merket på brettet mens du bygger). ',
      es: 'Objetivo: eliminar el 4 de r1c1, el 7 de r1c2 (el tablero marca el objetivo mientras construyes). '
    };
    try {
      for (const lang of ['en', 'nb', 'es'] as const) {
        useSettings.getState().set({ lang });
        useGame.getState().startGame(EASY, 196, 'Easy');
        useGame.getState().startChain([
          { cell: 0, digit: 4 },
          { cell: 1, digit: 7 }
        ]);
        const note = useGame.getState().chainNote;
        expect(note.startsWith(said[lang]), `${lang}: ${note}`).toBe(true);
        expect(note, lang).not.toMatch(/purple|circled|lilla|ringet|morad|círculo/);
        useGame.getState().endChain();
      }
    } finally {
      useSettings.getState().set({ lang: before });
    }
  });
});
