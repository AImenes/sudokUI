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
 * hues the view draws, in English, Norwegian and Spanish, and every
 * removal named in the explanation the full view shows; its line in
 * HoDoKu's notation; and its drawing on the app board, with the stored
 * examples': each tie clear of the other marks of its frame, each weak tie
 * clear of the other candidates of its digit, of the box lines and of the
 * other weak ties' ends, all laid out without the ties, and the walk's
 * numbers apart. Then the tree on its own, and over every position of
 * the practice pools' solve paths: the finders remove exactly what they
 * removed before they said their parity (tests/fixtures/colouringRemovals.json,
 * a hash per puzzle of every removal, taken before the change), every
 * colouring passes checkParity and is one the chain trainer can take as
 * its goal (Build it yourself) and names every removal in its
 * explanation (the solver's own in Norwegian and Spanish too), a proven
 * colour's partner is a single each
 * once the proven colour is removed, orange never shares a frame with a
 * true disc, 3D Medusa's ties are no longer than the design measured, and
 * no tie of 3D Medusa or Remote Pair is drawn over another mark.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import practice from '../src/content/practicePuzzles.json';
import { parseGrid, isSolved, cloneGrid, bit, UNITS, popcount, cellName } from '../src/engine/board';
import type { Grid } from '../src/engine/board';
import { solve } from '../src/engine/bruteForce';
import { findNextStep, applyStep, findStep } from '../src/engine/humanSolver';
import type { Tech } from '../src/engine/ratings';
import type { CellDigit, ChainLink, ColourRule, Step } from '../src/engine/steps';
import { isParity, isTie } from '../src/engine/steps';
import { checkParity } from '../src/engine/truth';
import { walkFrames, drawnLinks, describe as describeStep, conclusionText } from '../src/engine/hintFrames';
import type { Frame } from '../src/engine/hintFrames';
import { frameMarks, parityLegend, markedCandidates, placedKeys } from '../src/content/hintMarks';
import { arrowShapes, startMarkers, badgePoints, SIZES } from '../src/content/hintGeometry';
import type { ArrowShape, Point } from '../src/content/hintGeometry';
import { MARK } from '../src/content/hintPalette';
import { EXAMPLES } from '../src/content/examples';
import { exampleStep } from '../src/content/learnLocale';
import { stepText, eurekaOf } from '../src/content/eureka';
import { candidateCentre, spanningTies, tieWeight, nearest, readingOrder, shades, firstParity, drawnDistance } from '../src/engine/techniques/colourTree';
import { findSimpleColors, findMultiColors } from '../src/engine/techniques/coloring';
import { findMedusa3d } from '../src/engine/techniques/medusa';
import { findRemotePair } from '../src/engine/techniques/chains';
import { buildable } from '../src/engine/chainTrainer';
import { boardLayout, digitShown, M, SIZE } from '../src/ui/boardLayout';
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

/** the engine's languages, and their tables */
const LANGS = [
  ['en', null],
  ['nb', engineNb],
  ['es', engineEs]
] as const;

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
/**
 * The removals the full view's explanation (describe()) leaves unnamed, in
 * the language set: a colouring that removes more than one candidate must
 * end in the conclusion, which names them all; one that removes one must
 * name it, its digit in a sentence that names its cell
 */
function unnamedIn(s: Step): string[] {
  const text = describeStep(s);
  if (s.eliminations.length > 1) return text.endsWith(` ${conclusionText(s)}`) ? [] : s.eliminations.map(nameOf);
  const sentences = text.split(/(?<=\.) /);
  const names = (x: CellDigit) => sentences.some((t) => t.includes(cellName(x.cell)) && new RegExp(`(?<![\\w.])${x.digit}(?!\\d)`).test(t));
  return s.eliminations.filter((x) => !names(x)).map(nameOf);
}
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

/**
 * The app board's drawing of a step, worked out as src/ui/Grid.tsx works it
 * out, with the candidates on: from the full view's marks and every link
 */
function drawingOf(s: Step, values: ArrayLike<number>, cands: ArrayLike<number>) {
  const solved = (cell: number) => values[cell] > 0;
  const full = frameMarks(s, null, solved);
  const marks = markedCandidates(full);
  const shown = (x: CellDigit) => digitShown({ value: values[x.cell], corner: 0, center: 0 }, x.digit, cands[x.cell], full.cands.get(x.cell));
  const layout = boardLayout(placedKeys(full), shown, solved);
  const shapes = arrowShapes(s.links!, layout, marks);
  const badges = badgePoints(shapes, layout, marks, startMarkers(s.links!, layout, marks, shapes));
  return { layout, marks, shapes, badges, shown, solved };
}
const drawingAt = (f: Fixture) => drawingOf(stepAt(f), positionAt(f.puzzle, f.at).grid.values, positionAt(f.puzzle, f.at).grid.cands);
/** every stored colouring example: its step, and its drawing */
const storedColourings = () =>
  Object.values(EXAMPLES)
    .filter((ex) => isParity(ex!.step))
    .map((ex) => {
      const values = Array.from(ex!.values, Number);
      return { name: `${ex!.step.tech} (stored)`, step: ex!.step, values, cands: ex!.cands, drawing: drawingOf(ex!.step, values, ex!.cands) };
    });
/** every rule fixture and stored example: its step, its position and its drawing */
const everyColouring = () => [
  ...FIXTURES.map((f) => {
    const { values, cands } = positionAt(f.puzzle, f.at).grid;
    return { name: f.name, step: stepAt(f), values: Array.from(values), cands: Array.from(cands), drawing: drawingAt(f) };
  }),
  ...storedColourings()
];

/** points along a drawn line, read back from its path: straight, one arc or two bends */
function pathPoints(d: string): Point[] {
  const n = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
  return Array.from({ length: 81 }, (_, k) => {
    const t = k / 80;
    const u = 1 - t;
    if (d.includes(' C ')) {
      const [x0, y0, ax, ay, bx, by, x1, y1] = n;
      return { x: u ** 3 * x0 + 3 * u * u * t * ax + 3 * u * t * t * bx + t ** 3 * x1, y: u ** 3 * y0 + 3 * u * u * t * ay + 3 * u * t * t * by + t ** 3 * y1 };
    }
    if (d.includes(' Q ')) {
      const [x0, y0, cx, cy, x1, y1] = n;
      return { x: u * u * x0 + 2 * u * t * cx + t * t * x1, y: u * u * y0 + 2 * u * t * cy + t * t * y1 };
    }
    const [x0, y0, x1, y1] = n;
    return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t };
  });
}
/** the distance from a point to the segment a-b */
function toSegment(p: Point, a: Point, b: Point): number {
  const [abx, aby] = [b.x - a.x, b.y - a.y];
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby || 1)));
  return Math.hypot(p.x - a.x - abx * t, p.y - a.y - aby * t);
}
/** the distance from a point to a line through the points given */
const toLine = (p: Point, line: Point[]) => Math.min(...line.slice(1).map((q, k) => toSegment(p, line[k], q)));
/** whether two lines cross: some segment of one crosses some segment of the other */
function cross(p: Point[], q: Point[]): boolean {
  const side = (a: Point, b: Point, c: Point) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  for (let i = 1; i < p.length; i++)
    for (let j = 1; j < q.length; j++)
      if (side(p[i - 1], p[i], q[j - 1]) * side(p[i - 1], p[i], q[j]) < 0 && side(q[j - 1], q[j], p[i - 1]) * side(q[j - 1], q[j], p[i]) < 0) return true;
  return false;
}
const lineOf = (s: ArrowShape) => (s.kind === 'arrow' || s.kind === 'tie' ? pathPoints(s.d) : []);
const named = (l: ChainLink) => `${l.from.map(nameOf).join('+')}-${l.to.map(nameOf).join('+')}`;
/** a cell's line: a box line every third */
const LINES = Array.from({ length: 10 }, (_, k) => ({ at: M + k * SIZE, box: k % 3 === 0 }));
/** how far a line runs along a box line: within 0.08 of a cell of it, and within 15 degrees of its direction */
function alongBoxLines(line: Point[]): number {
  let run = 0;
  for (let k = 1; k < line.length; k++) {
    const [a, b] = [line[k - 1], line[k]];
    const [dx, dy] = [Math.abs(b.x - a.x), Math.abs(b.y - a.y)];
    const [mx, my] = [(a.x + b.x) / 2, (a.y + b.y) / 2];
    const along = (at: number, steep: boolean) => steep && LINES.some((g) => g.box && Math.abs(at - g.at) < 0.08 * SIZE);
    if (along(mx, dx < dy * Math.tan(Math.PI / 12)) || along(my, dy < dx * Math.tan(Math.PI / 12))) run += Math.hypot(dx, dy);
  }
  return run;
}

describe('the drawing of a colouring the finders give', () => {
  it('draws each tie clear of every other mark its frame draws: straight, or bent round one on its line', () => {
    let bent = 0;
    for (const { name, step: s, values, drawing } of everyColouring()) {
      const solved = (cell: number) => values[cell] > 0;
      walkFrames(s).forEach((fr, k) => {
        const marks = markedCandidates(frameMarks(s, fr, solved));
        for (const i of drawnLinks(s, fr)) {
          const l = s.links![i];
          const sh = drawing.shapes[i];
          if (!isTie(l) || sh.kind !== 'tie') continue;
          const line = lineOf(sh);
          // the straight line between its ends, which a mark on it would seem to join
          const straight = [line[0], line[line.length - 1]];
          const near = (line: Point[]) => marks.filter((m) => !has([...l.from, ...l.to], m) && toLine(drawing.layout.centre(m), line) < (MARK.disc + SIZES.gap) * SIZE);
          expect(near(line).map(nameOf), `${name}, frame ${k + 1}, tie ${named(l)}`).toEqual([]);
          if (/ [QC] /.test(sh.d)) {
            bent++;
            expect(near(straight).length, `${name}, frame ${k + 1}, tie ${named(l)} bent`).toBeGreaterThan(0);
          }
        }
      });
    }
    expect(bent).toBeGreaterThan(10);
    // the stored Remote Pair: 3r5c5-3r6c4 goes round the 5 of r5c5, which its straight line runs through
    const rp = drawingAt(FIXTURES.find((f) => f.name === 'Remote Pair (stored)')!);
    const s = stepAt(FIXTURES.find((f) => f.name === 'Remote Pair (stored)')!);
    const i = s.links!.findIndex((l) => named(l) === '3r5c5-3r6c4');
    expect(rp.shapes[i].kind === 'tie' && rp.shapes[i].d).toMatch(/ Q /);
    expect(toLine(rp.layout.centre({ cell: 40, digit: 5 }), lineOf(rp.shapes[i]))).toBeGreaterThanOrEqual((MARK.disc + SIZES.gap) * SIZE);
  });

  it('draws each weak tie clear of every candidate of its digit the board shows and the hint does not mark, along its whole bend', () => {
    // 3D Medusa rule 2's clash 2r5c3-2r5c9 bent into row 6, through r6c6's 2
    const g = positionAt('3...7.2......6..741...2.85...9..7......4......38...51.2....1.4.........3.569...2.', 27).grid;
    const clash = findStep('MEDUSA_3D', g)!;
    expect(clash.colouring!.rule).toBe('medusa2');
    const all = [...everyColouring(), { name: 'Medusa rule 2, off the path', step: clash, drawing: drawingOf(clash, g.values, g.cands) }];
    let checked = 0;
    for (const { name, step: s, drawing } of all) {
      drawing.shapes.forEach((sh, i) => {
        const l = s.links![i];
        if (sh.kind !== 'arrow' || !sh.undirected) return;
        const digits = new Set([...l.from, ...l.to].map((x) => x.digit));
        if (digits.size !== 1) return;
        const digit = [...digits][0];
        const line = lineOf(sh);
        for (let cell = 0; cell < 81; cell++) {
          const x = { cell, digit };
          if (!drawing.shown(x) || has(drawing.marks, x) || has([...l.from, ...l.to], x)) continue;
          checked++;
          expect(toLine(drawing.layout.centre(x), line), `${name}: ${named(l)} and ${nameOf(x)}`).toBeGreaterThanOrEqual(drawing.layout.r + SIZES.gap * SIZE);
        }
      });
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('lays out the weak ties and their walk numbers as if the ties were not there: they are never drawn together', () => {
    // 3D Medusa rule 6: 7r8c8-7r1c8 runs straight up column 8, across two ties of the cluster's frame
    const g = positionAt('.13.5......6...8.......34...2..6...5...2.1....39....6.68..7..2.1..8....4......9..', 33).grid;
    const six = findNextStep(g)!;
    expect([six.tech, six.colouring!.rule]).toEqual(['MEDUSA_3D', 'medusa6']);
    const at = drawingOf(six, g.values, g.cands);
    const i = six.links!.findIndex((l) => named(l) === '7r8c8-7r1c8');
    expect(at.shapes[i].kind === 'arrow' && at.shapes[i].d).toMatch(/^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/);
    for (const { name, step: s, values, cands, drawing } of [...everyColouring(), { name: 'Medusa rule 6, @33', step: six, values: Array.from(g.values), cands: Array.from(g.cands), drawing: at }]) {
      const without = drawingOf({ ...s, links: argument(s) }, values, cands);
      const kept = s.links!.flatMap((l, k) => (isTie(l) ? [] : [k]));
      expect(kept.map((k) => drawing.shapes[k]).map((x) => ('d' in x ? x.d : x.kind)), name).toEqual(without.shapes.map((x) => ('d' in x ? x.d : x.kind)));
      expect(kept.map((k) => drawing.badges.get(k)), name).toEqual(without.shapes.map((_, k) => without.badges.get(k)));
    }
  });

  it("keeps a weak tie's bend off the box lines: the stored Remote Pair's line down column 3 bends into its column", () => {
    for (const { name, step: s, drawing } of everyColouring()) {
      drawing.shapes.forEach((sh, i) => {
        if (sh.kind === 'arrow') expect(alongBoxLines(lineOf(sh)), `${name}: ${named(s.links![i])}`).toBeLessThanOrEqual(0.1 * SIZE);
      });
    }
    const f = FIXTURES.find((x) => x.name === 'Remote Pair (stored)')!;
    const s = stepAt(f);
    const i = s.links!.findIndex((l) => named(l) === '3r2c3-3r6c3');
    const line = lineOf(drawingAt(f).shapes[i]);
    // the box line between columns 3 and 4, and the cell line between 2 and 3
    for (const p of line) expect(Math.min(Math.abs(p.x - (M + 3 * SIZE)), Math.abs(p.x - (M + 2 * SIZE)))).toBeGreaterThan(SIZES.gridLine * SIZE);
  });

  it("brings two weak ties into one cell from apart: Medusa rule 6's into the 7 and the 8 of r4c4 never cross, nor come near the other's end", () => {
    const f = FIXTURES.find((x) => x.name === 'Medusa rule 6')!;
    const s = stepAt(f);
    const { shapes, layout } = drawingAt(f);
    const into = argument(s).map((l) => s.links!.indexOf(l));
    expect(into.map((i) => nameOf(s.links![i].to[0]))).toEqual(['7r4c4', '8r4c4']);
    const [p, q] = into.map((i) => lineOf(shapes[i]));
    expect(cross(p, q)).toBe(false);
    // each a mark's radius and a gap off where the other ends
    expect(toLine(q[q.length - 1], p)).toBeGreaterThanOrEqual(layout.r + SIZES.gap * SIZE);
    expect(toLine(p[p.length - 1], q)).toBeGreaterThanOrEqual(layout.r + SIZES.gap * SIZE);
  });

  it('keeps clear of the end of another weak tie: a Multi Colors bridge goes round the end of its witness into r7c9', () => {
    const g = positionAt('..2.....4...3.7291...8.43.....9..48..45...76..87..2.....64.1...4917.3...3.....1..', 14).grid;
    const s = findStep('MULTI_COLORS', g)!;
    const { shapes } = drawingOf(s, g.values, g.cands);
    const [down, witness] = ['2r4c9-2r8c9', '2r8c8-2r7c9'].map((n) => s.links!.findIndex((l) => named(l) === n));
    expect(down).toBeGreaterThanOrEqual(0);
    expect(witness).toBeGreaterThanOrEqual(0);
    // round the 2s of r5c9 and r7c9 on its line, on the side away from the witness's end
    const [p, q] = [lineOf(shapes[down]), lineOf(shapes[witness])];
    expect(cross(p, q)).toBe(false);
    expect(toLine(q[q.length - 1], p)).toBeGreaterThanOrEqual(((SIZES.headWidth / 2 + SIZES.clearance) * SIZE) - 0.5);
  });

  it('keeps the walk numbers of a colouring a badge and a gap apart, and a gap off the marks: sees both in one cell, numbers 3 and 4 on the box line; Medusa rule 6, number 3 off the 1 of r5c5', () => {
    for (const { name, drawing } of everyColouring()) {
      const at = [...drawing.badges.values()];
      for (let i = 0; i < at.length; i++)
        for (let j = i + 1; j < at.length; j++)
          expect(Math.hypot(at[i].x - at[j].x, at[i].y - at[j].y), name).toBeGreaterThanOrEqual((2 * SIZES.badgeLarge + SIZES.badgeGap) * SIZE - 1e-9);
      for (const p of at) expect(offTheMarks(p, drawing), `${name}: a number at ${p.x.toFixed(1)},${p.y.toFixed(1)}`).toBeGreaterThanOrEqual(-1e-9);
    }
    // rule 6: the number of 8r5c6-8r4c4 sat against the 1 of r5c5, 0.4 units apart on a phone
    const six = FIXTURES.find((x) => x.name === 'Medusa rule 6')!;
    const sixStep = stepAt(six);
    const sixDrawing = drawingAt(six);
    const third = sixDrawing.badges.get(sixStep.links!.findIndex((l) => named(l) === '8r5c6-8r4c4'))!;
    const one = sixDrawing.layout.centre({ cell: 40, digit: 1 });
    expect(Math.hypot(third.x - one.x, third.y - one.y)).toBeGreaterThanOrEqual((SIZES.r + MARK.keylineSmall + SIZES.badgeLarge + SIZES.badgeGap) * SIZE);
    const f = FIXTURES.find((x) => x.name === 'sees both, one cell')!;
    const s = stepAt(f);
    const { badges } = drawingOf(s, positionAt(f.puzzle, f.at).grid.values, positionAt(f.puzzle, f.at).grid.cands);
    const [three, four] = argument(s).map((l) => badges.get(s.links!.indexOf(l))!);
    expect(Math.hypot(three.x - four.x, three.y - four.y)).toBeGreaterThanOrEqual((2 * SIZES.badgeLarge + SIZES.badgeGap) * SIZE);
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

  it('are in Norwegian and Spanish, every sentence translated, in the hues drawn and never the old colours, a colour named as a noun neuter in Norwegian and masculine in Spanish', () => {
    const before = new Set(missedTemplates());
    // "Hvis mørkelilla er sant", as main's "Hvis blått er sant": never the common
    // gender of a noun left out ("sann"), where the colour itself is true or false,
    // or what a legend's label calls so; "el morado oscuro es verdadero"
    const agreement = {
      nb: /(?<!\p{L})(?:mørke|lyse)(?:lilla|oransje)(?: eller (?:mørke|lyse)(?:lilla|oransje))?(?: (?:er|var|være|kan ikke være))? u?sann(?!\p{L})|bevist u?sann(?!\p{L})|(?:^|\| )u?sann: /iu,
      es: /(?<!\p{L})(?:la|una) (?:morad|naranja)|(?:morado|naranja) (?:oscuro|claro),? (?:(?:es|sea|fuera|sería|demostrado) )?(?:verdadera|falsa)(?!\p{L})/iu
    };
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
            expect(text, where).not.toMatch(agreement[lang]);
          }
        }
        // and every sentence that names a shade, whether a fixture shows it or not
        for (const [key, said] of Object.entries(table)) if (/\b(dark|light) (purple|orange)\b/.test(key)) expect(said, `${lang}: ${key}`).not.toMatch(agreement[lang]);
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

  it('say what the corner brackets hold, rule by rule, in every language: in rule 3 a cell holding both shades, whose other candidates go; in rules 1 and 5 two candidates, at most one true', () => {
    const said = {
      en: {
        cell: 'corner brackets: a cell holding both shades; one is true, so its other candidates go',
        two: 'corner brackets: two candidates of one cell, at most one true'
      },
      nb: {
        cell: 'hjørneklammer: en rute med begge nyansene; én av dem er sann, så de andre kandidatene i ruten faller bort',
        two: 'hjørneklammer: to kandidater i samme rute, høyst én av dem sann'
      },
      es: {
        cell: 'corchetes de las esquinas: una casilla con los dos tonos; uno es verdadero, así que se eliminan sus demás candidatos',
        two: 'corchetes de las esquinas: dos candidatos de una misma casilla, como mucho uno verdadero'
      }
    };
    try {
      for (const [lang, table] of LANGS) {
        setEngineText(lang, table);
        const shown = new Set<string>();
        for (const f of FIXTURES) {
          const s = stepAt(f);
          for (const frame of views(s)) {
            const corners = parityLegend(s, frameMarks(s, frame, solvedAt(f))).filter((e) => e.kind === 'corners');
            for (const e of corners) {
              expect(e.label, `${lang} ${f.name}: ${frame?.text ?? 'full view'}`).toBe(f.rule === 'medusa3' ? said[lang].cell : said[lang].two);
              shown.add(f.rule);
            }
          }
        }
        expect([...shown].sort(), lang).toEqual(['medusa1', 'medusa3', 'medusa5']);
      }
    } finally {
      setEngineText('en', null);
    }
  });

  it("say that the removals after a 3D Medusa's first fall the same way, as a trap's and a Remote Pair's do, so rule 5 says whichever shade once", () => {
    const sameWay = {
      en: /; (one more candidate falls|\d+ more candidates fall) the same way\.$/,
      nb: /; (én kandidat til faller|\d+ kandidater til faller) bort på samme måte\.$/,
      es: /; (otro candidato se elimina|\d+ candidatos más se eliminan) de la misma forma\.$/
    };
    // the words for "whichever shade is true", which rule 5's own sentence says
    const whichever = { en: /whichever|two shades/g, nb: /uansett/g, es: /sea cual sea/g };
    try {
      for (const [lang, table] of LANGS) {
        setEngineText(lang, table);
        const rules = new Set<string>();
        for (const [tech, puzzle, at] of TAILS.filter(([t]) => t === 'MEDUSA_3D')) {
          const s = findStep(tech, positionAt(puzzle, at).grid)!;
          rules.add(s.colouring!.rule);
          const last = argument(s).at(-1)!.text!;
          const where = `${lang} ${puzzle} @${at}: ${s.description} | ${last}`;
          expect(s.description, where).toMatch(sameWay[lang]);
          expect(last, where).toMatch(sameWay[lang]);
          expect(s.description.match(whichever[lang])?.length ?? 0, where).toBeLessThanOrEqual(1);
        }
        expect([...rules].sort(), lang).toEqual(['medusa4', 'medusa5']);
      }
    } finally {
      setEngineText('en', null);
    }
  });

  it('name the two colours a Multi Colors bridge rests on where it concludes, so "one of them" is never read as the two candidates just named', () => {
    const bridge = FIXTURES.find((f) => f.rule === 'bridge')!;
    const said = {
      en: 'If light orange is true, the 6 in r2c4 is true, and the 6 in r3c6 goes. Light orange or light purple is true, so it is false either way; one more 6 falls the same way.',
      nb: 'Hvis lyseoransje er sant, er 6-tallet i r2c4 sant, og 6-tallet i r3c6 faller bort. Lyseoransje eller lyselilla er sant, så 6-tallet i r3c6 er usant uansett; ett 6-tall til faller bort på samme måte.',
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
  /**
   * positions where the finder's sentence names a cell that loses a second
   * candidate it does not name (review round 2, finding F): Remote Pair's,
   * as the solver gives it and off its path; 3D Medusa rules 5 and 4, the
   * second removal in a witness's cell and in the removal's own; rule 3
   * narrowing one cell by two
   */
  const SECOND: [Tech, string, number, string][] = [
    ['REMOTE_PAIR', '37.......2.....5.9..168..4..6..3.8524...1......5.......4...8...6.8..21.....7..4..', 28, 'So 3 is removed from r7c3; 9 is removed from r7c3.'],
    ['REMOTE_PAIR', '238.6...5.5..4.8......2..9.8.6.34..7.........3..27.5.4.1..5......5.8..4.6...9.351', 37, 'So 2 is removed from r5c9; 6 is removed from r5c9.'],
    ['MEDUSA_3D', '..3.8..........3.1.....7..9.2.5.3...9.8.6.......7...5....1....6...4...7.71...9..2', 18, 'So 1 is removed from r4c1; 4 is removed from r1c1.'],
    ['MEDUSA_3D', '.5...31..318.....2..2...64....127......4.6......398....75...9..2.....385..15...7.', 12, 'So 4 is removed from r1c5; 6 is removed from r1c5.'],
    ['MEDUSA_3D', '..457...1.3796.....82.1.....2..5....76.....32....9..6.....3.42.....8519.4...268..', 10, 'So 1 is removed from r5c3; 8 is removed from r5c3.']
  ];

  it('are each named in the explanation the full view shows, in every language: at the fixtures, the stored examples, and where a named cell loses a second candidate', () => {
    try {
      for (const [lang, table] of LANGS) {
        setEngineText(lang, table);
        for (const [tech, puzzle, at, conclusion] of SECOND) {
          const s = findStep(tech, positionAt(puzzle, at).grid)!;
          const where = `${lang} ${tech} ${puzzle} @${at}: ${describeStep(s)}`;
          if (lang === 'en') expect(describeStep(s).endsWith(`. ${conclusion}`), where).toBe(true);
          expect(unnamedIn(s), where).toEqual([]);
        }
        for (const f of FIXTURES) expect(unnamedIn(stepAt(f)), `${lang} ${f.name}: ${describeStep(stepAt(f))}`).toEqual([]);
        let stored = 0;
        for (const [tech, ex] of Object.entries(EXAMPLES)) {
          if (!isParity(ex!.step)) continue;
          const s = exampleStep(tech as Tech, ex!);
          expect(unnamedIn(s), `${lang} ${tech} (stored): ${describeStep(s)}`).toEqual([]);
          stored++;
        }
        expect(stored).toBe(4);
      }
    } finally {
      setEngineText('en', null);
    }
  });

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
  const remotePairs = { steps: 0 };
  // the removals an explanation leaves unnamed: every finder's colouring in
  // English, and the solver's own in Norwegian and Spanish too
  const unnamed: string[] = [];
  const solverColourings = { steps: 0 };
  // the ties the solver's Medusa and Remote Pair steps draw within a mark's
  // radius and a gap of another mark their frame draws
  const drawnOver: string[] = [];

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
          // every colouring a finder gives, once, for the drawing's checks at the end of this file
          finderColouring(where, s, g);
          lines.push(`${k}:${tech} ${s.eliminations.map(nameOf).join(' ')}`);
          for (const p of checkParity(s, g.cands)) problems.push(`${where}: ${p.issue} ${p.at}`);
          if (!buildable(s)) unbuildable.push(where);
          if (unnamedIn(s).length) unnamed.push(`${where}: ${unnamedIn(s).join(' ')} in ${describeStep(s)}`);
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
        if (isParity(step)) {
          solverColourings.steps++;
          try {
            for (const [lang, table] of LANGS.slice(1)) {
              setEngineText(lang, table);
              const said = findStep(step.tech, g)!;
              if (unnamedIn(said).length) unnamed.push(`${puzzle} @${k} ${step.tech} ${lang}: ${unnamedIn(said).join(' ')} in ${describeStep(said)}`);
            }
          } finally {
            setEngineText('en', null);
          }
        }
        // every colouring on the path, for the ties' checks at the end of this file
        if (isParity(step)) pathColourings.push({ name: `${puzzle} @${k}`, step, values: Array.from(g.values), cands: Array.from(g.cands) });
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
        if (step.tech === 'MEDUSA_3D' || step.tech === 'REMOTE_PAIR') {
          // and as drawn, each in its cluster's frame
          if (step.tech === 'REMOTE_PAIR') remotePairs.steps++;
          const { shapes, layout } = drawingOf(step, g.values, g.cands);
          for (const fr of walkFrames(step)) {
            const shown = markedCandidates(frameMarks(step, fr, (c) => g.values[c] > 0));
            for (const i of drawnLinks(step, fr)) {
              const l = step.links![i];
              if (shapes[i].kind !== 'tie') continue;
              const line = pathPoints((shapes[i] as Extract<ArrowShape, { kind: 'tie' }>).d);
              for (const m of shown) {
                if (!has([...l.from, ...l.to], m) && toLine(layout.centre(m), line) < (MARK.disc + SIZES.gap) * SIZE) drawnOver.push(`${puzzle} @${k}: ${named(l)} over ${nameOf(m)}`);
              }
            }
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

  it('name every removal in the explanation the full view shows: every finder\'s colouring in English, the solver\'s own in Norwegian and Spanish too', () => {
    expect(solverColourings.steps).toBe(114);
    expect(unnamed.slice(0, 10)).toEqual([]);
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

  it("draw 3D Medusa's ties along the shortest tree: at most 1,260 lines, 3,100 cells of them, 180 whose straight line would pass over another mark, and none drawn over one, nor a Remote Pair's", () => {
    expect(found.medusaSteps).toBe(70);
    expect(medusa.lines).toBeLessThanOrEqual(1260);
    expect(medusa.length).toBeLessThanOrEqual(3100);
    expect(medusa.overAMark).toBeLessThanOrEqual(180);
    // those bend round it (src/content/hintGeometry.ts), as drawn in their cluster's frame
    expect(remotePairs.steps).toBe(15);
    expect(drawnOver.slice(0, 10)).toEqual([]);
  });
});

/**
 * The colourings the solver gives along the practice pools' solve paths, at
 * the position before each: filled as the block above walks those paths,
 * or by colouringsOnPath when a block below runs on its own
 */
const pathColourings: { name: string; step: Step; values: number[]; cands: number[] }[] = [];

/** the colourings on the solve paths, walking the paths here if the block above has not */
function colouringsOnPath() {
  if (!pathColourings.length) {
    const puzzles = [...new Set(Object.values(practice as Record<string, { puzzle: string }[]>).flat().map((p) => p.puzzle))];
    for (const puzzle of puzzles) {
      const g = parseGrid(puzzle)!;
      for (let k = 0; k < 400 && !isSolved(g); k++) {
        const step = findNextStep(g);
        if (!step) break;
        if (isParity(step)) pathColourings.push({ name: `${puzzle} @${k}`, step, values: Array.from(g.values), cands: Array.from(g.cands) });
        applyStep(g, step);
      }
    }
  }
  return pathColourings;
}

/** how far a walk number at `p` keeps off a drawing's marks beyond their radius, a mark's keyline at its widest, a number's radius at a phone's size and a gap (none below 0: all clear) */
function offTheMarks(p: Point, drawing: ReturnType<typeof drawingOf>): number {
  const { layout, marks } = drawing;
  return Math.min(...marks.map((m) => Math.hypot(layout.centre(m).x - p.x, layout.centre(m).y - p.y) - (layout.radiusOf?.(m) ?? layout.r) - (MARK.keylineSmall + SIZES.badgeLarge + SIZES.badgeGap) * SIZE));
}

/**
 * Each end of each weak tie of a drawing, as drawn: the candidate it joins,
 * how far it is from that candidate, and how far from the nearest other
 * mark of that candidate's cell (Infinity: none)
 */
function weakTieEnds(s: Step, drawing: ReturnType<typeof drawingOf>): { name: string; own: number; other: number }[] {
  const { layout, marks, shapes } = drawing;
  return shapes.flatMap((sh, i) => {
    if (sh.kind !== 'arrow' || !sh.undirected) return [];
    const l = s.links![i];
    const line = lineOf(sh);
    return ([
      [l.from[0], line[0]],
      [l.to[0], line[line.length - 1]]
    ] as [CellDigit, Point][]).map(([x, p]) => {
      const at = (m: CellDigit) => Math.hypot(layout.centre(m).x - p.x, layout.centre(m).y - p.y);
      const others = marks.filter((m) => m.cell === x.cell && m.digit !== x.digit);
      return { name: `${named(l)} at ${nameOf(x)}`, own: at(x), other: Math.min(...others.map(at)) };
    });
  });
}

describe("a colouring's weak ties and walk numbers, against the other marks", () => {
  // the colouring hints on the practice pools' solve paths: the step the
  // solver gives, where it gives one, and its drawing
  const onPath: { name: string; step: Step; drawing: ReturnType<typeof drawingOf> }[] = [];
  beforeAll(() => {
    for (const { name, step, values, cands } of colouringsOnPath()) onPath.push({ name, step, drawing: drawingOf(step, values, cands) });
  }, 600_000);

  it("ends each weak tie clearly nearer its own candidate than any other mark of its cell: Medusa rule 6's into the 7 of r4c4 comes in steeply, off the 8; rule 5's from the 5 of r3c1 leaves off the 8 below it", () => {
    expect(onPath.length).toBe(114);
    let checked = 0;
    for (const { name, step, drawing } of [...everyColouring(), ...onPath]) {
      for (const end of weakTieEnds(step, drawing)) {
        // just outside its own mark, and a clearance further from any other of its cell
        expect(end.own, `${name}: ${end.name}`).toBeCloseTo((SIZES.r + SIZES.gap) * SIZE, 0);
        if (end.other === Infinity) continue;
        checked++;
        expect(end.other - end.own, `${name}: ${end.name}`).toBeGreaterThanOrEqual(SIZES.clearance * SIZE - 0.15);
      }
    }
    expect(checked).toBeGreaterThan(100);
    // rule 6: 7r4c5-7r4c4 ended in the gap between the 7 and the 8 of r4c4, 16.0 and 19.2 units from them
    const six = FIXTURES.find((x) => x.name === 'Medusa rule 6')!;
    const into = weakTieEnds(stepAt(six), drawingAt(six)).find((e) => e.name === '7r4c5-7r4c4 at 7r4c4')!;
    expect(into.other).toBeGreaterThanOrEqual((SIZES.r + SIZES.gap + SIZES.clearance) * SIZE - 0.15);
    // rule 5, on a practice path: 5r3c1-5r4c1 left the 5 of r3c1 16.0 units from it and 19.2 from the 8 below
    const five = onPath.find((x) => x.name === '.....78.5..1..839..4.1.......2.....7..9.6.2..3.....5.......9.5..674..9..9.52..... @20')!;
    expect(five.step.colouring!.rule).toBe('medusa5');
    const from = weakTieEnds(five.step, five.drawing).find((e) => e.name === '5r3c1-5r4c1 at 5r3c1')!;
    expect(from.other).toBeGreaterThanOrEqual((SIZES.r + SIZES.gap + SIZES.clearance) * SIZE - 0.15);
  });

  it('keeps every walk number of a colouring a gap off the marks, on the solve paths too', () => {
    let checked = 0;
    for (const { name, drawing } of onPath) {
      for (const p of drawing.badges.values()) {
        checked++;
        expect(offTheMarks(p, drawing), `${name}: a number at ${p.x.toFixed(1)},${p.y.toFixed(1)}`).toBeGreaterThanOrEqual(-1e-9);
      }
    }
    expect(checked).toBeGreaterThan(150);
  });
});

/** a line's points from its end nearer `at` */
const fromEnd = (line: Point[], at: Point) =>
  Math.hypot(line[0].x - at.x, line[0].y - at.y) <= Math.hypot(line[line.length - 1].x - at.x, line[line.length - 1].y - at.y) ? line : [...line].reverse();

/**
 * Two lines that meet at a candidate: the angle between the ways they leave
 * it, in degrees, over the first twentieth of each; and how far either runs
 * within 6 units (a phone's halo) of the other beyond 0.2 of a cell from the
 * candidate's centre (its mark, a gap and a little more): from there on
 * until they part (`together`), and anywhere within 20 degrees of the
 * other's direction (`alongside`). Crossing the other is neither
 */
function meeting(p: Point[], q: Point[], at: Point): { angle: number; together: number; alongside: number } {
  const [P, Q] = [fromEnd(p, at), fromEnd(q, at)];
  const way = (line: Point[]) => {
    const [dx, dy] = [line[4].x - line[0].x, line[4].y - line[0].y];
    return { x: dx / Math.hypot(dx, dy), y: dy / Math.hypot(dx, dy) };
  };
  const [u, v] = [way(P), way(Q)];
  const angle = (Math.acos(Math.max(-1, Math.min(1, u.x * v.x + u.y * v.y))) * 180) / Math.PI;
  let together = 0;
  let alongside = 0;
  for (const [X, Y] of [
    [P, Q],
    [Q, P]
  ]) {
    let run = 0;
    let side = 0;
    let open = true;
    for (let k = 1; k < X.length; k++) {
      const m = { x: (X[k - 1].x + X[k].x) / 2, y: (X[k - 1].y + X[k].y) / 2 };
      if (Math.hypot(m.x - at.x, m.y - at.y) < 0.2 * SIZE) continue;
      const step = Math.hypot(X[k].x - X[k - 1].x, X[k].y - X[k - 1].y);
      // the other's nearest stretch, and how far it is
      let [d, j] = [Infinity, 1];
      for (let i = 1; i < Y.length; i++) {
        const e = toSegment(m, Y[i - 1], Y[i]);
        if (e < d) [d, j] = [e, i];
      }
      if (open && d < 6) run += step;
      else open = false;
      const [ax, ay, bx, by] = [X[k].x - X[k - 1].x, X[k].y - X[k - 1].y, Y[j].x - Y[j - 1].x, Y[j].y - Y[j - 1].y];
      if (d < 6 && Math.abs(ax * bx + ay * by) > Math.cos(Math.PI / 9) * Math.hypot(ax, ay) * Math.hypot(bx, by)) side += step;
    }
    together = Math.max(together, run);
    alongside = Math.max(alongside, side);
  }
  return { angle, together, alongside };
}

/**
 * The ties of a drawing, frame by frame: each pair of them that meet at a
 * candidate, and each candidate of a tie's digit the board shows that the
 * tie does not join; and those that go wrong: two that leave their
 * candidate less than 20 degrees apart or run along each other for more
 * than 0.1 of a cell (they read as one line joining their far ends, two
 * candidates of one shade), and a tie within a mark's radius and a gap of
 * such a candidate (it seems to join it too)
 */
function tiesMeeting(name: string, s: Step, drawing: ReturnType<typeof drawingOf>) {
  const out = { met: 0, passed: 0, forks: [] as string[], passes: [] as string[] };
  walkFrames(s).forEach((fr, f) => {
    const drawn = [...drawnLinks(s, fr)].filter((i) => drawing.shapes[i].kind === 'tie').map((i) => ({ l: s.links![i], line: lineOf(drawing.shapes[i]) }));
    for (const { l, line } of drawn) {
      const ends = [...l.from, ...l.to];
      for (let cell = 0; cell < 81; cell++) {
        const x = { cell, digit: ends[0].digit };
        if (!drawing.shown(x) || has(ends, x)) continue;
        out.passed++;
        const d = toLine(drawing.layout.centre(x), line);
        if (d < drawing.layout.r + SIZES.gap * SIZE) out.passes.push(`${name}, frame ${f + 1}: ${named(l)} passes ${nameOf(x)} ${(d / SIZE).toFixed(3)} of a cell from its centre`);
      }
    }
    for (let p = 0; p < drawn.length; p++)
      for (let q = p + 1; q < drawn.length; q++) {
        const shared = [drawn[p].l.from[0], drawn[p].l.to[0]].find((x) => has([drawn[q].l.from[0], drawn[q].l.to[0]], x));
        if (!shared) continue;
        out.met++;
        const m = meeting(drawn[p].line, drawn[q].line, drawing.layout.centre(shared));
        if (m.angle < 20 || m.together > 0.1 * SIZE || m.alongside > 0.1 * SIZE)
          out.forks.push(
            `${name}, frame ${f + 1}: ${named(drawn[p].l)} and ${named(drawn[q].l)} at ${nameOf(shared)}, ${m.angle.toFixed(1)} degrees apart, together ${m.together.toFixed(1)}, alongside ${m.alongside.toFixed(1)}`
          );
      }
  });
  return out;
}

describe('the ties of a colouring, where two meet and where one passes a candidate of its digit', () => {
  let all: { name: string; step: Step; drawing: ReturnType<typeof drawingOf> }[] = [];
  beforeAll(() => {
    all = [...everyColouring(), ...colouringsOnPath().map(({ name, step, values, cands }) => ({ name, step, drawing: drawingOf(step, values, cands) }))];
  }, 600_000);

  it("leave a candidate two of them share at a clear angle, and never run along each other beyond its mark: the rule fixtures, the stored examples and the solve paths' colourings", () => {
    expect(pathColourings.length).toBe(114);
    const found = all.map(({ name, step, drawing }) => tiesMeeting(name, step, drawing));
    expect(found.reduce((n, x) => n + x.met, 0)).toBeGreaterThan(1000);
    expect(found.flatMap((x) => x.forks).slice(0, 10)).toEqual([]);
  });

  it('keep clear of every candidate of their digit the board shows and they do not join, in their frame or not, marked by the hint or not', () => {
    const found = all.map(({ name, step, drawing }) => tiesMeeting(name, step, drawing));
    expect(found.reduce((n, x) => n + x.passed, 0)).toBeGreaterThan(10000);
    expect(found.flatMap((x) => x.passes).slice(0, 10)).toEqual([]);
  });

  /** a link's shape in a drawing, by its name */
  const shapeOf = (s: Step, drawing: ReturnType<typeof drawingOf>, name: string) => {
    const i = s.links!.findIndex((l) => named(l) === name);
    expect(i, name).toBeGreaterThanOrEqual(0);
    expect(drawing.shapes[i].kind, name).toBe('tie');
    return drawing.shapes[i] as Extract<ArrowShape, { kind: 'tie' }>;
  };
  const at = (r: number, c: number, digit: number): CellDigit => ({ cell: (r - 1) * 9 + c - 1, digit });

  it("bend apart from a tie at their end: 3D Medusa rule 4's 2r1c8-2r1c4 goes round 1r1c8 and no longer leaves along 2r2c7-2r1c8", () => {
    const g = positionAt('......4...5...9.3.2.93...7..8.9....136...8..44...6.78......2.53..65....752....9..', 36).grid;
    const s = findNextStep(g)!;
    expect([s.tech, s.colouring!.rule]).toEqual(['MEDUSA_3D', 'medusa4']);
    const drawing = drawingOf(s, g.values, g.cands);
    const [bend, tie] = ['2r1c8-2r1c4', '2r2c7-2r1c8'].map((n) => shapeOf(s, drawing, n));
    // it was M 742.7 38.3 Q 554.0 227.0 365.3 38.3, leaving 2r1c8 at 45 degrees as the tie to 2r2c7 does: a bend off each end now
    expect(bend.d).toMatch(/ C /);
    expect(tie.d).toMatch(/ L /);
    expect(toLine(drawing.layout.centre(at(1, 8, 1)), lineOf(bend))).toBeGreaterThanOrEqual((MARK.disc + SIZES.gap) * SIZE);
    const m = meeting(lineOf(bend), lineOf(tie), drawing.layout.centre(at(1, 8, 2)));
    expect(m.angle).toBeGreaterThanOrEqual(30);
    expect([m.together, m.alongside]).toEqual([0, 0]);
  });

  it("bend apart from a tie at their end: Medusa rule 3's 9r8c7-9r7c9 and Remote Pair's 1r4c4-1r5c6 no longer come into their end along its row's tie, nor cross it", () => {
    for (const [fixture, bent, row, shared] of [
      ['Medusa rule 3', '9r8c7-9r7c9', '9r7c9-9r7c5', at(7, 9, 9)],
      ['Remote Pair, branching', '1r4c4-1r5c6', '1r5c6-1r5c1', at(5, 6, 1)]
    ] as const) {
      const f = FIXTURES.find((x) => x.name === fixture)!;
      const s = stepAt(f);
      const drawing = drawingAt(f);
      const [p, q] = [bent, row].map((n) => shapeOf(s, drawing, n));
      expect(p.d, fixture).toMatch(/ [QC] /);
      expect(q.d, fixture).toMatch(/ L /);
      // 5 and 6 degrees apart, together for 0.3 of a cell, before
      const m = meeting(lineOf(p), lineOf(q), drawing.layout.centre(shared));
      expect(m.angle, fixture).toBeGreaterThanOrEqual(30);
      expect([m.together, m.alongside], fixture).toEqual([0, 0]);
      // nor does it come round under the row's tie and into its end from below, a loop with it
      expect(cross(lineOf(p), lineOf(q)), fixture).toBe(false);
    }
  });

  it("bend round a candidate of their digit they do not join: 3D Medusa's 4r1c8-4r1c2 off 4r2c3 and 4r2c5, a Remote Pair's 2r2c9-2r8c9 off its own removal 2r5c9", () => {
    const medusa = positionAt('..3.8..........3.1.....7..9.2.5.3...9.8.6.......7...5....1....6...4...7.71...9..2', 37).grid;
    const pair = positionAt('238.6...5.5..4.8......2..9.8.6.34..7.........3..27.5.4.1..5......5.8..4.6...9.351', 24).grid;
    const cases: [Step, Grid, string, CellDigit[]][] = [
      [findNextStep(medusa)!, medusa, '4r1c8-4r1c2', [at(2, 3, 4), at(2, 5, 4)]],
      [findStep('REMOTE_PAIR', pair)!, pair, '2r2c9-2r8c9', [at(5, 9, 2), at(7, 9, 2)]],
      [findStep('REMOTE_PAIR', pair)!, pair, '2r8c7-2r5c7', [at(7, 7, 2)]]
    ];
    expect([cases[0][0].tech, cases[0][0].colouring!.rule]).toEqual(['MEDUSA_3D', 'medusa2']);
    expect(has(cases[1][0].eliminations, at(5, 9, 2))).toBe(true);
    for (const [s, g, name, passed] of cases) {
      const drawing = drawingOf(s, g.values, g.cands);
      const line = lineOf(shapeOf(s, drawing, name));
      // none of them a mark of the cluster's frame, every one a candidate the board shows
      const framed = markedCandidates(frameMarks(s, walkFrames(s)[0], (cell) => g.values[cell] > 0));
      for (const x of passed) {
        expect([drawing.shown(x), has(framed, x)], `${name} and ${nameOf(x)}`).toEqual([true, false]);
        expect(toLine(drawing.layout.centre(x), line), `${name} and ${nameOf(x)}`).toBeGreaterThanOrEqual(drawing.layout.r + SIZES.gap * SIZE);
      }
    }
  });

  it("are laid out in a few milliseconds: the 54 links of a large 3D Medusa hint on a practice solve path, its ties bent where they must be", () => {
    const g = positionAt('.68..........19.24.9...61..8.3.5.....5..3..6.....4.2.5..17...9.97.28..........75.', 29).grid;
    const s = findNextStep(g)!;
    expect([s.tech, s.colouring!.rule, s.links!.length]).toEqual(['MEDUSA_3D', 'medusa1', 54]);
    const { layout, marks, shapes } = drawingOf(s, g.values, g.cands);
    expect(shapes.filter((sh) => sh.kind === 'tie' && / [QC] /.test(sh.d)).length).toBeGreaterThanOrEqual(5);
    // as src/ui/Grid.tsx lays out a hint when it opens: the arrows, the start dots and the walk's numbers
    const once = () => {
      const t0 = performance.now();
      const sh = arrowShapes(s.links!, layout, marks);
      badgePoints(sh, layout, marks, startMarkers(s.links!, layout, marks, sh));
      return performance.now() - t0;
    };
    for (let k = 0; k < 3; k++) once();
    const runs = Array.from({ length: 9 }, once).sort((x, y) => x - y);
    // about 40 ms before the tie search was cut down to the marks and lines near each bend; under 10
    // after, with room for a busy CI runner
    expect(runs[4]).toBeLessThan(25);
  });
});

/**
 * Round 3's words and tooling: a 3D Medusa rule 4 says its removals after
 * the first "fall the same way" only where each sees both shades of its
 * digit, as the first does, and else that they are false whichever shade
 * is true; docs/highlighting.md speaks of a colouring's shades, not the
 * old colour roles, and bends a tie as G13 does; and the review gallery
 * (scripts/hint-gallery.ts) shows each example's explanation as Learn does
 */
describe("a 3D Medusa's removals after its first, where they fall another way; the developer docs and the review gallery", () => {
  const seesCell = (a: number, b: number) => a !== b && UNITS.some((u) => u.includes(a) && u.includes(b));
  /** whether a removal sees a dark and a light candidate of its digit: rule 4's reason, the first one's */
  function seesBothShades(s: Step, x: CellDigit): boolean {
    const { dark, light } = s.colouring!.clusters[0];
    const seen = (o: CellDigit) => o.digit === x.digit && seesCell(o.cell, x.cell);
    return dark.some(seen) && light.some(seen);
  }
  /** whether a removal sees one shade of its digit while its own cell holds the other: rule 5's reason */
  function seesOneHoldsOther(s: Step, x: CellDigit): boolean {
    const { dark, light } = s.colouring!.clusters[0];
    const seen = (o: CellDigit) => o.digit === x.digit && seesCell(o.cell, x.cell);
    const held = (o: CellDigit) => o.cell === x.cell;
    return (dark.some(seen) && light.some(held)) || (light.some(seen) && dark.some(held));
  }
  /** the tail after a rule 4 or 5's first removal, at the end of its sentence and of the light witness's */
  const TAIL = {
    en: {
      same: /; (one more candidate falls|\d+ more candidates fall) the same way\.$/,
      whichever: /; (one more candidate is|\d+ more candidates are) false whichever shade is true\.$/
    },
    nb: {
      same: /; (én kandidat til|\d+ kandidater til) faller bort på samme måte\.$/,
      whichever: /; (én kandidat til|\d+ kandidater til) faller bort, enten det er mørkelilla eller lyselilla som er sant\.$/
    },
    es: {
      same: /; (otro candidato se elimina|\d+ candidatos más se eliminan) de la misma forma\.$/,
      whichever: /; (otro candidato se elimina|\d+ candidatos más se eliminan) sea cual sea el tono verdadero\.$/
    }
  };

  it("say a rule 4's removals after its first are false whichever shade is true where one falls by rule 5, in every language: on a practice solve path, 1r1c5 sees both shades but 7r6c5 and 9r6c6 one each; and one more so in a daily", () => {
    const onPath = positionAt('72....3.5..8.....2...7..98..3...2..9.8..4..5.1..6...3..46..3...8.....5..3.2....41', 31).grid;
    // daily 2026-11-07, off its path: 6r1c6 sees both shades, 8r4c6 a dark 8 while its cell holds a light 6
    const oneMore = positionAt('9.....3.164....9....139.5......1.....1.5.7.6.....3......5.724....7....258.9.....7', 33).grid;
    const said = {
      en: [
        'The 1 in r1c5 sees a dark purple 1 in r1c3 and a light purple 1 in r7c5, so it is false either way; 2 more candidates are false whichever shade is true.',
        'If light purple is true, the 1 in r7c5 is true, and the 1 in r1c5 goes. Either way it is false; 2 more candidates are false whichever shade is true.',
        'The 6 in r1c6 sees a dark purple 6 in r6c6 and a light purple 6 in r4c6, so it is false either way; one more candidate is false whichever shade is true.',
        'If light purple is true, the 6 in r4c6 is true, and the 6 in r1c6 goes. Either way it is false; one more candidate is false whichever shade is true.'
      ],
      nb: [
        '1-tallet i r1c5 ser et mørkelilla 1-tall i r1c3 og et lyselilla 1-tall i r7c5, så det er usant uansett; 2 kandidater til faller bort, enten det er mørkelilla eller lyselilla som er sant.',
        'Hvis lyselilla er sant, er 1-tallet i r7c5 sant, og 1-tallet i r1c5 faller bort. Uansett er det usant; 2 kandidater til faller bort, enten det er mørkelilla eller lyselilla som er sant.',
        '6-tallet i r1c6 ser et mørkelilla 6-tall i r6c6 og et lyselilla 6-tall i r4c6, så det er usant uansett; én kandidat til faller bort, enten det er mørkelilla eller lyselilla som er sant.',
        'Hvis lyselilla er sant, er 6-tallet i r4c6 sant, og 6-tallet i r1c6 faller bort. Uansett er det usant; én kandidat til faller bort, enten det er mørkelilla eller lyselilla som er sant.'
      ],
      es: [
        'El 1 de r1c5 ve un 1 morado oscuro en r1c3 y un 1 morado claro en r7c5, así que es falso en cualquier caso; 2 candidatos más se eliminan sea cual sea el tono verdadero.',
        'Si el morado claro es verdadero, el 1 de r7c5 es verdadero y se elimina el 1 de r1c5. En cualquier caso, es falso; 2 candidatos más se eliminan sea cual sea el tono verdadero.',
        'El 6 de r1c6 ve un 6 morado oscuro en r6c6 y un 6 morado claro en r4c6, así que es falso en cualquier caso; otro candidato se elimina sea cual sea el tono verdadero.',
        'Si el morado claro es verdadero, el 6 de r4c6 es verdadero y se elimina el 6 de r1c6. En cualquier caso, es falso; otro candidato se elimina sea cual sea el tono verdadero.'
      ]
    };
    // the solver's own next step on that path
    const next = findNextStep(onPath)!;
    expect([next.tech, next.colouring?.rule, next.eliminations.map(nameOf)]).toEqual(['MEDUSA_3D', 'medusa4', ['1r1c5', '7r6c5', '9r6c6']]);
    for (const [s, removed] of [
      [next, ['1r1c5', '7r6c5', '9r6c6']],
      [findStep('MEDUSA_3D', oneMore)!, ['6r1c6', '8r4c6']]
    ] as const) {
      expect([s.colouring!.rule, s.eliminations.map(nameOf)]).toEqual(['medusa4', removed]);
      expect(s.eliminations.map((x) => [seesBothShades(s, x), seesOneHoldsOther(s, x)])).toEqual(removed.map((_, k) => (k === 0 ? [true, false] : [false, true])));
    }
    try {
      for (const [lang, table] of LANGS) {
        setEngineText(lang, table);
        for (const [k, s] of [findStep('MEDUSA_3D', onPath)!, findStep('MEDUSA_3D', oneMore)!].entries()) {
          const [sentence, witness] = said[lang].slice(2 * k);
          expect(s.description.endsWith(` ${sentence}`), `${lang}: ${s.description}`).toBe(true);
          expect(argument(s).at(-1)!.text, lang).toBe(witness);
          for (const text of [s.description, witness]) {
            expect(text, lang).toMatch(TAIL[lang].whichever);
            expect(text, lang).not.toMatch(TAIL[lang].same);
            // never "1 6 más", "2 8-tall til": a reader takes them for 16 and 28
            expect(text, lang).not.toMatch(/(?<![\p{L}\d])\d+[ -]+\d/u);
          }
        }
      }
    } finally {
      setEngineText('en', null);
    }
  });

  describe("over every 3D Medusa along the dailies' solve paths, and the solver's own on the practice paths", () => {
    /** a rule 4 or 5 that removes more than its first */
    const hits: { where: string; step: Step }[] = [];
    const more = (s: Step | null): s is Step => !!s && ['medusa4', 'medusa5'].includes(s.colouring!.rule) && s.eliminations.length > 1;
    beforeAll(() => {
      const dailies: { date: string; puzzle: string }[] = JSON.parse(new TextDecoder().decode(readFileSync('src/content/dailies.json')));
      for (const { date, puzzle } of dailies) {
        const g = parseGrid(puzzle)!;
        for (let k = 0; k < 400 && !isSolved(g); k++) {
          const s = findMedusa3d(g);
          if (more(s)) hits.push({ where: `daily ${date} @${k}`, step: s });
          const step = findNextStep(g);
          if (!step) break;
          applyStep(g, step);
        }
      }
      for (const { name, step } of colouringsOnPath()) if (more(step)) hits.push({ where: `practice ${name}`, step });
    }, 600_000);

    it("say 'the same way' only where it is true: after rule 5, or after rule 4 where every removal sees both shades; else each is false whichever shade is true, and is", () => {
      const counts = { 'medusa4 same': 0, 'medusa4 whichever': 0, 'medusa5 same': 0, practice: 0 };
      const wrong: string[] = [];
      for (const { where, step: s } of hits) {
        const rule = s.colouring!.rule;
        const extras = s.eliminations.slice(1);
        // every removal after the first is false whichever shade is true: it sees both, or one while its cell holds the other
        for (const x of extras) if (!seesBothShades(s, x) && !seesOneHoldsOther(s, x)) wrong.push(`${where}: ${nameOf(x)} is not removed by rule 4 or 5`);
        const same = rule === 'medusa5' || extras.every((x) => seesBothShades(s, x));
        const tail = same ? 'same' : 'whichever';
        for (const text of [s.description, argument(s).at(-1)!.text!]) if (!TAIL.en[tail].test(text)) wrong.push(`${where} ${rule}, ${tail}: ${text}`);
        counts[`${rule as 'medusa4' | 'medusa5'} ${tail}` as keyof typeof counts]++;
        if (where.startsWith('practice')) counts.practice++;
      }
      expect(wrong.slice(0, 10)).toEqual([]);
      // 5,653, 295 and 272 along the dailies' paths when this was written; 11 on the practice paths, 2 of
      // them a rule 4 with removals by rule 5 (1r1c5's above, and 2r4c7's 6r7c7 and 7r8c7)
      expect(counts['medusa4 same']).toBeGreaterThan(1000);
      expect(counts['medusa4 whichever']).toBeGreaterThan(100);
      expect(counts['medusa5 same']).toBeGreaterThan(100);
      expect(counts.practice).toBeGreaterThan(5);
    });
  });

  it("are described in docs/highlighting.md as drawn since phase 3: a colouring in shades, with none of the old colour roles, and its ties bent as G13 bends them", () => {
    const doc = new TextDecoder().decode(readFileSync('docs/highlighting.md')).replace(/\s+/g, ' ');
    // the roles' and the legend's examples name no colouring, and the colouring none of the roles
    expect(doc).not.toMatch(/the second colour|the bridge colours|the other colour|\bgold\b/);
    expect(doc).toContain('A colouring has none of these roles: it draws each cluster in two shades of one hue, dark and light purple, and a second cluster dark and light orange');
    expect(doc).toContain('A colouring carries none: its legend names its shades');
    // a tie bends round another mark of its frame or a candidate of its digit, and apart from a tie at its end
    expect(doc).toContain('It is straight unless it would pass over another mark its frame draws, or another candidate of its digit the board shows, when it bends round it as an arrow does; where two ties share a candidate, each leaves it well apart from the other');
    expect(doc).toContain("(bent round another mark of the frame, or a candidate of their digit, where a straight one would cross it, and apart from a tie that shares their end)");
  });

  it("show in the review gallery what Learn shows beside each example: its explanation with the conclusion, which names Multi Colors' second removal, r7c4", async () => {
    // the page scripts/hint-gallery.ts writes
    const html = (await import('../scripts/hint-gallery-page')).galleryPage();
    const shown = (tech: Tech) => html.match(new RegExp(`<figure id="${tech}">.*?<p>(.*?)</p></figure>`, 's'))?.[1];
    const escaped = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    // as src/ui/Learn.tsx and src/content/learnPages.ts write it
    for (const tech of Object.keys(EXAMPLES) as Tech[]) expect(shown(tech), tech).toBe(escaped(describeStep(exampleStep(tech, EXAMPLES[tech]!))));
    expect(shown('MULTI_COLORS')).toMatch(/; one more 6 falls the same way\. So 6 is removed from r3c6, r7c4\.$/);
  });
});

/**
 * A colouring's strong relations, cluster by cluster, rebuilt from the
 * position as its finder builds them: for a Remote Pair each cell's own two
 * candidates and the lower digits of two cells that see each other; else
 * the conjugate pairs of the cluster's candidates, and for 3D Medusa its
 * bivalue cells
 */
function strongRelations(s: Step, values: ArrayLike<number>, cands: ArrayLike<number>): { nodes: CellDigit[]; relations: [CellDigit, CellDigit][] }[] {
  return s.colouring!.clusters.map((cl) => {
    const nodes = [...cl.dark, ...cl.light];
    const relations: [CellDigit, CellDigit][] = [];
    if (s.tech === 'REMOTE_PAIR') {
      const cells = [...new Set(nodes.map((x) => x.cell))].sort((a, b) => a - b);
      const [lo, hi] = [Math.min(...nodes.map((x) => x.digit)), Math.max(...nodes.map((x) => x.digit))];
      cells.forEach((a, i) => {
        relations.push([{ cell: a, digit: lo }, { cell: a, digit: hi }]);
        for (const b of cells.slice(i + 1)) if (UNITS.some((u) => u.includes(a) && u.includes(b))) relations.push([{ cell: a, digit: lo }, { cell: b, digit: lo }]);
      });
      return { nodes, relations };
    }
    for (const unit of UNITS)
      for (let digit = 1; digit <= 9; digit++) {
        const cells = unit.filter((c) => values[c] === 0 && cands[c] & bit(digit));
        if (cells.length === 2 && cells.every((cell) => has(nodes, { cell, digit }))) relations.push([{ cell: cells[0], digit }, { cell: cells[1], digit }]);
      }
    if (s.tech === 'MEDUSA_3D')
      for (let cell = 0; cell < 81; cell++) {
        const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => values[cell] === 0 && cands[cell] & bit(d));
        if (digits.length === 2 && digits.every((digit) => has(nodes, { cell, digit }))) relations.push([{ cell, digit: digits[0] }, { cell, digit: digits[1] }]);
      }
    return { nodes, relations };
  });
}

/** the tree reading order alone takes, as the tie-break was before: Kruskal, of two ties that weigh the same the first in reading order */
function byReadingOrder(nodes: readonly CellDigit[], relations: readonly [CellDigit, CellDigit][], marks: readonly CellDigit[]): [CellDigit, CellDigit][] {
  const parent = new Map(nodes.map((x) => [nameOf(x), nameOf(x)]));
  const root = (x: string): string => (parent.get(x) === x ? x : root(parent.get(x)!));
  const edges = relations
    .map(([a, b]) => (readingOrder(a, b) <= 0 ? [a, b] : [b, a]))
    .map(([a, b]) => ({ a, b, w: tieWeight(a, b, marks) }))
    .sort((p, q) => p.w - q.w || readingOrder(p.a, q.a) || readingOrder(p.b, q.b));
  const out: [CellDigit, CellDigit][] = [];
  for (const { a, b } of edges) {
    const [ra, rb] = [root(nameOf(a)), root(nameOf(b))];
    if (ra === rb) continue;
    parent.set(ra, rb);
    out.push([a, b]);
  }
  return out;
}

describe('the shortest drawn tree, of ties that weigh the same', () => {
  // the practice paths' colourings, then the rule fixtures and stored examples, each with its drawing
  let all: { name: string; onPath: boolean; step: Step; values: ArrayLike<number>; cands: ArrayLike<number>; drawing: ReturnType<typeof drawingOf> }[] = [];
  beforeAll(() => {
    all = [
      ...colouringsOnPath().map((c) => ({ ...c, onPath: true, drawing: drawingOf(c.step, c.values, c.cands) })),
      ...everyColouring().map((c) => ({ ...c, onPath: false }))
    ];
  }, 600_000);
  const at = (r: number, c: number, digit: number): CellDigit => ({ cell: (r - 1) * 9 + c - 1, digit });
  const pair = ([a, b]: [CellDigit, CellDigit]) => `${nameOf(a)}-${nameOf(b)}`;
  const unordered = ([a, b]: [CellDigit, CellDigit]) => [nameOf(a), nameOf(b)].sort().join('-');
  /** a tree's weight, and how many of its ties' straight lines pass over another mark */
  const weight = (tree: [CellDigit, CellDigit][], marks: CellDigit[]) => tree.reduce((n, [a, b]) => n + tieWeight(a, b, marks), 0);
  const overAMark = (tree: [CellDigit, CellDigit][], marks: CellDigit[]) => tree.filter(([a, b]) => tieWeight(a, b, marks) > drawnDistance(a, b) + 1e-9).length;
  /** each pair of ties a frame draws that share an end and cross */
  const crossingAtTheirEnd = (name: string, s: Step, drawing: ReturnType<typeof drawingOf>) =>
    walkFrames(s).flatMap((fr, f) => {
      const drawn = [...drawnLinks(s, fr)].filter((i) => drawing.shapes[i].kind === 'tie').map((i) => ({ l: s.links![i], line: lineOf(drawing.shapes[i]) }));
      return drawn.flatMap((p, i) =>
        drawn
          .slice(i + 1)
          .filter((q) => [p.l.from[0], p.l.to[0]].some((x) => has([q.l.from[0], q.l.to[0]], x)) && cross(p.line, q.line))
          .map((q) => `${name}, frame ${f + 1}: ${named(p.l)} crosses ${named(q.l)}`)
      );
    });

  it('takes a straight line before one over another mark that weighs the same, and the tree is as short', () => {
    // a rectangle of 4s, r1c1 and r1c4 over r7c1 and r7c4, with a mark between r1c1 and r1c4: that line weighs 3 + 3,
    // as much as a column's 6, and reading order alone would take it first
    const [a, b, d, e] = [at(1, 1, 4), at(1, 4, 4), at(7, 1, 4), at(7, 4, 4)];
    const marks = [a, b, d, e, at(1, 2, 4)];
    const relations: [CellDigit, CellDigit][] = [
      [a, b],
      [b, e],
      [d, e],
      [a, d]
    ];
    expect(tieWeight(a, b, marks)).toBe(tieWeight(a, d, marks));
    expect(byReadingOrder([a, b, d, e], relations, marks).map(pair)).toEqual(['4r7c1-4r7c4', '4r1c1-4r1c4', '4r1c1-4r7c1']);
    const tree = spanningTies([a, b, d, e], relations, marks);
    expect(tree.map(pair)).toEqual(['4r1c1-4r7c1', '4r7c1-4r7c4', '4r7c4-4r1c4']);
    expect(overAMark(tree, marks)).toBe(0);
    expect(weight(tree, marks)).toBeCloseTo(weight(byReadingOrder([a, b, d, e], relations, marks), marks), 9);
  });

  it("then a line clear of the ties the tree draws at its ends: the stored Remote Pair joins r5c5 and r6c4, not r2c5 and r3c4, which would leave r2c5 between its two ties", () => {
    // r2c3, r2c5, r3c4, r5c5 and r6c4 hold only 3 and 5; the 3s of two cells that see each other are tied
    const cells = [at(2, 3, 3), at(2, 5, 3), at(3, 4, 3), at(5, 5, 3), at(6, 4, 3)];
    const nodes = cells.flatMap((x) => [x, { cell: x.cell, digit: 5 }]);
    const relations: [CellDigit, CellDigit][] = [
      ...cells.map((x): [CellDigit, CellDigit] => [x, { cell: x.cell, digit: 5 }]),
      [at(2, 3, 3), at(2, 5, 3)],
      [at(2, 5, 3), at(3, 4, 3)],
      [at(2, 5, 3), at(5, 5, 3)],
      [at(3, 4, 3), at(6, 4, 3)],
      [at(5, 5, 3), at(6, 4, 3)]
    ];
    const marks = [...nodes, at(6, 3, 3)];
    // each of the two diagonals runs through the 5 of its upper cell: the square root of 2, and 3 more
    expect(tieWeight(at(2, 5, 3), at(3, 4, 3), marks)).toBe(tieWeight(at(5, 5, 3), at(6, 4, 3), marks));
    expect(tieWeight(at(5, 5, 3), at(6, 4, 3), marks)).toBeCloseTo(Math.SQRT2 + 3, 9);
    // by the time they are weighed, r2c5 draws a tie to its left and one down, each 45 degrees off the diagonal to r3c4;
    // r5c5 draws only the one up, and r6c4 the one up to r3c4, 45 degrees off
    expect(byReadingOrder(nodes, relations, marks).map(pair)).toContain('3r2c5-3r3c4');
    const tree = spanningTies(nodes, relations, marks);
    expect(tree.filter(([x, y]) => x.cell !== y.cell).map(pair)).toEqual(['3r2c3-3r2c5', '3r2c5-3r5c5', '3r5c5-3r6c4', '3r6c4-3r3c4']);
    expect(weight(tree, marks)).toBeCloseTo(weight(byReadingOrder(nodes, relations, marks), marks), 9);
    // as found at its position and as stored, and drawn: no tie of the cluster's frame crosses one that shares its end
    const f = FIXTURES.find((x) => x.name === 'Remote Pair (stored)')!;
    const ex = EXAMPLES.REMOTE_PAIR!;
    expect([ex.puzzle, ex.stepIndex]).toEqual([f.puzzle, f.at]);
    for (const [where, s, drawing] of [
      ['found', stepAt(f), drawingAt(f)],
      ['stored', ex.step, drawingOf(ex.step, Array.from(ex.values, Number), ex.cands)]
    ] as const) {
      expect(ties(s).map((l) => named(l)), where).toContain('3r5c5-3r6c4');
      expect(ties(s).map((l) => unordered([l.from[0], l.to[0]])), where).not.toContain('3r2c5-3r3c4');
      expect(crossingAtTheirEnd(where, s, drawing)).toEqual([]);
    }
  });

  it("is never longer than reading order alone makes it, passes fewer marks, and crosses no tie at its end: the practice paths' colourings, the rule fixtures and the stored examples", () => {
    const longer: string[] = [];
    const crossing: string[] = [];
    const over = { now: 0, before: 0 };
    for (const { name, onPath, step, values, cands, drawing } of all) {
      const marks = [...coloured(step), ...step.eliminations];
      const clusters = strongRelations(step, values, cands);
      // the relations rebuilt are the finder's: they give its own tree
      expect(clusters.flatMap(({ nodes, relations }) => spanningTies(nodes, relations, marks)).map(unordered).sort(), name).toEqual(ties(step).map((l) => unordered([l.from[0], l.to[0]])).sort());
      for (const { nodes, relations } of clusters) {
        const [tree, before] = [spanningTies(nodes, relations, marks), byReadingOrder(nodes, relations, marks)];
        if (weight(tree, marks) > weight(before, marks) + 1e-9) longer.push(`${name}: ${weight(tree, marks)} against ${weight(before, marks)}`);
        if (onPath) {
          over.now += overAMark(tree, marks);
          over.before += overAMark(before, marks);
        }
      }
      crossing.push(...crossingAtTheirEnd(name, step, drawing));
    }
    expect(all.filter((c) => c.onPath).length).toBe(114);
    expect(longer).toEqual([]);
    // on the paths, 192 ties whose straight line passes another mark, against 196 by reading order alone
    expect(over.now).toBeLessThan(over.before);
    expect(crossing.slice(0, 10)).toEqual([]);
  });
});

/**
 * Every colouring a finder gives along the practice pools' solve paths,
 * once each (a finder gives the same one at many positions), at the first
 * position it gives it: filled as the block that walks those paths runs
 * the finders, or by finderColourings when a block below runs on its own
 */
const offPath: { name: string; step: Step; values: number[]; cands: number[] }[] = [];
const offPathSeen = new Set<string>();
function finderColouring(name: string, step: Step, g: Grid) {
  const seen = `${step.tech}|${JSON.stringify(step.links)}|${step.eliminations.map(nameOf).join(' ')}`;
  if (offPathSeen.has(seen)) return;
  offPathSeen.add(seen);
  offPath.push({ name, step, values: Array.from(g.values), cands: Array.from(g.cands) });
}
/** the colourings the finders give on the solve paths, walking the paths here if the block that does has not */
function finderColourings() {
  if (!offPath.length) {
    const puzzles = [...new Set(Object.values(practice as Record<string, { puzzle: string }[]>).flat().map((p) => p.puzzle))];
    for (const puzzle of puzzles) {
      const g = parseGrid(puzzle)!;
      for (let k = 0; k < 400 && !isSolved(g); k++) {
        for (const find of [findSimpleColors, findMultiColors, findMedusa3d, findRemotePair]) {
          const s = find(g);
          if (s) finderColouring(`${puzzle} @${k} ${s.tech}`, s, g);
        }
        const step = findNextStep(g);
        if (!step) break;
        applyStep(g, step);
      }
    }
  }
  return offPath;
}

/** whether two lines come within `gap` of each other, by the boxes round them */
function within(p: Point[], q: Point[], gap: number): boolean {
  const box = (ps: Point[]) => ps.reduce((b, x) => ({ x0: Math.min(b.x0, x.x), y0: Math.min(b.y0, x.y), x1: Math.max(b.x1, x.x), y1: Math.max(b.y1, x.y) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
  const [a, b] = [box(p), box(q)];
  return a.x0 <= b.x1 + gap && b.x0 <= a.x1 + gap && a.y0 <= b.y1 + gap && b.y0 <= a.y1 + gap;
}
/** how many times two lines cross */
function crossings(p: Point[], q: Point[]): number {
  if (!within(p, q, 0)) return 0;
  const side = (a: Point, b: Point, c: Point) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  let n = 0;
  for (let i = 1; i < p.length; i++)
    for (let j = 1; j < q.length; j++) if (side(p[i - 1], p[i], q[j - 1]) * side(p[i - 1], p[i], q[j]) < 0 && side(q[j - 1], q[j], p[i - 1]) * side(q[j - 1], q[j], p[i]) < 0) n++;
  return n;
}
/** whether two lines cross further than `free` from `at` */
function crossBeyond(p: Point[], q: Point[], at: Point, free: number): boolean {
  if (!within(p, q, 0)) return false;
  const side = (a: Point, b: Point, c: Point) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  const off = (x: Point) => Math.hypot(x.x - at.x, x.y - at.y) >= free;
  for (let i = 1; i < p.length; i++)
    for (let j = 1; j < q.length; j++)
      if (off(p[i - 1]) && off(p[i]) && side(p[i - 1], p[i], q[j - 1]) * side(p[i - 1], p[i], q[j]) < 0 && side(q[j - 1], q[j], p[i - 1]) * side(q[j - 1], q[j], p[i]) < 0) return true;
  return false;
}
/**
 * How far a line runs beside another: its longest stretch between 0.07 and
 * 0.25 of a cell from it, further than 0.3 of a cell from either's ends,
 * where the two read as a double line though their halos never touch
 */
function besideRun(p: Point[], q: Point[]): number {
  if (!within(p, q, 0.25 * SIZE)) return 0;
  const ends = [p[0], p[p.length - 1], q[0], q[q.length - 1]];
  let [run, most] = [0, 0];
  for (let k = 1; k < p.length; k++) {
    const m = { x: (p[k - 1].x + p[k].x) / 2, y: (p[k - 1].y + p[k].y) / 2 };
    const d = toLine(m, q);
    if (ends.every((e) => Math.hypot(e.x - m.x, e.y - m.y) >= 0.3 * SIZE) && d < 0.25 * SIZE && d > 0.07 * SIZE) run += Math.hypot(p[k].x - p[k - 1].x, p[k].y - p[k - 1].y);
    else [run, most] = [0, Math.max(most, run)];
  }
  return Math.max(most, run);
}
/** the least room between a line and the board's edge */
const offTheEdge = (line: Point[]) => Math.min(...line.map((p) => Math.min(p.x - M, p.y - M, M + 9 * SIZE - p.x, M + 9 * SIZE - p.y)));

/**
 * What a drawing does wrong, as the third review of phase 3 measured it:
 * a tie or a weak tie within 0.08 of a cell of the board's edge, where its
 * halo meets the border; two ties of a frame that cross twice; a tie bent
 * off each end that runs beside another for more than a cell; two weak
 * ties into one candidate that cross further than a quarter of a cell
 * from it; a weak tie's end not clearly nearer its own candidate than any
 * other mark of its cell
 */
function wrongIn(name: string, s: Step, drawing: Pick<ReturnType<typeof drawingOf>, 'layout' | 'marks' | 'shapes'>) {
  const out = { edge: [] as string[], twice: [] as string[], beside: [] as string[], crossed: [] as string[], ends: [] as string[] };
  const { layout, shapes } = drawing;
  const lines = shapes.map((sh) => (sh.kind === 'tie' || sh.kind === 'arrow' ? pathPoints(sh.d) : []));
  // the lines met with each other, at a quarter of the points: fast enough for every colouring of the paths
  const coarse = lines.map((line) => line.filter((_, k) => k % 4 === 0));
  shapes.forEach((sh, i) => {
    if ((sh.kind === 'tie' || sh.kind === 'arrow') && offTheEdge(lines[i]) < SIZES.gridLine * SIZE) out.edge.push(`${name}: ${named(s.links![i])} ${sh.d}`);
  });
  walkFrames(s).forEach((fr, f) => {
    const drawn = [...drawnLinks(s, fr)].filter((i) => shapes[i].kind === 'tie');
    for (let x = 0; x < drawn.length; x++)
      for (let y = x + 1; y < drawn.length; y++) {
        const [i, j] = [drawn[x], drawn[y]];
        const [p, q] = [coarse[i], coarse[j]];
        const both = `${name}, frame ${f + 1}: ${named(s.links![i])} and ${named(s.links![j])}`;
        if (crossings(p, q) >= 2) out.twice.push(both);
        for (const [k, a, b] of [
          [i, p, q],
          [j, q, p]
        ] as const) {
          const run = / C /.test((shapes[k] as { d: string }).d) ? besideRun(a, b) : 0;
          if (run > SIZE) out.beside.push(`${both}, ${(run / SIZE).toFixed(2)} of a cell`);
        }
      }
  });
  const weak = shapes.flatMap((sh, i) => (sh.kind === 'arrow' && sh.undirected ? [i] : []));
  for (let x = 0; x < weak.length; x++)
    for (let y = x + 1; y < weak.length; y++) {
      const [li, lj] = [s.links![weak[x]], s.links![weak[y]]];
      // two into one candidate, from two others: two between the same two are drawn side by side
      const shared = [li.from[0], li.to[0]].find((c) => has([lj.from[0], lj.to[0]], c));
      const far = shared && (has([shared], lj.from[0]) ? lj.to[0] : lj.from[0]);
      if (shared && !has([li.from[0], li.to[0]], far!) && crossBeyond(coarse[weak[x]], coarse[weak[y]], layout.centre(shared), 0.25 * SIZE))
        out.crossed.push(`${name}: ${named(li)} and ${named(lj)}`);
    }
  for (const end of weakTieEnds(s, drawing as ReturnType<typeof drawingOf>)) if (end.other - end.own < SIZES.clearance * SIZE - 0.15) out.ends.push(`${name}: ${end.name}`);
  return out;
}
/** a step's lines on the app board, as drawingOf lays them out, without the start dots and walk numbers */
function linesOf(s: Step, values: ArrayLike<number>, cands: ArrayLike<number>) {
  const solved = (cell: number) => values[cell] > 0;
  const full = frameMarks(s, null, solved);
  const marks = markedCandidates(full);
  const shown = (x: CellDigit) => digitShown({ value: values[x.cell], corner: 0, center: 0 }, x.digit, cands[x.cell], full.cands.get(x.cell));
  const layout = boardLayout(placedKeys(full), shown, solved);
  return { layout, marks, shapes: arrowShapes(s.links!, layout, marks) };
}

describe('what the third review of phase 3 found', () => {
  /** a link's line in a drawing, by its name */
  const lineNamed = (s: Step, shapes: ArrowShape[], name: string) => {
    const i = s.links!.findIndex((l) => named(l) === name);
    expect(i, name).toBeGreaterThanOrEqual(0);
    return lineOf(shapes[i]);
  };
  const at = (r: number, c: number, digit: number): CellDigit => ({ cell: (r - 1) * 9 + c - 1, digit });

  it("runs no tie bent off each end beside another tie, nor across one twice, nor bends it off each end only to leave a grid line: 3D Medusa rule 2's 1r2c5-1r6c5 by the column's 2s, rule 1's 7r2c8-7r9c8 by 5r4c7-5r8c7, one arc each", () => {
    for (const [puzzle, steps, rule, name, other] of [
      ['18.4.5.6....7.62......83........2.54..85.....45....9....3...6426.....7.9.41......', 22, 'medusa2', '1r2c5-1r6c5', '2r1c5-2r9c5'],
      ['..97....6.4..561......143...82....9.....2.....1....26...748......627..3.4....59..', 29, 'medusa1', '7r2c8-7r9c8', '5r4c7-5r8c7']
    ] as const) {
      const g = positionAt(puzzle, steps).grid;
      const s = findNextStep(g)!;
      expect([s.tech, s.colouring!.rule]).toEqual(['MEDUSA_3D', rule]);
      const drawing = linesOf(s, g.values, g.cands);
      const [p, q] = [name, other].map((n) => lineNamed(s, drawing.shapes, n));
      // they were 'M 441.1 132.3 C 486.0 148.0 486.0 506.0 441.1 521.7', across the column's
      // tie at both ends and 0.17-0.21 of a cell beside it for 3.1 cells between; and 'M 710.9 188.3
      // C 666.0 204.0 666.0 862.0 710.9 877.7', 0.23 of a cell beside 5r4c7-5r8c7 for 2.3 cells,
      // where an arc ran along a cell line instead
      const d = (drawing.shapes[s.links!.findIndex((l) => named(l) === name)] as { d: string }).d;
      expect(d, name).toMatch(/^M [\d.]+ [\d.]+ Q [\d.]+ [\d.]+ [\d.]+ [\d.]+$/);
      expect(crossings(p, q), name).toBeLessThanOrEqual(1);
      expect(besideRun(p, q), name).toBeLessThan(SIZE);
      expect(wrongIn(name, s, drawing)).toEqual({ edge: [], twice: [], beside: [], crossed: [], ends: [] });
    }
  });

  it("runs no tie bent off each end beside another tie, nor any bend twice across one, where the finders give it off the solver's path: 3D Medusa's 3r4c1-3r4c9 by the tie along row 5, 4r4c3-4r8c3 round 5r9c3-5r4c3", () => {
    for (const [puzzle, steps, name, other] of [
      ['5..2...1823..4.5..7..5..3.......9.8.1...6...4.6.4.......3..5..2..1.7..3567...2..1', 22, '3r4c1-3r4c9', '5r5c2-5r5c8'],
      ['1..5.8.........12..3..2....6.....9.8...4.5...8..3....7......6.39.......5.6.8.1.4.', 42, '4r4c3-4r8c3', '5r9c3-5r4c3']
    ] as const) {
      const g = positionAt(puzzle, steps).grid;
      const s = findStep('MEDUSA_3D', g)!;
      const drawing = linesOf(s, g.values, g.cands);
      const [p, q] = [name, other].map((n) => lineNamed(s, drawing.shapes, n));
      // the first ran 3.8 cells along the tie below it, bent off each end; the second crossed the
      // tie beside it at both ends, an arc round it
      expect(crossings(p, q), name).toBeLessThanOrEqual(1);
      expect(besideRun(p, q), name).toBeLessThan(SIZE);
    }
  });

  it("keeps a tie's bend off the board's edge, where its halo would meet the border and the two merge: 3D Medusa's 2r1c1-2r1c9 and 2r1c1-2r1c6 along the top", () => {
    for (const [puzzle, steps, name] of [
      ['...7.8...3.........59.3.6..1..8..9......5..2...7....14.....52...62.....9.....486.', 27, '2r1c1-2r1c9'],
      ['..8.......79.....8...57..1.1.........9..3.6......561.7.....4.8...46......65.2...3', 39, '2r1c1-2r1c6']
    ] as const) {
      const g = positionAt(puzzle, steps).grid;
      const s = findStep('MEDUSA_3D', g)!;
      const { shapes } = linesOf(s, g.values, g.cands);
      // they ran 1.7 cells and 1.1 cells at y 7-12, against the border drawn 6 wide at y 4
      expect(offTheEdge(lineNamed(s, shapes, name)), name).toBeGreaterThanOrEqual(SIZES.gridLine * SIZE);
    }
  });

  it("takes a slight miss of a clear angle where a tie meets another before a run along a box line: 3D Medusa's 1r7c2-1r7c8 bends under its row, off 1r7c8-1r9c8 but not along the line between rows 6 and 7", () => {
    const g = positionAt('...2...8......6.938....97...9...7..21.4...9.76..9...5...27....693.1......6...4...', 48).grid;
    const s = findStep('MEDUSA_3D', g)!;
    const { shapes, layout } = linesOf(s, g.values, g.cands);
    // it was M 141.6 623.5 Q 666.0 507.0 718.8 612.7, 3 cells along the box line above row 7
    const [p, q] = ['1r7c2-1r7c8', '1r7c8-1r9c8'].map((n) => lineNamed(s, shapes, n));
    expect(alongBoxLines(p)).toBeLessThanOrEqual(0.1 * SIZE);
    const m = meeting(p, q, layout.centre(at(7, 8, 1)));
    expect(m.angle).toBeGreaterThanOrEqual(20);
    expect([m.together, m.alongside]).toEqual([0, 0]);
  });

  it("brings two weak ties into one candidate without crossing before it, each end still clearly its own candidate's: 3D Medusa rule 4's into the 7 of r3c8, past the 8 of r2c7, and into the 9 of r1c6", () => {
    for (const [puzzle, steps, first, second, into] of [
      ['.......9.....15.2315..2...45.....1.9..2.4.6..8.7.....56...3..1778.29.....3.......', 6, '7r2c7-7r3c8', '7r3c7-7r3c8', at(3, 8, 7)],
      ['..716...453...26..1.6.7....39...4.....2...4.....3...25....3.5.1..12...637...819..', 20, '9r2c4-9r1c6', '9r3c4-9r1c6', at(1, 6, 9)]
    ] as const) {
      const g = positionAt(puzzle, steps).grid;
      const s = findStep('MEDUSA_3D', g)!;
      expect(s.colouring!.rule).toBe('medusa4');
      const drawing = linesOf(s, g.values, g.cands);
      const [p, q] = [first, second].map((n) => lineNamed(s, drawing.shapes, n));
      // they crossed at 35 and 27 degrees, half a cell and a quarter before it
      expect(crossBeyond(p, q, drawing.layout.centre(into), 0.25 * SIZE), first).toBe(false);
      for (const end of weakTieEnds(s, drawing as ReturnType<typeof drawingOf>).filter((e) => [first, second].some((n) => e.name.startsWith(n))))
        expect(end.other - end.own, end.name).toBeGreaterThanOrEqual(SIZES.clearance * SIZE - 0.15);
    }
  });

  it("comes into a weak tie's end boxed in by the marks of its cell from a free side: a daily's 6r9c3-6r9c8, under 6r9c7 into the 6 of r9c8, off the 3 above it", () => {
    for (const steps of [25, 26, 28]) {
      const g = positionAt('4.......6.62.41..........97..348......4.7.8......237..39..........63.12.5.......4', steps).grid;
      const s = findStep('MEDUSA_3D', g)!;
      expect(s.colouring!.rule).toBe('medusa2');
      const drawing = linesOf(s, g.values, g.cands);
      // it ended 13.9 units from the 3's centre, on its disc, and 16.0 from the 6's
      const end = weakTieEnds(s, drawing as ReturnType<typeof drawingOf>).find((e) => e.name === '6r9c3-6r9c8 at 6r9c8')!;
      expect(end.other - end.own, `@${steps}`).toBeGreaterThanOrEqual(SIZES.clearance * SIZE - 0.15);
      // and the line keeps clear of every other mark
      const line = lineNamed(s, drawing.shapes, '6r9c3-6r9c8');
      for (const m of drawing.marks) if (!has([at(9, 3, 6), at(9, 8, 6)], m)) expect(toLine(drawing.layout.centre(m), line), nameOf(m)).toBeGreaterThanOrEqual((SIZES.r + SIZES.clearance) * SIZE - 0.01);
    }
  });

  it("does none of it, or seldom where it is boxed in, over every colouring the finders give along the practice pools' solve paths, the solver's or not: at most 8 pairs of ties crossing twice, 20 ties bent off each end beside another and 6 pairs of weak ties crossing before their candidate (50, 52 and 242 before), no line at the board's edge (25) and no weak tie's end nearer another mark of its cell (9)", () => {
    const found = { edge: [] as string[], twice: [] as string[], beside: [] as string[], crossed: [] as string[], ends: [] as string[] };
    const all = finderColourings();
    expect(all.length).toBeGreaterThan(11000);
    for (const { name, step, values, cands } of all) {
      const out = wrongIn(name, step, linesOf(step, values, cands));
      for (const k of Object.keys(found) as (keyof typeof found)[]) found[k].push(...out[k]);
    }
    expect(found.edge.slice(0, 5)).toEqual([]);
    expect(found.ends.slice(0, 5)).toEqual([]);
    expect(found.twice.length, found.twice.slice(0, 10).join('\n')).toBeLessThanOrEqual(8);
    expect(found.beside.length, found.beside.slice(0, 10).join('\n')).toBeLessThanOrEqual(20);
    expect(found.crossed.length, found.crossed.slice(0, 10).join('\n')).toBeLessThanOrEqual(6);
  });
});
