// How a touch on the board settles (Grid.tsx): by where the finger has
// gone, not by how long it has been down. The cell under a landing finger
// is highlighted at once; the highlight is kept or put back once the
// finger has moved far enough to show what it meant.
//
// - within SLOP_PX of the landing: undecided, still a tap in the making;
// - beyond the slop, mostly up or down: a scroll, the browser's gesture
//   (the board's touch-action is pan-y), and the highlight goes back;
// - beyond the slop, mostly sideways: a drag-select across cells;
// - a finger that has not left the slop after INTENT_MS is resting, and a
//   rest is marking too: the drag that follows may go any way, with the
//   page held still under it, which is how a column is selected.
//
// That is a phone, where the board is the whole width of the page and has
// to let a swipe through. From a tablet's width up the page scrolls from
// beside the board, the board's touch-action has no pan-y (styles.css),
// and there is no scroll to tell from a drag (`pans` is false): a move
// beyond the slop is a drag-select whichever way it goes, with no rest
// first. A cell there is nearly twice a phone's, so a finger crossing
// cells at the same pace leaves the slop in half the time and is seldom
// found resting; and a tablet on its side has no page to scroll.
//
// Tune by feel on a phone: SLOP_PX (how still a tap must be: smaller feels
// snappier, larger forgives a wobbly thumb), INTENT_MS (how long a rest
// is: shorter commits sooner, longer keeps slow vertical drags scrolling),
// SCROLL_RATIO (how steep a drag must be to count as a scroll: higher
// favours selecting, lower favours scrolling).

/** how far a finger may wander and still be tapping, in CSS pixels */
export const SLOP_PX = 10;

/** a finger still within the slop after this long is resting, so marking */
export const INTENT_MS = 100;

/** a move is a scroll when it goes up or down more than this many times as far as it goes sideways (0.8: steeper than about 39 degrees) */
export const SCROLL_RATIO = 0.8;

export type TouchIntent = 'undecided' | 'scroll' | 'drag';

/**
 * what a finger that has moved by (dx, dy) since it landed means, so far;
 * `pans` says whether the board lets a swipe up or down scroll the page
 */
export function touchIntent(dx: number, dy: number, pans = true, slop = SLOP_PX, ratio = SCROLL_RATIO): TouchIntent {
  if (Math.hypot(dx, dy) <= slop) return 'undecided';
  return pans && Math.abs(dy) > Math.abs(dx) * ratio ? 'scroll' : 'drag';
}

/**
 * The cells a drag passes on its way from one cell to another (0 to 80,
 * row by row), the last one included and the first one not. A fast finger
 * is sampled a cell or more apart, and a slow device samples any finger
 * so: the run it draws must have no holes.
 */
export function cellsBetween(from: number, to: number): number[] {
  const [r0, c0] = [Math.floor(from / 9), from % 9];
  const [r1, c1] = [Math.floor(to / 9), to % 9];
  const n = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0));
  const out: number[] = [];
  for (let i = 1; i <= n; i++) {
    out.push(Math.round(r0 + ((r1 - r0) * i) / n) * 9 + Math.round(c0 + ((c1 - c0) * i) / n));
  }
  return out;
}
