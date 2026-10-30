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
import { alsClash, deriveTruth } from '../src/engine/truth';
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
import { deriveLinks } from '../src/engine/truth';
import { drawnLinks } from '../src/engine/hintFrames';
import { isPlaced } from '../src/content/hintMarks';
import { sees } from '../src/engine/board';
import type { Grid } from '../src/engine/board';
import { solve } from '../src/engine/bruteForce';

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
    // a chain that claims no truth and names roles (the ALS patterns, once so, are derived chains now)
    const links = [{ from: [A], to: [B], strong: true }];
    const s = step({ tech: 'DIGIT_FORCING_CHAIN', primary: [A, B], secondary: [B], links, eliminations: [C] });
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

  it("draws each set from the frame of the first link that reaches it, or its own frame before that, in its tint, its candidates no other mark takes its members", () => {
    let members = 0;
    expect(corpus.length).toBeGreaterThan(60);
    for (const { where, step: s, values } of corpus) {
      const tints = setTints(s);
      for (const fr of [null, ...walkFrames(s)]) {
        const m = frameMarks(s, fr, (c) => values[c] !== '0');
        // a set frame introduces its set before any link reaches it (decision 17)
        const reached = new Set(
          [...(s.links ?? []).slice(0, fr ? fr.links : undefined).flatMap((l) => [l.fromSet, l.toSet]), ...(fr?.sets ?? [])].filter(
            (k): k is number => k !== undefined && s.sets![k].kind === 'als'
          )
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
    // an ALS pattern is the chain it derives (decision 11): A's 5s false
    // rings, r8c2's 1 a true disc, r8c9's 1 a false ring, r7c8's 5 a true
    // disc, the 9s members, r7c1's 5 removed, and no role anywhere; its first
    // frame introduces set A, its candidates members, no truth yet
    const xz = EXAMPLES.ALS_XZ!;
    const at = (r: number, c: number) => (r - 1) * 9 + c - 1;
    const full = frameMarks(xz.step, null, (c) => xz.values[c] !== '0');
    const of = (r: number, c: number) => [...(full.cands.get(at(r, c)) ?? [])].sort((a, b) => a[0] - b[0]);
    expect([of(8, 2), of(9, 1), of(7, 8), of(8, 9), of(7, 1)]).toEqual([
      [[1, 'true'], [5, 'false'], [9, 'member']],
      [[5, 'false'], [9, 'member']],
      [[5, 'true'], [9, 'member']],
      [[1, 'false'], [9, 'member']],
      [[5, 'elim']]
    ]);
    const frames = walkFrames(xz.step);
    const kinds = (fr: Frame | null) => new Set([...frameMarks(xz.step, fr, (c) => xz.values[c] !== '0').cands.values()].flatMap((x) => [...x.values()]));
    expect([...kinds(frames[0])]).toEqual(['member']);
    expect([...kinds(frames[1])].sort()).toEqual(['false', 'member', 'true']);
  });

  it('draws no role in a derived ALS pattern, and no gold or pattern-blue disc beside a truth mark in any frame of any set step (G2-G5, decision 10)', () => {
    const ROLES = new Set(['primary', 'secondary', 'fin']);
    const TRUTHS = new Set(['true', 'false', 'oneOf']);
    let views = 0;
    for (const { where, step: s, values } of corpus) {
      for (const fr of [null, ...walkFrames(s)]) {
        const kinds = new Set([...frameMarks(s, fr, (c) => values[c] !== '0').cands.values()].flatMap((x) => [...x.values()]));
        const roles = [...kinds].filter((k) => ROLES.has(k));
        if (s.truth === 'derived') expect(roles, `${where}, frame ${fr?.links ?? 'full'}`).toEqual([]);
        if ([...kinds].some((k) => TRUTHS.has(k))) expect(roles, `${where}, frame ${fr?.links ?? 'full'}`).toEqual([]);
        views++;
      }
    }
    expect(views).toBeGreaterThan(500);
  });

  it("draws Death Blossom with no truth: the stem's candidates and each petal's stem digit gold, every petal's z blue, the rest members, the stem no tile (decision 15)", () => {
    const db = EXAMPLES.DEATH_BLOSSOM!;
    const solved = (c: number) => db.values[c] !== '0';
    const at = (r: number, c: number) => (r - 1) * 9 + c - 1;
    const full = frameMarks(db.step, null, solved);
    const of = (r: number, c: number) => [...(full.cands.get(at(r, c)) ?? [])].sort((a, b) => a[0] - b[0]);
    // the stem r8c9 {257}; petals A r9c7 {24}, B r8c5 {15} and r9c6 {14}, C r8c1 {47}; r9c2's and r9c3's 4 removed
    expect([of(8, 9), of(9, 7), of(8, 5), of(9, 6), of(8, 1), of(9, 2).filter(([d]) => d === 4), of(9, 3).filter(([d]) => d === 4)]).toEqual([
      [[2, 'secondary'], [5, 'secondary'], [7, 'secondary']],
      [[2, 'secondary'], [4, 'primary']],
      [[1, 'member'], [5, 'secondary']],
      [[1, 'member'], [4, 'primary']],
      [[4, 'primary'], [7, 'secondary']],
      [[4, 'elim']],
      [[4, 'elim']]
    ]);
    expect(full.sets.map((x) => x.set)).toEqual([0, 1, 2]);
    expect(db.step.sets!.some((set) => set.cells.includes(at(8, 9)))).toBe(false);
    // the step names them so: every petal's z its pattern, the stem's candidates and each petal's stem digit what it acts through
    const named = (list: CellDigit[] | undefined) => (list ?? []).map((cd) => `${cd.digit}@${cd.cell}`);
    expect(named(db.step.primary)).toEqual([`4@${at(9, 7)}`, `4@${at(9, 6)}`, `4@${at(8, 1)}`]);
    expect(named(db.step.secondary)).toEqual([`2@${at(8, 9)}`, `5@${at(8, 9)}`, `7@${at(8, 9)}`, `2@${at(9, 7)}`, `5@${at(8, 5)}`, `7@${at(8, 1)}`]);
    expect(full.lines).toEqual(new Set(['weakTie']));
    // no truth in any frame; the stem from the first, alone; each branch's nodes from its frame
    const frames = walkFrames(db.step);
    for (const fr of [null, ...frames]) {
      const kinds = [...frameMarks(db.step, fr, solved).cands.values()].flatMap((x) => [...x.values()]);
      expect(kinds.filter((k) => k === 'true' || k === 'false' || k === 'oneOf' || k === 'node'), `frame ${fr?.links ?? 'full'}`).toEqual([]);
    }
    const marked = (fr: Frame) =>
      [...frameMarks(db.step, fr, solved).cands]
        .flatMap(([cell, m]) => [...m].map(([digit, k]) => `${cell}:${digit}:${k}`))
        .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    expect(marked(frames[0])).toEqual([`${at(8, 9)}:2:secondary`, `${at(8, 9)}:5:secondary`, `${at(8, 9)}:7:secondary`]);
    expect(frameMarks(db.step, frames[0], solved).sets).toEqual([]);
    expect(marked(frames[1])).toEqual([`${at(8, 9)}:2:secondary`, `${at(8, 9)}:5:secondary`, `${at(8, 9)}:7:secondary`, `${at(9, 7)}:2:secondary`, `${at(9, 7)}:4:primary`]);
    // petal B's own frame: its tiles and its candidates members, no branch yet
    expect(frameMarks(db.step, frames[2], solved).sets.map((x) => x.set)).toEqual([0, 1]);
    expect(marked(frames[2]).filter((k) => k.startsWith(`${at(8, 5)}:`))).toEqual([`${at(8, 5)}:1:member`, `${at(8, 5)}:5:member`]);
    // the legend: the removal, the pattern's z and what it acts through in words, the petals, the dashed line, no truth
    expect(legendOf(db.step, db.values).map((l) => l.kind)).toEqual(['elim', 'primary', 'secondary', 'tile', 'weakTie']);
    expect(premiseOf(db.step)).toBeNull();
  });

  it('draws an ALS pattern whose chain clashes with no truth in any view, its legend naming none (decision 13)', () => {
    let clashes = 0;
    for (const { where, step: s, values } of corpus) {
      if (!alsClash(s)) continue;
      clashes++;
      for (const fr of [null, ...walkFrames(s)]) {
        const m = frameMarks(s, fr, (c) => values[c] !== '0');
        const kinds = new Set([...m.cands.values()].flatMap((x) => [...x.values()]));
        expect([...kinds].filter((k) => k !== 'member' && k !== 'elim'), `${where}, frame ${fr?.links ?? 'full'}`).toEqual([]);
        expect(m.refuted, where).toBe(false);
        // the removals, the lettered cells and a cell of two sets' dashed outline: no truth
        expect(legendOf(s, values, fr).map((l) => l.kind).filter((k) => k !== 'elim' && k !== 'tile' && k !== 'shared'), `${where}, frame ${fr?.links ?? 'full'}`).toEqual([]);
      }
      expect(premiseOf(s), where).toBeNull();
      // its tiles, its arrows and its removal still drawn
      const full = frameMarks(s, null, (c) => values[c] !== '0');
      expect(full.sets.length, where).toBe(s.sets!.length);
    }
    expect(clashes).toBe(9);
  });

  it('gives the tints by decision 8: one each in letter order up to three, then the way that parts the most conflicting sets, never two linked ones, and uses all three', () => {
    const tints = (s: Step) => [...setTints(s)].sort((a, b) => a[0] - b[0]).map(([, t]) => t);
    expect(tints(EXAMPLES.ALS_XY_WING!.step)).toEqual([1, 2, 3]);
    expect(tints(EXAMPLES.DEATH_BLOSSOM!.step)).toEqual([1, 2, 3]);
    // four sets in a chain, none touching another but its neighbours by its link: all three tints, A and C sand
    expect(tints(EXAMPLES.ALS_XY_CHAIN!.step)).toEqual([1, 2, 1, 3]);
    // A-B-C-D, C beside A, D beside A and B: every pair conflicts, so one pair not linked shares a tint, the
    // first way in letter order: C takes A's sand, D violet
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
    expect(tints(chain)).toEqual([1, 2, 1, 3]);
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

  it('draws the set a walk frame introduces before any link reaches it: its tiles in its tint and its candidates members, no truth (decision 17)', () => {
    const ex = EXAMPLES.AIC_ALS!;
    const solved = (c: number) => ex.values[c] !== '0';
    const links = ex.step.links!.slice(0, 1);
    // the frame's set, given or not: its tiles and members, or nothing of it
    const show = (part: string) => part === 'units';
    const introduced = hintMarks(ex.step, { solved, links, sets: [0], walking: true, show });
    expect(introduced.sets).toEqual([{ set: 0, style: 'als', tint: 1 }]);
    expect(ex.step.sets![0].members.map((m) => kindAt(introduced, m))).toEqual(ex.step.sets![0].members.map(() => 'member'));
    const before = hintMarks(ex.step, { solved, links, walking: true, show });
    expect(before.sets).toEqual([]);
    expect(ex.step.sets![0].members.map((m) => kindAt(before, m))).toEqual(ex.step.sets![0].members.map(() => undefined));
    // through the walk: the set's own frame, and every frame after it, draws it
    const frames = walkFrames(ex.step);
    const own = frames.findIndex((f) => f.sets?.includes(0));
    expect(own).toBe(1);
    for (const [i, fr] of frames.entries()) expect(frameMarks(ex.step, fr, solved).sets.length, `frame ${i + 1}`).toBe(i < own ? 0 : 1);
  });

  it('words the premise of a chain that opens in an almost locked set by the set, whichever way it is assumed, and its refutation (decision 18)', () => {
    const xz = EXAMPLES.ALS_XZ!.step;
    const node = (k: number, d: number) => xz.sets![k].members.filter((m) => m.digit === d);
    // (5)A=(1)A-(1)B=(5)B: A holds no 5
    const chain = xz;
    expect(premiseOf(chain)).toEqual({ assumed: false, kind: 'set', letter: 'A', digit: 5 });
    // (1)A-(1)B=(5)B, opening weak: A holds a 1
    const weak = step({ ...chain, links: chain.links!.slice(1), eliminations: [] });
    expect(premiseOf(weak)).toEqual({ assumed: true, kind: 'set', letter: 'A', digit: 1 });
    expect(legendOf(weak).map((l) => l.label)).toEqual(['true, if set A holds a 1 (by the small dot)', 'false, if set A holds a 1 (by the small dot)', expect.stringMatching(/^lettered cells/)]);
    // a chain that goes on to a true 5 beside B's true 5, in box 9: A holds a 5 after all
    const clash = step({
      ...chain,
      links: [...chain.links!, { from: node(1, 5), to: [{ cell: 60, digit: 5 }], strong: false, toSet: undefined }, { from: [{ cell: 60, digit: 5 }], to: [{ cell: 80, digit: 5 }], strong: true }]
    });
    expect(frameMarks(clash, null, () => false).refuted).toBe(true);
    expect(legendOf(clash).map((l) => l.label)).toContain('the chain shows that premise is impossible: set A holds a 5 (by the small dot)');
    // a set's digit in one cell is still the set's, never "the first candidate": B's 1, in r8c9 only
    expect(premiseOf(step({ ...chain, links: chain.links!.slice(2) }))).toEqual({ assumed: false, kind: 'set', letter: 'B', digit: 1 });
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
      // an almost locked set's tiles, over the bands, the keylines of its letter tabs under their outlines,
      // and its letter tabs, over the removal bars (decisions 5 and 7)
      const tiles = at(svg, /<rect class="(?:tl|tk|to)" /);
      const tabs = at(svg, /<(?:rect class="tb"|text [^>]*class="tab")/);
      if (tiles.length) tiled++;
      expect(tabs.length, tech).toBe(tiles.length ? 2 * at(svg, /<rect class="tk"/).length : 0);
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

describe('a true node of several candidates where sets share a cell, and what a walk frame has proven (phase 4 review round 1)', () => {
  /** the techniques whose chains derive with sets: the grouped chains, AIC with ALS and the three ALS patterns */
  const DERIVED: Tech[] = ['AIC_GROUPED', 'GROUPED_NICE_LOOP', 'GROUPED_X_CYCLES', 'AIC_ALS', 'ALS_XZ', 'ALS_XY_WING', 'ALS_XY_CHAIN'];
  /**
   * Positions, as a puzzle and the solver's steps before them, where an
   * ALS-XY-Chain on offer has a true set node one of whose candidates a
   * one-cell set already makes true (the review's repros and scans; the
   * first is the set fixture's hard 1, step 19); in the second and the last
   * four the premise holds in the solution, and in the third and fourth a
   * walk frame once drew a truth only a later set proves
   */
  const SHARED: [string, number][] = [
    ['4.....8.5.3..........7......2.....6.....8.4......1.......6.3.7.5..2.....1.4......', 19],
    ['.......38.1..2.....5.7469..42...1...3.1...5.6...9...14..7614.5.....8..7.56.......', 21],
    ['..9.....2.5.6...3.1....9....6..8...7.1.46....5.4...1..683.4...1...29.8..........4', 4],
    ['..1..569.8......7..7..9...5...3..48.3...6...7.87..1...9...7..3..2......6.462..7..', 7],
    ['...9.....216547....89.21..............2.93.61......4.3.41.7...98.....7....51...2.', 11],
    ['...9.......95....47.5.436..53...2467.........6947...32..231.8.91....93.......4...', 32],
    ['1.8.9....3..7.5.....6.....7.....68.1.......2.96.4...5..9.2......2...7..8..4....3.', 10],
    ['.......2..3..1..949....6..55.....6.....9.8.7.....2......2....4.86..7....1.7.35...', 13]
  ];
  const at = (r: number, c: number, d: number): CellDigit => ({ cell: (r - 1) * 9 + c - 1, digit: d });
  const key = (x: CellDigit) => `${x.cell}:${x.digit}`;
  const kindAt = (m: ReturnType<typeof hintMarks>, cd: CellDigit) => m.cands.get(cd.cell)?.get(cd.digit);
  /** two candidates that cannot both be true */
  const excludes = (a: CellDigit, b: CellDigit) => (a.cell === b.cell ? a.digit !== b.digit : a.digit === b.digit && sees(a.cell, b.cell));
  type Entry = { where: string; step: Step; values: string; solution: Grid };
  /** every derived set step the repository keeps (the examples, the set fixture's positions) and the shared positions' */
  const corpus = (() => {
    const out: Entry[] = [];
    const solutionOf = (digits: string) => solve(parseGrid(digits)!)!;
    for (const tech of DERIVED) out.push({ where: tech, step: EXAMPLES[tech]!.step, values: EXAMPLES[tech]!.values, solution: solutionOf(EXAMPLES[tech]!.values) });
    const fx = JSON.parse(new TextDecoder().decode(readFileSync('tests/fixtures/setDrawings.json')));
    for (const section of ['paths', 'named']) {
      for (const [id, d] of Object.entries<{ position: { puzzle: string; values: string; cands: number[] } }>(fx[section])) {
        const tech = id.split(', ').at(-1) as Tech;
        if (!DERIVED.includes(tech)) continue;
        const g = parseGrid(d.position.puzzle)!;
        for (let i = 0; i < 81; i++) {
          g.values[i] = Number(d.position.values[i]);
          g.cands[i] = d.position.cands[i];
        }
        const s = findStep(tech, g);
        if (s?.tech === tech) out.push({ where: id, step: s, values: d.position.values, solution: solutionOf(d.position.puzzle) });
      }
    }
    for (const [puzzle, steps] of SHARED) {
      const g = parseGrid(puzzle)!;
      for (let i = 0; i < steps; i++) applyStep(g, findNextStep(g)!);
      const values = Array.from(g.values).join('');
      for (const tech of DERIVED) {
        const s = findStep(tech, g);
        if (s?.tech === tech) out.push({ where: `${puzzle} after ${steps}, ${tech}`, step: s, values, solution: solutionOf(puzzle) });
      }
    }
    return out;
  })();
  /** each view of a step that draws its truth, with the nodes of the links it draws (their truth as those links derive it) and its marks */
  const views = (e: Entry) => {
    const d = deriveTruth(e.step);
    if (!d || d.problems.length || alsClash(e.step)) return [];
    return [null, ...walkFrames(e.step)].map((fr) => {
      const drawn = drawnLinks(e.step, fr);
      const links = (e.step.links ?? []).filter((l, i) => drawn.has(i) && !l.undirected);
      return { fr, nodes: deriveLinks(links).nodes, marks: frameMarks(e.step, fr, (c) => e.values[c] !== '0') };
    });
  };
  const SHAPES = ['true', 'false', 'oneOf'];

  it('draws a true node of several candidates as "one of these" squares, or, where a node of one candidate already makes one of them true, as that disc and false rings, never a disc beside squares', () => {
    let fixed = 0;
    expect(corpus.length).toBeGreaterThan(140);
    expect(new Set(corpus.map((e) => e.step.tech))).toEqual(new Set(DERIVED));
    for (const e of corpus) {
      for (const { fr, nodes, marks } of views(e)) {
        const where = `${e.where}, frame ${fr ? fr.links : 'full'}`;
        const trueOne = (cd: CellDigit) => nodes.some((n) => n.truth && n.node.length === 1 && key(n.node[0]) === key(cd));
        for (const { node, truth } of nodes) {
          if (!truth || node.length < 2) continue;
          const kinds = node.map((cd) => kindAt(marks, cd));
          const discs = node.filter((cd) => kindAt(marks, cd) === 'true');
          expect(kinds.includes('true') && kinds.includes('oneOf'), `${where}: ${node.map(key)} ${kinds}`).toBe(false);
          // a disc is a node of one candidate the links drawn make true, and its node's others, which see it, are rings
          for (const cd of discs) expect(trueOne(cd), `${where}: ${key(cd)}`).toBe(true);
          if (discs.length) {
            fixed++;
            for (const cd of node) if (!discs.includes(cd) && SHAPES.includes(kindAt(marks, cd)!)) expect([kindAt(marks, cd), discs.some((p) => excludes(p, cd))], `${where}: ${key(cd)}`).toEqual(['false', true]);
          }
        }
      }
    }
    // the shared positions' nodes, in their full views, the last frames and the frames from the one-cell set's on
    expect(fixed).toBeGreaterThan(40);
  });

  it('draws in each view only the truths its links prove: a disc on a true node of one candidate, a square on a true node of several, a ring on a false node or beside a disc in its own node', () => {
    let early = 0;
    for (const e of corpus) {
      for (const { fr, nodes, marks } of views(e)) {
        const where = `${e.where}, frame ${fr ? fr.links : 'full'}`;
        const holding = (cd: CellDigit) => nodes.filter((n) => n.node.some((x) => key(x) === key(cd)));
        for (const [cell, m] of marks.cands) {
          for (const [digit, kind] of m) {
            if (!SHAPES.includes(kind)) continue;
            const cd = { cell, digit };
            const ns = holding(cd);
            const ok =
              kind === 'true'
                ? ns.some((n) => n.truth && n.node.length === 1)
                : kind === 'oneOf'
                  ? ns.some((n) => n.truth && n.node.length > 1)
                  : ns.some((n) => !n.truth) || ns.some((n) => n.truth && n.node.some((x) => kindAt(marks, x) === 'true' && excludes(x, cd)));
            if (!ok) early++;
            expect(ok, `${where}: ${kind} ${digit} in cell ${cell}`).toBe(true);
          }
        }
      }
    }
    expect(early).toBe(0);
  });

  it('draws nothing false under a premise that holds in the solution: every disc true there, every ring false, and each true node\'s squares holding its true candidate', () => {
    let held = 0;
    let settled = 0;
    for (const e of corpus) {
      const d = deriveTruth(e.step);
      if (!d || d.closure || !views(e).length) continue;
      const sol = (cd: CellDigit) => e.solution.values[cd.cell] === cd.digit;
      // the premise: the first node as the chain assumes it
      if (d.nodes[0].node.some(sol) !== d.nodes[0].truth) continue;
      held++;
      for (const { fr, nodes, marks } of views(e)) {
        const where = `${e.where}, frame ${fr ? fr.links : 'full'}`;
        for (const [cell, m] of marks.cands) {
          for (const [digit, kind] of m) {
            if (kind === 'true') expect(sol({ cell, digit }), `${where}: the disc on ${digit} in cell ${cell}`).toBe(true);
            if (kind === 'false') expect(sol({ cell, digit }), `${where}: the ring on ${digit} in cell ${cell}`).toBe(false);
          }
        }
        for (const { node, truth } of nodes) {
          if (!truth || node.length < 2) continue;
          if (node.some((cd) => kindAt(marks, cd) === 'true')) settled++;
          const squares = node.filter((cd) => kindAt(marks, cd) === 'oneOf');
          if (!squares.length) continue;
          // the true candidate is a square, or the step places it
          const placed = node.filter((cd) => isPlaced(kindAt(marks, cd)));
          expect([...squares, ...placed].some(sol), `${where}: the squares ${squares.map(key)}`).toBe(true);
        }
      }
    }
    expect(held).toBeGreaterThan(50);
    // the shared positions' true set nodes a one-cell set settles, their disc and rings checked
    expect(settled).toBeGreaterThan(20);
  });

  it('draws the stored repros as the chain proves them, frame by frame', () => {
    const find = (puzzle: string) => corpus.find((e) => e.where.startsWith(puzzle) && e.step.tech === 'ALS_XY_CHAIN')!;
    const allViews = (e: Entry) => [null, ...walkFrames(e.step)].map((fr) => ({ fr, m: frameMarks(e.step, fr, (c) => e.values[c] !== '0') }));
    const kinds = (m: ReturnType<typeof hintMarks>, cds: CellDigit[]) => cds.map((cd) => kindAt(m, cd));
    /** the walk frames before the one that draws the step's lock inside its set `letter`, and the rest */
    const split = (e: Entry, letter: string) => {
      const set = e.step.sets!.findIndex((s) => s.letter === letter);
      const lock = e.step.links!.findIndex((l) => l.fromSet === set && l.toSet === set);
      const all = allViews(e).filter((v) => v.fr && !v.fr.show.has('conclusion'));
      return [all.filter((v) => v.fr!.links <= lock), all.filter((v) => v.fr!.links > lock)];
    };
    // hard 1, step 19: B's lock makes 5r4c6 true, so D's other 5s, in column 6, are false
    const hard = find(SHARED[0][0]);
    expect(kinds(allViews(hard)[0].m, [at(4, 6, 5), at(2, 6, 5), at(3, 6, 5)])).toEqual(['true', 'false', 'false']);
    // the premise holds in the solution, where r2c1 is 9: 7r2c1 is no square
    const second = find(SHARED[1][0]);
    for (const { m } of allViews(second)) expect(kindAt(m, at(2, 1, 7)), 'r2c1').not.toBe('oneOf');
    expect(kinds(allViews(second)[0].m, [at(1, 2, 7), at(2, 1, 7)])).toEqual(['true', 'false']);
    // A's 7s are "one of these" until C's lock, the one-cell set r5c3, makes 7r5c3 true and the others false
    const third = find(SHARED[2][0]);
    const [before, after] = split(third, 'C');
    expect(before.length).toBeGreaterThan(2);
    for (const { m } of before.slice(1)) expect(kinds(m, [at(5, 3, 7), at(8, 3, 7), at(9, 3, 7)])).toEqual(['oneOf', 'oneOf', 'oneOf']);
    for (const { m } of after) expect(kinds(m, [at(5, 3, 7), at(8, 3, 7), at(9, 3, 7)])).toEqual(['true', 'false', 'false']);
    // A's 2s, r3c1 and r3c3, are "one of these" until C's lock makes 2r3c3 true
    const fourth = find(SHARED[3][0]);
    const [early, late] = split(fourth, 'C');
    for (const { m } of early.slice(1)) expect(kinds(m, [at(3, 1, 2), at(3, 3, 2)])).toEqual(['oneOf', 'oneOf']);
    for (const { m } of late) expect(kinds(m, [at(3, 1, 2), at(3, 3, 2)])).toEqual(['false', 'true']);
  });

  it('draws each walk frame of a chain whose nodes share no candidate as the whole chain derives it, as before', () => {
    let chains = 0;
    for (const e of corpus) {
      const d = deriveTruth(e.step);
      if (!d || d.problems.length || alsClash(e.step)) continue;
      const counted = d.nodes.flatMap((n) => n.node.map(key));
      if (new Set(counted).size !== counted.length) continue;
      chains++;
      const start = new Set((d.closure?.node ?? []).map(key));
      const shape = (t: string | undefined) => (t === 'groupTrue' ? 'oneOf' : t);
      for (const fr of walkFrames(e.step)) {
        if (fr.show.has('conclusion')) continue;
        const m = frameMarks(e.step, fr, (c) => e.values[c] !== '0');
        for (const [cell, ds] of m.cands) {
          for (const [digit, kind] of ds) {
            if (!SHAPES.includes(kind) || start.has(`${cell}:${digit}`)) continue;
            expect(kind, `${e.where}, frame ${fr.links}: ${digit} in cell ${cell}`).toBe(shape(d.candidates.get(`${cell}:${digit}`)));
          }
        }
      }
    }
    expect(chains).toBeGreaterThan(120);
  });
});

describe('the swatches of review round 1 (docs/hint-drawing-sets.md, the legend lines)', () => {
  it("draws, in the Learn legend, two bars where a view draws both inks, the pattern's above the removal's, and a cell of two sets as one set's tile with the other's outline dashed inside it", () => {
    const bars = swatchStyle({ kind: 'bars', label: '', colour: LIGHT.primaryInk, ink: LIGHT.elim });
    expect(bars.background).toBe(
      `linear-gradient(${LIGHT.primaryInk},${LIGHT.primaryInk}) 2px 1px/16px 3px no-repeat,linear-gradient(${LIGHT.elim},${LIGHT.elim}) 2px 6px/16px 3px no-repeat,#ffffff`
    );
    const shared = swatchStyle({ kind: 'shared', label: '', colour: LIGHT.set1, ink: LIGHT.set1Ink, dash: LIGHT.set2Ink });
    expect(shared.border).toBe(`1.5px solid ${LIGHT.set1Ink}`);
    // dashes in the other set's ink along the four sides inside the outline, over the tile's tint at half strength
    expect(shared.background.match(new RegExp(`repeating-linear-gradient\\((90|180)deg,${LIGHT.set2Ink} 0 2\\.5px,transparent 2\\.5px 4px\\)`, 'g'))).toHaveLength(4);
    expect(shared.background).toContain(`linear-gradient(${LIGHT.set1}80,${LIGHT.set1}80)`);
  });

  it("gives the hint panel the same swatches: two bars, and a tile in any set's tint with any set's outline dashed inside it", () => {
    const css = new TextDecoder().decode(readFileSync('src/ui/styles.css'));
    expect(css).toMatch(/\.hint-legend \.swatch-bars::before \{[^}]*background: var\(--hint-primary-ink\);/);
    expect(css).toMatch(/\.hint-legend \.swatch-bars::after \{[^}]*background: var\(--hint-elim\);/);
    expect(css).toMatch(/\.hint-legend \.swatch-shared::after \{[^}]*border: 1\.5px dashed var\(--dash\);/);
    for (const n of [1, 2, 3]) {
      expect(css).toContain(`.hint-legend .swatch-shared.tile-${n} {\n  --sw: var(--hint-set-${n});\n  --sw-ink: var(--hint-set-${n}-ink);\n}`);
      expect(css).toContain(`.hint-legend .swatch-shared.dash-${n} {\n  --dash: var(--hint-set-${n}-ink);\n}`);
    }
  });
});

describe("the sets' tints, review round 1 of phase 4 (docs/hint-drawing-sets.md, decision 8)", () => {
  const set = (letter: string, cells: number[]): ChainSet => ({ kind: 'als', cells, digits: [1, 2, 3], members: [], unit: 0, letter });
  const chainOf = (sets: ChainSet[]) =>
    step({
      tech: 'ALS_XY_CHAIN',
      sets,
      links: sets.slice(1).map((_, k) => ({ from: [], to: [], strong: false, fromSet: k, toSet: k + 1 }))
    });
  const tints = (s: Step) => [...setTints(s)].sort((a, b) => a[0] - b[0]).map(([, t]) => t);
  const besideCell = (a: number, b: number) =>
    (Math.floor(a / 9) === Math.floor(b / 9) && Math.abs(a - b) === 1) || (a % 9 === b % 9 && Math.abs(a - b) === 9);

  it('gives a chain of four sets all three tints, so no two of its sets look alike but one pair that does not conflict', () => {
    // four sets apart: the lowest tint free for each would take turns, sand and rose, and leave violet out
    expect(tints(chainOf([set('A', [0]), set('B', [40]), set('C', [80]), set('D', [44])]))).toEqual([1, 2, 1, 3]);
    expect(new Set(tints(EXAMPLES.ALS_XY_CHAIN!.step)).size).toBe(3);
  });

  it('never puts one tint on two conflicting sets where a way of giving them parts every pair, as taking the least used tint free for each in turn would', () => {
    // A-B-C-D with D on A's cell and beside B: A sand and B rose, then the
    // least used tint free for C, violet, leaves none free for D; C sand
    // leaves D violet
    const shared = chainOf([set('A', [0]), set('B', [20]), set('C', [40]), set('D', [0, 21])]);
    expect(tints(shared)).toEqual([1, 2, 1, 3]);
  });

  it('over every set step the repository keeps, parts the conflicting sets wherever any way does, never two linked ones, and uses all three tints wherever that costs no conflict', () => {
    const ALS: Tech[] = ['AIC_ALS', 'ALS_XZ', 'ALS_XY_WING', 'ALS_XY_CHAIN', 'DEATH_BLOSSOM'];
    const steps: { where: string; step: Step }[] = ALS.map((tech) => ({ where: tech, step: EXAMPLES[tech]!.step }));
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
        if (s?.tech === tech) steps.push({ where: id, step: s });
      }
    }
    let four = 0;
    for (const { where, step: s } of steps) {
      const sets = s.sets ?? [];
      const ks = sets.flatMap((x, k) => (x.kind === 'als' ? [k] : []));
      const linked = (a: number, b: number) => (s.links ?? []).some((l) => (l.fromSet === a && l.toSet === b) || (l.fromSet === b && l.toSet === a));
      const conflict = (a: number, b: number) => linked(a, b) || sets[a].cells.some((x) => sets[b].cells.some((y) => x === y || besideCell(x, y)));
      const pairs = ks.flatMap((a, i) => ks.slice(i + 1).map((b) => [a, b]));
      // every way of giving the three tints to the sets
      const ways: Map<number, number>[] = [new Map()];
      for (const k of ks) ways.splice(0, ways.length, ...ways.flatMap((w) => [1, 2, 3].map((t) => new Map([...w, [k, t]]))));
      const clashes = (w: Map<number, number>) => pairs.filter(([a, b]) => conflict(a, b) && w.get(a) === w.get(b)).length;
      const least = Math.min(...ways.map(clashes));
      const t = setTints(s);
      for (const [a, b] of pairs) if (linked(a, b)) expect(t.get(a), `${where}: linked sets ${a} and ${b}`).not.toBe(t.get(b));
      expect(clashes(t), where).toBe(least);
      const wide = ways.filter((w) => clashes(w) === least).some((w) => new Set(w.values()).size === Math.min(3, ks.length));
      if (wide) expect(new Set(t.values()).size, where).toBe(Math.min(3, ks.length));
      if (ks.length >= 4) four++;
    }
    // the stored ALS-XY-Chain and the set fixture's four-set chains
    expect(four).toBeGreaterThan(10);
  });
});

describe("the Learn diagrams' tiles, review round 1 of phase 4 (docs/hint-drawing-sets.md, decision 5)", () => {
  it("draw a tile's fill, then the keylines of the tabs on it, then its outline, so a tab in its edge row sits on the outline, as on the app's board", () => {
    for (const tech of ['AIC_ALS', 'ALS_XZ', 'ALS_XY_WING', 'ALS_XY_CHAIN', 'DEATH_BLOSSOM'] as Tech[]) {
      const svg = boardSvg(EXAMPLES[tech]!, TECHS[tech].name);
      const at = (re: RegExp) => [...svg.matchAll(new RegExp(re.source, 'g'))].map((m) => m.index!);
      const [fills, keys, outlines, tabs] = [/<rect class="tl" /, /<rect class="tk" /, /<rect class="to" /, /<rect class="tb" /].map(at);
      expect(keys.length, tech).toBe(tabs.length);
      expect(keys.length, tech).toBeGreaterThan(0);
      expect(Math.max(...fills), tech).toBeLessThan(Math.min(...keys));
      expect(Math.max(...keys), tech).toBeLessThan(Math.min(...outlines));
      expect(Math.max(...outlines), tech).toBeLessThan(Math.min(...tabs));
    }
  });
});
