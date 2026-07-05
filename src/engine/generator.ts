import { Grid, emptyGrid, cloneGrid, setValue, gridToString, parseGrid, digitsOf } from './board';
import { countSolutions } from './bruteForce';
import { ratePuzzle, Rating } from './humanSolver';
import { Level, Tech, TECHS } from './ratings';

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

/** Dig holes from a full grid, keeping the solution unique. */
export function generatePuzzle(symmetry: Symmetry = 'rotational'): Grid {
  const full = generateFullGrid();
  const puzzle = cloneGrid(full);
  const order = shuffle(Array.from({ length: 81 }, (_, i) => i));
  const removed = new Set<number>();
  for (const cell of order) {
    if (removed.has(cell)) continue;
    const group = [cell, ...partners(cell, symmetry).filter((p) => p !== cell)];
    const backup = group.map((c) => puzzle.values[c]);
    if (backup.some((v) => v === 0)) continue;
    const test = parseGrid(
      gridToString(puzzle)
        .split('')
        .map((ch, i) => (group.includes(i) ? '.' : ch))
        .join('')
    )!;
    if (countSolutions(test, 2) === 1) {
      for (const c of group) removed.add(c);
      // rebuild puzzle grid without the removed cells
      puzzle.values = test.values;
      puzzle.cands = test.cands;
      puzzle.given = test.given;
    }
  }
  return puzzle;
}

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
