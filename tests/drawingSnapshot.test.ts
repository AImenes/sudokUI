/**
 * The drawings phase 3 leaves as they are (docs/hint-drawing-colouring.md,
 * "How it is checked"): every hint drawing that is not a colouring, taken
 * before phase 3 changed anything, and worked out again here. That is every
 * stored example but Simple Colors, Multi Colors, 3D Medusa and Remote
 * Pair, and every derived chain step on offer along the solve paths of six
 * hard puzzles, where the solver needs more than a single (as
 * tests/truth.test.ts walks them). For each:
 * - the walk's frames: each one's sentence, the links it has reached and
 *   the parts it shows (src/engine/hintFrames.ts walkFrames);
 * - the marks of the full view and of every frame (src/content/hintMarks.ts
 *   frameMarks): the candidates' kinds, the colours inside a ring, the solved
 *   digits' colours, the bands and whether the premise is refuted, sorted;
 * - for the same views, the kinds a legend shows (legendKinds) and the
 *   Learn legend (src/content/boardSvg.ts legendOf);
 * - the arrows, the start dots and the walk's numbers the app board draws
 *   (src/content/hintGeometry.ts), worked out as src/ui/Grid.tsx works them
 *   out, with the candidates on and every number rounded to 0.01.
 *
 * The fixture is tests/fixtures/drawingSnapshot.json. Only a deliberate
 * change to these drawings, named in the commit that makes it, writes it
 * again:
 *
 *   DRAWING_SNAPSHOT=write npx vitest run tests/drawingSnapshot.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { env } from 'node:process';
import { EXAMPLES } from '../src/content/examples';
import { parseGrid, isSolved } from '../src/engine/board';
import { findNextStep, findAllSteps, applyStep } from '../src/engine/humanSolver';
import { walkFrames } from '../src/engine/hintFrames';
import type { Frame } from '../src/engine/hintFrames';
import { frameMarks, legendKinds, markedCandidates, placedKeys } from '../src/content/hintMarks';
import { legendOf } from '../src/content/boardSvg';
import { arrowShapes, startMarkers, badgePoints } from '../src/content/hintGeometry';
import { boardLayout, digitShown } from '../src/ui/boardLayout';
import type { CellDigit, Step } from '../src/engine/steps';
import type { Tech } from '../src/engine/ratings';

const FIXTURE = 'tests/fixtures/drawingSnapshot.json';

/** the techniques phase 3 draws as colourings: every other drawing stays */
const COLOURING = new Set<Tech>(['SIMPLE_COLORS', 'MULTI_COLORS', 'MEDUSA_3D', 'REMOTE_PAIR']);

/** the solve paths, tests/truth.test.ts's hard puzzles */
const HARD = [
  '52...6.........7.13...........4..8..6......5...........418.........3..2...87.....',
  '4.....8.5.3..........7......2.....6.....8.4......1.......6.3.7.5..2.....1.4......',
  '..53.....8......2..7..1.5..4....53...1..7...6..32...8..6.5....9..4....3......97..',
  '.......12........3..23..4....18....5.6..7.8.......9.....85.....9...4.5..47...6...',
  '.2..5.7..4..1....68....3...2....8..3.4..2.5.....6...1...2.9.....9......57.4...9..',
  '1....7.9..3..2...8..96..5....53..9...1..8...26....4...3......1..4......7..7...3..'
];

const SINGLES = new Set<Tech>(['FULL_HOUSE', 'NAKED_SINGLE', 'HIDDEN_SINGLE']);

type Drawing = Record<string, unknown>;
interface Snapshot {
  examples: Record<string, Drawing>;
  paths: Record<string, Drawing>;
}

/** every number to 0.01, and no -0, so a drawing reads the same however its sums were rounded */
const rounded = (x: unknown): unknown => {
  if (typeof x === 'number') {
    const n = Math.round(x * 100) / 100;
    return n === 0 ? 0 : n;
  }
  if (Array.isArray(x)) return x.map(rounded);
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, rounded(v)]));
  return x;
};

/** a mark per candidate, in cell and digit order */
const perCandidate = <K>(m: Map<number, Map<number, K>>): [number, number, K][] =>
  [...m]
    .flatMap(([cell, ds]) => [...ds].map(([digit, kind]): [number, number, K] => [cell, digit, kind]))
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);

/**
 * What a step draws at a position: `values` the board's digits, '0' for an
 * empty cell, as an example stores them; `cands` every cell's candidates
 */
function drawingOf(step: Step, values: string, cands: ArrayLike<number>): Drawing {
  const solved = (cell: number) => values[cell] !== '0';
  const frames = walkFrames(step);
  // the full view, then every frame of the walk
  const views: (Frame | null)[] = [null, ...frames];
  const marks = views.map((frame) => frameMarks(step, frame, solved));
  return {
    frames: frames.map((f) => ({ text: f.text, links: f.links, show: [...f.show].sort() })),
    marks: marks.map((m) => ({
      cands: perCandidate(m.cands),
      inside: perCandidate(m.inside),
      values: [...m.values].sort((a, b) => a[0] - b[0]),
      bands: m.bands.map((b): [number, string] => [b.unit, b.role]).sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0)),
      refuted: m.refuted
    })),
    legendKinds: marks.map((m) => {
      const k = legendKinds(step, m);
      return {
        shown: [...k.shown].sort(),
        onValue: [...k.onValue].sort(),
        onBand: [...k.onBand].sort(),
        intoRemove: k.intoRemove,
        intoPlace: k.intoPlace,
        refuted: k.refuted
      };
    }),
    legendOf: views.map((frame) => legendOf(step, values, frame)),
    geometry: geometryOf(step, values, cands)
  };
}

/**
 * The arrows, start dots and walk numbers as the app board works them out
 * (src/ui/Grid.tsx, `drawing`): once for the whole hint, from the full
 * view's marks and every link, with the candidates on, so a cell shows its
 * candidates and the digits the hint marks at their places on the 3×3
 */
function geometryOf(step: Step, values: string, cands: ArrayLike<number>): unknown {
  if (!step.links?.length) return null;
  const solved = (cell: number) => values[cell] !== '0';
  const full = frameMarks(step, null, solved);
  const marks = markedCandidates(full);
  const placed = placedKeys(full);
  const shown = (cd: CellDigit) =>
    digitShown({ value: Number(values[cd.cell]), corner: 0, center: 0 }, cd.digit, cands[cd.cell], full.cands.get(cd.cell));
  const layout = boardLayout(placed, shown, solved);
  const shapes = arrowShapes(step.links, layout, marks);
  const dots = startMarkers(step.links, layout, marks, shapes);
  const badges = [...badgePoints(shapes, layout, marks, dots)].sort((a, b) => a[0] - b[0]);
  return rounded({ shapes, dots, badges });
}

/** every drawing the fixture holds, worked out from the code as it is */
function snapshot(): Snapshot {
  const examples: Record<string, Drawing> = {};
  for (const tech of Object.keys(EXAMPLES).sort() as Tech[]) {
    if (COLOURING.has(tech)) continue;
    const ex = EXAMPLES[tech]!;
    examples[tech] = drawingOf(ex.step, ex.values, ex.cands);
  }
  const paths: Record<string, Drawing> = {};
  for (const [pi, puzzle] of HARD.entries()) {
    const g = parseGrid(puzzle)!;
    for (let i = 0; i < 300 && !isSolved(g); i++) {
      const step = findNextStep(g);
      if (!step) break;
      // where the solver needs more than a single, every derived chain on offer
      if (!SINGLES.has(step.tech)) {
        const values = Array.from(g.values).join('');
        for (const s of findAllSteps(g)) {
          if (s.truth !== 'derived' || COLOURING.has(s.tech)) continue;
          paths[`hard ${pi}, step ${i}, ${s.tech}`] = drawingOf(s, values, g.cands);
        }
      }
      applyStep(g, step);
    }
  }
  // as plain data, the way the fixture reads back
  return JSON.parse(JSON.stringify({ examples, paths }));
}

/** the fixture's text: a line for each part of each drawing, so a diff says which part changed */
function fixtureText(s: Snapshot): string {
  const section = (drawings: Record<string, Drawing>) =>
    Object.entries(drawings)
      .map(
        ([id, d]) =>
          `  ${JSON.stringify(id)}: {\n` +
          Object.entries(d)
            .map(([part, v]) => `   ${JSON.stringify(part)}: ${JSON.stringify(v)}`)
            .join(',\n') +
          '\n  }'
      )
      .join(',\n');
  return `{\n "examples": {\n${section(s.examples)}\n },\n "paths": {\n${section(s.paths)}\n }\n}\n`;
}

describe('the drawings phase 3 leaves alone are drawn as they were', () => {
  let now: Snapshot;
  let then: Snapshot;
  beforeAll(() => {
    now = snapshot();
    if (env.DRAWING_SNAPSHOT === 'write') writeFileSync(FIXTURE, fixtureText(now));
    then = JSON.parse(new TextDecoder().decode(readFileSync(FIXTURE)));
  }, 120_000);

  it('the same stored examples and the same chain steps along the solve paths', () => {
    expect(Object.keys(now.examples)).toEqual(Object.keys(then.examples));
    expect(Object.keys(now.paths)).toEqual(Object.keys(then.paths));
    // every stored example that is not a colouring, and chains of many kinds
    expect(Object.keys(now.examples).length).toBe(Object.keys(EXAMPLES).filter((t) => !COLOURING.has(t as Tech)).length);
    expect(Object.keys(now.paths).length).toBeGreaterThan(80);
    expect(new Set(Object.keys(now.paths).map((id) => id.split(', ')[2])).size).toBeGreaterThanOrEqual(10);
  });

  it('each stored example: its frames, marks, legends and geometry', () => {
    for (const [id, d] of Object.entries(then.examples)) {
      for (const part of Object.keys(d)) expect.soft(now.examples[id]?.[part], `${id}: ${part}`).toEqual(d[part]);
    }
  });

  it('each chain step on the solve paths: its frames, marks, legends and geometry', () => {
    for (const [id, d] of Object.entries(then.paths)) {
      for (const part of Object.keys(d)) expect.soft(now.paths[id]?.[part], `${id}: ${part}`).toEqual(d[part]);
    }
  });

  it('a fixture written by this test reads back as the drawings it was written from', () => {
    expect(JSON.parse(fixtureText(now))).toEqual(now);
  });
});
