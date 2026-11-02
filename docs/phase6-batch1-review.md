# Phase 6, batch 1, and the reach items: the review and the fix

Five fixers built this batch on 2 November 2026, on the shared hook
`Step.walk` (2f59a68):
- aaa61b1, the launch fixes and the daily's times (reach plan item 1);
- 4a43d8e, measuring each channel (item 2);
- 7a8d300, the wings;
- a0eb8c6, Chute Remote Pair and Sue de Coq;
- 5f2e9a9, the uniqueness family and BUG+1;
- 3718f8a, /admin's daily solves against daily times sent.

It was reviewed by four lenses (truth, words, design, and code with privacy and regression), with two refuting
skeptics on each blocking claim.

The truth lens found nothing false in the hints. The BUG+1 finder change was measured against main and behaves as
claimed. One design claim, that the walk's Next button moves under the thumb, was refuted by both skeptics.

## Fixed

Every one of these was low, but each made a statement that could be untrue, which blocks a merge by the owner's rule:

1. **The privacy page's "at most 31 days" of daily solves kept on the device.** The store trimmed by distance from the
   daily just solved, so solving old dailies out of order (friends' links) kept more. It now keeps the 31 dailies with
   the highest numbers; a test records them newest first.
2. **A time the switch queued while offline went after the switch was turned off,** where the privacy page says a time
   then goes only on a tap. Such a time is now marked as the switch's, on the device only, and dropped at the next
   flush once the switch is off; a test holds it, and that the mark is never sent.
3. **A re-solved daily's win screen gave the first sent time's place under the new time.** It now says which time is in
   the results ("The time in the results is the first one you sent, 10:05.").

Lows taken with them:
- "shows your place" became "shows where your time stands": from 20 times the result is a share, not a place. This is
  in Settings and the privacy page, in three languages.
- The switch's hint says "You can turn it off here or in Settings".
- The share button names the daily as the rest of nb and es do.
- A browser's prefetch or prerender of a page (Sec-Purpose) no longer counts as a home landing.

## Left for later (low)

- The wings' frame-1 legend names roles the frame does not draw yet (the walk's sentence is right). A walk frame
  could carry its own legend label.
- A cut position link in the pre-October link format says only the marks were lost, over a board unrelated to the
  link.
- WXYZ-Wing drawn as the ALS-XZ it is (tile, link, z truth).
- The other phase 6 items: every other technique's walk, M17 (link sentences naming their house), L2 and L3.
