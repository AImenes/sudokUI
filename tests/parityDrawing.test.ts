/**
 * A colouring drawn by its parity (docs/hint-drawing-colouring.md): the
 * step model and its self-check (src/engine/steps.ts, src/engine/truth.ts
 * checkParity), the walk (src/engine/hintFrames.ts), the marks and the
 * legend (src/content/hintMarks.ts), the geometry of weak ties and corner
 * brackets (src/content/hintGeometry.ts), and the two boards and their
 * legends (src/ui/Grid.tsx, src/ui/HintPanel.tsx, src/content/boardSvg.ts).
 * The colourings are the hand-built ones of tests/parityFixtures.ts, one
 * per shape of argument, on real positions, which tests/colouring.test.ts
 * holds the finders to; every other drawing is held as it was by
 * tests/drawingSnapshot.test.ts.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { PARITY_FIXTURES, fixture, positionOf, exampleOf, cd, cds, nameOf } from './parityFixtures';
import type { ParityFixture } from './parityFixtures';
import type { CellDigit, ChainLink, Step } from '../src/engine/steps';
import { isParity, isTie } from '../src/engine/steps';
import { checkParity } from '../src/engine/truth';
import { walkFrames, drawnLinks, conclusionText } from '../src/engine/hintFrames';
import type { Frame } from '../src/engine/hintFrames';
import { frameMarks, legendKinds, parityLegend, markedCandidates, placedKeys } from '../src/content/hintMarks';
import type { HintMarks } from '../src/content/hintMarks';
import { arrowShapes, startMarkers, badgePoints, SIZES } from '../src/content/hintGeometry';
import type { ArrowShape, Point } from '../src/content/hintGeometry';
import { boardLayout, digitShown } from '../src/ui/boardLayout';
import { boardSvg, legendOf, swatchStyle } from '../src/content/boardSvg';
import { MARK, LIGHT } from '../src/content/hintPalette';
import { EXAMPLES } from '../src/content/examples';
import { setEngineText } from '../src/engine/text';
import engineNb from '../src/content/locales/engine.nb';
import engineEs from '../src/content/locales/engine.es';

const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k)
};

const key = (x: CellDigit) => `${x.cell}:${x.digit}`;
const has = (list: CellDigit[], x: CellDigit) => list.some((o) => o.cell === x.cell && o.digit === x.digit);
const solvedIn = (f: ParityFixture) => (cell: number) => positionOf(f).grid.values[cell] > 0;
/** every candidate's mark, as "4r1c5": kind */
const kindsOf = (m: HintMarks): Record<string, string> =>
  Object.fromEntries([...m.cands].flatMap(([cell, ds]) => [...ds].map(([digit, k]) => [nameOf({ cell, digit }), k])));
const marksAt = (f: ParityFixture, frame: Frame | null) => frameMarks(f.step, frame, solvedIn(f));
/** the views of a fixture: its full view, then every frame of its walk */
const views = (f: ParityFixture): (Frame | null)[] => [null, ...walkFrames(f.step)];
const coloured = (s: Step) => s.colouring!.clusters.flatMap((cl) => [...cl.dark, ...cl.light]);
/** the frame number (from 1) that first reaches each link */
const frameOfLink = (s: Step) => {
  const frames = walkFrames(s);
  return (s.links ?? []).map((_, i) => frames.findIndex((fr) => fr.links > i) + 1);
};

describe('the step model and its self-check', () => {
  it('a colouring is truth parity with its clusters, and names no roles', () => {
    for (const f of PARITY_FIXTURES) {
      expect(isParity(f.step), f.name).toBe(true);
      expect(f.step.primary ?? f.step.secondary ?? f.step.fins ?? f.step.labels, f.name).toBeUndefined();
    }
    expect(isParity({ ...fixture('trap').step, colouring: undefined })).toBe(false);
    // the finders say it too (tests/colouring.test.ts), and nothing else does
    expect(isParity(EXAMPLES.SIMPLE_COLORS!.step)).toBe(true);
    expect(isParity(EXAMPLES.AIC!.step)).toBe(false);
  });

  it('every fixture passes checkParity against its board, and its colours are what the solution says', () => {
    for (const f of PARITY_FIXTURES) {
      const { grid, solution } = positionOf(f);
      expect(checkParity(f.step, grid.cands), f.name).toEqual([]);
      const truth = (x: CellDigit) => solution[x.cell] === x.digit;
      // every candidate drawn is on the board
      for (const x of [...coloured(f.step), ...f.step.eliminations, ...f.step.links!.flatMap((l) => [...l.from, ...l.to])]) {
        expect(grid.cands[x.cell] & (1 << (x.digit - 1)), `${f.name} ${nameOf(x)}`).not.toBe(0);
      }
      f.step.colouring!.clusters.forEach((cl, k) => {
        // exactly one colour of each cluster is wholly true
        const dark = cl.dark.map(truth);
        const light = cl.light.map(truth);
        expect(new Set(dark).size, `${f.name} cluster ${k}`).toBe(1);
        expect(new Set(light).size, `${f.name} cluster ${k}`).toBe(1);
        expect(dark[0], `${f.name} cluster ${k}`).not.toBe(light[0]);
        // a colour proven false is false, and its partner true
        if (f.step.colouring!.darkFalse === k) expect([dark[0], light[0]], f.name).toEqual([false, true]);
      });
      for (const x of f.step.eliminations) expect(truth(x), `${f.name} removes ${nameOf(x)}`).toBe(false);
    }
  });

  it('names whatever is wrong: two colours, a tie between like shades or no strong relation, a weak tie that is none, a cluster its ties leave apart, links out of order, the proven colour not removed or more removed', () => {
    const issues = (s: Step, cands?: ArrayLike<number>) => checkParity(s, cands).map((p) => p.issue);
    const trap = fixture('trap').step;
    const wrap = fixture('wrap').step;
    const cl = trap.colouring!.clusters[0];
    const withClusters = (s: Step, clusters: typeof cl[]) => ({ ...s, colouring: { ...s.colouring!, clusters } });
    // a candidate in both colours
    expect(issues(withClusters(trap, [{ dark: cl.dark, light: [...cl.light, cl.dark[0]] }]))).toContain('twoColours');
    // a tie joining two dark candidates
    const like: ChainLink = { from: [cd('4r1c5')], to: [cd('4r6c4')], strong: true, undirected: true };
    expect(issues({ ...trap, links: [like, ...trap.links!] })).toContain('sameShade');
    // a tie between candidates that do not see each other, and one the board does not make strong
    const far: ChainLink = { from: [cd('4r1c5')], to: [cd('4r8c8')], strong: true, undirected: true };
    expect(issues({ ...trap, links: [far, ...trap.links!] })).toContain('notStrong');
    const { grid } = positionOf(fixture('trap'));
    expect(issues(trap, grid.cands)).toEqual([]);
    // the tie 4r1c5-4r1c6, the only two 4s of row 1 and of box 2, with a third 4 in both
    const cands = Array.from(grid.cands);
    cands[cd('4r1c4').cell] |= 1 << 3;
    expect(checkParity(trap, cands)).toEqual([{ link: 1, issue: 'notStrong', at: '4r1c5' }]);
    // two cells that hold only the same two digits and see each other are strong on each digit (Remote Pair)
    const pair: ChainLink = { from: [cd('4r6c4')], to: [cd('4r5c5')], strong: true, undirected: true };
    expect(issues({ ...trap, links: [trap.links![0], pair, ...trap.links!.slice(1).filter((l) => l.to[0].cell !== pair.from[0].cell)] }, grid.cands)).toEqual([]);
    // a weak tie between candidates that do not see each other
    const notWeak: ChainLink = { from: [cd('4r1c5')], to: [cd('4r6c8')], strong: false, undirected: true, text: 'x' };
    expect(issues({ ...trap, links: [...trap.links!, notWeak] })).toContain('notWeak');
    // a cluster left in two pieces
    expect(issues({ ...trap, links: trap.links!.filter((_, i) => i !== 2) })).toContain('unspanned');
    // a tie after the argument
    expect(issues({ ...trap, links: [...trap.links!.slice(1), trap.links![0]] })).toContain('order');
    // cluster 1's ties before cluster 0's: each of cluster 0's ties comes too late
    const bridge = fixture('bridge');
    const [purple] = bridge.step.colouring!.clusters;
    const ofPurple = (l: ChainLink) => isTie(l) && has([...purple.dark, ...purple.light], l.from[0]);
    const links = bridge.step.links!;
    const swapped = [...links.filter((l) => isTie(l) && !ofPurple(l)), ...links.filter(ofPurple), ...links.filter((l) => !isTie(l))];
    expect(checkParity(bridge.step, positionOf(bridge).grid.cands)).toEqual([]);
    expect(checkParity({ ...bridge.step, links: swapped }, positionOf(bridge).grid.cands)).toEqual([
      { link: 5, issue: 'order', at: '6r8c6' },
      { link: 6, issue: 'order', at: '6r8c7' },
      { link: 7, issue: 'order', at: '6r5c7' }
    ]);
    // the proven colour, not all removed; a coloured candidate removed outside it
    expect(issues({ ...wrap, eliminations: wrap.eliminations.slice(1) })).toEqual(['notRemoved']);
    expect(issues({ ...wrap, eliminations: [...wrap.eliminations, cd('7r4c9')] })).toEqual(['removedOutside']);
    expect(issues({ ...trap, eliminations: [...trap.eliminations, cd('4r5c5')] })).toEqual(['removedOutside']);
    // nothing to say of a step that is not a colouring
    expect(checkParity(EXAMPLES.AIC!.step)).toEqual([]);
  });
});

describe('the walk', () => {
  it('has a frame per cluster, one per link of the argument, the proof where a colour is proven, and the conclusion', () => {
    const counts: Record<string, number> = { trap: 4, wrap: 4, bridge: 6, seesBoth: 6, medusa1: 4, medusa3: 3, medusa5: 4, medusa6: 5, remotePair: 4 };
    for (const f of PARITY_FIXTURES) {
      const frames = walkFrames(f.step);
      expect(frames.length, f.name).toBe(counts[f.name]);
      const { clusters, darkFalse } = f.step.colouring!;
      const args = f.step.links!.filter((l) => !isTie(l)).length;
      expect(frames.length, f.name).toBe(clusters.length + args + (darkFalse !== undefined ? 1 : 0) + 1);
      // the cluster frames show the clusters so far, the first tie's sentence their own
      clusters.forEach((_, k) => {
        expect([...frames[k].show].sort(), `${f.name} ${k}`).toEqual(['units', 'cluster0', ...(k ? ['cluster1'] : [])].sort());
        const ties = f.step.links!.filter((l) => isTie(l) && has(clusters[k].dark.concat(clusters[k].light), l.from[0]));
        expect(frames[k].text, `${f.name} ${k}`).toBe(ties[0].text);
      });
      // the proof, then the conclusion
      const last = frames[frames.length - 1];
      expect(last.show.has('conclusion'), f.name).toBe(true);
      const proof = frames[frames.length - 2];
      expect(proof.show.has('proof') && !proof.show.has('conclusion'), f.name).toBe(darkFalse !== undefined);
      expect(last.text.startsWith(conclusionText(f.step)), f.name).toBe(true);
    }
  });

  it('draws each link first in the frame that reaches it: a tie only there, a weak tie from there on and in the full view', () => {
    for (const f of PARITY_FIXTURES) {
      const frames = walkFrames(f.step);
      const first = frameOfLink(f.step);
      const full = drawnLinks(f.step, null);
      f.step.links!.forEach((l, i) => {
        const at = first[i] - 1;
        expect(at, `${f.name} link ${i + 1}`).toBeGreaterThanOrEqual(0);
        frames.forEach((fr, j) => {
          const drawn = drawnLinks(f.step, fr).has(i);
          if (isTie(l)) expect(drawn, `${f.name} tie ${i + 1} in frame ${j + 1}`).toBe(j === at);
          else expect(drawn, `${f.name} weak tie ${i + 1} in frame ${j + 1}`).toBe(j >= at);
        });
        expect(full.has(i), `${f.name} link ${i + 1} in the full view`).toBe(!isTie(l));
      });
    }
  });

  it('says the proven colour in its hue, by digit for one digit and by candidate for more, and the conclusion its partner true', () => {
    expect(walkFrames(fixture('wrap').step).at(-2)!.text).toBe(
      'So dark purple is false and light purple is true: once dark purple is removed, every light purple 7 is a single.'
    );
    expect(walkFrames(fixture('wrap').step).at(-1)!.text).toBe(
      'So 7 is removed from r4c7, r6c9. Every light purple 7 is true; this step only removes, and each is then a single.'
    );
    expect(walkFrames(fixture('seesBoth').step).at(-2)!.text).toBe(
      'So dark orange is false and light orange is true: once dark orange is removed, every light orange 9 is a single.'
    );
    expect(walkFrames(fixture('seesBoth').step).at(-1)!.text).toMatch(/Every light orange 9 is true; this step only removes, and each is then a single\.$/);
    expect(walkFrames(fixture('medusa1').step).at(-2)!.text).toMatch(/every light purple candidate is a single\.$/);
    expect(walkFrames(fixture('medusa6').step).at(-1)!.text).toMatch(/Every light purple candidate is true; this step only removes/);
    // a step that proves no colour concludes with its removals alone
    expect(walkFrames(fixture('trap').step).at(-1)!.text).toBe('So 4 is removed from r6c8.');
  });

  it('ends on the full view', () => {
    for (const f of PARITY_FIXTURES) {
      const frames = walkFrames(f.step);
      expect(marksAt(f, frames[frames.length - 1]), f.name).toEqual(marksAt(f, null));
    }
  });

  it('leaves every other walk as it was: no frame lists its own links, and each draws the links it has reached', () => {
    for (const ex of Object.values(EXAMPLES)) {
      if (isParity(ex!.step)) continue;
      for (const fr of walkFrames(ex!.step)) {
        expect(fr.drawn, ex!.step.tech).toBeUndefined();
        expect([...drawnLinks(ex!.step, fr)], ex!.step.tech).toEqual(Array.from({ length: fr.links }, (_, i) => i));
      }
      expect(drawnLinks(ex!.step, null).size, ex!.step.tech).toBe(ex!.step.links?.length ?? 0);
    }
  });
});

describe('the marks', () => {
  it('shade a candidate exactly where its cluster is shown and it is not proven, and draw the proof in its frame only', () => {
    for (const f of PARITY_FIXTURES) {
      const { clusters, darkFalse } = f.step.colouring!;
      for (const frame of views(f)) {
        const where = frame ? `${f.name} frame "${frame.text.slice(0, 30)}"` : `${f.name} full view`;
        const show = (p: string) => !frame || frame.show.has(p as never);
        const kinds = kindsOf(marksAt(f, frame));
        const concluded = show('conclusion');
        const proving = !concluded && show('proof');
        clusters.forEach((cl, k) => {
          const hue = k === 0 ? 'purple' : 'orange';
          const proven = darkFalse === k && (concluded || proving);
          for (const [list, dark] of [
            [cl.dark, true],
            [cl.light, false]
          ] as const) {
            for (const x of list) {
              const want = !show(`cluster${k}`)
                ? undefined
                : proven
                  ? dark
                    ? concluded
                      ? 'elim'
                      : 'false'
                    : 'true'
                  : `${hue}${dark ? 'Dark' : 'Light'}`;
              expect(kinds[nameOf(x)], `${where}: ${nameOf(x)}`).toBe(want);
            }
          }
        });
        // nothing a pattern or an older colouring would draw, and nothing inside a removal
        for (const k of Object.values(kinds)) expect(['primary', 'secondary', 'fin', 'elimOn', 'placeOn', 'oneTrue', 'place'], where).not.toContain(k);
        expect(marksAt(f, frame).inside.size, where).toBe(0);
        if (!proving) expect(Object.values(kinds), where).not.toContain('false');
        // orange is never in shades beside a true disc (worst-model ΔE 10.7)
        if (Object.values(kinds).includes('true')) expect(Object.values(kinds).filter((k) => k.startsWith('orange')), where).toEqual([]);
      }
    }
  });

  it('mark an end of a drawn weak tie no colour claims: a removal, or the plain ring of the cell rule 6 would empty', () => {
    for (const f of PARITY_FIXTURES) {
      const removed = (x: CellDigit) => has(f.step.eliminations, x);
      for (const frame of views(f)) {
        const kinds = kindsOf(marksAt(f, frame));
        const drawn = drawnLinks(f.step, frame);
        const ends = f.step.links!.filter((_, i) => drawn.has(i)).flatMap((l) => [...l.from, ...l.to]).filter((x) => !has(coloured(f.step), x));
        const concluded = !frame || frame.show.has('conclusion');
        // before the conclusion, a removal is drawn only where a weak tie reaches it
        for (const [name, k] of Object.entries(kinds)) {
          const x = cd(name);
          if (k === 'node') expect(ends.some((e) => key(e) === key(x)) && !removed(x), `${f.name} ${name}`).toBe(true);
          if (k === 'elim' && !concluded) expect(ends.some((e) => key(e) === key(x)), `${f.name} ${name}`).toBe(true);
        }
        for (const x of ends) expect(kinds[nameOf(x)], `${f.name} ${nameOf(x)}`).toBe(removed(x) ? 'elim' : 'node');
        if (concluded) for (const x of f.step.eliminations) expect(kinds[nameOf(x)], `${f.name} ${nameOf(x)}`).toBe('elim');
      }
    }
    // rule 6's emptied cell, r4c4, ringed in the full view as in its frames
    const m6 = kindsOf(marksAt(fixture('medusa6'), null));
    expect([m6['7r4c4'], m6['8r4c4']]).toEqual(['node', 'node']);
  });
});

describe('the legend', () => {
  /** the legend's words in a view */
  const words = (f: ParityFixture, frame: Frame | null) => parityLegend(f.step, marksAt(f, frame));

  it('names each cluster drawn in its shades, the lines drawn, and the proven colours by their shade', () => {
    const trap = fixture('trap');
    const [one, two] = walkFrames(trap.step);
    expect(words(trap, one)).toEqual([
      { kind: 'pair', cluster: 0, label: 'dark purple, light purple: either every dark purple 4 is true, or every light purple one is' },
      { kind: 'tie', label: 'line: exactly one of its two ends is true' }
    ]);
    expect(words(trap, two).map((e) => e.kind)).toEqual(['pair', 'weakTie', 'elim']);
    expect(words(trap, two)[1].label).toBe('dashed line: its two ends see each other, so at most one is true');
    expect(words(trap, two)[2].label).toBe('remove');
    // a wrap's proof frame, and its conclusion: no shade is left, so the shade is in the words
    const wrap = fixture('wrap');
    const wf = walkFrames(wrap.step);
    expect(words(wrap, wf[2]).map((e) => e.label)).toEqual([
      'dashed line: its two ends see each other, so at most one is true',
      'true: light purple, proven (this step only removes)',
      'false: dark purple, proven'
    ]);
    expect(words(wrap, null).map((e) => e.label)).toEqual([
      'dashed line: its two ends see each other, so at most one is true',
      'remove: dark purple, proven false',
      'true: light purple, proven (this step only removes)'
    ]);
    // Multi Colors: orange from its own frame on, and gone once it is proven
    const both = fixture('seesBoth');
    const bf = walkFrames(both.step);
    expect(words(both, bf[0]).filter((e) => e.kind === 'pair').map((e) => e.cluster)).toEqual([0]);
    expect(words(both, bf[1]).filter((e) => e.kind === 'pair').map((e) => e.cluster)).toEqual([0, 1]);
    expect(words(both, bf[1])[1].label).toBe('dark orange, light orange: either every dark orange 9 is true, or every light orange one is');
    expect(words(both, null).map((e) => e.label)).toEqual([
      'dark purple, light purple: either every dark purple 9 is true, or every light purple one is',
      'dashed line: its two ends see each other, so at most one is true',
      'remove: dark orange, proven false',
      'true: light orange, proven (this step only removes)'
    ]);
    // 3D Medusa: by candidate; its corner brackets, and rule 6's emptied cell
    const m1 = fixture('medusa1');
    expect(words(m1, walkFrames(m1.step)[1]).map((e) => e.label)).toEqual([
      'dark purple, light purple: either every dark purple candidate is true, or every light purple one is',
      'corner brackets: two candidates of one cell, at most one true'
    ]);
    expect(words(fixture('medusa6'), null).map((e) => e.label)).toContain('a cell dark purple would empty');
  });

  it("comes from the kinds the view draws: the clusters in shades, the lines, and what of the proven colour is drawn", () => {
    const kinds = (f: ParityFixture, frame: Frame | null) => legendKinds(f.step, marksAt(f, frame));
    const wrap = fixture('wrap');
    const wf = walkFrames(wrap.step);
    expect(kinds(wrap, wf[0]).clusters).toEqual([0]);
    expect([...kinds(wrap, wf[0]).lines]).toEqual(['tie']);
    expect(kinds(wrap, wf[1]).proven).toEqual({ false: false, removed: false, true: false, otherRemoved: false });
    expect(kinds(wrap, wf[2]).proven).toEqual({ false: true, removed: false, true: true, otherRemoved: false });
    expect(kinds(wrap, wf[2]).clusters).toEqual([]);
    expect(kinds(wrap, null).proven).toEqual({ false: false, removed: true, true: true, otherRemoved: false });
    expect(kinds(fixture('trap'), null).proven).toEqual({ false: false, removed: false, true: false, otherRemoved: true });
    expect(kinds(fixture('bridge'), walkFrames(fixture('bridge').step)[1]).clusters).toEqual([0, 1]);
    expect([...kinds(fixture('medusa5'), null).lines].sort()).toEqual(['corners', 'weakTie']);
    // a Medusa cluster frame whose ties all lie inside cells would draw no line, and names none
    const m = fixture('medusa1');
    const inCell = { ...m.step, links: m.step.links!.filter((l) => !isTie(l) || l.from[0].cell === l.to[0].cell) };
    expect(legendKinds(inCell, frameMarks(inCell, { text: '', links: 0, drawn: inCell.links.map((_, i) => i).filter((i) => isTie(inCell.links[i])), show: new Set(['units', 'cluster0']) }, solvedIn(m))).lines.size).toBe(0);
    // nothing of the sort for any other step
    const aic = legendKinds(EXAMPLES.AIC!.step, frameMarks(EXAMPLES.AIC!.step, null, () => false));
    expect([aic.clusters, aic.lines.size, aic.proven]).toEqual([[], 0, { false: false, removed: false, true: false, otherRemoved: true }]);
  });

  it('names a hue only where the view draws it, and dark or light only with a hue', () => {
    for (const f of PARITY_FIXTURES) {
      for (const frame of views(f)) {
        const kinds = Object.values(kindsOf(marksAt(f, frame)));
        const drawn = (k: number) =>
          kinds.some((x) => x.startsWith(k === 0 ? 'purple' : 'orange')) ||
          (f.step.colouring!.darkFalse === k && kinds.some((x) => x === 'true' || x === 'false'));
        // the legend, and the sentences the walk itself writes: the proof's and the conclusion's
        const own = frame && (frame.show.has('proof') || frame.show.has('conclusion')) ? [frame.text] : [];
        const text = [...words(f, frame).map((e) => e.label), ...own].join(' | ');
        if (/purple/.test(text)) expect(drawn(0), `${f.name}: ${text}`).toBe(true);
        if (/orange/.test(text)) expect(drawn(1), `${f.name}: ${text}`).toBe(true);
        expect(text, f.name).not.toMatch(/\b(blue|gold|red|violet|yellow|circled)\b/);
        expect(text.replace(/\b(dark|light) (purple|orange)\b/g, ''), f.name).not.toMatch(/\b(dark|light)\b/);
      }
    }
  });

  it('is in Norwegian and Spanish in the colours drawn, words that do not inflect', () => {
    const labels = () =>
      PARITY_FIXTURES.flatMap((f) => views(f).flatMap((frame) => words(f, frame).map((e) => e.label)))
        .concat(PARITY_FIXTURES.flatMap((f) => walkFrames(f.step).slice(-2).map((fr) => fr.text)))
        .join(' | ');
    try {
      setEngineText('nb', engineNb);
      const nb = labels();
      expect(nb).toMatch(/mørkelilla, lyselilla/);
      expect(nb).toMatch(/mørkeoransje, lyseoransje/);
      expect(nb).not.toMatch(/\b(blå|gul|rød|fiolett\w*)\b/);
      setEngineText('es', engineEs);
      const es = labels();
      expect(es).toMatch(/morado oscuro, morado claro/);
      expect(es).toMatch(/naranja oscuro, naranja claro/);
      expect(es).not.toMatch(/\b(azul|dorado|rojo|violeta)\b/);
    } finally {
      setEngineText('en', null);
    }
  });

  it('is the same list under the Learn diagram, each swatch drawn like its mark', () => {
    for (const f of PARITY_FIXTURES) {
      const ex = exampleOf(f);
      for (const frame of views(f)) {
        const entries = legendOf(f.step, ex.values, frame);
        expect(entries.map((e) => [e.kind, e.label]), f.name).toEqual(words(f, frame).map((e) => [e.kind, e.label]));
      }
    }
    const pair = legendOf(fixture('bridge').step, exampleOf(fixture('bridge')).values).filter((e) => e.kind === 'pair');
    expect(pair.map((e) => [e.colour, e.ink, e.light, e.lightInk])).toEqual([
      [LIGHT.purple, LIGHT.purpleInk, LIGHT.purpleLight, LIGHT.purpleLightInk],
      [LIGHT.orange, LIGHT.orangeInk, LIGHT.orangeLight, LIGHT.orangeLightInk]
    ]);
    // two discs side by side, the light one rimmed in the dark shade
    const style = swatchStyle(pair[0]);
    expect(style.background).toContain(`${LIGHT.purple} 4.35px`);
    expect(style.background).toContain(`${LIGHT.purpleLight} 4.35px,${LIGHT.purpleLightInk}`);
    expect(style.width).toBe('22px');
    for (const e of legendOf(fixture('medusa5').step, exampleOf(fixture('medusa5')).values)) expect(swatchStyle(e).background, e.kind).toBeTruthy();
  });
});

/** the app board's geometry for a fixture, worked out as src/ui/Grid.tsx works it out */
function geometryOf(f: ParityFixture) {
  const { grid } = positionOf(f);
  const solved = solvedIn(f);
  const full = frameMarks(f.step, null, solved);
  const marks = markedCandidates(full);
  const shown = (x: CellDigit) => digitShown({ value: grid.values[x.cell], corner: 0, center: 0 }, x.digit, grid.cands[x.cell], full.cands.get(x.cell));
  const layout = boardLayout(placedKeys(full), shown, solved);
  const shapes = arrowShapes(f.step.links!, layout, marks);
  const dots = startMarkers(f.step.links!, layout, marks, shapes);
  return { layout, marks, shapes, dots, badges: badgePoints(shapes, layout, marks, dots) };
}

describe('the geometry', () => {
  const at = (r: number, c: number, d: number): CellDigit => ({ cell: (r - 1) * 9 + c - 1, digit: d });

  it('draws a weak tie as an arrow with no head and no start dot, and a tie inside a cell as nothing', () => {
    for (const f of PARITY_FIXTURES) {
      const { shapes, dots } = geometryOf(f);
      expect(dots, f.name).toEqual([]);
      f.step.links!.forEach((l, i) => {
        const s = shapes[i];
        if (isTie(l)) expect(s.kind, `${f.name} ${i + 1}`).toBe(l.from[0].cell === l.to[0].cell ? 'none' : 'tie');
        else if (s.kind === 'arrow') {
          expect(s.head, `${f.name} ${i + 1}`).toEqual([]);
          expect(s.undirected, `${f.name} ${i + 1}`).toBe(true);
          expect(s.strong).toBe(false);
        } else expect(s.kind, `${f.name} ${i + 1}`).toBe('cell');
      });
    }
    // a weak link with a direction keeps its head
    const layout = boardLayout();
    const [directed] = arrowShapes([{ from: [at(1, 1, 5)], to: [at(1, 5, 5)], strong: false }], layout, []);
    expect(directed.kind === 'arrow' && directed.head.length).toBe(3);
  });

  it('bends a weak tie round a mark on its line, as an arrow (G10), and round another shown candidate of its digit', () => {
    const a = at(1, 1, 5);
    const b = at(1, 9, 5);
    const between = at(1, 5, 5);
    const weak: ChainLink = { from: [a], to: [b], strong: false, undirected: true };
    const bent = (s: ArrowShape) => s.kind === 'arrow' && /[QC]/.test(s.d);
    expect(bent(arrowShapes([weak], boardLayout(), [a, b, between])[0])).toBe(true);
    expect(bent(arrowShapes([weak], boardLayout(), [a, b])[0])).toBe(false);
    // the 5 in r1c5 only shown, not marked: a weak tie keeps off it, a weak arrow crosses it straight
    const shown = (x: CellDigit) => x.digit === 5 && x.cell === between.cell;
    expect(bent(arrowShapes([weak], boardLayout(new Set(), shown), [a, b])[0])).toBe(true);
    expect(bent(arrowShapes([{ ...weak, undirected: undefined }], boardLayout(new Set(), shown), [a, b])[0])).toBe(false);
    // the trap's light witness r8c8-r6c8, over r7c8's uncoloured 4
    const { shapes } = geometryOf(fixture('trap'));
    expect(bent(shapes[6])).toBe(true);
    expect(bent(shapes[5])).toBe(false);
  });

  /** the small board's widths, from the stylesheet: the brackets' stroke and halo, and a ring's stroke at its widest */
  function smallBoard() {
    const css = new TextDecoder().decode(readFileSync('src/ui/styles.css'));
    const px = (re: RegExp) => [...css.matchAll(re)].map((m) => Number(m[1]));
    const strokes = px(/\.board \.chain-bracket \{\s*stroke-width: ([\d.]+)px;/g);
    const halos = px(/\.board \.chain-bracket-halo \{\s*stroke-width: ([\d.]+)px;/g);
    const rings = px(/\.board \.hint-(?:ring|node) \{\s*stroke-width: ([\d.]+)px;/g);
    expect([strokes.length, halos.length]).toEqual([2, 2]);
    expect(rings.length).toBeGreaterThan(0);
    return { stroke: Math.max(...strokes), halo: Math.max(...halos), ring: Math.max(...rings) };
  }
  /** a bracket's arms, tips and corners included, sampled */
  function armsOf(s: Extract<ArrowShape, { kind: 'cell' }>): Point[] {
    const n = s.d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    const out: Point[] = [];
    for (let k = 0; k < n.length; k += 6)
      for (const [p, q] of [
        [0, 2],
        [2, 4]
      ])
        for (let i = 0; i <= 20; i++) out.push({ x: n[k + p] + ((n[k + q] - n[k + p]) * i) / 20, y: n[k + p + 1] + ((n[k + q + 1] - n[k + p + 1]) * i) / 20 });
    return out;
  }
  /**
   * the least room a bracket's halo leaves, at a small board's widths, to
   * the marks at the places given: a disc and its keyline, or a removal's
   * ring at its widest stroke, whichever reaches further
   */
  function bracketRoom(s: Extract<ArrowShape, { kind: 'cell' }>, layout: ReturnType<typeof boardLayout>, places: CellDigit[]): number {
    const { halo, ring } = smallBoard();
    const c = layout.cell;
    const outer = Math.max(MARK.disc + MARK.keyline, MARK.ring + ring / 2 / c) * c;
    let least = Infinity;
    for (const pt of armsOf(s)) for (const x of places) least = Math.min(least, Math.hypot(pt.x - layout.centre(x).x, pt.y - layout.centre(x).y) - outer - halo / 2);
    return least;
  }

  it('draws a weak tie inside one cell as corner brackets, clear of the candidates and the box lines on a small board', () => {
    const layout = boardLayout();
    const [s] = arrowShapes([{ from: [at(5, 5, 1)], to: [at(5, 5, 3)], strong: false, undirected: true }], layout, [at(5, 5, 1), at(5, 5, 3)]);
    expect(s.kind).toBe('cell');
    if (s.kind !== 'cell') return;
    const c = layout.cell;
    const x0 = layout.bounds.x0 + 4 * c;
    const y0 = layout.bounds.y0 + 4 * c;
    expect(s.corners).toEqual([
      { x: x0 + SIZES.bracketInset * c, y: y0 + SIZES.bracketInset * c },
      { x: x0 + c - SIZES.bracketInset * c, y: y0 + SIZES.bracketInset * c },
      { x: x0 + c - SIZES.bracketInset * c, y: y0 + c - SIZES.bracketInset * c },
      { x: x0 + SIZES.bracketInset * c, y: y0 + c - SIZES.bracketInset * c }
    ]);
    const { stroke } = smallBoard();
    const half = Math.max(stroke, SIZES.stroke * c) / 2;
    // every arm, tips included, sampled: 0.5 unit or more off the box lines (6 units wide)
    for (const pt of armsOf(s)) {
      const edge = Math.min(pt.x - x0, x0 + c - pt.x, pt.y - y0, y0 + c - pt.y);
      expect(edge - 3 - half).toBeGreaterThanOrEqual(0.5 - 1e-9);
    }
    // and its halo, at a small board's width, 0.5 unit or more off every place's mark, keyline and all,
    // or a removal's ring at its widest: the candidates sit 21 units from a cell's bottom, 23 from its
    // top, so the bottom corners' arms are shorter than the top ones'
    expect(bracketRoom(s, layout, [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => at(5, 5, d)))).toBeGreaterThanOrEqual(0.5);
    const arm = (k: number) => Math.abs(armsOf(s)[k * 42].y - armsOf(s)[k * 42 + 20].y);
    expect(arm(0)).toBeCloseTo(SIZES.bracketArm * c, 5);
    expect(arm(3)).toBeLessThan(SIZES.bracketArm * c);
    // a tie inside one cell stays nothing
    expect(arrowShapes([{ from: [at(5, 5, 1)], to: [at(5, 5, 3)], strong: true, undirected: true }], layout, [])[0].kind).toBe('none');
  });

  it("keeps 3D Medusa rule 5's brackets in r3c9 clear of its removal ring in the bottom row, on a phone", () => {
    const { shapes, layout } = geometryOf(fixture('medusa5'));
    const brackets = shapes.find((s): s is Extract<ArrowShape, { kind: 'cell' }> => s.kind === 'cell')!;
    expect(brackets.cell).toBe(at(3, 9, 7).cell);
    expect(bracketRoom(brackets, layout, [at(3, 9, 7), at(3, 9, 5)])).toBeGreaterThanOrEqual(0.5);
  });

  it('puts a walk number on each weak tie, and on a clear corner of the brackets', () => {
    for (const f of PARITY_FIXTURES) {
      const { shapes, badges, marks, layout } = geometryOf(f);
      for (const s of shapes) {
        if (s.kind === 'arrow' || s.kind === 'cell') expect(badges.has(s.link), `${f.name} ${s.link + 1}`).toBe(true);
        else expect(badges.has(s.link), `${f.name} ${s.link + 1}`).toBe(false);
        if (s.kind !== 'cell') continue;
        const p = badges.get(s.link)!;
        expect(s.corners, f.name).toContainEqual(p);
        // clear of the marks at the size a wide board draws it
        for (const x of marks) {
          const m = layout.centre(x);
          expect(Math.hypot(p.x - m.x, p.y - m.y) - layout.r - SIZES.badge * layout.cell, `${f.name} ${nameOf(x)}`).toBeGreaterThanOrEqual(0);
        }
      }
    }
    // r7c6 holds the dark 1 and 3 at its top: the number goes to the bottom right
    const { shapes, badges } = geometryOf(fixture('medusa1'));
    const brackets = shapes.find((s) => s.kind === 'cell')!;
    expect(badges.get(brackets.link)).toEqual(brackets.kind === 'cell' && brackets.corners[2]);
  });
});

const { useGame } = await import('../src/state/gameStore');
const { Grid } = await import('../src/ui/Grid');
const { HintPanel } = await import('../src/ui/HintPanel');

/** the app board and its hint panel at a fixture's position, in full or at a frame of the walk */
function render(f: ParityFixture, walk?: number): { board: string; panel: string } {
  const ex = exampleOf(f);
  const cells = Array.from({ length: 81 }, (_, i) => {
    const value = Number(ex.values[i]);
    return { given: f.puzzle[i] >= '1' && f.puzzle[i] <= '9', value, corner: 0, center: 0, excluded: value ? 0 : 0x1ff & ~ex.cands[i], colors: [] };
  });
  useGame.setState({
    cells,
    autoCandidates: true,
    hint: f.step,
    hintStage: walk === undefined ? 'full' : 'walk',
    walkIndex: walk ?? 0,
    paused: false,
    won: false,
    chain: null,
    info: { puzzle: f.puzzle, score: 1000, level: 'hard' } as any
  });
  Object.assign(useGame.getInitialState() as unknown as Record<string, unknown>, useGame.getState());
  return { board: renderToStaticMarkup(React.createElement(Grid)), panel: renderToStaticMarkup(React.createElement(HintPanel, { onLearn: () => {} })) };
}
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

describe('the app board', () => {
  it("draws a trap's full view as its shades, its removal and its two weak ties: no tie, no head, no dot, no number", () => {
    const { board } = render(fixture('trap'));
    expect(count(board, /class="chain-tie"/g)).toBe(0);
    expect(count(board, /class="chain-shaft weak weak-tie"/g)).toBe(2);
    expect(count(board, /<polygon points="[^"]+" fill="var\(--hint-arrow\)"/g)).toBe(0);
    expect(board).not.toContain('chain-start');
    expect(board).not.toContain('walk-badge');
    // the digits are cut out of the lines
    expect(board).toMatch(/class="chain-arrows" mask="url\(#/);
    // three dark and three light purple discs, each keylined wide and small, and one removal
    expect(count(board, /class="hint-shade"[^>]*fill="var\(--hint-purple\)"/g)).toBe(3);
    expect(count(board, /class="hint-shade"[^>]*fill="var\(--hint-purple-light\)"/g)).toBe(3);
    expect(count(board, /class="hint-shade-small"/g)).toBe(6);
    expect(count(board, /class="hint-bar"/g)).toBe(1);
    expect(board).not.toContain('var(--hint-false)');
    expect(board).not.toContain('var(--hint-primary)');
  });

  it('walks it: the ties in the cluster frame only, then each weak tie with its number', () => {
    const one = render(fixture('trap'), 0).board;
    expect(count(one, /class="chain-tie"/g)).toBe(5);
    expect(count(one, /weak-tie/g)).toBe(0);
    expect(one).not.toContain('walk-badge');
    const two = render(fixture('trap'), 1).board;
    expect(count(two, /class="chain-tie"/g)).toBe(0);
    expect(count(two, /class="chain-shaft weak weak-tie"/g)).toBe(1);
    expect(two).toMatch(/class="walk-badge"[\s\S]*?>2<\/text>/);
    const three = render(fixture('trap'), 2).board;
    expect(count(three, /class="chain-shaft weak weak-tie"/g)).toBe(2);
    expect(count(three, /class="walk-badge"/g)).toBe(2);
  });

  it("draws Medusa's corner brackets with their number, and the proof as false rings and true discs, the conclusion as removals", () => {
    const frame2 = render(fixture('medusa1'), 1).board;
    expect(count(frame2, /class="chain-bracket"/g)).toBe(1);
    expect(count(frame2, /class="chain-bracket-halo"/g)).toBe(1);
    expect(frame2).toMatch(/class="walk-badge"[\s\S]*?>2<\/text>/);
    const proof = render(fixture('medusa1'), 2).board;
    expect(count(proof, /stroke="var\(--hint-false\)"/g)).toBe(8);
    expect(count(proof, /<circle[^>]*fill="var\(--hint-place\)"/g)).toBe(7);
    expect(proof).not.toContain('hint-shade');
    const full = render(fixture('medusa1')).board;
    expect(count(full, /class="hint-bar"/g)).toBe(8);
    expect(count(full, /<circle[^>]*fill="var\(--hint-place\)"/g)).toBe(7);
    expect(full).not.toContain('var(--hint-false)');
    expect(count(full, /class="chain-bracket"/g)).toBe(1);
    // a true disc has no outer ring: nothing is placed
    expect(full).not.toContain('hint-place-wide');
  });

  it("draws Multi Colors' proven orange as removals and true discs, never as a shade beside them", () => {
    const { board } = render(fixture('seesBoth'));
    expect(count(board, /<circle[^>]*fill="var\(--hint-place\)"/g)).toBe(1);
    expect(count(board, /class="hint-shade"[^>]*fill="var\(--hint-purple/g)).toBe(5);
    expect(board).not.toContain('var(--hint-orange');
    expect(count(render(fixture('seesBoth'), 1).board, /class="hint-shade"[^>]*fill="var\(--hint-orange/g)).toBe(4);
  });

  it('rims a shade thin on every board, and on a small board draws its keyline wider, as the placement ring is drawn there', () => {
    const { board } = render(fixture('trap'));
    // one disc, the mark's size, its thin rim inwards (tests/shadeRender.test.ts holds what that rim leaves of the light fill)
    const disc = /class="hint-shade" cx="[^"]+" cy="[^"]+" r="([\d.]+)"[^>]*stroke-width="([\d.]+)"/.exec(board)!;
    expect(Number(disc[2])).toBeCloseTo(MARK.shadeEdge * 100, 5);
    expect(Number(disc[1]) + Number(disc[2]) / 2).toBeCloseTo(MARK.disc * 100, 5);
    // the keyline from the disc's edge out, wider on a small board, and no wider than leaves two
    // marks side by side in a cell (28 units apart) meeting keyline to disc
    const keyline = /class="([\w-]+)" cx="[^"]+" cy="[^"]+" r="([\d.]+)" fill="none" stroke="var\(--cell-bg\)" stroke-width="([\d.]+)"/g;
    const keys = Object.fromEntries([...board.matchAll(keyline)].map((m) => [m[1], [Number(m[2]), Number(m[3])]]));
    const [wide, small] = [keys['hint-shade-wide'], keys['hint-shade-small']];
    expect(wide[1]).toBeCloseTo(MARK.keyline * 100, 5);
    expect(small[1]).toBeGreaterThan(wide[1]);
    for (const [r, w] of [wide, small]) expect(r - w / 2).toBeCloseTo(MARK.disc * 100, 5);
    expect(small[0] + small[1] / 2).toBeLessThanOrEqual(28 - MARK.disc * 100 + 1e-9);
    const css = new TextDecoder().decode(readFileSync('src/ui/styles.css'));
    expect(css).toMatch(/\.board \.hint-place-small,\s*\.board \.hint-shade-small \{\s*display: none;/);
    expect(count(css, /\.board \.hint-place-wide,\s*\.board \.hint-shade-wide \{\s*display: none;/g)).toBe(2);
    expect(count(css, /\.board \.hint-place-small,\s*\.board \.hint-shade-small \{\s*display: inline;/g)).toBe(2);
  });

  it("names in the hint panel's legend what the frame draws, in the shades' words", () => {
    const { panel } = render(fixture('trap'));
    expect(panel).toContain('<i class="swatch-shades-0"></i>dark purple, light purple: either every dark purple 4 is true, or every light purple one is');
    expect(panel).toContain('<i class="swatch-weak-tie"></i>dashed line: its two ends see each other, so at most one is true');
    expect(panel).toContain('<i class="swatch-elim"></i>remove');
    expect(render(fixture('trap'), 0).panel).toContain('<i class="swatch-tie"></i>line: exactly one of its two ends is true');
    const both = render(fixture('seesBoth'), 5).panel;
    expect(both).toContain('<i class="swatch-elim"></i>remove: dark orange, proven false');
    expect(both).toContain('<i class="swatch-true"></i>true: light orange, proven (this step only removes)');
    expect(both).not.toContain('swatch-shades-1');
    expect(render(fixture('seesBoth'), 1).panel).toContain('swatch-shades-1');
    expect(render(fixture('wrap'), 2).panel).toContain('<i class="swatch-false"></i>false: dark purple, proven');
    expect(render(fixture('medusa1'), 1).panel).toContain('<i class="swatch-corners"></i>corner brackets: two candidates of one cell, at most one true');
    expect(render(fixture('medusa6')).panel).toContain('<i class="swatch-node"></i>a cell dark purple would empty');
    // no role words, from an older colouring's legend
    expect(panel).not.toMatch(/swatch-(primary|secondary|fin)/);
    const css = new TextDecoder().decode(readFileSync('src/ui/styles.css'));
    for (const swatch of ['shades-0', 'shades-1', 'tie', 'weak-tie', 'corners', 'node']) expect(css, swatch).toContain(`.hint-legend .swatch-${swatch}`);
  });
});

describe('the Learn diagram', () => {
  it("is the full view: shades, removals, the weak ties as dashed lines with no head, no tie and no start dot", () => {
    const svg = boardSvg(exampleOf(fixture('trap')) as any, 'trap');
    // two dashed lines, no head, no faint tie
    expect(count(svg, /<path d="[^"]+" fill="none" stroke="#151a24"[^>]*stroke-dasharray/g)).toBe(2);
    expect(count(svg, /<polygon points="[^"]+" fill="#151a24"/g)).toBe(0);
    expect(svg).not.toMatch(/stroke="#151a24"[^>]*opacity="0.5"/);
    expect(count(svg, new RegExp(`<circle[^>]*r="${(SIZES.dotLarge * 60).toFixed(1)}"`, 'g'))).toBe(0);
    // the shades, rimmed as the app's board rims them
    expect(count(svg, new RegExp(`fill="${LIGHT.purple}" stroke="${LIGHT.purpleInk}" stroke-width="${(MARK.shadeEdge * 60).toFixed(1)}"`, 'g'))).toBe(3);
    expect(count(svg, new RegExp(`fill="${LIGHT.purpleLight}" stroke="${LIGHT.purpleLightInk}"`, 'g'))).toBe(3);
    // brackets for a weak tie inside a cell
    const m1 = boardSvg(exampleOf(fixture('medusa1')) as any, 'medusa1');
    expect(count(m1, /<path d="M [^"]+ L [^"]+ L [^"]+ M [^"]+" fill="none" stroke="#151a24"/g)).toBe(1);
  });
});
