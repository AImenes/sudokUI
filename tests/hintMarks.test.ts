/**
 * What a hint marks where (src/content/hintMarks.ts), shared by the app's
 * board, the Learn diagrams and both legends (docs/hint-drawing.md G1-G5,
 * G22): one mark per candidate, a removal over everything, a placement
 * over everything but a removal; a legend that names what is drawn and
 * nothing else; and the Learn diagram's layers in the spec's order.
 */
import { describe, it, expect } from 'vitest';
import type { CellDigit, Step } from '../src/engine/steps';
import { hintMarks, legendKinds, frameMarks } from '../src/content/hintMarks';
import { walkFrames } from '../src/engine/hintFrames';
import { boardSvg, legendOf } from '../src/content/boardSvg';
import { LIGHT } from '../src/content/hintPalette';
import { EXAMPLES } from '../src/content/examples';
import { TECHS, Tech } from '../src/engine/ratings';

const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k)
};

const A: CellDigit = { cell: 10, digit: 4 };
const B: CellDigit = { cell: 12, digit: 4 };
const C: CellDigit = { cell: 30, digit: 7 };
const step = (s: Partial<Step>): Step => ({ tech: 'X_WING', placements: [], eliminations: [], description: '', ...s }) as Step;
const none = { solved: () => false };

describe('the marks', () => {
  it('give each candidate one mark: a removal over everything, a placement over a role', () => {
    const m = hintMarks(step({ primary: [A, B], secondary: [A], fins: [C], placements: [B], eliminations: [C] }), none);
    expect(m.cands.get(A.cell)?.get(A.digit)).toBe('primary'); // the first kind it was given
    expect(m.cands.get(B.cell)?.get(B.digit)).toBe('place');
    expect(m.cands.get(C.cell)?.get(C.digit)).toBe('elim');
    const both = hintMarks(step({ placements: [A], eliminations: [A] }), none);
    expect(both.cands.get(A.cell)?.get(A.digit)).toBe('elim');
  });

  it('put a solved cell the step names on its digit, not on a candidate', () => {
    const m = hintMarks(step({ primary: [A, B] }), { solved: (c) => c === A.cell });
    expect(m.values.get(A.cell)).toBe('primary');
    expect(m.cands.has(A.cell)).toBe(false);
    expect(m.cands.get(B.cell)?.get(B.digit)).toBe('primary');
  });

  it('keep a colouring’s colour inside the ring of what it removes, and only a colour the step names', () => {
    const s = step({ tech: 'SIMPLE_COLORS', primary: [A], secondary: [B], eliminations: [A, C] });
    const m = hintMarks(s, none);
    expect(m.cands.get(A.cell)?.get(A.digit)).toBe('elimOn');
    expect(m.inside.get(A.cell)?.get(A.digit)).toBe('primary');
    expect(m.cands.get(C.cell)?.get(C.digit)).toBe('elim');
    expect(m.inside.get(C.cell)).toBeUndefined();
    // the same removal outside a colouring is a plain ring
    expect(hintMarks({ ...s, tech: 'X_CHAIN' }, none).inside.size).toBe(0);
  });

  it('keep the colour a step names for a placed chain node, as Digit Forcing places its own assumption', () => {
    const links = [{ from: [A], to: [B], strong: false }];
    const s = step({ tech: 'DIGIT_FORCING_CHAIN', primary: [A], links, placements: [A], labels: { primary: 'the assumption and the singles it forces' } });
    const m = hintMarks(s, none);
    expect(m.cands.get(A.cell)?.get(A.digit)).toBe('placeOn');
    expect(m.inside.get(A.cell)?.get(A.digit)).toBe('primary');
    // the legend keeps the assumption's words, and the placement's
    const k = legendKinds(s, m);
    expect([k.shown.has('place'), k.shown.has('primary'), k.intoPlace]).toEqual([true, true, []]);
    expect(legendOf(s).map((l) => l.label)).toEqual(['place', 'the assumption and the singles it forces']);
    // a named placement that is no chain node stays a plain placement
    expect(hintMarks(step({ primary: [C], placements: [C] }), none).cands.get(C.cell)?.get(C.digit)).toBe('place');
  });

  it('keep the colour a step names for a removed chain node, as Nishio removes its own assumption', () => {
    const links = [{ from: [A], to: [B], strong: true }];
    const s = step({ tech: 'NISHIO_FORCING_CHAIN', primary: [A], links, eliminations: [A] });
    const m = hintMarks(s, none);
    expect(m.cands.get(A.cell)?.get(A.digit)).toBe('elimOn');
    expect(m.inside.get(A.cell)?.get(A.digit)).toBe('primary');
    // so the legend still finds the assumption's words
    expect(legendKinds(s, m).intoRemove).toEqual([]);
    // a named removal that is no chain node stays a plain ring
    expect(hintMarks(step({ primary: [C], eliminations: [C] }), none).inside.size).toBe(0);
  });

  it('while walking a chain, mark only the nodes of the links drawn so far', () => {
    const links = [
      { from: [A], to: [B], strong: true },
      { from: [B], to: [C], strong: false }
    ];
    const s = step({ tech: 'AIC', primary: [A, B, C], links, eliminations: [{ cell: 40, digit: 4 }] });
    const m = hintMarks(s, { solved: () => false, links: links.slice(0, 1), show: (p) => p !== 'conclusion', walking: true });
    expect(m.cands.get(A.cell)?.get(A.digit)).toBe('primary');
    expect(m.cands.get(B.cell)?.get(B.digit)).toBe('primary');
    expect(m.cands.has(C.cell)).toBe(false);
    expect(m.cands.has(40)).toBe(false);
  });
});

describe('the walk', () => {
  const kinds = (m: ReturnType<typeof hintMarks>) =>
    [...m.cands].flatMap(([c, d]) => [...d].map(([digit, kind]) => `${c}:${digit}:${kind}`)).sort().join(' ');

  it('ends on the full view: every example\'s last frame marks every candidate as the full view does', () => {
    for (const [tech, ex] of Object.entries(EXAMPLES)) {
      const solved = (c: number) => ex!.values[c] !== '0';
      const frames = walkFrames(ex!.step);
      expect(kinds(frameMarks(ex!.step, frames[frames.length - 1], solved)), tech).toBe(kinds(frameMarks(ex!.step, null, solved)));
    }
  });

  it('colours a chain node listed in two roles the same in the walk as in the full view', () => {
    const links = [{ from: [A], to: [B], strong: true }];
    const s = step({ tech: 'ALS_XY_CHAIN', primary: [A, B], secondary: [B], links, eliminations: [C] });
    const frames = walkFrames(s);
    expect(frameMarks(s, frames[0], () => false).cands.get(B.cell)?.get(B.digit)).toBe('primary');
    expect(frameMarks(s, null, () => false).cands.get(B.cell)?.get(B.digit)).toBe('primary');
  });

  it('gives the legend what the frame draws: a single\'s first frames show the pattern, not yet the placement', () => {
    const s = step({ tech: 'NAKED_SINGLE', primary: [A], placements: [A], labels: { primary: 'the single' } });
    const frames = walkFrames(s);
    const first = legendKinds(s, frameMarks(s, frames[0], () => false));
    expect(first.shown.has('primary')).toBe(true);
    expect(first.shown.has('place')).toBe(false);
    const last = legendKinds(s, frameMarks(s, frames[frames.length - 1], () => false));
    expect([last.shown.has('place'), last.intoPlace]).toEqual([true, ['primary']]);
  });
});

describe('the legend', () => {
  it('names only the kinds drawn, and a role wholly removed lends its words to the removal', () => {
    const s = step({ primary: [A, B], secondary: [C], eliminations: [A, B], labels: { primary: 'the corners', secondary: 'the base' } });
    const k = legendKinds(s, hintMarks(s, none));
    expect([...k.shown].sort()).toEqual(['elim', 'secondary']);
    expect(k.intoRemove).toEqual(['primary']);
    expect(legendOf(s).map((l) => [l.kind, l.label])).toEqual([
      ['elim', 'remove: the corners'],
      ['secondary', 'the base']
    ]);
  });

  it('a role wholly placed lends its words to the placement', () => {
    const s = step({ primary: [A], placements: [A], labels: { primary: 'the single' } });
    expect(legendOf(s).map((l) => l.label)).toEqual(['place: the single']);
  });

  it('counts a solved cell’s colour and a band as drawn', () => {
    const s = step({ primary: [A], secondary: [B] });
    const values = '0'.repeat(81).split('');
    values[A.cell] = String(A.digit);
    const legend = legendOf(s, values.join(''));
    expect(legend.map((l) => l.kind)).toEqual(['primary', 'secondary']);
    // drawn only on a solved digit, its swatch is the digit's outline
    expect(legend.map((l) => !!l.onValue)).toEqual([true, false]);
    const banded = step({ units: [{ unit: 3, role: 'secondary' }] });
    expect(legendOf(banded).map((l) => l.kind)).toEqual(['secondary']);
    // drawn only as a band, its swatch is a band
    expect(legendOf(banded)[0].onBand).toBe(true);
    // on solved digits and as a band: the digit's outline
    const both = step({ secondary: [A], units: [{ unit: 3, role: 'secondary' }] });
    const k = legendKinds(both, hintMarks(both, { solved: (c) => c === A.cell }));
    expect([k.onValue.has('secondary'), k.onBand.has('secondary')]).toEqual([true, false]);
  });

  it('for a colouring names only the conclusion: the explanation names its colours', () => {
    const s = step({ tech: 'SIMPLE_COLORS', primary: [A], secondary: [B], eliminations: [C] });
    expect(legendOf(s).map((l) => l.kind)).toEqual(['elim']);
  });
});

describe('the Learn diagrams', () => {
  const techs = Object.keys(EXAMPLES) as Tech[];
  const at = (svg: string, re: RegExp) => [...svg.matchAll(new RegExp(re.source, 'g'))].map((m) => m.index!);
  const last = (xs: number[]) => (xs.length ? Math.max(...xs) : -1);
  const first = (xs: number[]) => (xs.length ? Math.min(...xs) : Infinity);

  it('draw in the spec’s order: marks, grid lines, arrows, digits, bars, start dots (G11)', () => {
    for (const tech of techs) {
      // the digits cut out of the arrows are drawn in the mask too, before them
      const svg = boardSvg(EXAMPLES[tech]!, TECHS[tech].name).replace(/<mask [\s\S]*?<\/mask>/, '');
      const dot = new RegExp(`<circle [^>]*fill="${LIGHT.arrow}"`);
      const marks = at(svg, /<circle /).filter((i) => !dot.test(svg.slice(i, svg.indexOf('>', i) + 1)));
      const grid = at(svg, /<line [^>]*stroke="#(?:b4bac8|23293a)"/);
      const arrows = at(svg, /<(?:path|polygon) /);
      const digits = at(svg, /<text [^>]*class="(?:cd|mk|rm|giv|ent)"/);
      const bars = at(svg, new RegExp(`<line [^>]*stroke="${LIGHT.elim}"`));
      const dots = at(svg, dot);
      expect(last(marks), tech).toBeLessThan(first(grid));
      expect(last(grid), tech).toBeLessThan(first(arrows));
      expect(last(arrows), tech).toBeLessThan(first(digits));
      expect(last(digits), tech).toBeLessThan(first(bars));
      expect(last(bars), tech).toBeLessThan(first(dots));
    }
  });

  it('colour a solved digit the step names through its style, with a rounded outline as the shape cue', () => {
    for (const tech of techs) {
      const ex = EXAMPLES[tech]!;
      const s = ex.step;
      const named = new Set(
        [...(s.primary ?? []), ...(s.secondary ?? []), ...(s.fins ?? []), ...s.eliminations, ...s.placements, ...(s.links ?? []).flatMap((l) => [...l.from, ...l.to])]
          .filter((cd) => ex.values[cd.cell] !== '0')
          .map((cd) => cd.cell)
      );
      const svg = boardSvg(ex, TECHS[tech].name);
      expect((svg.match(/class="(?:giv|ent)" style="fill:#[0-9a-f]{6}"/g) ?? []).length, tech).toBe(named.size);
      expect((svg.match(/rx="8\.4" fill="none"/g) ?? []).length, tech).toBe(named.size);
    }
  });
});

describe('the store', () => {
  it('keeps the chain trainer\'s drawing when auto candidates are switched off, the chain and its candidates unchanged', async () => {
    const { useGame } = await import('../src/state/gameStore');
    const { engineGrid } = await import('../src/state/gameStore');
    useGame.getState().startGame('..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..', 196, 'Easy');
    useGame.getState().startChain();
    const g = engineGrid(useGame.getState().cells);
    const cell = [...g.values].findIndex((v, i) => v === 0 && [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => g.cands[i] & (1 << (d - 1))).length === 2);
    const [d1, d2] = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => g.cands[cell] & (1 << (d - 1)));
    useGame.getState().chainTap(cell, d1);
    useGame.getState().chainTap(cell, d2);
    expect(useGame.getState().hint?.links).toHaveLength(1);
    useGame.getState().toggleAutoCandidates();
    expect(useGame.getState().autoCandidates).toBe(false);
    expect(useGame.getState().chain?.nodes).toHaveLength(2);
    expect(useGame.getState().hint?.links).toHaveLength(1);
    expect(useGame.getState().hintStage).toBe('full');
    useGame.getState().endChain();
  });

  it('switching auto candidates with the trainer open draws only what the trainer draws', async () => {
    const { useGame, engineGrid } = await import('../src/state/gameStore');
    useGame.getState().startGame('..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..', 196, 'Easy');
    useGame.getState().startChain();
    const g = engineGrid(useGame.getState().cells);
    const cell = [...g.values].findIndex((v) => v === 0);
    const d = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((x) => g.cands[cell] & (1 << (x - 1)))!;
    // one node, no suggestions: the trainer draws nothing; a hint is asked for anyway
    useGame.getState().chainTap(cell, d);
    useGame.getState().requestHint();
    useGame.getState().toggleAutoCandidates();
    expect(useGame.getState().chain?.nodes).toHaveLength(1);
    expect(useGame.getState().hint).toBeNull();
    expect(useGame.getState().hintStage).toBe('hidden');
    useGame.getState().endChain();
  });

  it('takes a hint away when auto candidates are switched, since the board then shows other candidates', async () => {
    const { useGame } = await import('../src/state/gameStore');
    useGame.getState().startGame('..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..', 196, 'Easy');
    useGame.getState().requestHint();
    expect(useGame.getState().hint).not.toBeNull();
    useGame.getState().toggleAutoCandidates();
    expect(useGame.getState().hint).toBeNull();
    expect(useGame.getState().hintStage).toBe('hidden');
  });
});
