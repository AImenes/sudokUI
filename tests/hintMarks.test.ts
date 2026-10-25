/**
 * What a hint marks where (src/content/hintMarks.ts), shared by the app's
 * board, the Learn diagrams and both legends (docs/hint-drawing.md G1-G5,
 * G22): one mark per candidate, a removal over everything, a placement
 * over everything but a removal; a legend that names what is drawn and
 * nothing else; and the Learn diagram's layers in the spec's order.
 */
import { describe, it, expect } from 'vitest';
import type { CellDigit, Step } from '../src/engine/steps';
import { hintMarks, legendKinds, frameMarks, premiseOf } from '../src/content/hintMarks';
import { deriveTruth } from '../src/engine/truth';
import { alternatingLinks } from '../src/engine/steps';
import type { ChainLink } from '../src/engine/steps';
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

describe("a chain's truth (phase 2b)", () => {
  const at = (r: number, c: number, d: number): CellDigit => ({ cell: (r - 1) * 9 + c - 1, digit: d });
  const kindAt = (m: ReturnType<typeof hintMarks>, cd: CellDigit) => m.cands.get(cd.cell)?.get(cd.digit);

  it('draws every node of every derived example as true or false, as its chain makes it', () => {
    let nodes = 0;
    for (const [tech, ex] of Object.entries(EXAMPLES)) {
      const s = ex!.step;
      const d = deriveTruth(s);
      if (!d) continue;
      expect(d.problems, tech).toEqual([]);
      const m = frameMarks(s, null, (c) => ex!.values[c] !== '0');
      const removedOrPlaced = (cd: CellDigit) => [...s.eliminations, ...s.placements].some((x) => x.cell === cd.cell && x.digit === cd.digit);
      for (const [key, truth] of d.candidates) {
        const [cell, digit] = key.split(':').map(Number);
        if (ex!.values[cell] !== '0' || removedOrPlaced({ cell, digit })) continue;
        nodes++;
        const kind = kindAt(m, { cell, digit });
        // a true group's members keep the pattern's disc: "one of these", not all
        expect(kind, `${tech}: ${digit} in cell ${cell}`).toBe(truth === 'groupTrue' ? namedRoleOrPrimary(s, { cell, digit }) : truth);
      }
      // and the legend says under which premise
      const k = legendKinds(s, m);
      expect(k.shown.has('true') && k.shown.has('false'), tech).toBe(true);
    }
    expect(nodes).toBeGreaterThan(60);
  });

  it("shows a discontinuous loop's start as its premise through the walk, and as proven at the end", () => {
    // 7r1c1=7r1c5-7r3c5=7r3c1-7r3c9=7r1c1: assumed false, proven true, placed
    const ring = [[at(1, 1, 7)], [at(1, 5, 7)], [at(3, 5, 7)], [at(3, 1, 7)], [at(3, 9, 7)]];
    const links = alternatingLinks(ring, 'strong');
    const s = step({ tech: 'NICE_LOOP', truth: 'derived', links, primary: ring.flat(), placements: [at(1, 1, 7)] });
    expect(premiseOf(s)).toBe(false);
    const frames = walkFrames(s);
    const start = at(1, 1, 7);
    // the premise while the loop is open, proven once its closing link is drawn, placed at the conclusion
    const open = frames.filter((fr) => fr.links < links.length);
    const shut = frames.filter((fr) => fr.links === links.length && !fr.show.has('conclusion'));
    expect(open.length).toBeGreaterThan(1);
    for (const fr of open) expect(kindAt(frameMarks(s, fr, () => false), start)).toBe('false');
    for (const fr of shut) expect(kindAt(frameMarks(s, fr, () => false), start)).toBe('true');
    expect(kindAt(frameMarks(s, frames[frames.length - 1], () => false), start)).toBe('place');
    expect(kindAt(frameMarks(s, null, () => false), start)).toBe('place');
    // the rest of the loop under the premise: 7r1c5 true, 7r3c5 false, ...
    const full = frameMarks(s, null, () => false);
    expect([at(1, 5, 7), at(3, 5, 7), at(3, 1, 7), at(3, 9, 7)].map((cd) => kindAt(full, cd))).toEqual(['true', 'false', 'true', 'false']);
  });

  it('words the legend by the premise: an inverted loop assumes its start true', () => {
    const a = [at(2, 2, 4), at(2, 3, 4)];
    const links: ChainLink[] = [
      { from: a, to: [at(2, 8, 4)], strong: false },
      { from: [at(2, 8, 4)], to: [at(6, 8, 4)], strong: true },
      { from: [at(6, 8, 4)], to: [at(6, 3, 4)], strong: false },
      { from: [at(6, 3, 4)], to: [at(4, 3, 4)], strong: true },
      { from: [at(4, 3, 4)], to: a, strong: false }
    ];
    const s = step({ tech: 'GROUPED_X_CYCLES', truth: 'derived', links, primary: [...a, at(2, 8, 4), at(6, 8, 4), at(6, 3, 4), at(4, 3, 4)], eliminations: [at(9, 9, 4)] });
    expect(premiseOf(s)).toBe(true);
    const labels = legendOf(s).map((l) => l.label);
    expect(labels).toContain('true, if the first candidate (by the dot) is true');
    expect(labels).toContain('false, if the first candidate (by the dot) is true');
    // a step whose truth is not derived claims none
    expect(premiseOf(step({ primary: [A] }))).toBeNull();
  });
});

/** the role a step names for a candidate, the pattern's when none */
function namedRoleOrPrimary(s: Step, cd: CellDigit) {
  const has = (l?: CellDigit[]) => !!l?.some((x) => x.cell === cd.cell && x.digit === cd.digit);
  return has(s.primary) ? 'primary' : has(s.secondary) ? 'secondary' : has(s.fins) ? 'fin' : 'primary';
}

describe('a colouring', () => {
  const ROLE = { primary: 'primary', secondary: 'secondary', fin: 'fins' } as const;
  /** every candidate a frame (or the full view) draws in a role colour is in that role's list */
  function colouredAsNamed(s: Step, solved: (c: number) => boolean, label: string) {
    for (const frame of [null, ...walkFrames(s)]) {
      const m = frameMarks(s, frame, solved);
      for (const [cell, ds] of m.cands)
        for (const [digit, kind] of ds) {
          if (kind !== 'primary' && kind !== 'secondary' && kind !== 'fin') continue;
          const list = s[ROLE[kind]] ?? [];
          expect(list.some((cd) => cd.cell === cell && cd.digit === digit), `${label}: ${digit} in cell ${cell} drawn ${kind}`).toBe(true);
        }
    }
  }

  it('colours only what the step puts in a colour, in the full view and every frame of the walk', () => {
    for (const tech of ['SIMPLE_COLORS', 'MULTI_COLORS', 'MEDUSA_3D'] as Tech[]) {
      const ex = EXAMPLES[tech]!;
      colouredAsNamed(ex.step, (c) => ex.values[c] !== '0', tech);
    }
  });

  it('draws Medusa\'s uncoloured target as a plain node, never as a colour the step proves false', async () => {
    // rule 6: if blue were true, r4c4 would lose both its candidates (7, 9)
    const { parseGrid } = await import('../src/engine/board');
    const { findNextStep, applyStep } = await import('../src/engine/humanSolver');
    const g = parseGrid('040000700010090400600200003200005036000300500003810270100000000006057010000000004')!;
    let s = findNextStep(g)!;
    for (let k = 0; k < 40 && s.tech !== 'MEDUSA_3D'; k++) {
      applyStep(g, s);
      s = findNextStep(g)!;
    }
    expect(s.tech).toBe('MEDUSA_3D');
    const solved = (c: number) => g.values[c] > 0;
    colouredAsNamed(s, solved, 'Medusa');
    const r4c4 = 3 * 9 + 3;
    const m = frameMarks(s, null, solved);
    for (const d of [7, 9]) expect(m.cands.get(r4c4)?.get(d), `${d} of r4c4`).toBe('node');
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

  it("starts the trainer's chain over when switching auto candidates on removes one of its candidates", async () => {
    const { useGame, engineGrid } = await import('../src/state/gameStore');
    const { useSettings } = await import('../src/state/settings');
    useSettings.setState({ autoOffMaterialize: false });
    useGame.getState().startGame('..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..', 196, 'Easy');
    useGame.getState().startChain();
    const g = engineGrid(useGame.getState().cells);
    const cell = [...g.values].findIndex((v, i) => v === 0 && [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => g.cands[i] & (1 << (d - 1))).length === 2);
    const [d1, d2] = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => g.cands[cell] & (1 << (d - 1)));
    useGame.getState().chainTap(cell, d1);
    useGame.getState().chainTap(cell, d2);
    useGame.getState().toggleAutoCandidates(); // off
    // the player's centre marks for the cell now hold only d1: switching auto
    // back on adopts that, and d2 is no longer a candidate
    const cells = useGame.getState().cells.map((c, i) => (i === cell ? { ...c, center: 1 << (d1 - 1), corner: 0 } : c));
    useGame.setState({ cells });
    useGame.getState().toggleAutoCandidates(); // on
    expect(useGame.getState().autoCandidates).toBe(true);
    expect(engineGrid(useGame.getState().cells).cands[cell] & (1 << (d2 - 1))).toBe(0);
    expect(useGame.getState().chain?.nodes).toHaveLength(0);
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
