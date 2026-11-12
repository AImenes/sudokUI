/**
 * How a door of the advent calendar is found (scripts/build-advent.ts,
 * docs/advent-calendar.md): its own seed, the year and the door, and a
 * fixed number of tries, so the same doors come out on any machine while
 * the generator and the rater stay as they are (tests/advent.test.ts makes
 * the first doors again and compares them with advent.json).
 *
 * Fresh minimal puzzles, rated, the nearest to the target kept; a puzzle
 * rated above the target may also have clues of its own solution given
 * back, one at a time, which brings its rating down by the singles it no
 * longer needs (door 1, about 100, is a puzzle of singles with only some
 * 25 empty cells, which no minimal puzzle is). Every door has one
 * solution, is solved by the catalogue without guessing, is in the band
 * its target names or the one above (never below the door before), and,
 * from Medium up, meets its hardest technique on a board with room in it
 * (fitForLevel), as a served puzzle must.
 */
import { generatePuzzle, fitForLevel } from '../src/engine/generator';
import { ratePuzzle } from '../src/engine/humanSolver';
import type { Rating } from '../src/engine/humanSolver';
import { parseGrid, gridToString } from '../src/engine/board';
import { solve, countSolutions } from '../src/engine/bruteForce';
import { SOLVE_ORDER, LEVELS, levelForScore } from '../src/engine/ratings';
import type { Level } from '../src/engine/ratings';
import { doorDate, doorTarget } from '../src/content/advent';
import type { AdventDoor } from '../src/content/advent';

/** how far from the target a door may land and still stop the search early */
export const tolerance = (target: number) => Math.max(5, Math.round(target * 0.01));
/** fresh puzzles tried per door at most */
const ATTEMPTS = 3000;
/** puzzles above the target that are brought down by giving clues back, per door at most */
const DESCENTS = 300;

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

/** a level and the one above it */
const above = (level: Level): Level => LEVELS[Math.min(LEVELS.indexOf(level) + 1, LEVELS.length - 1)];

/**
 * The levels a door may be, from its target and the door before it: the
 * band the target's score names, or the one above it (singles alone
 * rarely add up to 600, and a Medium step at that score is the next band,
 * as a calendar climbs), and never below the door before, so the bands
 * rise with the doors as the ratings do
 */
const levelsFor = (target: number, before: Level): Level[] =>
  [levelForScore(target), above(levelForScore(target))].filter((l) => LEVELS.indexOf(l) >= LEVELS.indexOf(before));

/**
 * Fit to stand behind a door: solved by the catalogue without guessing,
 * of a level the door may be, and from Medium up with its crux on a live
 * board (fitForLevel), as a puzzle served for its band must be
 */
const fitFor = (levels: Level[]) => (puzzle: string, r: Rating) =>
  r.solvable && levels.includes(r.level) && (r.level === 'Easy' || fitForLevel(puzzle, r));

/**
 * A puzzle above the target, brought down by giving back clues of its own
 * solution, one at a time in a random order: a clue stays when the rating
 * is still at or above the target's lower edge (on the way the puzzle may
 * pass through bands its score does not name, a Hard step on a score of
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

/**
 * The door's puzzle: the nearest to its target the tries turn up, in the
 * band its target names when one is near enough, else in the band above
 * (stopping early once one of those is near and a few hundred tries have
 * gone to the first)
 */
/** a door as found: all it publishes but the solution's hash, which its caller makes from `solution` (node:crypto, in scripts/build-advent.ts) */
export type FoundDoor = Omit<AdventDoor, 'solutionHash'>;

export function makeDoor(year: number, door: number, before: Level): { door: FoundDoor; solution: string; tries: number; descents: number } {
  const target = doorTarget(door);
  const tol = tolerance(target);
  const levels = levelsFor(target, before);
  const fit = fitFor(levels);
  const rnd = seeded(`sudokui-advent-${year}-${door}`);
  const original = Math.random;
  Math.random = rnd;
  // the nearest in each level the door may be, the first preferred
  const best: (Found | null)[] = levels.map(() => null);
  let tries = 0;
  let descents = 0;
  const off = (f: Found | null) => (f ? Math.abs(f.rating.score - target) : Infinity);
  const take = (f: Found | null) => {
    if (!f) return;
    const i = levels.indexOf(f.rating.level);
    if (i >= 0 && off(f) < off(best[i])) best[i] = f;
  };
  const done = () => off(best[0]) <= tol || (tries >= 300 && best.some((f) => off(f) <= tol));
  try {
    while (tries < ATTEMPTS && !done()) {
      tries++;
      const grid = generatePuzzle(rnd() < 0.7 ? 'rotational' : 'none');
      const puzzle = gridToString(grid);
      const rating = ratePuzzle(puzzle, SOLVE_ORDER);
      if (!rating || !rating.solvable) continue;
      const found = { puzzle, rating };
      if (fit(puzzle, rating)) take(found);
      // above the target (and not wildly so, where a clue given back
      // would undo the crux before the singles): brought down
      if (!done() && rating.score > target + tol && rating.score < target * 1.6 + 200 && descents < DESCENTS) {
        descents++;
        take(descend(found, target, fit, rnd));
      }
    }
  } finally {
    Math.random = original;
  }
  // the first level's when it is near, else the nearest of all
  const pick = off(best[0]) <= tol ? best[0] : best.reduce((a, b) => (off(b) < off(a) ? b : a), null as Found | null);
  if (!pick) throw new Error(`door ${door}: no puzzle found`);
  const { puzzle, rating } = pick;
  const grid = parseGrid(puzzle)!;
  if (countSolutions(grid, 2) !== 1) throw new Error(`door ${door}: not unique`);
  const solution = gridToString(solve(grid)!);
  return {
    door: { date: doorDate(year, door), door, puzzle, level: rating.level, score: rating.score },
    solution,
    tries,
    descents
  };
}

