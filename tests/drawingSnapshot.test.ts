/**
 * The drawings each phase leaves as they are (docs/hint-drawing-colouring.md
 * and docs/hint-drawing-sets.md, "How it is checked"), in two fixtures.
 *
 * tests/fixtures/drawingSnapshot.json holds every hint drawing that is
 * neither a colouring (phase 3's) nor one of the eight set techniques
 * (phase 4's: AIC with Groups, AIC with ALS, Grouped Nice Loop, Grouped
 * X-Cycles, ALS-XZ, ALS-XY-Wing, ALS-XY-Chain and Death Blossom): every
 * other stored example, and every other derived chain step on offer along
 * the solve paths of six hard puzzles, where the solver needs more than a
 * single (as tests/truth.test.ts walks them). It was taken before phase 3
 * changed anything and split off in phase 4's first stage, every drawing in
 * it unchanged; phase 4 never rewrites it.
 *
 * tests/fixtures/setDrawings.json holds the set techniques: their stored
 * examples, every step of theirs on offer along the same paths whatever its
 * truth, and the design's named positions (the true group, the Grouped
 * Nice Loop pair, rule 3, the two ALS-XY-Chains whose sets share a cell,
 * and the rest). Phase 4 rewrites it on purpose, stage by stage, each time
 * in a commit that names the drawings it changes.
 *
 * Each entry off the stored examples keeps its position (the puzzle, the
 * board's digits and every cell's candidates), and its step is found again
 * at that position, so a change to the solver that moves a solve path
 * cannot move the entry. For each drawing:
 * - the walk's frames: each one's sentence, the links it has reached and
 *   the parts it shows (src/engine/hintFrames.ts walkFrames);
 * - the marks of the full view and of every frame (src/content/hintMarks.ts
 *   frameMarks): the candidates' kinds, the colours inside a ring, the solved
 *   digits' colours, the bands, whether the premise is refuted, and the
 *   groups drawn on their bars, sorted;
 * - for the same views, the kinds a legend shows (legendKinds) and the
 *   Learn legend (src/content/boardSvg.ts legendOf);
 * - the arrows, the start dots and the walk's numbers the app board draws
 *   (src/content/hintGeometry.ts), and its groups' bars, worked out as
 *   src/ui/Grid.tsx works them out, with the candidates on and every number
 *   rounded to 0.01.
 * A part a step without groups draws nothing of (a bar, a group's style)
 * is left out of its drawing, so the drawings outside the set techniques
 * read as they did before phase 4 drew any.
 *
 * Only a deliberate change to the set techniques' drawings, named in the
 * commit that makes it, writes their fixture again, at the positions it
 * holds:
 *
 *   DRAWING_SNAPSHOT=write-sets npx vitest run tests/drawingSnapshot.test.ts
 *
 * and `DRAWING_SNAPSHOT=write-all` walks the paths and the named positions
 * afresh and writes both fixtures, which phase 4 does once, to split them.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { env } from 'node:process';
import { EXAMPLES } from '../src/content/examples';
import { parseGrid, isSolved } from '../src/engine/board';
import type { Grid } from '../src/engine/board';
import { findNextStep, findAllSteps, findStep, applyStep } from '../src/engine/humanSolver';
import { walkFrames } from '../src/engine/hintFrames';
import type { Frame } from '../src/engine/hintFrames';
import { frameMarks, legendKinds, markedCandidates, placedKeys, squareKeys } from '../src/content/hintMarks';
import { legendOf } from '../src/content/boardSvg';
import { arrowShapes, startMarkers, badgePoints, setShapes } from '../src/content/hintGeometry';
import { boardLayout, digitShown } from '../src/ui/boardLayout';
import type { CellDigit, Step } from '../src/engine/steps';
import type { Tech } from '../src/engine/ratings';

const FIXTURE = 'tests/fixtures/drawingSnapshot.json';
const SET_FIXTURE = 'tests/fixtures/setDrawings.json';

/** the techniques phase 3 draws as colourings: every other drawing stays */
const COLOURING = new Set<Tech>(['SIMPLE_COLORS', 'MULTI_COLORS', 'MEDUSA_3D', 'REMOTE_PAIR']);

/** the techniques phase 4 draws with their sets (docs/hint-drawing-sets.md): their own fixture */
const SETS = new Set<Tech>([
  'AIC_GROUPED',
  'AIC_ALS',
  'GROUPED_NICE_LOOP',
  'GROUPED_X_CYCLES',
  'ALS_XZ',
  'ALS_XY_WING',
  'ALS_XY_CHAIN',
  'DEATH_BLOSSOM'
]);

/** the solve paths, tests/truth.test.ts's hard puzzles */
const HARD = [
  '52...6.........7.13...........4..8..6......5...........418.........3..2...87.....',
  '4.....8.5.3..........7......2.....6.....8.4......1.......6.3.7.5..2.....1.4......',
  '..53.....8......2..7..1.5..4....53...1..7...6..32...8..6.5....9..4....3......97..',
  '.......12........3..23..4....18....5.6..7.8.......9.....85.....9...4.5..47...6...',
  '.2..5.7..4..1....68....3...2....8..3.4..2.5.....6...1...2.9.....9......57.4...9..',
  '1....7.9..3..2...8..96..5....53..9...1..8...26....4...3......1..4......7..7...3..'
];

/**
 * The set fixture's named positions (docs/hint-drawing-sets.md, Per
 * technique and How it is checked): a puzzle, how many of the solver's
 * steps come before the position, and the technique's step there, the
 * solver's own but for the two-digit stem, which a solver never takes (an
 * ALS-XY-Wing comes first)
 */
const NAMED: { name: string; puzzle: string; at: number; tech: Tech }[] = [
  { name: 'the true group', puzzle: '..5...2...7..14...6.........94..6..571.9.2.......3..8.......8..1..5...96.39.2..4.', at: 18, tech: 'AIC_GROUPED' },
  { name: 'the Grouped Nice Loop pair', puzzle: '.13.5......6...8.......34...2..6...5...2.1....39....6.68..7..2.1..8....4......9..', at: 10, tech: 'GROUPED_NICE_LOOP' },
  { name: 'the gapped group over a solved cell', puzzle: '.1.........7.....1.9...32.51..58...9......76....9......54.......2.81.5.......98.7', at: 20, tech: 'GROUPED_X_CYCLES' },
  { name: 'rule 3', puzzle: '.4...2.6.8.2.....51..4.8...4....1..7..5.7.6..3..5....4...1.9..66.....9.2.9.2...5.', at: 14, tech: 'GROUPED_X_CYCLES' },
  { name: 'the short link', puzzle: '..652....32.8...6..9.76.1.....39...8....5..3.1.26....9......5.4.5.....8...9....21', at: 16, tech: 'ALS_XZ' },
  { name: 'wings that touch', puzzle: '..8.....1.61.9.......7..5...7.5....431..8..756....3.8...3..6.......4.23.1.....8..', at: 33, tech: 'ALS_XY_WING' },
  { name: 'a two-digit stem', puzzle: '1.9..3.......9.5.....5.281.2..........18.....86.3...249.....1........63.5..76...8', at: 43, tech: 'DEATH_BLOSSOM' },
  { name: 'shared cells that derive', puzzle: '.37.4......67.8...........972.....61..91.54..14.....856...........9.28......8.23.', at: 25, tech: 'ALS_XY_CHAIN' },
  { name: 'shared cells that clash', puzzle: '..2....61...5.....7.4.....3.......3.42..3.9..3...9267..9.3...5.56.1.......3.8....', at: 15, tech: 'ALS_XY_CHAIN' },
  { name: 'a clash in a false group', puzzle: '7..1.4..9....694....25.....56.....1...4...7...1.....24.....69....591....3..2.5..6', at: 29, tech: 'ALS_XY_CHAIN' },
  { name: 'a clash that closes', puzzle: '..9.2..6....56........714..3.......6.5...2.98..4...5..4.........3.7..1....7.5..32', at: 16, tech: 'ALS_XY_CHAIN' }
];

const SINGLES = new Set<Tech>(['FULL_HOUSE', 'NAKED_SINGLE', 'HIDDEN_SINGLE']);

/** a position: the puzzle (its givens), the board's digits, '0' for an empty cell, and every cell's candidates */
interface Position {
  puzzle: string;
  values: string;
  cands: number[];
}
type Drawing = Record<string, unknown>;
/** a fixture's sections, by name: 'examples' by technique, the others by entry, each with its position */
type Snapshot = Record<string, Record<string, Drawing>>;

/** an entry's technique: the last part of its name */
const techOf = (id: string) => id.split(', ').at(-1) as Tech;

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
      refuted: m.refuted,
      ...(m.sets.length ? { sets: m.sets.map((x): [number, string] => [x.set, x.style]) } : {})
    })),
    legendKinds: marks.map((m) => {
      const k = legendKinds(step, m);
      return {
        shown: [...k.shown].sort(),
        onValue: [...k.onValue].sort(),
        onBand: [...k.onBand].sort(),
        intoRemove: k.intoRemove,
        intoPlace: k.intoPlace,
        refuted: k.refuted,
        ...(k.bars.size ? { bars: [...k.bars].sort() } : {}),
        ...(k.setSquares ? { setSquares: true } : {})
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
 * candidates and the digits the hint marks at their places on the 3×3; and
 * the groups' bars first, which they keep off, a square any frame draws
 * reaching further than a disc
 */
function geometryOf(step: Step, values: string, cands: ArrayLike<number>): unknown {
  if (!step.links?.length) return null;
  const solved = (cell: number) => values[cell] !== '0';
  const full = frameMarks(step, null, solved);
  const marks = markedCandidates(full);
  const placed = placedKeys(full);
  const shown = (cd: CellDigit) =>
    digitShown({ value: Number(values[cd.cell]), corner: 0, center: 0 }, cd.digit, cands[cd.cell], full.cands.get(cd.cell));
  const layout = boardLayout(placed, shown, solved, squareKeys(step, solved));
  const sets = setShapes(step, layout, marks);
  const shapes = arrowShapes(step.links, layout, marks, sets);
  const dots = startMarkers(step.links, layout, marks, shapes, sets);
  const badges = [...badgePoints(shapes, layout, marks, dots, sets)].sort((a, b) => a[0] - b[0]);
  return rounded({ shapes, dots, badges, ...(sets.bars.length ? { bars: sets.bars } : {}) });
}

/** a grid's position, to keep */
const positionOf = (puzzle: string, g: Grid): Position => ({ puzzle, values: Array.from(g.values).join(''), cands: Array.from(g.cands) });

/** the grid at a kept position: the puzzle's givens, the kept digits and candidates */
function gridAt(p: Position): Grid {
  const g = parseGrid(p.puzzle)!;
  for (let cell = 0; cell < 81; cell++) {
    g.values[cell] = Number(p.values[cell]);
    g.cands[cell] = p.cands[cell];
  }
  return g;
}

/** an entry's drawing, found again at its position: the position first, then the parts */
function entryAt(id: string, position: Position): Drawing {
  const tech = techOf(id);
  const step = findStep(tech, gridAt(position));
  // a technique no longer found here, or found as another, fails every part
  if (step?.tech !== tech) return { position };
  return { position, ...drawingOf(step, position.values, position.cands) };
}

/** the stored examples of the techniques a fixture holds */
function examplesOf(holds: (tech: Tech) => boolean): Record<string, Drawing> {
  const examples: Record<string, Drawing> = {};
  for (const tech of Object.keys(EXAMPLES).sort() as Tech[]) {
    if (!holds(tech)) continue;
    const ex = EXAMPLES[tech]!;
    examples[tech] = drawingOf(ex.step, ex.values, ex.cands);
  }
  return examples;
}

/** the entries of a section, each drawn again at the position it keeps */
const entriesAt = (section: Record<string, Drawing>): Record<string, Drawing> =>
  Object.fromEntries(Object.entries(section).map(([id, d]) => [id, entryAt(id, d.position as Position)]));

/** whether the fixture outside the sets holds a technique: neither a colouring nor a set technique */
const plain = (tech: Tech) => !COLOURING.has(tech) && !SETS.has(tech);

/**
 * Both fixtures afresh, for `write-all`: the stored examples; along the
 * hard paths, where the solver needs more than a single, every derived
 * chain step on offer outside the colourings and the set techniques for
 * the one, and every set technique's step on offer whatever its truth for
 * the other; and the named positions, after their solver's steps. Each
 * entry is drawn at its kept position, as the test draws it.
 */
function walked(): { plain: Snapshot; sets: Snapshot } {
  const plainPaths: Record<string, Drawing> = {};
  const setPaths: Record<string, Drawing> = {};
  for (const [pi, puzzle] of HARD.entries()) {
    const g = parseGrid(puzzle)!;
    for (let i = 0; i < 300 && !isSolved(g); i++) {
      const step = findNextStep(g);
      if (!step) break;
      if (!SINGLES.has(step.tech)) {
        for (const s of findAllSteps(g)) {
          const id = `hard ${pi}, step ${i}, ${s.tech}`;
          if (SETS.has(s.tech)) setPaths[id] = entryAt(id, positionOf(puzzle, g));
          else if (s.truth === 'derived' && !COLOURING.has(s.tech)) plainPaths[id] = entryAt(id, positionOf(puzzle, g));
        }
      }
      applyStep(g, step);
    }
  }
  const named: Record<string, Drawing> = {};
  for (const n of NAMED) {
    const g = parseGrid(n.puzzle)!;
    for (let i = 0; i < n.at; i++) applyStep(g, findNextStep(g)!);
    const id = `${n.name}, step ${n.at}, ${n.tech}`;
    named[id] = entryAt(id, positionOf(n.puzzle, g));
  }
  return {
    plain: { examples: examplesOf(plain), paths: plainPaths },
    sets: { examples: examplesOf((tech) => SETS.has(tech)), paths: setPaths, named }
  };
}

/** the set fixture drawn again at the positions it keeps */
const setsAt = (kept: Snapshot): Snapshot => ({
  examples: examplesOf((tech) => SETS.has(tech)),
  paths: entriesAt(kept.paths),
  named: entriesAt(kept.named)
});

let fresh: ReturnType<typeof walked> | undefined;
/** the fixtures each value of DRAWING_SNAPSHOT writes, and what it writes in them */
const WRITES: Record<string, Record<string, () => Snapshot>> = {
  // at the positions the set fixture keeps, never the paths' positions now
  'write-sets': { [SET_FIXTURE]: () => setsAt(read(SET_FIXTURE)) },
  'write-all': { [FIXTURE]: () => (fresh ??= walked()).plain, [SET_FIXTURE]: () => (fresh ??= walked()).sets }
};

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
  return `{\n${Object.entries(s)
    .map(([name, drawings]) => ` ${JSON.stringify(name)}: {\n${section(drawings)}\n }`)
    .join(',\n')}\n}\n`;
}

const read = (path: string): Snapshot => JSON.parse(new TextDecoder().decode(readFileSync(path)));
/** the techniques a fixture holds: its examples', and its entries' */
const techsIn = (s: Snapshot): Tech[] => [
  ...Object.keys(s.examples),
  ...Object.entries(s)
    .filter(([name]) => name !== 'examples')
    .flatMap(([, entries]) => Object.keys(entries).map(techOf))
] as Tech[];

/** each part of each drawing a fixture holds, as the code draws it now */
function sameDrawings(now: Snapshot, then: Snapshot, name: string) {
  for (const [id, d] of Object.entries(then[name])) {
    for (const part of Object.keys(d)) expect.soft(now[name]?.[id]?.[part], `${id}: ${part}`).toEqual(d[part]);
  }
}

let plainNow: Snapshot;
let plainThen: Snapshot;
let setsNow: Snapshot;
let setsThen: Snapshot;
beforeAll(() => {
  const flag = env.DRAWING_SNAPSHOT;
  if (flag !== undefined) {
    if (!WRITES[flag]) throw new Error(`DRAWING_SNAPSHOT=${flag}: write-sets or write-all`);
    for (const [path, drawings] of Object.entries(WRITES[flag])) writeFileSync(path, fixtureText(drawings()));
  }
  plainThen = read(FIXTURE);
  setsThen = read(SET_FIXTURE);
  plainNow = { examples: examplesOf(plain), paths: entriesAt(plainThen.paths) };
  setsNow = setsAt(setsThen);
}, 300_000);

describe('the drawings phases 3 and 4 leave alone are drawn as they were', () => {
  it('the same stored examples and the same chain steps, at the positions kept', () => {
    expect(Object.keys(plainThen)).toEqual(['examples', 'paths']);
    expect(Object.keys(plainNow.examples)).toEqual(Object.keys(plainThen.examples));
    // every stored example that is neither a colouring nor a set technique,
    // and chains of seven kinds
    expect(Object.keys(plainNow.examples).length).toBe(Object.keys(EXAMPLES).filter((t) => plain(t as Tech)).length);
    expect(Object.keys(plainThen.examples).length).toBe(53);
    expect(Object.keys(plainThen.paths).length).toBe(45);
    expect(new Set(Object.keys(plainThen.paths).map(techOf)).size).toBe(7);
  });

  it('hold no colouring and no set technique', () => {
    expect(techsIn(plainThen).filter((tech) => !plain(tech))).toEqual([]);
  });

  it('each stored example: its frames, marks, legends and geometry', () => {
    sameDrawings(plainNow, plainThen, 'examples');
  });

  it('each chain step on the solve paths: its frames, marks, legends and geometry', () => {
    sameDrawings(plainNow, plainThen, 'paths');
  });
});

describe("the set techniques' drawings are drawn as the set fixture last wrote them", () => {
  it('every set example, every set step on offer along the paths, and the named positions', () => {
    expect(Object.keys(setsThen)).toEqual(['examples', 'paths', 'named']);
    expect(Object.keys(setsNow.examples)).toEqual(Object.keys(setsThen.examples));
    expect(Object.keys(setsThen.examples)).toEqual([...SETS].sort());
    expect(Object.keys(setsThen.named)).toEqual(NAMED.map((n) => `${n.name}, step ${n.at}, ${n.tech}`));
    // the 49 grouped chains the paths offered before phase 4, derived, and
    // the ALS patterns beside them, which are not yet
    const count: Record<string, number> = {};
    for (const tech of Object.keys(setsThen.paths).map(techOf)) count[tech] = (count[tech] ?? 0) + 1;
    expect(count).toEqual({
      AIC_GROUPED: 10,
      AIC_ALS: 8,
      GROUPED_NICE_LOOP: 16,
      GROUPED_X_CYCLES: 15,
      ALS_XZ: 16,
      ALS_XY_WING: 14,
      ALS_XY_CHAIN: 16,
      DEATH_BLOSSOM: 8
    });
  });

  it('hold only set techniques', () => {
    expect(techsIn(setsThen).filter((tech) => !SETS.has(tech))).toEqual([]);
  });

  it('each stored example, each step on the paths and each named position: its frames, marks, legends and geometry', () => {
    sameDrawings(setsNow, setsThen, 'examples');
    sameDrawings(setsNow, setsThen, 'paths');
    sameDrawings(setsNow, setsThen, 'named');
  });
});

describe('the fixtures', () => {
  it('are written only on request, and write-sets writes only the set fixture', () => {
    expect(Object.keys(WRITES)).toEqual(['write-sets', 'write-all']);
    expect(Object.keys(WRITES['write-sets'])).toEqual([SET_FIXTURE]);
    expect(Object.keys(WRITES['write-all'])).toEqual([FIXTURE, SET_FIXTURE]);
  });

  it('read back as the drawings they were written from', () => {
    expect(JSON.parse(fixtureText(plainNow))).toEqual(plainNow);
    expect(JSON.parse(fixtureText(setsNow))).toEqual(setsNow);
  });

  it('keep each entry\'s position, where its step is found again', () => {
    for (const s of [plainThen, setsThen]) {
      for (const [name, entries] of Object.entries(s)) {
        if (name === 'examples') continue;
        for (const [id, d] of Object.entries(entries)) {
          const p = d.position as Position;
          expect(p.values.length, id).toBe(81);
          expect(p.cands.length, id).toBe(81);
          // the puzzle's givens are on the board
          for (let cell = 0; cell < 81; cell++) if (p.puzzle[cell] !== '.') expect(p.values[cell], id).toBe(p.puzzle[cell]);
          expect(findStep(techOf(id), gridAt(p))?.tech, id).toBe(techOf(id));
        }
      }
    }
  });
});
