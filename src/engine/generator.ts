/**
 * The puzzle generator: a random full grid, dug down to a minimal proper
 * puzzle, rated, and filtered for the band or technique a player asked
 * for. The design, with the numbers behind it, is in docs/generator.md.
 */
import { Grid, emptyGrid, cloneGrid, setValue, gridToString, gridFromValues, digitsOf, bit } from './board';
import { solve } from './bruteForce';
import { ratePuzzle, Rating, RatingLimit } from './humanSolver';
import { Step } from './steps';
import { Level, LEVELS, Tech, TECHS, SOLVE_ORDER, practiceCeiling } from './ratings';

export { practiceCeiling };

export type Symmetry = 'rotational' | 'mirror' | 'none';

function shuffle<T>(arr: T[], rnd: () => number = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Generate a random completed grid. */
export function generateFullGrid(rnd: () => number = Math.random): Grid {
  const g = emptyGrid();
  const rec = (grid: Grid): Grid | null => {
    let best = -1;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (grid.values[i] !== 0) continue;
      const n = digitsOf(grid.cands[i]).length;
      if (n === 0) return null;
      if (n < bestCount) {
        bestCount = n;
        best = i;
      }
    }
    if (best === -1) return grid;
    for (const d of shuffle(digitsOf(grid.cands[best]), rnd)) {
      const next = cloneGrid(grid);
      setValue(next, best, d);
      const res = rec(next);
      if (res) return res;
    }
    return null;
  };
  return rec(g)!;
}

/** Symmetric partner(s) of a cell. */
function partners(cell: number, symmetry: Symmetry): number[] {
  if (symmetry === 'rotational') return [80 - cell];
  if (symmetry === 'mirror') {
    const r = Math.floor(cell / 9);
    const c = cell % 9;
    return [r * 9 + (8 - c)];
  }
  return [];
}

/**
 * Whether a proper puzzle stays proper with the clues in `group` removed
 * (`values` already has them emptied; `backup` holds what they were).
 *
 * Any second solution would have to differ from the one solution in one of
 * the emptied cells, since with those cells restored the puzzle had only
 * the one. So the puzzle stays proper iff no other digit can go in any of
 * them: a few targeted solver calls, each usually dead on propagation,
 * instead of a full count of solutions.
 */
function removable(values: Uint8Array, group: number[], backup: number[]): boolean {
  const g = gridFromValues(values);
  for (let i = 0; i < group.length; i++) {
    const cell = group[i];
    let mask = g.cands[cell] & ~bit(backup[i]);
    while (mask) {
      const low = mask & -mask;
      mask &= mask - 1;
      const t = cloneGrid(g);
      setValue(t, cell, 32 - Math.clz32(low));
      if (solve(t)) return false;
    }
  }
  return true;
}

/**
 * Dig holes from a full grid, keeping the solution unique. Clues go in
 * random order, singly or with their symmetric partner, and a removal
 * stands only if the puzzle stays proper. A clue that cannot go now can
 * never go later (fewer clues only add solutions), so the result is
 * minimal: every clue left is needed. With a symmetry it is minimal as
 * pairs: no pair can go, though a clue on its own often could (about six
 * per puzzle). The symmetry is kept whole on purpose.
 *
 * Randomness is consumed in a fixed order (the full grid, then one
 * shuffle), which the daily puzzle relies on: see daily.ts.
 */
export function generatePuzzle(symmetry: Symmetry = 'rotational'): Grid {
  const full = generateFullGrid();
  const values = new Uint8Array(full.values);
  const order = shuffle(Array.from({ length: 81 }, (_, i) => i));
  for (const cell of order) {
    const group = [cell, ...partners(cell, symmetry).filter((p) => p !== cell)];
    const backup = group.map((c) => values[c]);
    if (backup.some((v) => v === 0)) continue;
    for (const c of group) values[c] = 0;
    if (!removable(values, group, backup)) group.forEach((c, i) => (values[c] = backup[i]));
  }
  return gridFromValues(values);
}

/** True iff the clue pattern has the symmetry: a clue's partner is a clue. */
export function hasSymmetry(g: Grid, symmetry: Symmetry): boolean {
  for (let c = 0; c < 81; c++) {
    for (const p of partners(c, symmetry)) {
      if ((g.values[c] === 0) !== (g.values[p] === 0)) return false;
    }
  }
  return true;
}

/**
 * True iff no clue of this proper puzzle can be removed; with a symmetry,
 * iff no clue can be removed together with its partner.
 */
export function isMinimal(g: Grid, symmetry: Symmetry = 'none'): boolean {
  const values = new Uint8Array(g.values);
  const seen = new Set<number>();
  for (let c = 0; c < 81; c++) {
    if (!values[c] || seen.has(c)) continue;
    const group = [c, ...partners(c, symmetry).filter((p) => p !== c && values[p])];
    for (const x of group) seen.add(x);
    const backup = group.map((x) => values[x]);
    for (const x of group) values[x] = 0;
    const spare = removable(values, group, backup);
    group.forEach((x, i) => (values[x] = backup[i]));
    if (spare) return false;
  }
  return true;
}

export const clueCount = (puzzle: string) => puzzle.replace(/[^1-9]/g, '').length;

export interface GeneratedPuzzle {
  puzzle: string;
  rating: Rating;
}

/**
 * Generate until predicate matches (or attempts run out — then the closest
 * attempt so far is returned with `exact: false` semantics by the caller).
 */
export function generateWhere(
  match: (rating: Rating) => boolean,
  maxAttempts = 200,
  onCandidate?: (p: GeneratedPuzzle) => void
): GeneratedPuzzle | null {
  for (let i = 0; i < maxAttempts; i++) {
    const puzzle = generatePuzzle(Math.random() < 0.7 ? 'rotational' : 'none');
    const rating = ratePuzzle(puzzle);
    if (!rating) continue;
    const result = { puzzle: gridToString(puzzle), rating };
    onCandidate?.(result);
    if (match(rating)) return result;
  }
  return null;
}

export const matchesLevel = (level: Level) => (r: Rating) =>
  r.level === level && r.solvable;

export const requiresTechnique = (tech: Tech) => (r: Rating) =>
  (r.techniques[tech] ?? 0) > 0 && r.solvable;

/**
 * Techniques that occur "cleanly" in a solve path: every step before the
 * technique's first occurrence is no harder (by solver order) than the
 * technique itself. Practice puzzles use this so you never need something
 * harder than the target to reach it.
 */
export function cleanTechniques(r: Rating): Tech[] {
  const out: Tech[] = [];
  let maxIndex = 0;
  for (const step of r.steps) {
    const idx = TECHS[step.tech].index;
    if (maxIndex <= idx && !out.includes(step.tech)) out.push(step.tech);
    maxIndex = Math.max(maxIndex, idx);
  }
  return out;
}

export const requiresTechniqueCleanly = (tech: Tech) => (r: Rating) =>
  r.solvable && cleanTechniques(r).includes(tech);

// ---- path quality ----

/**
 * The crux of a path: the first step of its hardest technique, by solver
 * order. The one definition the app uses, in the solution path dialog as
 * in the filters. -1 when there are no steps.
 */
export function cruxIndex(steps: Step[]): number {
  let best = -1;
  let hardest = -1;
  steps.forEach((s, i) => {
    const idx = TECHS[s.tech].index;
    if (idx > hardest) {
      hardest = idx;
      best = i;
    }
  });
  return best;
}

/** Empty cells left when the crux fires. */
export function cruxEmpties(rating: Rating, clues: number): number {
  const at = cruxIndex(rating.steps);
  let empties = 81 - clues;
  for (let i = 0; i < at; i++) empties -= rating.steps[i].placements.length;
  return empties;
}

/**
 * The crux on a live board: a puzzle served for its band must meet its
 * hardest technique with this many cells still empty, so the pattern is
 * found on a board with room in it rather than as an endgame formality.
 * Costs about one Tricky puzzle in six and almost nothing elsewhere.
 */
export const CRUX_MIN_EMPTIES = 20;

/**
 * The filters a puzzle must pass to be served for its band: solved by the
 * catalogue, the crux on a live board, and the crux not BUG+1, which by
 * its nature fires only when every other cell is down to two candidates.
 */
export function fitForLevel(puzzle: string, rating: Rating): boolean {
  if (!rating.solvable) return false;
  const at = cruxIndex(rating.steps);
  if (at >= 0 && rating.steps[at].tech === 'BUG_PLUS_1') return false;
  return cruxEmpties(rating, clueCount(puzzle)) >= CRUX_MIN_EMPTIES;
}

// ---- targeted generation ----

export type Target = { kind: 'level'; level: Level } | { kind: 'tech'; tech: Tech };

/** Where the rating of a candidate for this target may stop early. */
export const limitFor = (target: Target): RatingLimit =>
  target.kind === 'level'
    ? { maxLevel: target.level }
    : { cleanTech: target.tech, maxLevel: practiceCeiling(target.tech) };

/** Whether a rated puzzle is what the target asked for. */
export function hits(target: Target, puzzle: string, rating: Rating): boolean {
  if (!rating.solvable) return false;
  if (target.kind === 'level') return rating.level === target.level && fitForLevel(puzzle, rating);
  return (
    cleanTechniques(rating).includes(target.tech) &&
    LEVELS.indexOf(rating.level) <= LEVELS.indexOf(practiceCeiling(target.tech))
  );
}

/**
 * One generation attempt for a target: a fresh puzzle, rated. With `limit`
 * the rating stops as soon as the puzzle is past the target (null then),
 * which is most of the cost when a player is waiting; without it every
 * puzzle is rated in full so the pools of every band and technique can
 * keep what the attempt turned up.
 */
export function attemptFor(target: Target, limit = true): GeneratedPuzzle | null {
  const grid = generatePuzzle(Math.random() < 0.7 ? 'rotational' : 'none');
  const rating = ratePuzzle(grid, SOLVE_ORDER, limit ? limitFor(target) : undefined);
  return rating ? { puzzle: gridToString(grid), rating } : null;
}

/** Generate until a puzzle hits the target, with the rating capped. */
export function generateFor(
  target: Target,
  maxAttempts = 400,
  onCandidate?: (p: GeneratedPuzzle) => void
): GeneratedPuzzle | null {
  for (let i = 0; i < maxAttempts; i++) {
    const result = attemptFor(target);
    if (!result) continue;
    onCandidate?.(result);
    if (hits(target, result.puzzle, result.rating)) return result;
  }
  return null;
}
