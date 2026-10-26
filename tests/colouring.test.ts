/**
 * The colouring finders say their parity (docs/hint-drawing-colouring.md):
 * Simple Colors and Multi Colors (src/engine/techniques/coloring.ts), 3D
 * Medusa (medusa.ts) and Remote Pair (chains.ts findRemotePair), with the
 * shortest drawn tree, the nearest witnesses and which colour is dark from
 * src/engine/techniques/colourTree.ts.
 *
 * At a fixture of every rule (a puzzle and how many of the solver's steps
 * before it): the step is a parity that checkParity finds nothing wrong
 * with and the solution bears out; dark is the colour the argument tries
 * first; it colours as the hand-built colourings of tests/parityFixtures.ts
 * do, with the same argument; its walk has the frames the design counts,
 * each drawing the links and the marks it should; its words name only the
 * hues the view draws, in English, Norwegian and Spanish; and its line in
 * HoDoKu's notation. Then the tree on its own, and over every position of
 * the practice pools' solve paths: the finders remove exactly what they
 * removed before they said their parity (tests/fixtures/colouringRemovals.json,
 * a hash per puzzle of every removal, taken before the change), every
 * colouring passes checkParity and is one the chain trainer can take as
 * its goal (Build it yourself), a proven colour's partner is a single each
 * once the proven colour is removed, orange never shares a frame with a
 * true disc, and 3D Medusa's ties are no longer than the design measured.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import practice from '../src/content/practicePuzzles.json';
import { parseGrid, isSolved, cloneGrid, bit, UNITS, popcount } from '../src/engine/board';
import type { Grid } from '../src/engine/board';
import { solve } from '../src/engine/bruteForce';
import { findNextStep, applyStep, findStep } from '../src/engine/humanSolver';
import type { Tech } from '../src/engine/ratings';
import type { CellDigit, ChainLink, ColourRule, Step } from '../src/engine/steps';
import { isParity, isTie } from '../src/engine/steps';
import { checkParity } from '../src/engine/truth';
import { walkFrames, drawnLinks, describe as describeStep } from '../src/engine/hintFrames';
import type { Frame } from '../src/engine/hintFrames';
import { frameMarks, parityLegend } from '../src/content/hintMarks';
import { stepText, eurekaOf } from '../src/content/eureka';
import { candidateCentre, spanningTies, tieWeight, nearest, readingOrder, shades, firstParity, drawnDistance } from '../src/engine/techniques/colourTree';
import { findSimpleColors, findMultiColors } from '../src/engine/techniques/coloring';
import { findMedusa3d } from '../src/engine/techniques/medusa';
import { findRemotePair } from '../src/engine/techniques/chains';
import { buildable } from '../src/engine/chainTrainer';
import { boardLayout, M, SIZE } from '../src/ui/boardLayout';
import { setEngineText, missedTemplates } from '../src/engine/text';
import engineNb from '../src/content/locales/engine.nb';
import engineEs from '../src/content/locales/engine.es';
import { PARITY_FIXTURES, nameOf } from './parityFixtures';

interface Fixture {
  name: string;
  tech: Tech;
  rule: ColourRule;
  puzzle: string;
  /** the solver's steps before it */
  at: number;
  /** the frames of its walk */
  frames: number;
}

/** a fixture of every rule (the design's, docs/hint-drawing-colouring.md, Per rule) */
const FIXTURES: Fixture[] = [
  { name: 'trap (stored)', tech: 'SIMPLE_COLORS', rule: 'trap', puzzle: '15.6..3.94.....76.6...1......823.....6.8.9.2.....658......2...5.16.....88.5..6.32', at: 24, frames: 4 },
  { name: 'wrap', tech: 'SIMPLE_COLORS', rule: 'wrap', puzzle: '...8.1.397..........9....15.41........3.2.....8..3.254...25..4......9...6....39.2', at: 28, frames: 4 },
  { name: 'wrap, off the path', tech: 'SIMPLE_COLORS', rule: 'wrap', puzzle: '8..6..37....93.62..3...7.....18...6..7..5..........4....85..9...1.2..5...4......1', at: 25, frames: 4 },
  { name: 'bridge (stored)', tech: 'MULTI_COLORS', rule: 'bridge', puzzle: '.5.8.4.......73.1.......9.89.....4...7.9.2.35..1...27..........7...8...4.8..597..', at: 25, frames: 6 },
  { name: 'sees both, two cells', tech: 'MULTI_COLORS', rule: 'seesBoth', puzzle: '...3......3274.....84....9.......14..5316427..46.......6....38.....7652......2...', at: 28, frames: 6 },
  { name: 'sees both, one cell', tech: 'MULTI_COLORS', rule: 'seesBoth', puzzle: '49....68.3..1.4..7....2.4..7...61...8...3.2...2...........958..95......4........2', at: 22, frames: 6 },
  { name: 'Medusa rule 1', tech: 'MEDUSA_3D', rule: 'medusa1', puzzle: '..3.5.4..5....2..3.74...8.6....1.6..8......357..5.....6..42.....2.9..1.......5...', at: 13, frames: 4 },
  { name: 'Medusa rule 2', tech: 'MEDUSA_3D', rule: 'medusa2', puzzle: '..3.8..........3.1.....7..9.2.5.3...9.8.6.......7...5....1....6...4...7.71...9..2', at: 37, frames: 4 },
  { name: 'Medusa rule 3', tech: 'MEDUSA_3D', rule: 'medusa3', puzzle: '2.3....8.8.6..32.47....26..3....6.........5..67.4...9....2.48....41.7..2....38..1', at: 22, frames: 3 },
  { name: 'Medusa rule 4 (stored)', tech: 'MEDUSA_3D', rule: 'medusa4', puzzle: '.....5...9.3.7...8....3.2.95..32.4..4...5..8...2.1.........75...49..6.7.6........', at: 30, frames: 4 },
  { name: 'Medusa rule 5', tech: 'MEDUSA_3D', rule: 'medusa5', puzzle: '.....2....76...1..2.4...9..6..9......5...1.2.3.18..5....91.....51.....4......4..6', at: 32, frames: 4 },
  // rule 6: the cluster frame, a witness per candidate of the cell (two here), the proof, the conclusion
  { name: 'Medusa rule 6', tech: 'MEDUSA_3D', rule: 'medusa6', puzzle: '.7...4..6.1......2..3.5...7.9....4...6.2.....7.......1..23.7.......89.5.....6...8', at: 27, frames: 5 },
  { name: 'Remote Pair (stored)', tech: 'REMOTE_PAIR', rule: 'remotePair', puzzle: '.2..17..567............2.8.2.496...78.......27...214.8.1.2............633..49..7.', at: 42, frames: 4 },
  { name: 'Remote Pair, branching', tech: 'REMOTE_PAIR', rule: 'remotePair', puzzle: '59..8..2.3...75..4..8.......32..4.7...........4.3..95.......4..8..54...2.7..3..68', at: 35, frames: 4 }
];

const positions = new Map<string, { grid: Grid; solution: Uint8Array }>();
/** the position after `at` of the solver's steps, and the solution */
function positionAt(puzzle: string, at: number): { grid: Grid; solution: Uint8Array } {
  const key = `${puzzle}@${at}`;
  let p = positions.get(key);
  if (!p) {
    const grid = parseGrid(puzzle)!;
    for (let k = 0; k < at; k++) applyStep(grid, findNextStep(grid)!);
    p = { grid, solution: solve(parseGrid(puzzle)!)!.values };
    positions.set(key, p);
  }
  return p;
}
/** the finder's step at a fixture, in the language set */
const stepAt = (f: Fixture): Step => findStep(f.tech, positionAt(f.puzzle, f.at).grid)!;
const solvedAt = (f: Fixture) => (cell: number) => positionAt(f.puzzle, f.at).grid.values[cell] > 0;

const has = (list: readonly CellDigit[], x: CellDigit) => list.some((o) => o.cell === x.cell && o.digit === x.digit);
const coloured = (s: Step) => s.colouring!.clusters.flatMap((cl) => [...cl.dark, ...cl.light]);
const ties = (s: Step) => (s.links ?? []).filter(isTie);
const argument = (s: Step) => (s.links ?? []).filter((l) => !isTie(l));
/** the views of a step: the full view, then every frame of its walk */
const views = (s: Step): (Frame | null)[] => [null, ...walkFrames(s)];
/** every candidate's mark in a view, as "4r1c5": kind */
const kindsIn = (s: Step, frame: Frame | null, solved: (cell: number) => boolean): Record<string, string> =>
  Object.fromEntries([...frameMarks(s, frame, solved).cands].flatMap(([cell, ds]) => [...ds].map(([digit, k]) => [nameOf({ cell, digit }), k])));

describe('the colouring finders, at a fixture of every rule', () => {
  it('say their parity: the rule, its clusters and no roles, nothing checkParity finds wrong, colours the solution bears out', () => {
    for (const f of FIXTURES) {
      const { grid, solution } = positionAt(f.puzzle, f.at);
      const s = stepAt(f);
      expect(s.tech, f.name).toBe(f.tech);
      expect(isParity(s), f.name).toBe(true);
      expect(s.colouring!.rule, f.name).toBe(f.rule);
      expect([s.primary, s.secondary, s.fins, s.labels, s.chainCells], f.name).toEqual([undefined, undefined, undefined, undefined, undefined]);
      expect(s.placements, f.name).toEqual([]);
      expect(checkParity(s, grid.cands), f.name).toEqual([]);
      const truth = (x: CellDigit) => solution[x.cell] === x.digit;
      for (const x of [...coloured(s), ...s.eliminations, ...s.links!.flatMap((l) => [...l.from, ...l.to])]) {
        expect(grid.cands[x.cell] & bit(x.digit), `${f.name} ${nameOf(x)} on the board`).not.toBe(0);
      }
      const { clusters, darkFalse } = s.colouring!;
      // Multi Colors alone has a second cluster
      expect(clusters.length, f.name).toBe(f.tech === 'MULTI_COLORS' ? 2 : 1);
      clusters.forEach((cl, k) => {
        expect(new Set(cl.dark.map(truth)).size, `${f.name} cluster ${k}`).toBe(1);
        expect(new Set(cl.light.map(truth)).size, `${f.name} cluster ${k}`).toBe(1);
        expect(truth(cl.dark[0]), `${f.name} cluster ${k}`).not.toBe(truth(cl.light[0]));
        if (darkFalse === k) expect([truth(cl.dark[0]), truth(cl.light[0])], f.name).toEqual([false, true]);
      });
      // a colour is proven exactly where the design says: the wrap, sees both, Medusa rules 1, 2 and 6
      expect(darkFalse, f.name).toBe(['wrap', 'medusa1', 'medusa2', 'medusa6'].includes(f.rule) ? 0 : f.rule === 'seesBoth' ? 1 : undefined);
      for (const x of s.eliminations) expect(truth(x), `${f.name} removes ${nameOf(x)}`).toBe(false);
      // the removals are the proven colour, and nothing else coloured
      if (darkFalse !== undefined) expect(s.eliminations.map(nameOf).sort(), f.name).toEqual(clusters[darkFalse].dark.map(nameOf).sort());
      else for (const x of s.eliminations) expect(has(coloured(s), x), `${f.name} ${nameOf(x)}`).toBe(false);
    }
  });

  it('give each cluster its ties, the first with its frame\'s sentence, and each link of the argument a weak tie with its own', () => {
    for (const f of FIXTURES) {
      const s = stepAt(f);
      const { clusters } = s.colouring!;
      const links = s.links!;
      // cluster 0's ties, cluster 1's, then the argument
      const stage = (l: ChainLink) => (isTie(l) ? clusters.findIndex((cl) => has([...cl.dark, ...cl.light], l.from[0])) : clusters.length);
      expect(links.map(stage), f.name).toEqual([...links.map(stage)].sort((a, b) => a - b));
      clusters.forEach((cl, k) => {
        const own = links.filter((l) => isTie(l) && stage(l) === k);
        // a tree: one tie fewer than candidates
        expect(own.length, `${f.name} cluster ${k}`).toBe(cl.dark.length + cl.light.length - 1);
        expect(own.map((l) => !!l.text), `${f.name} cluster ${k}`).toEqual(own.map((_, i) => i === 0));
      });
      const args = argument(s);
      expect(args.length, f.name).toBeGreaterThan(0);
      expect(args.length, f.name).toBeLessThanOrEqual(3);
      for (const l of args) {
        expect([l.strong, l.undirected], f.name).toEqual([false, true]);
        expect(l.text, f.name).toBeTruthy();
      }
    }
  });

  it('make dark the colour the argument tries first, so a shade means the same every time', () => {
    for (const f of FIXTURES) {
      const s = stepAt(f);
      const [purple, orange] = s.colouring!.clusters;
      const args = argument(s);
      const dark = (x: CellDigit) => s.colouring!.clusters.some((cl) => has(cl.dark, x));
      const light = (x: CellDigit) => s.colouring!.clusters.some((cl) => has(cl.light, x));
      const first = [...purple.dark, ...purple.light].sort(readingOrder)[0];
      switch (f.rule) {
        case 'wrap':
        case 'medusa2':
          // the clash: two dark candidates of one digit in one house
          expect([...args[0].from, ...args[0].to].every(dark), f.name).toBe(true);
          expect(args[0].from[0].digit, f.name).toBe(args[0].to[0].digit);
          break;
        case 'medusa1':
          // two dark candidates of one cell, the lower digit first
          expect([...args[0].from, ...args[0].to].every(dark), f.name).toBe(true);
          expect(args[0].from[0].cell, f.name).toBe(args[0].to[0].cell);
          expect(args[0].from[0].digit, f.name).toBeLessThan(args[0].to[0].digit);
          break;
        case 'bridge':
          // the bridge joins dark orange to dark purple; then the light purple witness, then the light orange one
          expect([has(orange.dark, args[0].from[0]), has(purple.dark, args[0].to[0])], f.name).toEqual([true, true]);
          expect([has(purple.light, args[1].from[0]), has(orange.light, args[2].from[0])], f.name).toEqual([true, true]);
          expect(args[1].to, f.name).toEqual(args[2].to);
          break;
        case 'seesBoth':
          // both bridges leave dark orange, the first for dark purple, the second for light purple
          expect(args.map((l) => has(orange.dark, l.from[0])), f.name).toEqual([true, true]);
          expect([has(purple.dark, args[0].to[0]), has(purple.light, args[1].to[0])], f.name).toEqual([true, true]);
          break;
        case 'medusa5':
          // the colour seen outside the cell is dark; the cell's own is light, inside it
          expect(dark(args[0].from[0]) && args[0].from[0].cell !== args[0].to[0].cell, f.name).toBe(true);
          expect(light(args[1].from[0]) && args[1].from[0].cell === args[1].to[0].cell, f.name).toBe(true);
          break;
        case 'medusa6':
          // a witness from a dark candidate into each candidate of the cell dark would empty
          expect(args.every((l) => dark(l.from[0])), f.name).toBe(true);
          expect(new Set(args.map((l) => l.to[0].cell)).size, f.name).toBe(1);
          break;
        default:
          // the trap, Medusa rules 3 and 4, Remote Pair: dark is the colour of the first candidate in reading order
          expect(dark(first), f.name).toBe(true);
          // a witness frame takes dark first
          if (f.rule !== 'medusa3') expect([dark(args[0].from[0]), light(args[1].from[0])], f.name).toEqual([true, true]);
      }
    }
  });

  it('colour as the hand-built fixtures do, with the same argument; only the ties may be another tree as short', () => {
    const finders: Partial<Record<Tech, (g: Grid) => Step | null>> = {
      SIMPLE_COLORS: findSimpleColors,
      MULTI_COLORS: findMultiColors,
      MEDUSA_3D: findMedusa3d,
      REMOTE_PAIR: findRemotePair
    };
    for (const hand of PARITY_FIXTURES) {
      const { grid } = positionAt(hand.puzzle, hand.at);
      const s = finders[hand.step.tech]!(grid)!;
      const sorted = (list: CellDigit[]) => list.map(nameOf).sort();
      expect(s.colouring!.rule, hand.name).toBe(hand.step.colouring!.rule);
      expect(s.colouring!.darkFalse, hand.name).toBe(hand.step.colouring!.darkFalse);
      expect(s.colouring!.clusters.map((cl) => [sorted(cl.dark), sorted(cl.light)]), hand.name).toEqual(
        hand.step.colouring!.clusters.map((cl) => [sorted(cl.dark), sorted(cl.light)])
      );
      expect(sorted(s.eliminations), hand.name).toEqual(sorted(hand.step.eliminations));
      const plain = (l: ChainLink) => [l.from.map(nameOf), l.to.map(nameOf), l.text];
      expect(argument(s).map(plain), hand.name).toEqual(argument(hand.step).map(plain));
      expect(ties(s).length, hand.name).toBe(ties(hand.step).length);
      // the walk's own sentences for the clusters
      expect(ties(s).filter((l) => l.text).map((l) => l.text), hand.name).toEqual(ties(hand.step).filter((l) => l.text).map((l) => l.text));
    }
  });

  it('give a Remote Pair each cell one dark and one light candidate, its ties between cells on the lower digit', () => {
    for (const f of FIXTURES.filter((x) => x.rule === 'remotePair')) {
      const s = stepAt(f);
      const [{ dark, light }] = s.colouring!.clusters;
      const cells = [...new Set([...dark, ...light].map((x) => x.cell))];
      const digits = [...new Set([...dark, ...light].map((x) => x.digit))].sort();
      expect(digits.length, f.name).toBe(2);
      for (const cell of cells) {
        expect(dark.filter((x) => x.cell === cell).length, f.name).toBe(1);
        expect(light.filter((x) => x.cell === cell).length, f.name).toBe(1);
      }
      for (const l of ties(s)) {
        if (l.from[0].cell === l.to[0].cell) continue;
        expect([l.from[0].digit, l.to[0].digit], f.name).toEqual([digits[0], digits[0]]);
      }
      // the whole component, as the finder proves it, and the first cell's lower digit dark
      expect(cells.length, f.name).toBe(f.name.includes('branching') ? 14 : 5);
      expect(has(dark, { cell: Math.min(...cells), digit: digits[0] }), f.name).toBe(true);
    }
  });
});

describe('the walk of a colouring the finders give', () => {
  it('has the frames the design counts: a cluster each, a link of the argument each, the proof where a colour is proven, the conclusion', () => {
    for (const f of FIXTURES) {
      const s = stepAt(f);
      const frames = walkFrames(s);
      expect(frames.length, f.name).toBe(f.frames);
      const { clusters, darkFalse } = s.colouring!;
      expect(frames.length, f.name).toBe(clusters.length + argument(s).length + (darkFalse !== undefined ? 1 : 0) + 1);
      expect(frames.filter((fr) => fr.show.has('proof') && !fr.show.has('conclusion')).length, f.name).toBe(darkFalse !== undefined ? 1 : 0);
      expect(frames.at(-1)!.show.has('conclusion'), f.name).toBe(true);
    }
  });

  it('draws each tie in its cluster\'s frame only, each weak tie from its frame on and in the full view, and the conclusion as the full view', () => {
    for (const f of FIXTURES) {
      const s = stepAt(f);
      const frames = walkFrames(s);
      const first = s.links!.map((_, i) => frames.findIndex((fr) => fr.links > i));
      s.links!.forEach((l, i) => {
        expect(first[i], `${f.name} link ${i + 1}`).toBeGreaterThanOrEqual(0);
        frames.forEach((fr, j) => {
          const drawn = drawnLinks(s, fr).has(i);
          expect(drawn, `${f.name} link ${i + 1} in frame ${j + 1}`).toBe(isTie(l) ? j === first[i] : j >= first[i]);
        });
        expect(drawnLinks(s, null).has(i), `${f.name} link ${i + 1} in the full view`).toBe(!isTie(l));
      });
      // a cluster frame draws its own ties and no other
      s.colouring!.clusters.forEach((cl, k) => {
        const own = s.links!.flatMap((l, i) => (isTie(l) && has([...cl.dark, ...cl.light], l.from[0]) ? [i] : []));
        expect([...drawnLinks(s, frames[k])].sort((a, b) => a - b), `${f.name} cluster ${k}`).toEqual(own);
      });
      expect(frameMarks(s, frames.at(-1)!, solvedAt(f)), f.name).toEqual(frameMarks(s, null, solvedAt(f)));
    }
  });
});

describe('the marks of a colouring the finders give', () => {
  it('shade a candidate where its cluster is shown, nothing true or false unless a colour is proven, the proof in its frame, the conclusion as removals beside true discs', () => {
    for (const f of FIXTURES) {
      const s = stepAt(f);
      const { clusters, darkFalse } = s.colouring!;
      for (const frame of views(s)) {
        const where = frame ? `${f.name}, frame "${frame.text.slice(0, 40)}"` : `${f.name}, full view`;
        const show = (p: string) => !frame || frame.show.has(p as never);
        const concluded = show('conclusion');
        const proving = !concluded && show('proof');
        const kinds = kindsIn(s, frame, solvedAt(f));
        clusters.forEach((cl, k) => {
          const proven = darkFalse === k && (concluded || proving);
          const hue = k === 0 ? 'purple' : 'orange';
          for (const [list, dark] of [
            [cl.dark, true],
            [cl.light, false]
          ] as const) {
            for (const x of list) {
              const want = !show(`cluster${k}`) ? undefined : proven ? (dark ? (concluded ? 'elim' : 'false') : 'true') : `${hue}${dark ? 'Dark' : 'Light'}`;
              expect(kinds[nameOf(x)], `${where}: ${nameOf(x)}`).toBe(want);
            }
          }
        });
        const all = Object.values(kinds);
        for (const k of all) expect(['primary', 'secondary', 'fin', 'elimOn', 'placeOn', 'oneTrue', 'place'], where).not.toContain(k);
        if (darkFalse === undefined || !(concluded || proving)) expect(all.filter((k) => k === 'true' || k === 'false'), where).toEqual([]);
        if (!proving) expect(all, where).not.toContain('false');
        // orange is never in shades beside a true disc
        if (all.includes('true')) expect(all.filter((k) => k.startsWith('orange')), where).toEqual([]);
        // a weak tie's end no colour claims: a removal, or the plain ring of the cell rule 6 would empty
        const drawn = drawnLinks(s, frame);
        const ends = s.links!.filter((_, i) => drawn.has(i)).flatMap((l) => [...l.from, ...l.to]).filter((x) => !has(coloured(s), x));
        for (const x of ends) expect(kinds[nameOf(x)], `${where}: ${nameOf(x)}`).toBe(has(s.eliminations, x) ? 'elim' : 'node');
        for (const [name, k] of Object.entries(kinds)) if (k === 'node') expect(f.rule, `${where}: ${name}`).toBe('medusa6');
        if (concluded) for (const x of s.eliminations) expect(kinds[nameOf(x)], `${where}: ${nameOf(x)}`).toBe('elim');
      }
    }
  });
});

/** the words a view of a step shows: the explanation with the full view, a frame's sentence, the legend */
function wordsIn(s: Step, frame: Frame | null, solved: (cell: number) => boolean): string {
  return [frame ? frame.text : s.description, ...parityLegend(s, frameMarks(s, frame, solved)).map((e) => e.label)].join(' | ');
}
/** whether a view draws a cluster: in its shades, or as the colour it proves */
function drawsCluster(s: Step, frame: Frame | null, solved: (cell: number) => boolean, k: number): boolean {
  const kinds = Object.values(kindsIn(s, frame, solved));
  return kinds.some((x) => x.startsWith(k === 0 ? 'purple' : 'orange')) || (s.colouring!.darkFalse === k && kinds.some((x) => x === 'true' || x === 'false'));
}

describe('the words of a colouring the finders give', () => {
  it('name only the hues the view draws, dark and light only with a hue, and none of the old words', () => {
    for (const f of FIXTURES) {
      const s = stepAt(f);
      for (const frame of views(s)) {
        const text = wordsIn(s, frame, solvedAt(f));
        const where = `${f.name}: ${text}`;
        if (/purple/.test(text)) expect(drawsCluster(s, frame, solvedAt(f), 0), where).toBe(true);
        if (/orange/.test(text)) expect(drawsCluster(s, frame, solvedAt(f), 1), where).toBe(true);
        expect(text.replace(/\b(dark|light) (purple|orange)\b/g, ''), where).not.toMatch(/\b(dark|light)\b/);
        expect(text, where).not.toMatch(/\b(blue|gold|red|violet|yellow|circled|placed|colors?|colored|coloring)\b|solid link|dashed link/);
        if (f.rule === 'remotePair') expect(text, where).not.toMatch(/conjugate|chain of|"/);
      }
      // a frame of the walk names what it draws: its line, or its corners
      for (const fr of walkFrames(s)) {
        if (fr.text.includes('(the corner brackets)')) expect(argument(s).some((l) => l.from[0].cell === l.to[0].cell && fr.text === l.text), f.name).toBe(true);
      }
    }
  });

  it('say in the first cluster frame why two joined candidates take opposite shades', () => {
    for (const f of FIXTURES) {
      const first = walkFrames(stepAt(f))[0].text;
      expect(first, f.name).toMatch(
        f.rule === 'remotePair'
          ? /cannot hold the same digit, so their \ds take opposite shades/
          : /exactly one of (them|two joined candidates) is true, so they take opposite shades/i
      );
    }
  });

  it('are in Norwegian and Spanish, every sentence translated, in the hues drawn and never the old colours', () => {
    const before = new Set(missedTemplates());
    const old = {
      nb: /(?<!\p{L})(blå|blått|gul|gult|gule|rød|rødt|fiolett\p{L}*|ringet)(?!\p{L})/u,
      es: /(?<!\p{L})(azul\p{L}*|dorad\p{L}*|roj\p{L}*|violeta|círculo)(?!\p{L})/u
    };
    const hues = { nb: [/lilla/, /oransje/], es: [/morado/, /naranja/] };
    try {
      for (const [lang, table] of [
        ['nb', engineNb],
        ['es', engineEs]
      ] as const) {
        setEngineText(lang, table);
        for (const f of FIXTURES) {
          const s = stepAt(f);
          for (const frame of views(s)) {
            const text = wordsIn(s, frame, solvedAt(f));
            const where = `${lang} ${f.name}: ${text}`;
            expect(text, where).not.toMatch(old[lang]);
            hues[lang].forEach((hue, k) => {
              if (hue.test(text)) expect(drawsCluster(s, frame, solvedAt(f), k), where).toBe(true);
            });
            expect(text, where).not.toMatch(/\b(dark|light|purple|orange|either|true|false)\b/);
          }
        }
      }
      expect(missedTemplates().filter((k) => !before.has(k))).toEqual([]);
    } finally {
      setEngineText('en', null);
    }
  });
});

describe('the words of a colouring the finders give, where they could mislead', () => {
  /** positions whose colouring removes more than its first removal: one more, or several */
  const TAILS: [Tech, string, number][] = [
    ['SIMPLE_COLORS', '3.......5.9......2..49..637..1632...95.1.7.28...8591..635..12..1......9.7.......1', 0],
    ['SIMPLE_COLORS', '....4..6...963..5.68..5......5462.7...2...1...9.7156......2..14.3..785...5..9....', 0],
    ['MULTI_COLORS', '.5.8.4.......73.1.......9.89.....4...7.9.2.35..1...27..........7...8...4.8..597..', 25],
    ['MULTI_COLORS', '.4.7..953.........9.386.1.46..34...8.........7...21..61.8.943.2.........497..3.6.', 24],
    ['MEDUSA_3D', '3.......5.9......2..49..637..1632...95.1.7.28...8591..635..12..1......9.7.......1', 0],
    ['MEDUSA_3D', '1..52.97.5.39.8.1.................53..2.1.6..45.................4.3.62.7.95.72..8', 22],
    ['MEDUSA_3D', '238.6...5.5..4.8......2..9.8.6.34..7.........3..27.5.4.1..5......5.8..4.6...9.351', 21],
    ['REMOTE_PAIR', '.1....6...4.1..89...3.4.....69815..3...4.2...4..69718.....7.9...75..1.4...6....7.', 30],
    ['REMOTE_PAIR', '....89..4.....571.......2.51..8....99871.24533....4..28.2.......794.....6..91....', 24]
  ];
  const LANGS = [
    ['en', null],
    ['nb', engineNb],
    ['es', engineEs]
  ] as const;
  /** each removal after the first: one written as a word, several as a number with a word before the digit */
  const tail = {
    en: /; (one more (\d|candidate) falls|\d+ more (\ds|candidates) fall) /,
    nb: /; (ett \d-tall til|én kandidat til|\d+ andre \d-tall|\d+ kandidater til) faller bort /,
    es: /; (otro (\d|candidato) se elimina|\d+ candidatos (\d )?más se eliminan) /
  };

  it('write the removals after the first with no two numbers side by side, in every language', () => {
    try {
      for (const [lang, table] of LANGS) {
        setEngineText(lang, table);
        const counts = new Set<string>();
        for (const [tech, puzzle, at] of TAILS) {
          const s = findStep(tech, positionAt(puzzle, at).grid)!;
          const more = s.eliminations.length - 1;
          counts.add(`${tech} ${more === 1 ? 'one' : 'several'}`);
          const words = [s.description, ...s.links!.map((l) => l.text ?? '')].join(' ');
          const where = `${lang} ${tech} ${puzzle} @${at}: ${words}`;
          expect(words, where).toMatch(tail[lang]);
          // never "1 6 más", "2 8-tall til": a reader takes them for 16 and 28
          expect(words, where).not.toMatch(/(?<![\p{L}\d])\d+[ -]+\d/u);
        }
        // one more and several more, of each finder
        expect([...counts].sort(), lang).toEqual(['MEDUSA_3D', 'MULTI_COLORS', 'REMOTE_PAIR', 'SIMPLE_COLORS'].flatMap((t) => [`${t} one`, `${t} several`]));
      }
    } finally {
      setEngineText('en', null);
    }
  });

  it("call the corner brackets so, never by the pencil marks' name, in the walk and the legend, in every language", () => {
    const brackets = { en: '(the corner brackets)', nb: '(hjørneklammene)', es: '(los corchetes de las esquinas)' };
    const legend = { en: 'corner brackets: ', nb: 'hjørneklammer: ', es: 'corchetes de las esquinas: ' };
    // the app's names for corner pencil marks, and the legend's old word
    const pencil = { en: /corner marks?|corners:/, nb: /hjørnemerk|hjørnenotat|hjørner:/, es: /marcas de las esquinas|notas de esquina|(^|\| )esquinas:/ };
    try {
      for (const [lang, table] of LANGS) {
        setEngineText(lang, table);
        let named = 0;
        for (const f of FIXTURES) {
          const s = stepAt(f);
          for (const frame of views(s)) {
            const text = wordsIn(s, frame, solvedAt(f));
            const where = `${lang} ${f.name}: ${text}`;
            expect(text, where).not.toMatch(pencil[lang]);
            // a frame that draws corner brackets names them, and its legend too
            const inCell = frame && argument(s).some((l) => l.text === frame.text && l.from.every((x) => x.cell === l.to[0].cell));
            if (inCell) {
              named++;
              expect(frame.text, where).toContain(brackets[lang]);
              expect(text, where).toContain(`| ${legend[lang]}`);
            }
          }
        }
        expect(named, lang).toBe(3); // Medusa rules 1, 3 and 5
      }
    } finally {
      setEngineText('en', null);
    }
  });

  it('name the two colours a Multi Colors bridge rests on where it concludes, so "one of them" is never read as the two candidates just named', () => {
    const bridge = FIXTURES.find((f) => f.rule === 'bridge')!;
    const said = {
      en: 'If light orange is true, the 6 in r2c4 is true, and the 6 in r3c6 goes. Light orange or light purple is true, so it is false either way; one more 6 falls the same way.',
      nb: 'Hvis lyseoransje er sann, er 6-tallet i r2c4 sant, og 6-tallet i r3c6 faller bort. Lyseoransje eller lyselilla er sann, så 6-tallet i r3c6 er usant uansett; ett 6-tall til faller bort på samme måte.',
      es: 'Si el naranja claro es verdadero, el 6 de r2c4 es verdadero y se elimina el 6 de r3c6. El naranja claro o el morado claro es verdadero, así que el 6 de r3c6 es falso en cualquier caso; otro 6 se elimina de la misma forma.'
    };
    try {
      for (const [lang, table] of LANGS) {
        setEngineText(lang, table);
        expect(argument(stepAt(bridge)).at(-1)!.text, lang).toBe(said[lang]);
      }
    } finally {
      setEngineText('en', null);
    }
  });
});

describe('the removals of a colouring the finders give', () => {
  it('are named in reading order, in the walk\'s conclusion and the explanation, though the finder lists them as its cluster grew', () => {
    const wrap = stepAt(FIXTURES.find((f) => f.name === 'wrap')!);
    // the finder's own order, kept so its removals stay what they were
    expect(wrap.eliminations.map(nameOf).join(' ')).toBe('6r1c7 6r4c5 6r3c4 6r2c3 6r7c9 6r5c2 6r8c8 6r7c6 6r6c6 6r4c7');
    const named = 'So 6 is removed from r1c7, r2c3, r3c4, r4c5, r4c7, r5c2, r6c6, r7c6, r7c9, r8c8.';
    expect(walkFrames(wrap).at(-1)!.text.startsWith(named)).toBe(true);
    expect(describeStep(wrap)).toContain(named);
    for (const f of FIXTURES) {
      const s = stepAt(f);
      for (const m of walkFrames(s).at(-1)!.text.matchAll(/removed from ((?:r\dc\d(?:, )?)+)/g)) {
        const cells = m[1].split(', ');
        expect(cells, f.name).toEqual([...cells].sort());
      }
    }
  });
});

describe('the notation', () => {
  /** the Copy step line at a fixture */
  const line = (name: string) => stepText(stepAt(FIXTURES.find((f) => f.name === name)!));

  it("is HoDoKu's: the rule's name, each cluster's dark cells then its light ones, purple first; 3D Medusa's candidates; a Remote Pair's cells by the colour of the lower digit; the removals in reading order", () => {
    expect(line('trap (stored)')).toBe('Simple Colors Trap: 4 (r1c5,r6c4,r8c6) / (r1c6,r5c5,r8c8) => r6c8<>4');
    expect(line('wrap, off the path')).toBe('Simple Colors Wrap: 7 (r4c7,r6c9) / (r4c9,r6c4,r9c7) => r4c7<>7, r6c9<>7');
    expect(line('bridge (stored)')).toBe('Multi Colors 1: 6 (r4c9,r8c7) / (r5c7,r8c6), (r1c3,r2c9,r9c8) / (r1c8,r2c4) => r3c6<>6, r7c4<>6');
    expect(line('sees both, two cells')).toBe(
      'Multi Colors 2: 9 (r5c1,r6c7) / (r5c9,r6c5,r9c7), (r1c5,r2c1,r7c6) / (r2c6) => r1c5<>9, r2c1<>9, r7c6<>9'
    );
    expect(line('Medusa rule 4 (stored)')).toBe('3D Medusa: (1r1c1,1r7c3,8r1c3) / (1r7c1,8r1c1,8r7c3) => r7c2<>1');
    expect(line('Remote Pair (stored)')).toBe('Remote Pair: 3/5 (r2c3,r3c4,r5c5) / (r2c5,r6c4) => r6c3<>3');
  });

  it('writes no Eureka chain for a colouring', () => {
    for (const f of FIXTURES) expect(eurekaOf(stepAt(f)), f.name).toBeNull();
  });
});

describe('the shortest drawn tree', () => {
  const at = (r: number, c: number, d: number): CellDigit => ({ cell: (r - 1) * 9 + c - 1, digit: d });

  it("puts each candidate where the app's board draws it", () => {
    const layout = boardLayout();
    for (let cell = 0; cell < 81; cell++) {
      for (let digit = 1; digit <= 9; digit++) {
        const p = candidateCentre({ cell, digit });
        const q = layout.centre({ cell, digit });
        expect(p.x * SIZE + M).toBeCloseTo(q.x, 9);
        expect(p.y * SIZE + M).toBeCloseTo(q.y, 9);
      }
    }
  });

  it('joins a cell\'s own two candidates first, at no cost, and walks the tree from the first candidate in reading order', () => {
    // 5r1c1 and 7r1c1 in one cell, each tied across: r1c1 7 to r1c9 7, r1c1 5 to r9c1 5
    const nodes = [at(1, 1, 5), at(1, 1, 7), at(1, 9, 7), at(9, 1, 5)];
    const relations: [CellDigit, CellDigit][] = [
      [at(1, 9, 7), at(1, 1, 7)],
      [at(9, 1, 5), at(1, 1, 5)],
      [at(1, 1, 7), at(1, 1, 5)]
    ];
    expect(tieWeight(at(1, 1, 5), at(1, 1, 7), nodes)).toBe(0);
    expect(spanningTies(nodes, relations, nodes).map(([a, b]) => `${nameOf(a)}-${nameOf(b)}`)).toEqual(['5r1c1-7r1c1', '5r1c1-5r9c1', '7r1c1-7r1c9']);
  });

  it('takes a longer line before one over another mark, which costs 3 cells more', () => {
    // a cycle of three 4s: r1c1, r1c5 and r1c9; the line r1c1-r1c9 runs over r1c5's 4
    const a = at(1, 1, 4);
    const b = at(1, 5, 4);
    const c = at(1, 9, 4);
    expect(tieWeight(a, c, [a, b, c])).toBeCloseTo(8 + 3, 9);
    expect(tieWeight(a, c, [a, c])).toBeCloseTo(8, 9);
    // a 4 a cell beside the line is no obstacle; one on it is
    expect(tieWeight(a, c, [at(2, 5, 4)])).toBeCloseTo(8, 9);
    // without the middle mark the tree takes the line straight across, as short as the other
    const relations: [CellDigit, CellDigit][] = [
      [a, c],
      [b, c],
      [a, b]
    ];
    expect(spanningTies([a, b, c], relations, [a, b, c]).map(([x, y]) => `${nameOf(x)}-${nameOf(y)}`)).toEqual(['4r1c1-4r1c5', '4r1c5-4r1c9']);
    // two ties the same length: the first in reading order
    const d = at(5, 1, 4);
    const e = at(5, 5, 4);
    const square: [CellDigit, CellDigit][] = [
      [a, b],
      [b, e],
      [e, d],
      [d, a]
    ];
    expect(spanningTies([a, b, d, e], square, []).map(([x, y]) => `${nameOf(x)}-${nameOf(y)}`)).toEqual(['4r1c1-4r1c5', '4r1c1-4r5c1', '4r1c5-4r5c5']);
  });

  it('finds the nearest witness, the first in reading order of two as near, and makes dark the parity it is told', () => {
    const target = at(5, 5, 3);
    expect(nameOf(nearest(target, [at(5, 9, 3), at(5, 1, 3), at(1, 5, 3)]))).toBe('3r1c5');
    expect(drawnDistance(target, at(5, 1, 3))).toBe(drawnDistance(target, at(5, 9, 3)));
    expect(nameOf(nearest(target, [at(5, 9, 3), at(5, 1, 3)]))).toBe('3r5c1');
    const parity = (x: CellDigit) => x.cell % 2;
    const list = [at(1, 2, 1), at(1, 1, 1), at(1, 3, 1)];
    expect(firstParity(list, parity)).toBe(0);
    expect(shades(list, parity, 0)).toEqual({ dark: [at(1, 1, 1), at(1, 3, 1)], light: [at(1, 2, 1)] });
    expect(shades(list, parity, 1)).toEqual({ dark: [at(1, 2, 1)], light: [at(1, 1, 1), at(1, 3, 1)] });
  });
});

describe("over the practice pools' solve paths", () => {
  const FINDERS: [Tech, (g: Grid) => Step | null][] = [
    ['SIMPLE_COLORS', findSimpleColors],
    ['MULTI_COLORS', findMultiColors],
    ['MEDUSA_3D', findMedusa3d],
    ['REMOTE_PAIR', findRemotePair]
  ];
  const puzzles = [...new Set(Object.values(practice as Record<string, { puzzle: string }[]>).flat().map((p) => p.puzzle))];
  const removalsBefore: Record<string, string> = JSON.parse(new TextDecoder().decode(readFileSync('tests/fixtures/colouringRemovals.json')));
  /** FNV-1a, 32 bits, as hex: tests/fixtures/colouringRemovals.json's hash */
  function fnv(s: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }
  const found = { hits: 0, proven: 0, multi: 0, medusaSteps: 0 };
  const removals: Record<string, string> = {};
  const problems: string[] = [];
  const wrong: string[] = [];
  const notSingle: string[] = [];
  const orangeBesideTrue: string[] = [];
  const oldWords: string[] = [];
  const unbuildable: string[] = [];
  const medusa = { lines: 0, length: 0, overAMark: 0 };

  beforeAll(() => {
    for (const puzzle of puzzles) {
      const g = parseGrid(puzzle)!;
      const solution = solve(parseGrid(puzzle)!)!.values;
      const lines: string[] = [];
      for (let k = 0; k < 400 && !isSolved(g); k++) {
        for (const [tech, find] of FINDERS) {
          const s = find(g);
          if (!s) continue;
          found.hits++;
          const where = `${puzzle} @${k} ${tech}`;
          lines.push(`${k}:${tech} ${s.eliminations.map(nameOf).join(' ')}`);
          for (const p of checkParity(s, g.cands)) problems.push(`${where}: ${p.issue} ${p.at}`);
          if (!buildable(s)) unbuildable.push(where);
          const { clusters, darkFalse } = s.colouring!;
          for (const cl of clusters) {
            const dark = new Set(cl.dark.map((x) => solution[x.cell] === x.digit));
            const light = new Set(cl.light.map((x) => solution[x.cell] === x.digit));
            if (dark.size !== 1 || light.size !== 1 || [...dark][0] === [...light][0]) wrong.push(where);
          }
          for (const x of s.eliminations) if (solution[x.cell] === x.digit) wrong.push(`${where} removes ${nameOf(x)}`);
          const words = [s.description, ...s.links!.map((l) => l.text ?? '')].join(' ');
          if (/\b(blue|gold|red|violet|circled|placed|colors)\b|solid link|dashed link|conjugate|chain of/.test(words)) oldWords.push(`${where}: ${words}`);
          if (darkFalse !== undefined) {
            // once the proven colour is removed, each of its partner's candidates is a single
            found.proven++;
            const after = cloneGrid(g);
            for (const x of clusters[darkFalse].dark) after.cands[x.cell] &= ~bit(x.digit);
            for (const x of clusters[darkFalse].light) {
              const naked = popcount(after.cands[x.cell]) === 1;
              const hidden = UNITS.some((u) => u.includes(x.cell) && u.every((c) => c === x.cell || after.values[c] !== 0 || !(after.cands[c] & bit(x.digit))));
              if (!naked && !hidden) notSingle.push(`${where}: ${nameOf(x)}`);
            }
          }
          if (tech === 'MULTI_COLORS') {
            found.multi++;
            for (const frame of [null, ...walkFrames(s)]) {
              const kinds = [...frameMarks(s, frame, (c) => g.values[c] > 0).cands.values()].flatMap((m) => [...m.values()]);
              if (kinds.includes('true') && kinds.some((x) => x.startsWith('orange'))) orangeBesideTrue.push(`${where}: ${frame?.text ?? 'full view'}`);
            }
          }
        }
        const step = findNextStep(g);
        if (!step) break;
        if (step.tech === 'MEDUSA_3D') {
          // the ties the solver's Medusa draws: their lines, how long, how many over another mark
          found.medusaSteps++;
          const marks = [...coloured(step), ...step.eliminations];
          for (const l of ties(step)) {
            const [a, b] = [l.from[0], l.to[0]];
            if (a.cell === b.cell) continue;
            medusa.lines++;
            medusa.length += drawnDistance(a, b);
            if (tieWeight(a, b, marks) > drawnDistance(a, b) + 1e-6) medusa.overAMark++;
          }
        }
        applyStep(g, step);
      }
      lines.sort();
      removals[puzzle] = `${lines.length}:${fnv(lines.join('\n'))}`;
    }
  }, 600_000);

  it('remove exactly what the finders removed before they said their parity', () => {
    expect(found.hits).toBe(28317);
    const changed = puzzles.filter((p) => removals[p] !== removalsBefore[p]);
    expect(changed).toEqual([]);
  });

  it('pass checkParity against the board, colours and removals the solution bears out, and no old words', () => {
    expect(problems.slice(0, 10)).toEqual([]);
    expect(wrong.slice(0, 10)).toEqual([]);
    expect(oldWords.slice(0, 5)).toEqual([]);
  });

  it('can each be built in the chain trainer, as on main: practice offers Build it yourself, whatever the argument\'s weak ties join', () => {
    expect(unbuildable.slice(0, 10)).toEqual([]);
  });

  it('leave every candidate of a proven colour\'s partner a single, once the proven colour is removed', () => {
    expect(found.proven).toBeGreaterThan(5000);
    expect(notSingle.slice(0, 10)).toEqual([]);
  });

  it('never draw orange in shades in a view that draws a true disc', () => {
    expect(found.multi).toBeGreaterThan(2000);
    expect(orangeBesideTrue.slice(0, 10)).toEqual([]);
  });

  it("draw 3D Medusa's ties along the shortest tree: at most 1,260 lines, 3,100 cells of them, 180 over another mark", () => {
    expect(found.medusaSteps).toBe(70);
    expect(medusa.lines).toBeLessThanOrEqual(1260);
    expect(medusa.length).toBeLessThanOrEqual(3100);
    expect(medusa.overAMark).toBeLessThanOrEqual(180);
  });
});
