/**
 * The app board's own drawing of a hint (src/ui/Grid.tsx), rendered to
 * markup: the digits cut out of the arrows (docs/hint-drawing.md G11) by a
 * mask that holds the same digits, with every head painted back so none
 * is cut, and no mask when no line is drawn. The Learn diagrams' mask is
 * held by tests/examples.test.ts.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { EXAMPLES } from '../src/content/examples';
import type { Tech } from '../src/engine/ratings';
import type { Step } from '../src/engine/steps';

const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k)
};

const { useGame } = await import('../src/state/gameStore');
const { Grid } = await import('../src/ui/Grid');

/** the board at an example's position, with a step shown in full */
function board(tech: Tech, step?: Step): string {
  const ex = EXAMPLES[tech]!;
  const cells = Array.from({ length: 81 }, (_, i) => {
    const value = Number(ex.values[i]);
    return { given: ex.puzzle[i] >= '1' && ex.puzzle[i] <= '9', value, corner: 0, center: 0, excluded: value ? 0 : 0x1ff & ~ex.cands[i], colors: [] };
  });
  useGame.setState({ cells, autoCandidates: true, hint: step ?? ex.step, hintStage: 'full', walkIndex: 0, paused: false, won: false, chain: null });
  // a server render reads the store's initial state: give it the one set here
  // (as tests/setsReader.ts does)
  const init = useGame.getInitialState() as unknown as Record<string, unknown>;
  Object.assign(init, useGame.getState());
  return renderToStaticMarkup(React.createElement(Grid));
}

describe('the app board cuts the digits out of a hint\'s arrows', () => {
  it('with one mask on the lines, holding the board\'s digits, and every head painted back', () => {
    for (const tech of ['AIC', 'XY_CHAIN', 'NICE_LOOP', 'SIMPLE_COLORS'] as Tech[]) {
      const html = board(tech);
      const masks = [...html.matchAll(/<mask id="([^"]+)"[\s\S]*?<\/mask>/g)];
      expect(masks, tech).toHaveLength(1);
      const [whole, id] = masks[0];
      expect(html, tech).toContain(`class="chain-arrows" mask="url(#${id})"`);
      // the same digits as the board shows, in the mask's knock-out group
      const ko = whole.match(/<g class="knockout">([\s\S]*)<\/g>/)?.[1] ?? '';
      const digits = (s: string) => [...s.matchAll(/<text[^>]*>(\d)<\/text>/g)].map((m) => m[1]).join('');
      const outside = html.replace(whole, '');
      const boardDigits = digits(outside.slice(outside.indexOf('</g>', outside.indexOf('class="chain-arrows"'))));
      expect(digits(ko), tech).toBe(boardDigits);
      // every head drawn is painted back, white, after the digits
      const heads = [...outside.matchAll(/<polygon points="([^"]+)" fill="var\(--hint-arrow\)"/g)].map((m) => m[1]);
      const back = [...whole.matchAll(/<polygon points="([^"]+)" fill="#fff"/g)].map((m) => m[1]);
      expect(back, tech).toEqual(heads);
      // a colouring's full view draws its weak ties, dashed lines with no head
      if (tech === 'SIMPLE_COLORS') {
        expect(heads.length, tech).toBe(0);
        continue;
      }
      expect(heads.length, tech).toBeGreaterThan(0);
      expect(whole.indexOf('<polygon'), tech).toBeGreaterThan(whole.indexOf('class="knockout"'));
    }
  });

  it('and draws no mask when the hint draws no line', () => {
    expect(board('NAKED_SINGLE')).not.toContain('<mask');
    // a switch inside one cell draws no line, but keeps its start dot
    const ex = EXAMPLES.XY_CHAIN!;
    const inCell = ex.step.links!.find((l) => l.from[0].cell === l.to[0].cell)!;
    const html = board('XY_CHAIN', { ...ex.step, links: [inCell] });
    expect(html).not.toContain('<mask');
    expect(html).toContain('class="chain-start"');
  });

  it('with the stylesheet turning the mask\'s digits black and thick', () => {
    const css = new TextDecoder().decode(readFileSync('src/ui/styles.css'));
    expect(css).toMatch(/\.board \.knockout text,\s*\.board \.knockout tspan \{\s*fill: #000 !important;/);
    expect(css).toMatch(/\.board \.knockout text \{\s*stroke: #000;\s*stroke-width: max\(0\.12em, 4px\);/);
  });
});

const { frameMarks } = await import('../src/content/hintMarks');
const { HintPanel, ChainPanel } = await import('../src/ui/HintPanel');
const { extend, chainStep, EMPTY_CHAIN } = await import('../src/engine/chainTrainer');
const { gridFromValues } = await import('../src/engine/board');

describe("the app board and its panels draw a chain's truth (phase 2b)", () => {
  const kinds = (tech: Tech) => {
    const ex = EXAMPLES[tech]!;
    return [...frameMarks(ex.step, null, (c) => ex.values[c] !== '0').cands.values()].flatMap((m) => [...m.values()]);
  };

  it('a ring in the false colour for each false node, a disc in the true colour for each true one, and none outside a derived chain', () => {
    for (const tech of ['AIC', 'XY_CHAIN', 'W_WING', 'AIC_GROUPED', 'GROUPED_NICE_LOOP'] as Tech[]) {
      const html = board(tech);
      const k = kinds(tech);
      const n = (kind: string) => k.filter((x) => x === kind).length;
      expect(n('false'), tech).toBeGreaterThan(0);
      expect(n('true'), tech).toBeGreaterThan(0);
      expect((html.match(/<circle class="hint-ring"[^>]*stroke="var\(--hint-false\)"/g) ?? []).length, tech).toBe(n('false'));
      expect(n('place') + n('placeOn'), tech).toBe(0);
      expect((html.match(/<circle[^>]*fill="var\(--hint-place\)"/g) ?? []).length, tech).toBe(n('true'));
    }
    for (const tech of ['X_WING', 'SIMPLE_COLORS', 'NISHIO_FORCING_CHAIN'] as Tech[]) expect(board(tech), tech).not.toContain('var(--hint-false)');
  });

  it('a true group\'s members as pale "one of these" squares on a bar in the true ink, a false group\'s rings on a bar in the false ink (docs/hint-drawing-sets.md, decisions 1-3)', () => {
    for (const tech of ['AIC_GROUPED', 'GROUPED_NICE_LOOP', 'GROUPED_X_CYCLES', 'AIC_ALS'] as Tech[]) {
      const ex = EXAMPLES[tech]!;
      const html = board(tech);
      const m = frameMarks(ex.step, null, (c) => ex.values[c] !== '0');
      const squares = [...m.cands.values()].flatMap((x) => [...x.values()]).filter((x) => x === 'oneOf').length;
      // each square: the pale fill edged inside in the true ink, never the true disc's fill, with a keyline for each board size
      expect((html.match(/<rect class="hint-one-of"[^>]*fill="var\(--hint-one-of\)" stroke="var\(--hint-place-ink\)"/g) ?? []).length, tech).toBe(squares);
      expect((html.match(/class="hint-one-of-wide"/g) ?? []).length, tech).toBe(squares);
      expect((html.match(/class="hint-one-of-small"/g) ?? []).length, tech).toBe(squares);
      // one bar per group, in its members' mark's ink, under the marks and cut out by the digits
      const ink = { oneOf: 'var(--hint-place-ink)', false: 'var(--hint-false)', primary: 'var(--hint-primary-ink)', elim: 'var(--hint-elim)' };
      const bars = [...html.matchAll(/<line class="hint-group-bar"[^>]*stroke="([^"]+)"[^>]*stroke-width="3"[^>]*stroke-linecap="round"/g)].map((x) => x[1]);
      expect(bars, tech).toEqual(m.sets.map((x) => ink[x.style]));
      if (bars.length) {
        expect(html.indexOf('class="hint-group-bars" mask="url(#'), tech).toBeGreaterThan(html.indexOf('<mask id='));
        expect(html.indexOf('class="hint-group-bars"'), tech).toBeLessThan(html.indexOf('<rect class="hint-one-of"') === -1 ? html.indexOf('class="hint-ring"') : html.indexOf('<rect class="hint-one-of"'));
        // still one mask, cutting the digits out of the bars and the arrows alike
        expect((html.match(/<mask id=/g) ?? []).length, tech).toBe(1);
      }
    }
    // the stored AIC with Groups ends at a TRUE group, two squares on one green bar; the Grouped Nice Loop has a true and a false group of three
    expect(board('AIC_GROUPED').match(/<rect class="hint-one-of"/g)).toHaveLength(2);
    expect(board('GROUPED_NICE_LOOP').match(/<line class="hint-group-bar"/g)).toHaveLength(2);
    expect(board('GROUPED_NICE_LOOP').match(/<rect class="hint-one-of"/g)).toHaveLength(3);
    // a square's digit is bold in the ring's ink, as on a ring: near-black would be 2.58:1 on the dark square
    const html = board('AIC_GROUPED');
    const ex = EXAMPLES.AIC_GROUPED!;
    for (const { cell, digit } of ex.step.sets![0].members) {
      const x = 4 + (cell % 9) * 100 + 22 + ((digit - 1) % 3) * 28;
      const y = 4 + Math.floor(cell / 9) * 100 + 30 + Math.floor((digit - 1) / 3) * 28;
      expect(html).toMatch(new RegExp(`<text x="${x}" y="${y}"[^>]*font-weight="700" fill="var\\(--hint-in-ring\\)">${digit}</text>`));
    }
  });

  it("the hint panel names a group by its shapes, squares or rings joined by a bar, and a set's squares as a set's", () => {
    const panel = (tech: Tech) => {
      board(tech);
      useGame.setState({ info: { puzzle: EXAMPLES[tech]!.puzzle, score: 1000, level: 'hard' } as any });
      Object.assign(useGame.getInitialState() as unknown as Record<string, unknown>, useGame.getState());
      return renderToStaticMarkup(React.createElement(HintPanel, { onLearn: () => {} }));
    };
    const loop = panel('GROUPED_NICE_LOOP');
    expect(loop).toContain('<i class="swatch-one-of-bar"></i>squares joined by a bar: one of them is true, if the first candidate (by the small dot) is false');
    expect(loop).toContain('<i class="swatch-false-bar"></i>rings joined by a bar: none of them is true, if the first candidate (by the small dot) is false');
    expect(loop).not.toContain('each group');
    const als = panel('AIC_ALS');
    expect(als).toContain('<i class="swatch-one-of"></i>squares in a set: one of them is true, if the first candidate (by the small dot) is false');
    expect(als).not.toContain('joined by a bar');
  });

  it("the hint panel's legend names them by the premise, and the trainer's only what its board draws", () => {
    board('AIC');
    useGame.setState({ info: { puzzle: EXAMPLES.AIC!.puzzle, score: 1000, level: 'hard' } as any });
    Object.assign(useGame.getInitialState() as unknown as Record<string, unknown>, useGame.getState());
    const panel = renderToStaticMarkup(React.createElement(HintPanel, { onLearn: () => {} }));
    expect(panel).toContain('<i class="swatch-true"></i>true, if the first candidate (by the small dot) is false');
    expect(panel).toContain('<i class="swatch-false"></i>false, if the first candidate (by the small dot) is false');
    // the trainer, two candidates into the X-Chain: a strong link, its start false and its end true
    const ex = EXAMPLES.X_CHAIN!;
    const g = gridFromValues(ex.values.split('').map(Number));
    for (let i = 0; i < 81; i++) if (!g.values[i]) g.cands[i] = ex.cands[i];
    const links = ex.step.links!;
    const nodes = [links[0].from[0], ...links.map((l) => l.to[0])];
    const trainer = (count: number) => {
      let chain = EMPTY_CHAIN;
      for (const node of nodes.slice(0, count)) chain = extend(g, chain, node).chain;
      board('X_CHAIN', chainStep(g, chain));
      useGame.setState({ chain, chainNote: '', chainGoal: null, chainSuggest: false });
      Object.assign(useGame.getInitialState() as unknown as Record<string, unknown>, useGame.getState());
      return renderToStaticMarkup(React.createElement(ChainPanel));
    };
    const two = trainer(2);
    expect(two).toContain('false, if the first candidate (by the small dot) is false');
    expect(two).toContain('true, if the first candidate (by the small dot) is false');
    // with every node, the same, and nothing about a premise it has not shown impossible
    const all = trainer(nodes.length);
    expect(all).not.toContain('that premise is impossible');
    expect(all).toContain('removed by it');
    // a walk frame before the conclusion draws no removal, and its legend names none
    useGame.setState({ hintStage: 'walk', walkIndex: 0 });
    Object.assign(useGame.getInitialState() as unknown as Record<string, unknown>, useGame.getState());
    expect(renderToStaticMarkup(React.createElement(ChainPanel))).not.toContain('removed by it');
    useGame.setState({ chain: null });
  });
});
