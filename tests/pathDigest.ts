/**
 * Every solve path, held step by step (docs/hint-drawing-sets.md, "How it
 * is checked" and decision 23). Phase 4 changes what the set techniques'
 * finders say about their steps (their sets, their links' set ends, their
 * words and drawings), never what they find, so no solve path, rating or
 * level may move. Held two ways against tests/fixtures/pathDigest.json,
 * taken in phase 4's first stage, before any finder changed:
 * - for every puzzle of the practice pools and the seeds, the six hard
 *   puzzles of tests/drawingSnapshot.test.ts and the stored examples'
 *   puzzles, a hash of its solve path: each step's technique, placements
 *   and removals;
 * - for every puzzle of the pools and the seeds, a hash of what the set
 *   techniques' finders first find along its path (their menus), at every
 *   position where the solver needs more than a single, as phase 4's maps
 *   counted menus (at the singles' positions too they would take several
 *   times as long): each find's technique, placements and removals.
 * A hash is FNV-1a, 32 bits, as tests/fixtures/colouringRemovals.json's,
 * after the number of lines it is taken over.
 *
 * The same walk holds the steps it meets to their sets' rules
 * (tests/chainSets.ts, for tests/chainSets.test.ts): every step of every
 * path, and every find of the set techniques along the pools' and the
 * seeds' paths, so the minutes it takes are not spent twice.
 *
 * The finders take about eight minutes over all of it, so the puzzles are
 * dealt to four test files, tests/pathDigest.test.ts and
 * tests/pathDigest.2.test.ts to .4, which run side by side; each holds
 * its own share, and the first also that the fixture holds every puzzle.
 * Not a test file itself. Phase 4 never rewrites the fixture; only a
 * change that means to move a path or a menu, named in the commit that
 * makes it, writes it again, from the first file, which then works out
 * every share:
 *
 *   PATH_DIGEST=write npx vitest run tests/pathDigest.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { env } from 'node:process';
import practice from '../src/content/practicePuzzles.json';
import seeds from '../src/content/seeds.json';
import { EXAMPLES } from '../src/content/examples';
import { parseGrid, isSolved } from '../src/engine/board';
import { findNextStep, findStep, applyStep } from '../src/engine/humanSolver';
import type { CellDigit, Step } from '../src/engine/steps';
import type { Tech } from '../src/engine/ratings';
import { setProblems } from './chainSets';

const FIXTURE = 'tests/fixtures/pathDigest.json';

/** the test files the puzzles are dealt to */
export const SHARDS = 4;

/** tests/drawingSnapshot.test.ts's hard puzzles (tests/truth.test.ts's) */
const HARD = [
  '52...6.........7.13...........4..8..6......5...........418.........3..2...87.....',
  '4.....8.5.3..........7......2.....6.....8.4......1.......6.3.7.5..2.....1.4......',
  '..53.....8......2..7..1.5..4....53...1..7...6..32...8..6.5....9..4....3......97..',
  '.......12........3..23..4....18....5.6..7.8.......9.....85.....9...4.5..47...6...',
  '.2..5.7..4..1....68....3...2....8..3.4..2.5.....6...1...2.9.....9......57.4...9..',
  '1....7.9..3..2...8..96..5....53..9...1..8...26....4...3......1..4......7..7...3..'
];

/**
 * The finders of the eight set techniques: one engine gives both AIC with
 * Groups and AIC with ALS, naming each step by what it holds
 */
const SET_FINDERS: Tech[] = ['GROUPED_X_CYCLES', 'GROUPED_NICE_LOOP', 'AIC_GROUPED', 'ALS_XZ', 'ALS_XY_WING', 'ALS_XY_CHAIN', 'DEATH_BLOSSOM'];

const SINGLES = new Set<Tech>(['FULL_HOUSE', 'NAKED_SINGLE', 'HIDDEN_SINGLE']);

interface Digest {
  /** a puzzle's solve path: how many steps, and their hash */
  paths: Record<string, string>;
  /** the set techniques' first finds along a pool's or a seed's path: how many, and their hash */
  sets: Record<string, string>;
}

/** FNV-1a, 32 bits, as hex */
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
/** some lines' digest: how many, and their hash */
const hashOf = (lines: string[]) => `${lines.length}:${fnv(lines.join('\n'))}`;

/** a candidate's name, 4r1c5 */
const nameOf = (x: CellDigit) => `${x.digit}r${Math.floor(x.cell / 9) + 1}c${(x.cell % 9) + 1}`;
/** what a step does: its technique, what it places and what it removes */
const said = (s: Step) => `${s.tech} +${s.placements.map(nameOf).join(' ')} -${s.eliminations.map(nameOf).join(' ')}`;

const puzzlesOf = (pools: Record<string, { puzzle: string }[]>) => Object.values(pools).flat().map((p) => p.puzzle);
/** the pools' and the seeds' puzzles, whose menus are held too */
const POOLED = [...new Set([...puzzlesOf(practice as Record<string, { puzzle: string }[]>), ...puzzlesOf(seeds as Record<string, { puzzle: string }[]>)])];
/**
 * the stored examples' puzzles a later stage of phase 4 swapped for others
 * (docs/hint-drawing-sets.md, decision 22), whose paths are still held as
 * when the fixture was taken: the Grouped Nice Loop's (the AIC with
 * Groups' was a pool's puzzle, and both new ones are)
 */
const SWAPPED = ['.....72.4..83.9.76...5..1..4..871...............496..2..6..4...34.7.56..7.91.....'];
/** every puzzle whose path is held, in the fixture's order but for a swapped example's, which the fixture holds where the example stood */
const PUZZLES = [...new Set([...POOLED, ...HARD, ...Object.values(EXAMPLES).map((ex) => ex!.puzzle), ...SWAPPED])];

/** what the walk finds wrong with the sets of the steps it meets, and how many of them have sets */
interface SetsMet {
  problems: string[];
  withSets: number;
}

/** a puzzle's solve path, and the set techniques' first finds along it; each step met held to its sets' rules */
function walk(puzzle: string, menus: boolean, met: SetsMet): { path: string[]; sets: string[] } {
  const g = parseGrid(puzzle)!;
  const path: string[] = [];
  const sets: string[] = [];
  const hold = (s: Step, k: number) => {
    for (const p of setProblems(s, g.cands)) met.problems.push(`${puzzle}, step ${k}, ${s.tech}: ${p}`);
    if (s.sets) met.withSets++;
  };
  for (let k = 0; k < 400 && !isSolved(g); k++) {
    const step = findNextStep(g);
    if (!step) break;
    path.push(`${k} ${said(step)}`);
    hold(step, k);
    // the menu, where the solver needs more than a single
    if (menus && !SINGLES.has(step.tech)) {
      for (const tech of SET_FINDERS) {
        const s = findStep(tech, g);
        if (s) {
          sets.push(`${k} ${said(s)}`);
          hold(s, k);
        }
      }
    }
    applyStep(g, step);
  }
  return { path, sets };
}

/** the digest of some puzzles, as the code works them out now, and the sets met on the way */
function digestFor(puzzles: string[]): { digest: Digest; met: SetsMet } {
  const d: Digest = { paths: {}, sets: {} };
  const met: SetsMet = { problems: [], withSets: 0 };
  for (const puzzle of puzzles) {
    const menus = POOLED.includes(puzzle);
    const { path, sets } = walk(puzzle, menus, met);
    d.paths[puzzle] = hashOf(path);
    if (menus) d.sets[puzzle] = hashOf(sets);
  }
  return { digest: d, met };
}

/** a share's puzzles: every SHARDS-th, from the shard's own on */
const shareOf = (shard: number) => PUZZLES.filter((_, i) => i % SHARDS === shard);

/** the digest's tests for one share of the puzzles (0 the first, which also writes the fixture) */
export function holdPathDigest(shard: number) {
  const writing = env.PATH_DIGEST !== undefined;
  if (writing && env.PATH_DIGEST !== 'write') throw new Error(`PATH_DIGEST=${env.PATH_DIGEST}: write`);
  // while the first file writes the fixture, the others have nothing to hold it to
  const share = describe.skipIf(writing && shard !== 0);
  share(`the solve paths and the set techniques' finds along them, share ${shard + 1} of ${SHARDS}`, () => {
    const mine = shareOf(shard);
    let now: Digest;
    let then: Digest;
    let met: SetsMet;
    beforeAll(() => {
      const all = writing ? digestFor(PUZZLES) : undefined;
      if (all) writeFileSync(FIXTURE, `${JSON.stringify(all.digest, null, 1)}\n`);
      ({ digest: now, met } = all ?? digestFor(mine));
      then = JSON.parse(new TextDecoder().decode(readFileSync(FIXTURE)));
    }, 1_800_000);

    if (shard === 0) {
      it("the fixture holds the same puzzles: the pools', the seeds', the hard ones and the stored examples'", () => {
        // the same puzzles; a swapped example's puzzle moves to the end of the list
        expect([...Object.keys(then.paths)].sort()).toEqual([...PUZZLES].sort());
        for (const ex of Object.values(EXAMPLES)) expect(PUZZLES).toContain(ex!.puzzle);
        expect(Object.keys(then.sets)).toEqual(POOLED);
        expect(PUZZLES.length).toBe(536);
        expect(POOLED.length).toBe(480);
        for (const puzzle of HARD) expect(PUZZLES).toContain(puzzle);
      });
    }

    it("every solve path: each step's technique, placements and removals", () => {
      const moved = mine.filter((p) => now.paths[p] !== then.paths[p]);
      expect(moved).toEqual([]);
    });

    it("the set techniques' first finds along the pools' and the seeds' paths, where the solver needs more than a single", () => {
      const moved = mine.filter((p) => POOLED.includes(p) && now.sets[p] !== then.sets[p]);
      expect(moved).toEqual([]);
    });

    it("every step met on the way keeps its sets' rules (tests/chainSets.ts)", () => {
      expect(met.problems).toEqual([]);
      // thousands of them with sets in every share
      expect(met.withSets).toBeGreaterThan(1000);
    });
  });
}
