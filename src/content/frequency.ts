// How often each technique is needed: measured by scripts/hunt-examples.ts,
// which rates generated puzzles by the tens of thousands and counts the
// puzzles whose solve path uses the technique at least once.
//
// The numbers describe the puzzles sudokUI generates, not sudoku at large:
// a collection of hand-picked hard puzzles would look very different.
import data from './frequency.json';
import { Tech, TECHS } from '../engine/ratings';

export interface Frequency {
  /** generated puzzles rated */
  sample: number;
  /** puzzles needing the technique; only techniques in the solve order */
  counts: Partial<Record<Tech, number>>;
}

export const FREQUENCY = data as Frequency;

/** two significant digits: 37, 120, 4,500 */
function rounded(n: number): string {
  const step = Math.pow(10, Math.max(0, Math.floor(Math.log10(n)) - 1));
  return (Math.round(n / step) * step).toLocaleString('en');
}

/**
 * "34% of puzzles", "1 in 120 puzzles", or null for a technique the solver
 * never uses (not implemented, or switched off as redundant).
 */
export function frequencyLabel(tech: Tech, f: Frequency = FREQUENCY): string | null {
  const count = f.counts[tech];
  if (count === undefined || f.sample === 0) return null;
  if (count === 0) return `fewer than 1 in ${rounded(f.sample)} puzzles`;
  const share = count / f.sample;
  if (share >= 0.995) return 'every puzzle';
  if (share >= 0.1) return `${Math.round(share * 100)}% of puzzles`;
  return `1 in ${rounded(1 / share)} puzzles`;
}

/** share of generated puzzles needing the technique; below zero when never measured */
export function share(tech: Tech, f: Frequency = FREQUENCY): number {
  const n = f.counts[tech];
  return n === undefined || f.sample === 0 ? -1 : n / f.sample;
}

/**
 * Rating points per generated puzzle that the technique accounts for: how
 * often it is needed, weighted by its cost. Difficulty and frequency are
 * different things; this is what makes a technique worth learning.
 */
export function worth(tech: Tech, f: Frequency = FREQUENCY): number {
  return share(tech, f) * TECHS[tech].score;
}

/** the techniques most worth learning first, ties in solver order */
export function byWorth(techs: readonly Tech[], f: Frequency = FREQUENCY): Tech[] {
  return [...techs].sort((a, b) => worth(b, f) - worth(a, f) || TECHS[a].index - TECHS[b].index);
}
