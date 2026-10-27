/**
 * What a hint marks where (src/content/hintMarks.ts), shared by the app's
 * board, the Learn diagrams and both legends (docs/hint-drawing.md G1-G5,
 * G22): one mark per candidate, a removal over everything, a placement
 * over everything but a removal; a legend that names what is drawn and
 * nothing else; and the Learn diagram's layers in the spec's order.
 */
import { describe, it, expect } from 'vitest';
import type { CellDigit, Step } from '../src/engine/steps';
import { hintMarks, legendKinds, frameMarks, premiseOf, setTints, isParity } from '../src/content/hintMarks';
import { deriveTruth } from '../src/engine/truth';
import { alternatingLinks, groupSet } from '../src/engine/steps';
import type { ChainLink, ChainSet } from '../src/engine/steps';
import { walkFrames } from '../src/engine/hintFrames';
import type { Frame } from '../src/engine/hintFrames';
import { readFileSync } from 'node:fs';
import { parseGrid } from '../src/engine/board';
import { findNextStep, findStep, findAllSteps, applyStep } from '../src/engine/humanSolver';
import { boardSvg, legendOf, swatchStyle } from '../src/content/boardSvg';
import { PARITY_FIXTURES, positionOf } from './parityFixtures';
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

  it('keep no colour inside the ring of a removal that is no chain node, whatever the technique (G5)', () => {
    // a colouring's parity once stayed inside its removals; a colouring now
    // says its parity (truth 'parity'), and no technique's name does it
    for (const tech of ['X_CHAIN', 'SIMPLE_COLORS', 'MULTI_COLORS', 'MEDUSA_3D'] as Tech[]) {
      const m = hintMarks(step({ tech, primary: [A], secondary: [B], eliminations: [A, C] }), none);
      expect(m.cands.get(A.cell)?.get(A.digit), tech).toBe('elim');
      expect(m.cands.get(C.cell)?.get(C.digit), tech).toBe('elim');
      expect(m.inside.size, tech).toBe(0);
    }
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
        // a true group's members are "one of these", not all: their own mark, the square
        expect(kind, `${tech}: ${digit} in cell ${cell}`).toBe(truth === 'groupTrue' ? 'oneOf' : truth);
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
    expect(premiseOf(s)).toEqual({ assumed: false, kind: 'candidate' });
    const frames = walkFrames(s);
    const start = at(1, 1, 7);
    // the premise while the loop is open, proven once its closing link is drawn, placed at the conclusion
    const open = frames.filter((fr) => fr.links < links.length);
    const shut = frames.filter((fr) => fr.links === links.length && !fr.show.has('conclusion'));
    expect(open.length).toBeGreaterThan(1);
    for (const fr of open) expect(kindAt(frameMarks(s, fr, () => false), start)).toBe('false');
    for (const fr of shut) expect(kindAt(frameMarks(s, fr, () => false), start)).toBe('true');
    // placed, keeping the pattern's colour inside the placement's ring (G5)
    expect(kindAt(frameMarks(s, frames[frames.length - 1], () => false), start)).toBe('placeOn');
    expect(kindAt(frameMarks(s, null, () => false), start)).toBe('placeOn');
    // the rest of the loop under the premise, in the walk: 7r1c5 true, 7r3c5 false, ...
    const rest = [at(1, 5, 7), at(3, 5, 7), at(3, 1, 7), at(3, 9, 7)];
    expect(rest.map((cd) => kindAt(frameMarks(s, shut[0], () => false), cd))).toEqual(['true', 'false', 'true', 'false']);
    // the closing frame shows the start true beside its partner true in
    // row 1: the premise is impossible, and the frame and its legend say so
    for (const fr of open) expect(legendKinds(s, frameMarks(s, fr, () => false)).refuted, 'frame ' + fr.links).toBe(false);
    for (const fr of shut) expect(legendKinds(s, frameMarks(s, fr, () => false)).refuted).toBe(true);
    expect(legendOf(s, undefined, shut[0]).map((l) => l.label)).toContain('the chain shows that premise is impossible: the first candidate (by the small dot) is true');
    expect(frames[links.length - 1].text).toContain('So assuming r1c1 is not 7 makes it 7: that is impossible, so r1c1 is 7.');
    // those truths hold only under a premise the loop refutes: the full view
    // and the conclusion draw no truth beside the placement, but the pattern
    for (const m of [frameMarks(s, null, () => false), frameMarks(s, frames[frames.length - 1], () => false)]) {
      expect(rest.map((cd) => kindAt(m, cd))).toEqual(['primary', 'primary', 'primary', 'primary']);
      expect(legendKinds(s, m).refuted).toBe(false);
    }
    expect(legendOf(s).map((l) => l.kind)).toEqual(['place', 'primary']);
    expect(frames.slice(0, links.length - 1).every((fr) => !fr.text.includes('impossible'))).toBe(true);
  });

  it('says so when an open chain draws two true candidates that cannot both be: its premise is impossible', () => {
    // 7r4c1 = 7r4c4 - 7r9c4 = 7r9c6 - 7r5c6 = 7r6c6 ... under "7r4c1 false",
    // 7r4c4 and 7r6c6 are both true in box 5
    const nodes = [[at(4, 1, 7)], [at(4, 4, 7)], [at(9, 4, 7)], [at(9, 6, 7)], [at(5, 6, 7)], [at(6, 6, 7)]];
    const s = step({ tech: 'X_CHAIN', truth: 'derived', links: alternatingLinks(nodes), primary: nodes.flat(), eliminations: [at(6, 1, 7)] });
    const full = frameMarks(s, null, () => false);
    expect([kindAt(full, at(4, 4, 7)), kindAt(full, at(6, 6, 7))]).toEqual(['true', 'true']);
    expect(legendKinds(s, full).refuted).toBe(true);
    expect(legendOf(s).find((l) => l.kind === 'note')!.label).toBe('the chain shows that premise is impossible: the first candidate (by the small dot) is true');
    // the frames before the second true 7 is drawn say nothing of it
    const frames = walkFrames(s);
    expect(legendKinds(s, frameMarks(s, frames[2], () => false)).refuted).toBe(false);
    // and a chain whose truths agree has no such line
    expect(legendOf(step({ tech: 'X_CHAIN', truth: 'derived', links: alternatingLinks(nodes.slice(0, 4)), primary: nodes.slice(0, 4).flat(), eliminations: [at(4, 6, 7)] })).some((l) => l.kind === 'note')).toBe(false);
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
    expect(premiseOf(s)).toEqual({ assumed: true, kind: 'group' });
    // its start is a group: one of its candidates assumed true, not all (in
    // the walk: the full view of a loop that refutes its premise draws none)
    const labels = walkFrames(s).flatMap((fr) => legendOf(s, undefined, fr).map((l) => l.label));
    expect(labels).toContain('true, if one candidate of the first group (by the small dot) is true');
    expect(labels).toContain('false, if one candidate of the first group (by the small dot) is true');
    // and no walk frame draws a member of its start group true: one of them, not all
    for (const fr of walkFrames(s)) for (const m of a) expect(frameMarks(s, fr, () => false).cands.get(m.cell)?.get(m.digit), 'frame ' + fr.links).not.toBe('true');
    // a step whose truth is not derived claims none
    expect(premiseOf(step({ primary: [A] }))).toBeNull();
  });

  it('words a chain that opens at a group by the group: none of its candidates assumed true', () => {
    // (8)r5c7,r6c7 = r9c7 - r9c1 = r5c1 => r5c8, r5c9 <> 8
    const g = [at(5, 7, 8), at(6, 7, 8)];
    const links = alternatingLinks([g, [at(9, 7, 8)], [at(9, 1, 8)], [at(5, 1, 8)]], undefined, [0]);
    const s = step({ tech: 'AIC_GROUPED', truth: 'derived', links, sets: [groupSet([g[0].cell, g[1].cell], 8)], primary: [...g, at(9, 7, 8), at(9, 1, 8), at(5, 1, 8)], eliminations: [at(5, 8, 8), at(5, 9, 8)] });
    expect(premiseOf(s)).toEqual({ assumed: false, kind: 'group' });
    const labels = legendOf(s).map((l) => l.label);
    expect(labels).toContain('true, if no candidate of the first group (by the small dot) is true');
    expect(labels).toContain('false, if no candidate of the first group (by the small dot) is true');
    // a false group is none of its candidates: each a false ring, on a bar in the false ink
    const full = frameMarks(s, null, () => false);
    for (const m of g) expect(kindAt(full, m)).toBe('false');
    expect(full.sets).toEqual([{ set: 0, style: 'false' }]);
    expect(legendOf(s).find((l) => l.kind === 'falseBar')).toEqual({
      kind: 'falseBar',
      label: 'rings joined by a bar: none of them is true, if no candidate of the first group (by the small dot) is true',
      colour: '#ffffff',
      ink: LIGHT.false
    });
  });

  it("draws a true group's candidates as one of them, squares on a bar, never true discs nor the whole step's label (docs/hint-drawing-sets.md, decision 1)", () => {
    // 3r1c1 = 3r1c56 - 3r2c4 = 3r8c4 => r8c1 <> 3: the group r1c5,r1c6 is true
    const grp = [at(1, 5, 3), at(1, 6, 3)];
    const links = alternatingLinks([[at(1, 1, 3)], grp, [at(2, 4, 3)], [at(8, 4, 3)]], undefined, [undefined, 0]);
    const s = step({ tech: 'AIC_GROUPED', truth: 'derived', links, sets: [groupSet([grp[0].cell, grp[1].cell], 3)], primary: [at(1, 1, 3), ...grp, at(2, 4, 3), at(8, 4, 3)], eliminations: [at(8, 1, 3)], labels: { primary: 'the chain, with grouped nodes' } });
    expect(deriveTruth(s)!.candidates.get(`${grp[0].cell}:3`)).toBe('groupTrue');
    const frames = walkFrames(s);
    for (const fr of [null, ...frames]) {
      const m = frameMarks(s, fr, () => false);
      for (const cd of grp) if (kindAt(m, cd)) expect(kindAt(m, cd)).toBe('oneOf');
      // the bar with its squares, from the frame of the link that reaches the group
      expect(m.sets, `frame ${fr?.links}`).toEqual(fr && fr.links < 1 ? [] : [{ set: 0, style: 'oneOf' }]);
      expect(legendKinds(s, m).shown.has('primary')).toBe(false);
    }
    expect(frameMarks(s, frames[0], () => false).sets).toEqual([{ set: 0, style: 'oneOf' }]);
    const labels = legendOf(s).map((l) => l.label);
    expect(labels).toContain('squares joined by a bar: one of them is true, if the first candidate (by the small dot) is false');
    expect(labels).not.toContain('the chain, with grouped nodes');
    expect(labels.some((l) => l.includes('each group'))).toBe(false);
    // its swatch is the square on its bar, in the true ink, never the pattern's disc
    expect(legendOf(s).find((l) => l.kind === 'oneOfBar')).toMatchObject({ colour: LIGHT.oneOf, ink: LIGHT.placeInk });
    // without the step's sets, the same squares are a set's, on no bar
    const bare = { ...s, sets: undefined, links: links.map(({ fromSet, toSet, ...l }) => l) };
    expect(frameMarks(bare, null, () => false).sets).toEqual([]);
    expect(legendOf(bare).map((l) => l.label)).toContain('squares in a set: one of them is true, if the first candidate (by the small dot) is false');
  });
});

describe("groups on the board (docs/hint-drawing-sets.md, decisions 1-3 and 18)", () => {
  const at = (r: number, c: number, d: number): CellDigit => ({ cell: (r - 1) * 9 + c - 1, digit: d });
  const kindAt = (m: ReturnType<typeof hintMarks>, cd: CellDigit) => m.cands.get(cd.cell)?.get(cd.digit);
  /** the grouped chains: every set example, and the set fixture's grouped steps at the positions it keeps */
  const grouped = (() => {
    const out: { where: string; step: Step; values: string }[] = [];
    for (const tech of ['AIC_GROUPED', 'GROUPED_NICE_LOOP', 'GROUPED_X_CYCLES', 'AIC_ALS'] as Tech[]) out.push({ where: tech, step: EXAMPLES[tech]!.step, values: EXAMPLES[tech]!.values });
    const fx = JSON.parse(new TextDecoder().decode(readFileSync('tests/fixtures/setDrawings.json')));
    for (const section of ['paths', 'named']) {
      for (const [id, d] of Object.entries<{ position: { puzzle: string; values: string; cands: number[] } }>(fx[section])) {
        const tech = id.split(', ').at(-1) as Tech;
        if (!['AIC_GROUPED', 'GROUPED_NICE_LOOP', 'GROUPED_X_CYCLES', 'AIC_ALS'].includes(tech)) continue;
        const g = parseGrid(d.position.puzzle)!;
        for (let i = 0; i < 81; i++) {
          g.values[i] = Number(d.position.values[i]);
          g.cands[i] = d.position.cands[i];
        }
        const s = findStep(tech, g);
        if (s?.tech === tech) out.push({ where: id, step: s, values: d.position.values });
      }
    }
    return out;
  })();
  const styleOf = (kind: string | undefined) => (kind === 'elimOn' ? 'elim' : kind);

  it('never draws a candidate of a true node of several candidates as a true disc, in any view of any grouped chain', () => {
    let squares = 0;
    expect(grouped.length).toBeGreaterThan(50);
    for (const { where, step: s, values } of grouped) {
      const d = deriveTruth(s);
      if (!d || d.problems.length) continue;
      const several = d.nodes.filter((n) => n.truth && n.node.length > 1).flatMap((n) => n.node);
      for (const fr of [null, ...walkFrames(s)]) {
        const m = frameMarks(s, fr, (c) => values[c] !== '0');
        for (const cd of several) {
          const kind = kindAt(m, cd);
          expect(kind, `${where}, frame ${fr?.links}: ${cd.digit} in cell ${cd.cell}`).not.toBe('true');
          if (kind === 'oneOf') squares++;
        }
        // squares and a colouring's shades are never drawn together (the square is 1.6 from light orange under protan vision)
        if ([...m.cands.values()].some((x) => [...x.values()].includes('oneOf'))) {
          expect([...m.cands.values()].flatMap((x) => [...x.values()]).filter((k) => /Dark|Light/.test(k)), where).toEqual([]);
        }
      }
    }
    expect(squares).toBeGreaterThan(100);
  });

  it("draws each group a view reaches on a bar in its members' mark, from the frame of the first link that reaches it", () => {
    const styles = new Set<string>();
    for (const { where, step: s, values } of grouped) {
      const frames = walkFrames(s);
      for (const fr of [null, ...frames]) {
        const m = frameMarks(s, fr, (c) => values[c] !== '0');
        const reached = new Set(
          (s.links ?? [])
            .slice(0, fr ? fr.links : undefined)
            .flatMap((l) => [l.fromSet, l.toSet])
            .filter((k): k is number => k !== undefined && s.sets![k].kind === 'group')
        );
        // (an almost locked set is drawn as its tiles, not on a bar)
        const groups = m.sets.filter((x) => x.style !== 'als');
        expect(groups.map((x) => x.set).sort(), `${where}, frame ${fr?.links}`).toEqual([...reached].sort());
        for (const { set, style } of groups) {
          styles.add(style);
          // every member wears the bar's mark: a square, a ring, the pattern's disc, a removal
          for (const cd of s.sets![set].members) expect(styleOf(kindAt(m, cd)), `${where}, frame ${fr?.links}: ${cd.digit} in cell ${cd.cell}`).toBe(style);
        }
      }
    }
    // squares and rings, the pattern's in a discontinuous loop's full view, and rule 3's removal
    expect([...styles].sort()).toEqual(['elim', 'false', 'oneOf', 'primary']);
  });

  it("takes Grouped X-Cycles rule 3's start through three marks: squares while assumed, rings at the closing link, removals at the end", () => {
    // the set fixture's named rule 3, its first group assumed true
    const g = parseGrid('.4...2.6.8.2.....51..4.8...4....1..7..5.7.6..3..5....4...1.9..66.....9.2.9.2...5.')!;
    for (let i = 0; i < 14; i++) applyStep(g, findNextStep(g)!);
    const s = findStep('GROUPED_X_CYCLES', g)!;
    const solved = (c: number) => g.values[c] > 0;
    const start = s.links![0].fromSet!;
    expect(s.sets![start].kind).toBe('group');
    expect(premiseOf(s)).toEqual({ assumed: true, kind: 'group' });
    const frames = walkFrames(s);
    const styleIn = (fr: Frame | null) => frameMarks(s, fr, solved).sets.find((x) => x.set === start)?.style;
    const closing = frames.findIndex((fr) => fr.links === s.links!.length);
    for (const fr of frames.slice(0, closing)) expect(styleIn(fr), `frame ${fr.links}`).toBe('oneOf');
    expect(styleIn(frames[closing])).toBe('false');
    expect(styleIn(frames[frames.length - 1])).toBe('elim');
    expect(styleIn(null)).toBe('elim');
    // the legend follows: squares joined by a bar, then rings joined by a bar with the premise refuted, then a bar in the removal's ink
    const words = (fr: Frame | null) => legendOf(s, Array.from(g.values).join(''), fr).map((l) => l.label);
    expect(words(frames[0])).toContain('squares joined by a bar: one of them is true, if one candidate of the first group (by the small dot) is true');
    expect(words(frames[closing])).toContain('rings joined by a bar: none of them is true, if one candidate of the first group (by the small dot) is true');
    expect(words(frames[closing])).toContain('the chain shows that premise is impossible: no candidate of the first group (by the small dot) is true');
    expect(words(null)).toContain("bar: a group (one digit's cells in one box and one row or column), read as one node");
    expect(words(null).some((l) => l.includes('joined by a bar'))).toBe(false);
  });

  it('names a bar alone where it is the pattern\'s or the removal\'s, and squares in a set where no bar joins them', () => {
    // a discontinuous grouped loop's full view: the pattern's discs on a bar in its ink
    const loop = grouped.find(({ step: s }) => deriveTruth(s)?.closure && s.sets?.some((x) => x.kind === 'group'))!;
    const full = frameMarks(loop.step, null, (c) => loop.values[c] !== '0');
    expect(full.sets.map((x) => x.style)).toContain('primary');
    const entry = legendOf(loop.step, loop.values).find((l) => l.kind === 'bar')!;
    expect(entry).toMatchObject({ label: "bar: a group (one digit's cells in one box and one row or column), read as one node", ink: LIGHT.primaryInk });
    // AIC with ALS: its set's 9s, squares on no bar
    const als = EXAMPLES.AIC_ALS!;
    const labels = legendOf(als.step, als.values).map((l) => l.label);
    expect(labels).toContain('squares in a set: one of them is true, if the first candidate (by the small dot) is false');
    expect(labels.some((l) => l.includes('group') || l.includes('joined by a bar'))).toBe(false);
  });
});


describe("almost locked sets on the board (docs/hint-drawing-sets.md, decisions 5-10 and 18)", () => {
  const ALS: Tech[] = ['AIC_ALS', 'ALS_XZ', 'ALS_XY_WING', 'ALS_XY_CHAIN', 'DEATH_BLOSSOM'];
  const key = (x: CellDigit) => `${x.cell}:${x.digit}`;
  /** the almost locked set steps the repository keeps: every set example, and the set fixture's at the positions it keeps */
  const corpus = (() => {
    const out: { where: string; step: Step; values: string }[] = ALS.map((tech) => ({ where: tech, step: EXAMPLES[tech]!.step, values: EXAMPLES[tech]!.values }));
    const fx = JSON.parse(new TextDecoder().decode(readFileSync('tests/fixtures/setDrawings.json')));
    for (const section of ['paths', 'named']) {
      for (const [id, d] of Object.entries<{ position: { puzzle: string; values: string; cands: number[] } }>(fx[section])) {
        const tech = id.split(', ').at(-1) as Tech;
        if (!ALS.includes(tech)) continue;
        const g = parseGrid(d.position.puzzle)!;
        for (let i = 0; i < 81; i++) {
          g.values[i] = Number(d.position.values[i]);
          g.cands[i] = d.position.cands[i];
        }
        const s = findStep(tech, g);
        if (s?.tech === tech) out.push({ where: id, step: s, values: d.position.values });
      }
    }
    return out;
  })();
  const kindAt = (m: ReturnType<typeof hintMarks>, cd: CellDigit) => m.cands.get(cd.cell)?.get(cd.digit);

  it("draws each set from the frame of the first link that reaches it, in its tint, its candidates no other mark takes its members", () => {
    let members = 0;
    expect(corpus.length).toBeGreaterThan(60);
    for (const { where, step: s, values } of corpus) {
      const tints = setTints(s);
      for (const fr of [null, ...walkFrames(s)]) {
        const m = frameMarks(s, fr, (c) => values[c] !== '0');
        const reached = new Set(
          (s.links ?? [])
            .slice(0, fr ? fr.links : undefined)
            .flatMap((l) => [l.fromSet, l.toSet])
            .filter((k): k is number => k !== undefined && s.sets![k].kind === 'als')
        );
        const drawn = m.sets.filter((x) => x.style === 'als');
        expect(drawn.map((x) => x.set).sort(), `${where}, frame ${fr?.links}`).toEqual([...reached].sort());
        for (const x of drawn) expect(x.tint, `${where}, set ${x.set}`).toBe(tints.get(x.set));
        // a member is a drawn set's candidate, and only where no other mark took it
        const own = new Set(drawn.flatMap((x) => s.sets![x.set].members.map(key)));
        for (const [cell, ds] of m.cands)
          for (const [digit, kind] of ds) {
            if (kind !== 'member') continue;
            members++;
            expect(own.has(key({ cell, digit })), `${where}, frame ${fr?.links}: ${digit} in cell ${cell}`).toBe(true);
          }
        for (const x of drawn) for (const cd of s.sets![x.set].members) expect(kindAt(m, cd), `${where}, frame ${fr?.links}: ${key(cd)}`).toBeDefined();
      }
    }
    expect(members).toBeGreaterThan(100);
  });

  it('marks a member last of all (G5): the stored AIC with ALS draws its 4s as members beside the 8s and 9s it makes false and true', () => {
    const ex = EXAMPLES.AIC_ALS!;
    const m = frameMarks(ex.step, null, (c) => ex.values[c] !== '0');
    // set A, r7c8 and r8c8, holds only 4, 8 and 9: its 8s false rings, its 9s "one of these" squares, its 4s members
    expect([4, 8, 9].map((d) => [kindAt(m, { cell: 61, digit: d }), kindAt(m, { cell: 70, digit: d })])).toEqual([
      ['member', 'member'],
      ['false', 'false'],
      ['oneOf', 'oneOf']
    ]);
    expect(m.sets).toEqual([{ set: 0, style: 'als', tint: 1 }]);
    // not before the link that reaches A
    expect(frameMarks(ex.step, walkFrames(ex.step)[0], (c) => ex.values[c] !== '0').sets).toEqual([]);
    // a pattern's roles come before its members: the ALS-XZ's conclusion is its roles, its first frame the
    // restricted common's candidates and the sets' other candidates as members
    const xz = EXAMPLES.ALS_XZ!;
    const frames = walkFrames(xz.step);
    const kinds = (fr: Frame | null) => new Set([...frameMarks(xz.step, fr, (c) => xz.values[c] !== '0').cands.values()].flatMap((x) => [...x.values()]));
    expect([...kinds(frames[0])].sort()).toEqual(['member', 'primary', 'secondary']);
    expect(kinds(frames[frames.length - 1]).has('member')).toBe(false);
    expect(kinds(null).has('member')).toBe(false);
  });

  it('gives the tints by decision 8: one each in letter order up to three, then the lowest no conflicting set has, never one linked set\'s on another', () => {
    const tints = (s: Step) => [...setTints(s)].sort((a, b) => a[0] - b[0]).map(([, t]) => t);
    expect(tints(EXAMPLES.ALS_XY_WING!.step)).toEqual([1, 2, 3]);
    expect(tints(EXAMPLES.DEATH_BLOSSOM!.step)).toEqual([1, 2, 3]);
    // four sets in a chain, none touching another but its neighbours by its link: sand and rose take turns
    expect(tints(EXAMPLES.ALS_XY_CHAIN!.step)).toEqual([1, 2, 1, 2]);
    // A-B-C-D, C beside A, D beside A and B: C takes violet; D, every tint taken by a set it conflicts with, the lowest
    // no set linked to it has, A's sand
    const set = (letter: string, cells: number[]): ChainSet => ({ kind: 'als', cells, digits: [1, 2, 3], members: [], unit: 0, letter });
    const chain = step({
      tech: 'ALS_XY_CHAIN',
      sets: [set('A', [0]), set('B', [20]), set('C', [1]), set('D', [9, 21])],
      links: [
        { from: [], to: [], strong: false, fromSet: 0, toSet: 1 },
        { from: [], to: [], strong: false, fromSet: 1, toSet: 2 },
        { from: [], to: [], strong: false, fromSet: 2, toSet: 3 }
      ]
    });
    expect(tints(chain)).toEqual([1, 2, 3, 1]);
    // letter order, not the order the step lists them in; a group takes none
    expect([...setTints(step({ sets: [set('B', [0]), set('A', [40]), { ...groupSet([60, 61], 4) }] }))]).toEqual([
      [1, 1],
      [0, 2]
    ]);
    // every set step kept: no two linked sets share a tint, nor two that share a cell or a side while a tint was free
    for (const { where, step: s } of corpus) {
      const t = setTints(s);
      const links = (s.links ?? []).filter((l) => l.fromSet !== undefined && l.toSet !== undefined && l.fromSet !== l.toSet);
      for (const l of links) if (t.has(l.fromSet!) && t.has(l.toSet!)) expect(t.get(l.fromSet!), `${where}: sets ${l.fromSet} and ${l.toSet}`).not.toBe(t.get(l.toSet!));
    }
  });

  it("names the tiles in the legend as lettered cells, a Death Blossom's as its petals, the swatch in the first tint drawn", () => {
    const xz = EXAMPLES.ALS_XZ!;
    expect(legendKinds(xz.step, frameMarks(xz.step, null, (c) => xz.values[c] !== '0')).tiles).toEqual([1, 2]);
    expect(legendOf(xz.step, xz.values).at(-1)).toEqual({
      kind: 'tile',
      label: 'lettered cells: an almost locked set, one digit more than cells; without any one of its digits, the others fill its cells',
      colour: LIGHT.set1,
      ink: LIGHT.set1Ink
    });
    const db = EXAMPLES.DEATH_BLOSSOM!;
    expect(legendOf(db.step, db.values).find((l) => l.kind === 'tile')?.label).toBe("lettered cells: a petal, an almost locked set for one of the stem's digits");
    // a frame that draws no set names none; the group chains, none
    expect(legendOf(EXAMPLES.AIC_ALS!.step, EXAMPLES.AIC_ALS!.values, walkFrames(EXAMPLES.AIC_ALS!.step)[0]).some((l) => l.kind === 'tile')).toBe(false);
    for (const tech of ['AIC_GROUPED', 'GROUPED_NICE_LOOP', 'GROUPED_X_CYCLES'] as Tech[]) expect(legendOf(EXAMPLES[tech]!.step, EXAMPLES[tech]!.values).some((l) => l.kind === 'tile'), tech).toBe(false);
    // the swatch: a small tile in the tint at half strength over white, outlined in the ink, its tab in the corner
    expect(swatchStyle(legendOf(xz.step, xz.values).at(-1)!)).toMatchObject({ border: `1.5px solid ${LIGHT.set1Ink}`, width: '14px' });
    expect(swatchStyle(legendOf(xz.step, xz.values).at(-1)!).background).toContain(`${LIGHT.set1}80`);
  });

  it('never draws a set and a colouring in one step: the violet tile and the purple shades are 3.0 apart as areas', () => {
    const COLOURING: Tech[] = ['SIMPLE_COLORS', 'MULTI_COLORS', 'MEDUSA_3D', 'REMOTE_PAIR'];
    // every stored example and every set step kept
    for (const [tech, ex] of Object.entries(EXAMPLES)) {
      if (ex!.step.sets?.length) expect(isParity(ex!.step), tech).toBe(false);
      if (isParity(ex!.step)) expect(ex!.step.sets, tech).toBeUndefined();
    }
    for (const { where, step: s } of corpus) expect([s.truth, s.colouring], where).not.toContain('parity');
    // every step on offer at the colouring fixtures' positions: a colouring has no sets, a set step no colouring
    let colourings = 0;
    for (const f of PARITY_FIXTURES) {
      for (const s of findAllSteps(positionOf(f).grid)) {
        if (COLOURING.includes(s.tech)) {
          colourings++;
          expect(s.sets, `${f.name}: ${s.tech}`).toBeUndefined();
        }
        if (s.sets?.length) expect(s.colouring, `${f.name}: ${s.tech}`).toBeUndefined();
      }
    }
    expect(colourings).toBeGreaterThan(5);
    // and a colouring's marks draw no set, though its step should name one
    const c = PARITY_FIXTURES[0].step;
    const handed = { ...c, sets: EXAMPLES.ALS_XZ!.step.sets, links: c.links!.map((l) => ({ ...l, fromSet: 0, toSet: 1 })) };
    for (const fr of [null, ...walkFrames(handed)]) {
      const m = frameMarks(handed, fr, () => false);
      expect(m.sets).toEqual([]);
      expect([...m.cands.values()].flatMap((x) => [...x.values()])).not.toContain('member');
    }
  });
});

describe('a colouring', () => {
  /**
   * every candidate a frame (or the full view) draws is in a shade of its
   * own cluster's colour, or what the step makes of it: a removal, a true
   * disc or a false ring, or the plain ring of a weak tie's end; never a
   * role's colour (docs/hint-drawing-colouring.md)
   */
  function shadedAsColoured(s: Step, solved: (c: number) => boolean, label: string) {
    const { clusters } = s.colouring!;
    const shadeOf = (cell: number, digit: number) => {
      for (const [k, cl] of clusters.entries()) {
        const hue = k === 0 ? 'purple' : 'orange';
        if (cl.dark.some((cd) => cd.cell === cell && cd.digit === digit)) return `${hue}Dark`;
        if (cl.light.some((cd) => cd.cell === cell && cd.digit === digit)) return `${hue}Light`;
      }
      return null;
    };
    for (const frame of [null, ...walkFrames(s)]) {
      const m = frameMarks(s, frame, solved);
      for (const [cell, ds] of m.cands)
        for (const [digit, kind] of ds) {
          expect(['primary', 'secondary', 'fin', 'elimOn', 'placeOn', 'oneOf'], `${label}: ${digit} in cell ${cell}`).not.toContain(kind);
          if (/Dark|Light/.test(kind)) expect(kind, `${label}: ${digit} in cell ${cell}`).toBe(shadeOf(cell, digit));
        }
      expect(m.inside.size, label).toBe(0);
    }
  }

  it('colours only what the step puts in a colour, in its shade, in the full view and every frame of the walk', () => {
    for (const tech of ['SIMPLE_COLORS', 'MULTI_COLORS', 'MEDUSA_3D', 'REMOTE_PAIR'] as Tech[]) {
      const ex = EXAMPLES[tech]!;
      expect(ex.step.truth, tech).toBe('parity');
      shadedAsColoured(ex.step, (c) => ex.values[c] !== '0', tech);
    }
  });

  it('draws Medusa\'s uncoloured target as a plain node, never as a colour the step proves false', async () => {
    // rule 6: if dark purple were true, r4c4 would lose both its candidates (7, 9)
    const { parseGrid } = await import('../src/engine/board');
    const { findNextStep, applyStep } = await import('../src/engine/humanSolver');
    const g = parseGrid('040000700010090400600200003200005036000300500003810270100000000006057010000000004')!;
    let s = findNextStep(g)!;
    for (let k = 0; k < 40 && s.tech !== 'MEDUSA_3D'; k++) {
      applyStep(g, s);
      s = findNextStep(g)!;
    }
    expect(s.tech).toBe('MEDUSA_3D');
    expect(s.colouring?.rule).toBe('medusa6');
    const solved = (c: number) => g.values[c] > 0;
    shadedAsColoured(s, solved, 'Medusa');
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

  it('names what is drawn whatever the technique: no technique’s name hides a colour from it', () => {
    // a colouring once named only its removals, its parities left to the
    // explanation; a colouring now names its shades (parityLegend)
    for (const tech of ['X_WING', 'SIMPLE_COLORS', 'MULTI_COLORS', 'MEDUSA_3D'] as Tech[]) {
      const s = step({ tech, primary: [A], secondary: [B], eliminations: [C] });
      expect(legendOf(s).map((l) => l.kind), tech).toEqual(['elim', 'primary', 'secondary']);
    }
  });
});

describe('the Learn diagrams', () => {
  const techs = Object.keys(EXAMPLES) as Tech[];
  const at = (svg: string, re: RegExp) => [...svg.matchAll(new RegExp(re.source, 'g'))].map((m) => m.index!);
  const last = (xs: number[]) => (xs.length ? Math.max(...xs) : -1);
  const first = (xs: number[]) => (xs.length ? Math.min(...xs) : Infinity);

  it('draw in the spec’s order: set tiles, groups\' bars, marks, grid lines, arrows, digits, bars, letter tabs, start dots (G11)', () => {
    let grouped = 0;
    let tiled = 0;
    for (const tech of techs) {
      // the digits cut out of the arrows are drawn in the mask too, before them
      const svg = boardSvg(EXAMPLES[tech]!, TECHS[tech].name).replace(/<mask [\s\S]*?<\/mask>/, '');
      const dot = new RegExp(`<circle [^>]*fill="${LIGHT.arrow}"`);
      // a group's bar, under its members' marks (docs/hint-drawing-sets.md, decision 2)
      const groupBars = at(svg, /<line class="gb" /);
      if (groupBars.length) grouped++;
      // an almost locked set's tiles, over the bands, and its letter tabs, over the removal bars (decisions 5 and 7)
      const tiles = at(svg, /<rect class="(?:tl|to)" /);
      const tabs = at(svg, /<(?:rect class="(?:tb|tk)"|text [^>]*class="tab")/);
      if (tiles.length) tiled++;
      expect(tabs.length, tech).toBe(tiles.length ? 3 * at(svg, /<rect class="tb"/).length : 0);
      const marks = at(svg, /<(?:circle|rect class="(?:sq|kl)") /).filter((i) => !dot.test(svg.slice(i, svg.indexOf('>', i) + 1)));
      const grid = at(svg, /<line [^>]*stroke="#(?:b4bac8|23293a)"/);
      const arrows = at(svg, /<(?:path|polygon) /);
      const digits = at(svg, /<text [^>]*class="(?:cd|mk|rm|giv|ent)"/);
      const bars = at(svg, new RegExp(`<line (?!class="gb")[^>]*stroke="${LIGHT.elim}"`));
      const dots = at(svg, dot);
      expect(last(tiles), tech).toBeLessThan(Math.min(first(groupBars), first(marks)));
      expect(last(groupBars), tech).toBeLessThan(first(marks));
      expect(last(marks), tech).toBeLessThan(first(grid));
      expect(last(grid), tech).toBeLessThan(first(arrows));
      expect(last(arrows), tech).toBeLessThan(first(digits));
      expect(last(digits), tech).toBeLessThan(first(bars));
      expect(last(bars), tech).toBeLessThan(first(tabs));
      expect(Math.max(last(bars), last(tabs)), tech).toBeLessThan(first(dots));
    }
    // the four grouped chains: AIC with Groups, Grouped Nice Loop and X-Cycles, and AIC with ALS, whose set is no group
    expect(grouped).toBe(3);
    // AIC with ALS, the three ALS patterns and Death Blossom
    expect(tiled).toBe(5);
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
