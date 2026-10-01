import { describe, it, expect } from 'vitest';
import { LEVELS } from '../src/engine/ratings';
import {
  MEDIAN_SECONDS,
  timePercentile,
  timeAtPercentile,
  timeVerdict,
  percentileText,
  formatSeconds,
  SOLVE_TIME_ROWS,
  VERDICTS
} from '../src/content/solveTimes';

describe('solve time benchmarks', () => {
  it('place the median at 50% and get stricter with speed', () => {
    for (const level of LEVELS) {
      const m = MEDIAN_SECONDS[level];
      expect(timePercentile(level, m)).toBeCloseTo(0.5, 6);
      expect(timePercentile(level, m / 2)).toBeGreaterThan(timePercentile(level, m));
      expect(timePercentile(level, m * 2)).toBeLessThan(timePercentile(level, m));
      expect(timeAtPercentile(level, 0.5)).toBeCloseTo(m, 0);
    }
  });

  it('get harder as the band gets harder', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(MEDIAN_SECONDS[LEVELS[i]]).toBeGreaterThan(MEDIAN_SECONDS[LEVELS[i - 1]]);
    }
  });

  it('call 14 minutes on a Tricky puzzle a good solve, and a minute on Easy world class', () => {
    const tricky = timeVerdict('Tricky', 14 * 60);
    expect(tricky.label).toBe('Good');
    expect(tricky.percentile).toBeGreaterThan(0.5);
    expect(tricky.percentile).toBeLessThan(0.8);
    expect(timeVerdict('Easy', 60).label).toBe('World class');
    expect(timeVerdict('Easy', 30 * 60).label).toBe('Slow');
  });

  it('read as plain statements', () => {
    expect(percentileText(0.65)).toBe('faster than 65% of solvers');
    expect(percentileText(0.995)).toBe('faster than 99.5% of solvers');
    expect(percentileText(0.9995)).toBe('faster than 99.9% of solvers');
    expect(formatSeconds(270)).toBe('4:30');
    expect(formatSeconds(4320)).toBe('1h 12m');
    expect(VERDICTS[VERDICTS.length - 1].atLeast).toBe(0);
    expect(SOLVE_TIME_ROWS).toHaveLength(LEVELS.length);
    for (const row of SOLVE_TIME_ROWS) expect(row.worldClass < row.typical || row.level).toBeTruthy();
  });
});
