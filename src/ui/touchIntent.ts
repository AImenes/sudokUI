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

/** what a finger that has moved by (dx, dy) since it landed means, so far */
export function touchIntent(dx: number, dy: number, slop = SLOP_PX, ratio = SCROLL_RATIO): TouchIntent {
  if (Math.hypot(dx, dy) <= slop) return 'undecided';
  return Math.abs(dy) > Math.abs(dx) * ratio ? 'scroll' : 'drag';
}
