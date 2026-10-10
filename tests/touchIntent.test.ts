/**
 * How a touch on the board settles (src/ui/touchIntent.ts): a tap stays
 * undecided within the slop, a mostly vertical move is a scroll, a mostly
 * sideways one a drag, in every direction alike; on a board that does not
 * scroll the page every move is a drag; a drag's run has no holes; and
 * the constants stay in the range the board was tuned for.
 */
import { describe, it, expect } from 'vitest';
import { touchIntent, cellsBetween, SLOP_PX, INTENT_MS, SCROLL_RATIO } from '../src/ui/touchIntent';

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
    expect(touchIntent(30, 30, true, SLOP_PX, 1.2)).toBe('drag');
    expect(touchIntent(30, 20, true, SLOP_PX, 0.5)).toBe('scroll');
  });

  it('reads every move as a drag on a board that does not scroll the page', () => {
    // from a tablet's width up (styles.css): straight down, straight up
    // and the steep diagonals select at once, with no rest first
    for (const sign of [1, -1]) {
      expect(touchIntent(0, 40 * sign, false)).toBe('drag');
      expect(touchIntent(5 * sign, 40 * sign, false)).toBe('drag');
      expect(touchIntent(30 * sign, -30 * sign, false)).toBe('drag');
      expect(touchIntent(40 * sign, 0, false)).toBe('drag');
    }
    expect(touchIntent(0, SLOP_PX + 1, false)).toBe('drag');
    // a tap is still a tap
    expect(touchIntent(0, SLOP_PX, false)).toBe('undecided');
    expect(touchIntent(3, -4, false)).toBe('undecided');
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

describe('the run a drag draws', () => {
  it('has every cell on the way, the last one included and the first one not', () => {
    // down a column, r1c5 to r5c5, sampled once at each end
    expect(cellsBetween(4, 40)).toEqual([13, 22, 31, 40]);
    // back up, and along a row both ways
    expect(cellsBetween(40, 4)).toEqual([31, 22, 13, 4]);
    expect(cellsBetween(54, 58)).toEqual([55, 56, 57, 58]);
    expect(cellsBetween(58, 54)).toEqual([57, 56, 55, 54]);
    // the main diagonal
    expect(cellsBetween(0, 80)).toEqual([10, 20, 30, 40, 50, 60, 70, 80]);
  });

  it('is the cell alone for a neighbour, and nothing for the cell it is in', () => {
    expect(cellsBetween(40, 41)).toEqual([41]);
    expect(cellsBetween(40, 31)).toEqual([31]);
    expect(cellsBetween(40, 50)).toEqual([50]);
    expect(cellsBetween(40, 40)).toEqual([]);
  });

  it('steps one cell at a time on a slant, never off the board', () => {
    for (let from = 0; from < 81; from++) {
      for (let to = 0; to < 81; to++) {
        const run = cellsBetween(from, to);
        let [r, c] = [Math.floor(from / 9), from % 9];
        for (const cell of run) {
          expect(cell).toBeGreaterThanOrEqual(0);
          expect(cell).toBeLessThan(81);
          const [nr, nc] = [Math.floor(cell / 9), cell % 9];
          // a neighbour of the one before, a king's move at most
          expect(Math.max(Math.abs(nr - r), Math.abs(nc - c))).toBe(1);
          [r, c] = [nr, nc];
        }
        if (from !== to) expect(run[run.length - 1]).toBe(to);
      }
    }
  });
});
