/**
 * How a touch on the board settles (src/ui/touchIntent.ts): a tap stays
 * undecided within the slop, a mostly vertical move is a scroll, a mostly
 * sideways one a drag, in every direction alike; and the constants stay
 * in the range the board was tuned for.
 */
import { describe, it, expect } from 'vitest';
import { touchIntent, SLOP_PX, INTENT_MS, SCROLL_RATIO } from '../src/ui/touchIntent';

describe('touch intent', () => {
  it('is undecided while the finger stays within the slop', () => {
    expect(touchIntent(0, 0)).toBe('undecided');
    expect(touchIntent(3, -4)).toBe('undecided');
    expect(touchIntent(SLOP_PX, 0)).toBe('undecided');
    expect(touchIntent(0, -SLOP_PX)).toBe('undecided');
    // just past the slop, in a straight line, it has made up its mind
    expect(touchIntent(SLOP_PX + 1, 0)).toBe('drag');
    expect(touchIntent(0, SLOP_PX + 1)).toBe('scroll');
    // a diagonal of two short legs is past the circle too
    expect(touchIntent(8, 8)).not.toBe('undecided');
  });

  it('reads an up or down move as a scroll, a sideways move as a drag', () => {
    for (const sign of [1, -1]) {
      expect(touchIntent(0, 40 * sign)).toBe('scroll');
      expect(touchIntent(5 * sign, 40 * sign)).toBe('scroll');
      expect(touchIntent(40 * sign, 0)).toBe('drag');
      expect(touchIntent(40 * sign, 5 * sign)).toBe('drag');
      expect(touchIntent(40 * sign, -5 * sign)).toBe('drag');
    }
  });

  it('settles a diagonal by the ratio, leaning towards the scroll', () => {
    // a 45 degree move scrolls: a thumb scrolling is often this sloppy,
    // while a drag along a row is nearly flat
    expect(touchIntent(30, 30)).toBe('scroll');
    expect(touchIntent(30, 30 * SCROLL_RATIO + 0.01)).toBe('scroll');
    expect(touchIntent(30, 30 * SCROLL_RATIO - 0.01)).toBe('drag');
    expect(touchIntent(40, 20)).toBe('drag');
    // the ratio is a parameter, so the board can be retuned in one place
    expect(touchIntent(30, 30, SLOP_PX, 1.2)).toBe('drag');
    expect(touchIntent(30, 20, SLOP_PX, 0.5)).toBe('scroll');
  });

  it('keeps the constants where a tap feels instant and a swipe stays a swipe', () => {
    // a tap must not wait on the clock, and a rest must still be brief
    expect(INTENT_MS).toBeGreaterThan(0);
    expect(INTENT_MS).toBeLessThanOrEqual(150);
    // the slop is within a cell on the smallest phone (about 40 px wide)
    expect(SLOP_PX).toBeGreaterThanOrEqual(6);
    expect(SLOP_PX).toBeLessThanOrEqual(16);
    expect(SCROLL_RATIO).toBeGreaterThan(0);
    expect(SCROLL_RATIO).toBeLessThanOrEqual(1.5);
  });
});
