/**
 * How a door of the advent calendar is found (scripts/build-advent.ts,
 * docs/advent-calendar.md): its own seed, the year and the door, and a
 * fixed number of tries, so the same doors come out on any machine while
 * the generator and the rater stay as they are (tests/adventDoors.test.ts makes
 * the first doors again and compares them with advent.json).
 *
 * The owner's decision of 15 November 2026: the doors climb gently, from
 * about 100 to about 1000 (doorTarget), and none needs a technique above
 * Medium. A door is of the level its target's score names (doorLevel):
 * Easy up to 800, a puzzle of singles alone, and Medium up to 1000,
 * singles with pairs, triples and locked candidates. Singles alone do
 * not add up to much more than 640, though (SINGLES_REACH), so the last
 * Easy doors, whose targets lie above that, share the stretch below it
 * (doorAim): each still rated higher than the one before.
 *
 * First, fresh minimal puzzles, rated, the nearest to the door's aim
 * kept; a puzzle rated above it may also have clues of its own solution
 * given back, one at a time, which brings its rating down by the singles
 * it no longer needs (door 1, about 100, is a puzzle of singles with only
 * some 25 empty cells, which no minimal puzzle is). A door those tries do
 * not bring within its tolerance is climbed to (climb): a full grid dug
 * down while the level's techniques still solve it, then walked, a clue
 * taken, given back or moved at a time, towards the aim. Every door has
 * one solution, is solved by the catalogue without guessing with its
 * level's techniques, is rated higher than the door before, and, when
 * Medium, meets its hardest technique on a board with room in it
 * (fitForLevel), as a served puzzle must.
 */
import { generatePuzzle, generateFullGrid, fitForLevel } from '../src/engine/generator';
import { ratePuzzle } from '../src/engine/humanSolver';
import type { Rating } from '../src/engine/humanSolver';
import { parseGrid, gridToString } from '../src/engine/board';
import { solve, countSolutions } from '../src/engine/bruteForce';
import { SOLVE_ORDER, LEVELS, TECHS, levelForScore } from '../src/engine/ratings';
import type { Level, Tech } from '../src/engine/ratings';
import { ADVENT_DOORS, doorDate, doorTarget } from '../src/content/advent';
import type { AdventDoor } from '../src/content/advent';
import { dayToCome, EARLY_DAYS } from '../src/content/dailies';

/** how far from its aim a door may land and still stop the search early */
export const tolerance = (target: number) => Math.max(5, Math.round(target * 0.01));

/** the level a door is: the one its target's score names, Easy up to 800 and Medium up to 1000 */
export const doorLevel = (door: number): Level => levelForScore(doorTarget(door));

/**
 * What a puzzle of singles alone reaches on HoDoKu's scale. A Hidden
 * Single counts 14 and a Full House or a Naked Single 4, and the solver
 * takes the 4 whenever one is there, which it always is for the last 20
 * cells or so: with 21 clues, about the fewest a puzzle of singles has,
 * that leaves some 40 Hidden Singles, 640. Measured, November 2026: of
 * 3000 fresh minimal puzzles the highest Easy one was 550; climbs of
 * 50,000 steps ended at 620 to 640, and of 400,000 at 630 to 654.
 */
export const SINGLES_REACH = 640;

/**
 * The rating a door's search aims at: its target, or, for the last Easy
 * doors, whose targets singles alone do not reach, an even climb from the
 * last target within reach up to the reach itself (doors 15 to 18, at
 * 617, 625, 632 and 640, after door 14's 609): the nearest those doors
 * come to their targets while each is still rated higher than the one
 * before
 */
export function doorAim(door: number): number {
  const target = doorTarget(door);
  if (doorLevel(door) !== 'Easy' || target <= SINGLES_REACH) return target;
  const doors = Array.from({ length: ADVENT_DOORS }, (_, i) => i + 1).filter((d) => doorLevel(d) === 'Easy');
  const within = doors.filter((d) => doorTarget(d) <= SINGLES_REACH);
  const last = within[within.length - 1];
  const top = doors[doors.length - 1];
  return Math.round(doorTarget(last) + ((SINGLES_REACH - doorTarget(last)) * (door - last)) / (top - last));
}

/**
 * What a run may do with a year's doors (scripts/build-advent.ts): `add`
 * a year the file does not have; leave one it has alone (`published`),
 * unless the run asks to replace it, which it may only while the year's
 * first door has not opened anywhere (`replace`): a door somebody may have
 * played never changes (`opened`). A door opens by the player's own date,
 * which is at most a day ahead of UTC's (EARLY_DAYS, as the Worker
 * counts it), so the first door's day has come somewhere once it is no
 * longer after tomorrow's UTC date: from 30 November.
 */
export function yearPlan(published: AdventDoor[], year: number, replace: boolean, now: Date): 'add' | 'published' | 'replace' | 'opened' {
  if (!published.some((d) => d.date.startsWith(`${year}-`))) return 'add';
  if (!replace) return 'published';
  const ahead = new Date(now.getTime() + EARLY_DAYS * 86_400_000).toISOString().slice(0, 10);
  return dayToCome(doorDate(year, 1), ahead) ? 'replace' : 'opened';
}

/** fresh puzzles tried per door at most, before the climb */
const ATTEMPTS = 400;
/** puzzles above the aim that are brought down by giving clues back, per door at most */
const DESCENTS = 300;
/** steps a climb may take in all, and from one full grid before it starts from another */
const CLIMB = 480_000;
const LEG = 40_000;
/** how much further from the aim a step of the climb may land and still be taken, at the start of a grid's walk; it falls to nothing by its end */
const SLACK = 24;

/** mulberry32, seeded from a string by FNV-1a (as src/engine/daily.ts) */
function seeded(key: string): () => number {
  let h = 2166136261;
  for (const ch of key) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  let s = h >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Found {
  puzzle: string;
  rating: Rating;
}

/**
 * Fit to stand behind a door: solved by the catalogue without guessing,
 * of the door's level (so with no technique above it), rated higher than
 * the door before, and when Medium with its crux on a live board
 * (fitForLevel), as a puzzle served for its band must be
 */
const fitFor = (level: Level, floor: number) => (puzzle: string, r: Rating) =>
  r.solvable && r.level === level && r.score > floor && (r.level === 'Easy' || fitForLevel(puzzle, r));

/**
 * A puzzle above the aim, brought down by giving back clues of its own
 * solution, one at a time in a random order: a clue stays when the rating
 * is still at or above the aim's lower edge (on the way the puzzle may
 * pass through levels its score does not name, a Hard step on a score of
 * Medium, which a clue more can take away), and the walk stops at the
 * first fit rating within the tolerance. Every step keeps the solution
 * unique (a clue more never adds one).
 */
function descend(start: Found, target: number, fit: (puzzle: string, r: Rating) => boolean, rnd: () => number): Found | null {
  const tol = tolerance(target);
  const solution = gridToString(solve(parseGrid(start.puzzle)!)!);
  let cur = start;
  let best: Found | null = null;
  for (let round = 0; round < 81; round++) {
    const empty = [...cur.puzzle].flatMap((ch, i) => (ch === '.' ? [i] : []));
    // shuffled with the door's own stream
    for (let i = empty.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [empty[i], empty[j]] = [empty[j], empty[i]];
    }
    let moved = false;
    for (const cell of empty.slice(0, 12)) {
      const puzzle = cur.puzzle.slice(0, cell) + solution[cell] + cur.puzzle.slice(cell + 1);
      const rating = ratePuzzle(puzzle, SOLVE_ORDER);
      if (!rating || !rating.solvable || rating.score < target - tol) continue;
      cur = { puzzle, rating };
      moved = true;
      if (fit(puzzle, rating) && (!best || Math.abs(rating.score - target) < Math.abs(best.rating.score - target))) best = cur;
      break;
    }
    if (!moved || (best && Math.abs(best.rating.score - target) <= tol)) break;
  }
  return best;
}

/** the techniques a door of a level may need, in the solver's order: the singles for Easy, with pairs, triples and locked candidates for Medium */
const orderFor = (level: Level): Tech[] => SOLVE_ORDER.filter((t) => LEVELS.indexOf(TECHS[t].level) <= LEVELS.indexOf(level));

/**
 * The climb, for an aim the fresh puzzles do not come near (singles alone
 * past 500, Medium past 800): a full grid is dug down, a clue at a time
 * in a random order, while the level's techniques still solve it, and
 * then walked: a clue taken away, one given back, or one moved to another
 * cell, kept when the puzzle is still solved by the level's techniques
 * and its rating is no further from the aim than before, or further by
 * no more than a slack that falls to nothing over the grid's walk. The
 * nearest fit puzzle seen is kept, and the climb stops at the first
 * within the tolerance; a grid that does not get there in its steps
 * gives way to another. A puzzle those techniques solve has one solution
 * (they only ever rule out what cannot be), and its rating is the full
 * catalogue's, whose first techniques they are.
 */
function climb(aim: number, level: Level, fit: (puzzle: string, r: Rating) => boolean, rnd: () => number): { found: Found | null; steps: number } {
  const tol = tolerance(aim);
  const order = orderFor(level);
  const rate = (cells: string[]) => ratePuzzle(cells.join(''), order, { maxLevel: level });
  const off = (score: number) => Math.abs(score - aim);
  let best: Found | null = null;
  let steps = 0;
  const near = () => !!best && off(best.rating.score) <= tol;
  const see = (cells: string[], rating: Rating) => {
    const puzzle = cells.join('');
    if (fit(puzzle, rating) && (!best || off(rating.score) < off(best.rating.score))) best = { puzzle, rating };
  };
  const pick = (cells: string[], clue: boolean) => {
    const of = cells.flatMap((ch, i) => ((ch !== '.') === clue ? [i] : []));
    return of[Math.floor(rnd() * of.length)];
  };
  while (steps < CLIMB && !near()) {
    const solution = gridToString(generateFullGrid(rnd));
    const cells = solution.split('');
    let score = 0;
    const cut = Array.from({ length: 81 }, (_, i) => i);
    for (let i = cut.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [cut[i], cut[j]] = [cut[j], cut[i]];
    }
    for (const cell of cut) {
      cells[cell] = '.';
      const rating = rate(cells);
      if (!rating) cells[cell] = solution[cell];
      else {
        score = rating.score;
        see(cells, rating);
      }
    }
    for (let i = 0; i < LEG && steps < CLIMB && !near(); i++, steps++) {
      const slack = Math.round(SLACK * (1 - i / LEG));
      const kind = rnd();
      // a clue taken away, one given back, or one moved
      const take = kind < 0.3 || kind >= 0.4 ? pick(cells, true) : -1;
      const give = kind >= 0.3 ? pick(cells, false) : -1;
      if (take >= 0) cells[take] = '.';
      if (give >= 0) cells[give] = solution[give];
      const rating = rate(cells);
      if (rating && off(rating.score) <= off(score) + slack) {
        score = rating.score;
        see(cells, rating);
      } else {
        if (take >= 0) cells[take] = solution[take];
        if (give >= 0) cells[give] = '.';
      }
    }
  }
  return { found: best, steps };
}

/** a door as found: all it publishes but the solution's hash, which its caller makes from `solution` (node:crypto, in scripts/build-advent.ts) */
export type FoundDoor = Omit<AdventDoor, 'solutionHash'>;

/**
 * The door's puzzle: of its level, rated higher than the door before
 * (`before`, its rating; 0 for door 1), and the nearest to the door's aim
 * that the fresh puzzles, and then the climb, turn up, each stopping at
 * the first within the tolerance
 */
export function makeDoor(year: number, door: number, before: number): { door: FoundDoor; solution: string; tries: number; descents: number; steps: number } {
  const aim = doorAim(door);
  const tol = tolerance(aim);
  const level = doorLevel(door);
  const fit = fitFor(level, before);
  const rnd = seeded(`sudokui-advent-${year}-${door}`);
  const original = Math.random;
  Math.random = rnd;
  let best: Found | null = null;
  let tries = 0;
  let descents = 0;
  let steps = 0;
  const off = (f: Found | null) => (f ? Math.abs(f.rating.score - aim) : Infinity);
  const take = (f: Found | null) => {
    if (f && off(f) < off(best)) best = f;
  };
  const done = () => off(best) <= tol;
  try {
    while (tries < ATTEMPTS && !done()) {
      tries++;
      const grid = generatePuzzle(rnd() < 0.7 ? 'rotational' : 'none');
      const puzzle = gridToString(grid);
      const rating = ratePuzzle(puzzle, SOLVE_ORDER);
      if (!rating || !rating.solvable) continue;
      const found = { puzzle, rating };
      if (fit(puzzle, rating)) take(found);
      // above the aim (and not wildly so, where a clue given back
      // would undo the crux before the singles): brought down
      if (!done() && rating.score > aim + tol && rating.score < aim * 1.6 + 200 && descents < DESCENTS) {
        descents++;
        take(descend(found, aim, fit, rnd));
      }
    }
    if (!done()) {
      const climbed = climb(aim, level, fit, rnd);
      steps = climbed.steps;
      take(climbed.found);
    }
  } finally {
    Math.random = original;
  }
  const pick = best as Found | null;
  if (!pick) throw new Error(`door ${door}: no ${level} puzzle rated above ${before} found`);
  const { puzzle } = pick;
  // the rating the door publishes is the full catalogue's
  const rating = ratePuzzle(puzzle, SOLVE_ORDER)!;
  if (!fit(puzzle, rating)) throw new Error(`door ${door}: not fit by the full catalogue`);
  const grid = parseGrid(puzzle)!;
  if (countSolutions(grid, 2) !== 1) throw new Error(`door ${door}: not unique`);
  const solution = gridToString(solve(grid)!);
  return {
    door: { date: doorDate(year, door), door, puzzle, level: rating.level, score: rating.score },
    solution,
    tries,
    descents,
    steps
  };
}
