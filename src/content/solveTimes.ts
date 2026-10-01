// Where a solve time stands: "faster than 65% of solvers" and a word for
// it, from Slow to World class, per difficulty band.
//
// The benchmarks are rough by nature. Published figures for online solvers
// (sudoku.com, websudoku, the New York Times, the sites that report
// averages) put an easy puzzle at 5 to 10 minutes for a typical player,
// medium at 10 to 20, hard at 20 to 40 and expert at 40 upwards, with
// championship solvers finishing an easy puzzle in about a minute and a
// hard one in a few. Solve times are close to log-normal: most people
// cluster near a median and a long tail takes much longer. So each band
// gets a median for a typical online solver with automatic candidates,
// and one spread for all bands, calibrated so that the top 0.1% matches
// championship times. Solving with your own pencil marks, and on paper,
// take longer: each is a multiple of the screen-with-candidates time.
import { Level, LEVELS } from '../engine/ratings';

/** median solve time of a typical online solver, in seconds, per band */
export const MEDIAN_SECONDS: Record<Level, number> = {
  Beginner: 240,
  Easy: 420,
  Medium: 720,
  Tricky: 1080,
  Hard: 1680,
  Unfair: 2700,
  Extreme: 5400,
  Nightmare: 10800
};

/**
 * spread of the log-normal distribution of times (standard deviation of
 * ln t): with this, one solver in a thousand finishes an Easy puzzle in a
 * minute, which is where the championship times sit
 */
export const SIGMA = 0.62;

/** how the puzzle was solved: what the clock is compared against */
export type SolveMode = 'auto' | 'marks' | 'paper';

export const SOLVE_MODES: SolveMode[] = ['auto', 'marks', 'paper'];

/**
 * typical time relative to a screen with automatic candidates. Writing
 * your own marks costs the writing and the bookkeeping; paper adds the
 * erasing, no undo and no highlighting on top. Judgement calls, like the
 * medians themselves.
 */
export const MODE_FACTOR: Record<SolveMode, number> = { auto: 1, marks: 1.3, paper: 1.6 };

export const MODE_LABEL: Record<SolveMode, string> = {
  auto: 'with automatic candidates',
  marks: 'with your own marks',
  paper: 'on paper'
};

/** standard normal cumulative distribution */
function phi(z: number): number {
  // Phi(z) = (1 + erf(z / sqrt 2)) / 2, erf by Abramowitz and Stegun 7.1.26
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly =
    t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-x * x);
  return 0.5 * (1 + (z < 0 ? -erf : erf));
}

/** share of solvers of this band who take longer than `seconds`, 0 to 1 */
export function timePercentile(level: Level, seconds: number, mode: SolveMode = 'auto'): number {
  if (seconds <= 0) return 1;
  return phi((Math.log(MEDIAN_SECONDS[level] * MODE_FACTOR[mode]) - Math.log(seconds)) / SIGMA);
}

/** the time at which exactly `share` of solvers are slower, in seconds */
export function timeAtPercentile(level: Level, share: number, mode: SolveMode = 'auto'): number {
  // inverse of timePercentile by bisection on ln t: plenty fast for a table
  let lo = Math.log(1),
    hi = Math.log(24 * 3600);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (timePercentile(level, Math.exp(mid), mode) > share) lo = mid;
    else hi = mid;
  }
  return Math.exp((lo + hi) / 2);
}

export interface TimeVerdict {
  /** one word for it */
  label: string;
  /** share of solvers of the band who are slower, 0 to 1 */
  percentile: number;
}

/** the words, from the top down, with the share of solvers each one beats */
export const VERDICTS: { label: string; atLeast: number }[] = [
  { label: 'World class', atLeast: 0.999 },
  { label: 'Expert', atLeast: 0.99 },
  { label: 'Excellent', atLeast: 0.95 },
  { label: 'Fast', atLeast: 0.8 },
  { label: 'Good', atLeast: 0.5 },
  { label: 'Steady', atLeast: 0.2 },
  { label: 'Slow', atLeast: 0 }
];

export function timeVerdict(level: Level, seconds: number, mode: SolveMode = 'auto'): TimeVerdict {
  const percentile = timePercentile(level, seconds, mode);
  const { label } = VERDICTS.find((v) => percentile >= v.atLeast)!;
  return { label, percentile };
}

/** "faster than 65% of solvers", or the top-end phrasing when there is almost nobody left */
export function percentileText(percentile: number): string {
  if (percentile >= 0.999) return 'faster than 99.9% of solvers';
  if (percentile >= 0.99) return `faster than ${(percentile * 100).toFixed(1)}% of solvers`;
  return `faster than ${Math.round(percentile * 100)}% of solvers`;
}

/** 4:30 for 270 seconds; 1h 12m past the hour */
export function formatSeconds(seconds: number): string {
  const s = Math.round(seconds);
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export interface SolveTimeRow {
  level: Level;
  /** Slow: the slowest fifth take longer than this */
  slow: string;
  /** the median solver */
  typical: string;
  /** Fast: faster than 80% */
  fast: string;
  /** Expert: faster than 99% */
  expert: string;
  /** World class: faster than 99.9% */
  worldClass: string;
}

/** the benchmark table for one way of solving, one row per band */
export function solveTimeRows(mode: SolveMode): SolveTimeRow[] {
  return LEVELS.map((level) => ({
    level,
    slow: formatSeconds(timeAtPercentile(level, 0.2, mode)),
    typical: formatSeconds(MEDIAN_SECONDS[level] * MODE_FACTOR[mode]),
    fast: formatSeconds(timeAtPercentile(level, 0.8, mode)),
    expert: formatSeconds(timeAtPercentile(level, 0.99, mode)),
    worldClass: formatSeconds(timeAtPercentile(level, 0.999, mode))
  }));
}

/** the three tables: automatic candidates, your own marks, paper */
export const SOLVE_TIME_TABLES = SOLVE_MODES.map((mode) => ({
  mode,
  label: MODE_LABEL[mode],
  rows: solveTimeRows(mode)
}));

/** kept for the first table */
export const SOLVE_TIME_ROWS: SolveTimeRow[] = solveTimeRows('auto');

export const SOLVE_TIME_NOTE =
  'Rough benchmarks from the typical times online solvers report, spread the way solve times spread: most near the middle, a long tail behind. The world class mark is set by championship solvers. Writing your own marks takes longer than automatic candidates, and paper longer still, so each way of solving has its own table. A puzzle at the top of its band takes longer than one at the bottom.';
