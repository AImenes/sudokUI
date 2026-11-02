# The readability pass, review round 1: the findings and the fix

The readability quick wins (docs/hint-readability-2026-11.md section 4,
and round 3's two lows) were built by four fixers (1bd6f7c words A, 82f888a
words B, 9ba1037 frames, c2ac200 geometry), brought together in 1bb8216, and
reviewed on 2 November 2026 by five lenses (truth, words, design, code,
regression), with two refuting skeptics on each blocking claim. The truth
lens found nothing false. Nothing the review found teaches anything untrue.

## Fixed

1. **UR4, UR6 and the Hidden Rectangle: frame 1 named the whole rectangle
   and drew part of it** (medium, design lens, both skeptics). The batch
   moved each pattern's key digit into the gold role, so frame 1, which
   says "the rectangle: x/y in all four corners", left those candidates
   plain. The key digit is now in both lists, the pattern's until the frame
   that shows the gold colour (G5). 69cd0f5.
2. **Death Blossom some ten times slower to draw** (medium, code lens;
   reproduced: 150 to 300 ms against 10 to 35 on main, on a desktop). M11's
   search for fewer crossings ran to the end where no drawing avoids one. A
   crossing now ranks the drawings a tie tries, and a tie clean of all but a
   crossing tries six arcs more; a tie along its row or column runs along it
   as phase 4 settled. Death Blossoms with crossing ties along the paths:
   main 696, the unbounded search 208, now 550, in main's time. 787a906.
3. **The forum line of the uniqueness family changed** (low, a regression,
   code lens). Copy step followed the drawing's new roles ("5 in r56c69 / 6
   in r56c69", a bare "/ r4c8"). It is written from the rectangle again,
   every stored example's line identical to main's. 787a906.
4. **UR4 and a one-removal 3D Medusa said their conclusion twice** (low, a
   regression, words lens). Their sentences named the cells before a ';'
   and the digit after it ("so 4 is removed from both"), which M21's check
   reads as naming no removal. They now name both together, in en, nb and
   es. 787a906.
5. **nb UR3 was circular** ("må få en ekstrakandidat"): now "må være en av
   ekstrakandidatene sine". 787a906.

## Known and accepted (low, for later)

- M7's bends take some single-digit arrows over solved digits where main's
  did not (rank solved digits crossed before `stray`; M10 is phase 7).
- M20's conclusion of a long multi-digit removal (a real-size 3D Medusa) is
  hard to scan: order single-digit groups by digit (L3, phase 6).
- In forest, the player's gold entered digits sit inside the new gold
  bands of the uniqueness patterns (M6).
- A continuous grouped X-Cycle starting on a group says "The chain is back
  at r1c4, r1c5": name it "the group r1c4, r1c5", in its own template.
- An AIC with ALS whose chain starts inside a set gets the general ending
  ("One end of the chain is true ..."), not the either/or of a single
  candidate: treat a one-candidate start as lone.

## How it was checked

- **The regression lens did not finish** (the account's usage limit).
  Regression against main rests on: every changed part of every entry of
  both drawing fixtures traced to a fixer's item (none unexplained, none
  lost); the design lens comparing every touched technique's frames with
  main's, side by side (rd-shots, remade with each side's own
  scripts/hint-shots.cjs, which reads examples.json from its own checkout);
  the code lens; every stored example's copy line equal to main's; and the
  path digest, unchanged.
- The full checks (tsc, vitest, the menus path digest, build, the browser
  tests in both font setups) on the head before the merge.
