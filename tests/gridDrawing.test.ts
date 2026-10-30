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
import type { CellDigit, Step } from '../src/engine/steps';

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
  return boardAt(EXAMPLES[tech]!, step ?? EXAMPLES[tech]!.step);
}

/** the board at a position (the puzzle's givens, the board's digits, every cell's candidates), with a step shown in full */
function boardAt(ex: { puzzle: string; values: string; cands: number[] }, step: Step): string {
  const cells = Array.from({ length: 81 }, (_, i) => {
    const value = Number(ex.values[i]);
    return { given: ex.puzzle[i] >= '1' && ex.puzzle[i] <= '9', value, corner: 0, center: 0, excluded: value ? 0 : 0x1ff & ~ex.cands[i], colors: [] };
  });
  useGame.setState({ cells, autoCandidates: true, hint: step, hintStage: 'full', walkIndex: 0, paused: false, won: false, chain: null });
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
      // one bar per group, in its members' mark's ink, under the marks and cut out by the digits (an almost locked set has none)
      const ink = { oneOf: 'var(--hint-place-ink)', false: 'var(--hint-false)', primary: 'var(--hint-primary-ink)', elim: 'var(--hint-elim)' };
      const bars = [...html.matchAll(/<line class="hint-group-bar"[^>]*stroke="([^"]+)"[^>]*stroke-width="3"[^>]*stroke-linecap="round"/g)].map((x) => x[1]);
      expect(bars, tech).toEqual(m.sets.flatMap((x) => (x.style === 'als' ? [] : [ink[x.style]])));
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

const { parseGrid } = await import('../src/engine/board');
const { findStep } = await import('../src/engine/humanSolver');

describe("the app board draws an almost locked set's tiles and letter tabs (docs/hint-drawing-sets.md, decisions 5-10)", () => {
  const ALS: Tech[] = ['AIC_ALS', 'ALS_XZ', 'ALS_XY_WING', 'ALS_XY_CHAIN', 'DEATH_BLOSSOM'];
  /** the tiles a full view draws, their outlines, a filled tile's fill, and the tabs, from the markup */
  const parts = (html: string) => ({
    tiles: [...html.matchAll(/<g class="hint-tile">([\s\S]*?)<\/g>/g)].map((m) => m[1]),
    fills: [...html.matchAll(/<g class="hint-tile-fill">([\s\S]*?)<\/g>/g)].map((m) => m[1]),
    tabs: [...html.matchAll(/<g class="hint-tab">([\s\S]*?)<\/g>/g)].map((m) => m[1])
  });

  it('a tile in each cell of each set, in its tint at the set alpha, outlined in its ink at each board size, and a tab on each with its letter', () => {
    for (const tech of ALS) {
      const ex = EXAMPLES[tech]!;
      const html = board(tech);
      const m = frameMarks(ex.step, null, (c) => ex.values[c] !== '0');
      const tint = new Map(m.sets.filter((x) => x.tint).map((x) => [x.set, x.tint!]));
      const { tiles, fills, tabs } = parts(html);
      const lettered = ex.step.sets!.flatMap((x, k) => (tint.has(k) ? x.cells.map(() => k) : []));
      expect(tiles.length, tech).toBe(lettered.length);
      expect(tabs.length, tech).toBe(lettered.length);
      for (const [k, set] of ex.step.sets!.entries()) {
        const t = tint.get(k)!;
        const own = tiles.filter((x) => x.includes(`var(--hint-set-${t}-ink)`));
        expect(own.length, `${tech}: set ${set.letter}`).toBeGreaterThanOrEqual(set.cells.length);
        // filled at the set alpha, outlined inwards three times, one for each board size, wider on a small board
        const solid = own.filter((x) => !x.includes('stroke-dasharray')).length;
        expect(fills.filter((x) => x.includes(`fill="var(--hint-set-${t})" style="fill-opacity:var(--hint-set-alpha)"`)).length, tech).toBe(solid);
        for (const x of own) {
          expect([...x.matchAll(/class="hint-tile-(wide|small|tiny)"[^>]*stroke-width="([\d.]+)"/g)].map((y) => [y[1], y[2]]), tech).toEqual([
            ['wide', '2.5'],
            ['small', '4.5'],
            ['tiny', '5']
          ]);
        }
        // the tab: the set's ink, the letter bold in the board's colour, a keyline round it
        const letters = tabs.filter((x) => x.includes(`fill="var(--hint-set-${t}-ink)"`)).map((x) => x.match(/<text[^>]*font-weight="700" fill="var\(--cell-bg\)">([A-D])<\/text>/)?.[1]);
        expect(letters.filter((x) => x === set.letter).length, `${tech}: set ${set.letter}`).toBe(set.cells.length);
      }
      // the layers (G11): the tiles over the bands, their fill under the groups' bars, their outlines under the
      // marks; the tabs over the removal bars, under the start dots and the walk's numbers
      const at = (re: RegExp) => [...html.matchAll(new RegExp(re.source, 'g'))].map((x) => x.index!);
      const tileAt = at(/<g class="hint-tile(?:-fill)?">/);
      const marks = at(/class="hint-(?:ring|one-of)"|<circle[^>]*fill="var\(--hint-(?:primary|secondary|fin|place)\)"/);
      expect(Math.max(...tileAt), tech).toBeLessThan(Math.min(...marks));
      const tabAt = at(/<g class="hint-tab">/);
      expect(Math.min(...tabAt), tech).toBeGreaterThan(Math.max(...at(/class="hint-bar"/), ...at(/class="knockout"/)));
      expect(Math.max(...tabAt), tech).toBeLessThan(html.indexOf('class="chain-labels"'));
    }
  });

  it("a set's members as their digits alone, bold in the ring's ink, with no mark", () => {
    const html = board('AIC_ALS');
    // the 4s of r7c8 and r8c8, set A's members
    for (const cell of [61, 70]) {
      // the 4's place: the left column, the middle row
      const x = 4 + (cell % 9) * 100 + 22;
      const y = 4 + Math.floor(cell / 9) * 100 + 58;
      expect(html).toMatch(new RegExp(`<text x="${x}" y="${y}"[^>]*font-weight="700" fill="var\\(--hint-in-ring\\)">4</text>`));
      expect(html).not.toMatch(new RegExp(`<circle[^>]*cx="${x}" cy="${y - 7}"`));
    }
  });

  it("a cell in two sets as the smaller set's tile and the other's outline dashed inside it, no fill, both tabs", () => {
    // the set fixture's ALS-XY-Chain whose A, r7c7, lies inside D, r7c5 and r7c7
    const puzzle = '.37.4......67.8...........972.....61..91.54..14.....856...........9.28......8.23.';
    const fx = JSON.parse(new TextDecoder().decode(readFileSync('tests/fixtures/setDrawings.json')));
    const position = fx.named['shared cells that derive, step 25, ALS_XY_CHAIN'].position as { puzzle: string; values: string; cands: number[] };
    expect(position.puzzle).toBe(puzzle);
    const g = parseGrid(puzzle)!;
    for (let i = 0; i < 81; i++) {
      g.values[i] = Number(position.values[i]);
      g.cands[i] = position.cands[i];
    }
    const step = findStep('ALS_XY_CHAIN', g)!;
    const html = boardAt(position, step);
    const { tiles, fills, tabs } = parts(html);
    const m = frameMarks(step, null, (c) => position.values[c] !== '0');
    const tintOf = (k: number) => m.sets.find((x) => x.set === k)!.tint!;
    // r7c7: A's tile, filled, and D's outline dashed one width inside it at each size, with no fill
    const [left, top] = [4 + 6 * 100, 4 + 6 * 100];
    const inCell = (x: string) => {
      const [, px, py] = x.match(/x="([\d.]+)" y="([\d.]+)"/)!;
      return Number(px) > left && Number(px) < left + 100 && Number(py) > top && Number(py) < top + 100;
    };
    const here = tiles.filter(inCell);
    expect(here).toHaveLength(2);
    expect(fills.filter(inCell)).toHaveLength(1);
    expect(fills.filter(inCell)[0]).toContain(`fill="var(--hint-set-${tintOf(0)})"`);
    expect(here[0]).toContain(`stroke="var(--hint-set-${tintOf(0)}-ink)"`);
    expect(here[1]).not.toContain('fill-opacity');
    expect((here[1].match(/stroke-dasharray="6 4"/g) ?? []).length).toBe(3);
    expect(here[1]).toContain(`stroke="var(--hint-set-${tintOf(3)}-ink)"`);
    // inside A's outline by one outline width, at each size
    const xs = (x: string) => [...x.matchAll(/class="hint-tile-\w+" x="([\d.]+)"/g)].map((y) => Number(y[1]));
    expect(xs(here[1]).map((x, k) => x - xs(here[0])[k])).toEqual([2.5, 4.5, 5]);
    // both tabs on the shared cell, A's and D's, and a tab on each tile
    expect(tabs.length).toBe(tiles.length);
    const tabCells = [...html.matchAll(/<g transform="translate\(([\d.]+) ([\d.]+)\)"><g class="hint-tab">[\s\S]*?>([A-D])<\/text>/g)].filter((x) => Number(x[1]) > left && Number(x[1]) < left + 100 && Number(x[2]) > top && Number(x[2]) < top + 100).map((x) => x[3]);
    expect(tabCells.sort()).toEqual(['A', 'D']);
  });

  it("the hint panel names the tiles as lettered cells, the swatch a small tile in the first tint drawn", () => {
    const panel = (tech: Tech) => {
      board(tech);
      useGame.setState({ info: { puzzle: EXAMPLES[tech]!.puzzle, score: 1000, level: 'hard' } as any });
      Object.assign(useGame.getInitialState() as unknown as Record<string, unknown>, useGame.getState());
      return renderToStaticMarkup(React.createElement(HintPanel, { onLearn: () => {} }));
    };
    expect(panel('ALS_XZ')).toContain('<i class="swatch-set-1"></i>lettered cells: an almost locked set, one digit more than cells; without any one of its digits, the others fill its cells');
    expect(panel('AIC_ALS')).toContain('<i class="swatch-set-1"></i>lettered cells: an almost locked set');
    expect(panel('DEATH_BLOSSOM')).toContain("<i class=\"swatch-set-1\"></i>lettered cells: a petal, an almost locked set for one of the stem&#x27;s digits");
    expect(panel('AIC_GROUPED')).not.toContain('lettered cells');
  });

  it("draws Death Blossom's weak ties as dashed lines with no head and no start dot, nothing for a petal's lock, and the panel names the dashed line (decision 15)", () => {
    const html = board('DEATH_BLOSSOM');
    // three ties from the stem r8c9 to its petals, one per stem digit; the locks inside the petals draw nothing
    expect((html.match(/class="chain-shaft weak weak-tie"/g) ?? []).length).toBe(3);
    expect(html.match(/class="chain-shaft[^"]*"/g)).toHaveLength(3);
    expect(html).not.toMatch(/<polygon points="[^"]+" fill="var\(--hint-arrow\)"/);
    expect(html).not.toContain('class="chain-start"');
    const panel = () => {
      useGame.setState({ info: { puzzle: EXAMPLES.DEATH_BLOSSOM!.puzzle, score: 1000, level: 'hard' } as any });
      Object.assign(useGame.getInitialState() as unknown as Record<string, unknown>, useGame.getState());
      return renderToStaticMarkup(React.createElement(HintPanel, { onLearn: () => {} }));
    };
    expect(panel()).toContain('<i class="swatch-weak-tie"></i>dashed line: its two ends see each other, so at most one is true');
    // a derived chain's dashed arrows are no weak ties: the ALS-XZ's restricted common has its head and its start dot
    const xz = board('ALS_XZ');
    expect(xz).toContain('class="chain-start"');
    expect(xz).not.toContain('weak-tie');
    useGame.setState({ hint: EXAMPLES.ALS_XZ!.step });
    expect(panel()).not.toContain('dashed line');
  });
});

const { boardDrawing, squareReachOf } = await import('../src/ui/boardLayout');
const { squareKeys } = await import('../src/content/hintMarks');
const { SIZES, pointsOf } = await import('../src/content/hintGeometry');
const { drawnLinks } = await import('../src/engine/hintFrames');

describe("the app board draws boardDrawing's drawing, a square reaching further than a disc (docs/hint-drawing-sets.md, decision 4)", () => {
  it("draws the arrows boardDrawing works out, and ends an arrow at a \"one of these\" square's reach and a gap, further than a disc's off its axes", () => {
    let ends = 0;
    let beyondDisc = 0;
    for (const tech of ['AIC_GROUPED', 'GROUPED_NICE_LOOP', 'GROUPED_X_CYCLES', 'AIC_ALS'] as Tech[]) {
      const ex = EXAMPLES[tech]!;
      const html = board(tech);
      const d = boardDrawing(ex.step, (c) => ({ value: Number(ex.values[c]), corner: 0, center: 0 }), (c) => ex.cands[c]);
      const drawn = drawnLinks(ex.step, null);
      const arrows = d.shapes.filter((s): s is Extract<typeof s, { kind: 'arrow' }> => s.kind === 'arrow' && drawn.has(s.link));
      // the board draws boardDrawing's shafts and heads, no others
      expect([...html.matchAll(/<path class="chain-shaft[^"]*" d="([^"]+)"/g)].map((m) => m[1]), tech).toEqual(arrows.map((s) => s.d));
      expect([...html.matchAll(/<polygon points="([^"]+)" fill="var\(--hint-arrow\)"/g)].map((m) => m[1]), tech).toEqual(arrows.filter((s) => s.head.length).map((s) => pointsOf(s.head)));
      const squares = squareKeys(ex.step, (c) => ex.values[c] !== '0');
      for (const s of arrows) {
        const link = ex.step.links![s.link];
        for (const [p, at] of [[s.tail, link.from], ...(s.head.length ? [[s.head[0], link.to] as const] : [])] as const) {
          // the candidate the end is at: the nearest of its node
          const off = (y: CellDigit) => Math.hypot(p.x - d.layout.centre(y).x, p.y - d.layout.centre(y).y);
          const x = at.reduce((a, b) => (off(b) < off(a) ? b : a));
          if (!squares.has(`${x.cell}:${x.digit}`)) continue;
          const c = d.layout.centre(x);
          ends++;
          const r = Math.hypot(p.x - c.x, p.y - c.y);
          const dir = { x: (p.x - c.x) / r, y: (p.y - c.y) / r };
          expect(r, `${tech}: link ${s.link} at ${x.digit} of cell ${x.cell}`).toBeCloseTo(squareReachOf(dir) + SIZES.gap * 100, 5);
          if (squareReachOf(dir) - SIZES.r * 100 > 0.5) beyondDisc++;
        }
      }
    }
    // the stored AIC with Groups and Grouped Nice Loop each end an arrow at a square's corner side
    expect(ends).toBeGreaterThanOrEqual(4);
    expect(beyondDisc).toBeGreaterThanOrEqual(2);
  });
});

const { MARK } = await import('../src/content/hintPalette');

describe("the app board draws a tile's outline over its marks' keylines, review round 1 of phase 4 (docs/hint-drawing-sets.md, decision 5)", () => {
  /** the drawing's circles and rects in order, each with where it is and what it is: a keyline, a tile's outline, or a mark */
  const shapes = (html: string) => {
    const out: { at: number; kind: 'key' | 'edge' | 'mark' | 'tabKey' | 'tab'; x: number; y: number }[] = [];
    // a tab is drawn about its place's centre, in a group moved there
    for (const m of html.matchAll(/<g transform="translate\(([\d.]+) ([\d.]+)\)"><g class="hint-tab(-key)?">/g)) {
      out.push({ at: m.index!, kind: m[3] ? 'tabKey' : 'tab', x: Number(m[1]), y: Number(m[2]) });
    }
    for (const m of html.matchAll(/<(circle|rect)\b([^>]*)>/g)) {
      const attr = (name: string) => m[2].match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1];
      const n = (name: string) => Number(attr(name));
      const cls = attr('class') ?? '';
      const [x, y] = m[1] === 'circle' ? [n('cx'), n('cy')] : [n('x') + n('width') / 2, n('y') + n('height') / 2];
      if (/^hint-tile-(wide|small|tiny)$/.test(cls)) out.push({ at: m.index!, kind: 'edge', x, y });
      else if (attr('stroke') === 'var(--cell-bg)' && attr('fill') === 'none' && !Number.isNaN(x)) out.push({ at: m.index!, kind: 'key', x, y });
      else if (/^hint-(ring|node|shade|one-of)$/.test(cls) || /^var\(--hint-(primary|secondary|fin|place)\)$/.test(attr('fill') ?? '')) out.push({ at: m.index!, kind: 'mark', x, y });
    }
    return out.sort((a, b) => a.at - b.at);
  };
  const cellAt = (p: { x: number; y: number }) => Math.floor((p.y - 4) / 100) * 9 + Math.floor((p.x - 4) / 100);

  it("draws the keylines of a tile's marks and tabs first, then the tile's outline, then the marks and the tabs, so a mark in its edge row sits on the outline", () => {
    // a mark in a tile's edge row reaches the tile's outer edge, keyline
    // and all, on a small board: under its keyline the outline was hidden
    expect((MARK.disc + MARK.keylineSmall) * 100).toBeGreaterThanOrEqual(MARK.tile * 100);
    const puzzle = '.37.4......67.8...........972.....61..91.54..14.....856...........9.28......8.23.';
    const fx = JSON.parse(new TextDecoder().decode(readFileSync('tests/fixtures/setDrawings.json')));
    const position = fx.named['shared cells that derive, step 25, ALS_XY_CHAIN'].position as { puzzle: string; values: string; cands: number[] };
    expect(position.puzzle).toBe(puzzle);
    const g = parseGrid(puzzle)!;
    for (let i = 0; i < 81; i++) {
      g.values[i] = Number(position.values[i]);
      g.cands[i] = position.cands[i];
    }
    const boards = [
      ...(['AIC_ALS', 'ALS_XZ', 'ALS_XY_WING', 'ALS_XY_CHAIN', 'DEATH_BLOSSOM'] as Tech[]).map((tech) => ({ where: tech, html: board(tech) })),
      { where: 'shared cells that derive', html: boardAt(position, findStep('ALS_XY_CHAIN', g)!) }
    ];
    for (const { where, html } of boards) {
      const all = shapes(html);
      const edges = all.filter((s) => s.kind === 'edge');
      const tiled = new Set(edges.map(cellAt));
      expect(tiled.size, where).toBeGreaterThan(0);
      let marks = 0;
      for (const cell of tiled) {
        const here = all.filter((s) => cellAt(s) === cell);
        const first = Math.min(...here.filter((s) => s.kind === 'edge').map((s) => s.at));
        const last = Math.max(...here.filter((s) => s.kind === 'edge').map((s) => s.at));
        for (const s of here) {
          if (s.kind === 'key' || s.kind === 'tabKey') expect(s.at, `${where}: a keyline in cell ${cell}`).toBeLessThan(first);
          if (s.kind === 'mark' || s.kind === 'tab') expect(s.at, `${where}: a mark in cell ${cell}`).toBeGreaterThan(last);
        }
        expect(here.filter((s) => s.kind === 'tabKey').length, `${where}: cell ${cell}`).toBe(here.filter((s) => s.kind === 'tab').length);
        marks += here.filter((s) => s.kind === 'mark').length;
      }
      expect(marks, where).toBeGreaterThan(0);
      // a mark on no tile keeps its keyline with it, as before
      const loose = all.filter((s) => (s.kind === 'mark' || s.kind === 'key') && !tiled.has(cellAt(s)));
      for (const s of loose.filter((x) => x.kind === 'mark')) {
        const key = loose.filter((x) => x.kind === 'key' && x.x === s.x && x.y === s.y && x.at < s.at).at(-1);
        if (key) expect(all.filter((x) => x.at > key.at && x.at < s.at && x.kind !== 'key'), `${where}: the mark at ${s.x}, ${s.y}`).toEqual([]);
      }
    }
  });
});
