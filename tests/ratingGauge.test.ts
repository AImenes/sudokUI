/**
 * The speedometer's needle (src/ui/RatingGauge.tsx) points into the arc
 * of the puzzle's own level and nowhere else, tremor and all: at every
 * score a level can have, at the ends of its range, for a level set by a
 * technique rather than the score, and for scores past the dial.
 */
import { describe, it, expect } from 'vitest';
import { dialAngle, arcRange, SEG, GAP, TREMOR, DIAL_TOP } from '../src/ui/RatingGauge';
import { LEVELS, LEVEL_MAX_SCORE } from '../src/engine/ratings';

/** the drawn arc of a level, in degrees from the dial's left end */
const drawn = (i: number): [number, number] => [i * SEG + GAP / 2, (i + 1) * SEG - GAP / 2];

describe('the gauge needle', () => {
  it('stands inside its level, a tremor inside the drawn arc, at every score', () => {
    LEVELS.forEach((level, i) => {
      const [lo, hi] = arcRange(i);
      const [a, b] = drawn(i);
      // the tremor never reaches past the drawn arc
      expect(lo - TREMOR).toBeGreaterThanOrEqual(a);
      expect(hi + TREMOR).toBeLessThanOrEqual(b);
      const top = i === LEVELS.length - 1 ? DIAL_TOP : LEVEL_MAX_SCORE[level];
      for (const score of [0, 1, 400, 800, 801, 1000, 1001, 1600, 1601, 1800, 1801, 2500, 3000, top, top + 1, 10_000, Infinity]) {
        const angle = dialAngle(level, score);
        expect(angle, `${level} ${score}`).toBeGreaterThanOrEqual(lo);
        expect(angle, `${level} ${score}`).toBeLessThanOrEqual(hi);
      }
      // and anything that is no number stands at the arc's start
      expect(dialAngle(level, NaN)).toBe(lo);
    });
  });

  it('rises with the score inside a level, and stands at the start when a technique set the level', () => {
    for (const level of LEVELS) {
      let last = -1;
      for (let score = 0; score <= 5000; score += 25) {
        const angle = dialAngle(level, score);
        expect(angle).toBeGreaterThanOrEqual(last);
        last = angle;
      }
    }
    // a Fireworks puzzle of the practice library: Extreme by its technique, scored 1752
    expect(dialAngle('Extreme', 1752)).toBe(arcRange(4)[0]);
    // an XY-Chain puzzle of the seed library: Unfair by its technique, scored 834
    expect(dialAngle('Unfair', 834)).toBe(arcRange(3)[0]);
    // the top of a level's range is its arc's end, past the dial the end too
    expect(dialAngle('Hard', 1600)).toBe(arcRange(2)[1]);
    expect(dialAngle('Extreme', 4500)).toBe(arcRange(4)[1]);
  });
});
