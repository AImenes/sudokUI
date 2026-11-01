# Phase 4, review round 3: the findings and the fix

Round 3 (a confirmation round on round 2's two fix commits, 8e63f86 and 004d6e8; five lenses: logic, words, design,
code, regression; two refuting skeptics on each blocking claim) ran on 1 November 2026. It confirmed every round 2
finding fixed but one part of finding 9, and found four regressions against main before phase 4 (99516ad), all in how
two links side by side are drawn: three medium, one low. Three other claims were refuted, and two lows stand
unverified. Nothing teaches anything false; every head lies on its own candidate.

## The regressions, and what was done

1. **Two links between the same two nodes still drawn with one head where the bent one comes first** (medium, design
   and code lenses, both skeptics). Round 2 moved a bent link's ends round its marks, a pair's width from the other's
   ends, but only for the later link of a pair. The earlier, bent by a letter tab, was moved by its spread alone, and
   a straight partner drawn after it never looked at it: at
   `........214....5......85......26...4.6......5..7..46..5.3....6.4....2..1..67...2.` after 18 steps an
   ALS-XY-Chain on offer drew links 1 and 5, both 6r3c1 to 6r1c1, with tails and tips 2.6 apart, one head, the two
   crossing near both ends; main drew two straight arrows 9 apart. And the pair's width was measured along the tangent
   of the line's own ray, which shrinks once the end is put back on the rim: at
   `.....6.7.3.5....8.......9..8.46....2.2.1..5.....2.8.4..4.5..7...7...2..6..1.7....` after 11 steps two bent links
   began 3.7 apart and crossed twice.
   **Fix.** The width is measured round the mark, as an angle; and on a step with sets, the first link of a pair whose
   ends close up is drawn again once the later is chosen, knowing it (kept only where the ends are then apart and it
   keeps as clear of the marks). Now 9.1 apart, two heads, no crossing (main 9.0); the second 8.6 apart, no crossing.
2. **Round 2's end moving reached Cell and Unit Forcing Chains** (medium, regression lens, both skeptics). It was not
   gated on sets: 352 of 7,983 Cell and Unit Forcing Chains on offer changed, some braided (three repeats of
   7r6c1=6r4c3 crossing each other twice), where the design promises every drawing outside the eight stays byte for
   byte. **Fix.** The end moving, the re-anchoring of links joined alike (`linkEnds`) and the spreading of links
   between other nodes joined at the same two candidates apply to steps with sets alone; `hintDrawing` passes no sets
   for a step that has none.
3. **A Digit Forcing Chain re-anchored since round 1's `linkEnds`** (low, regression lens). The same gate fixes it.
4. **An arrow the tabs bend onto another's head** (part of 1, the design lens's scan). Two arrows into one candidate
   from different nodes, which main drew apart, came together where a tab turned one of them: at
   `9..64.5..1.............8.13....3...64.95....73...6..45...........2..9...65..8...4` after 13 steps link 1 went
   along row 1 into link 5's head (tips 0.0 apart, main 28.5). **Fix.** The along pass of round 2 also takes two heads
   within a head's width (11 units) of each other, nearer than the hint draws them without its bars and tabs, and
   draws the moved one again, its head kept off the other heads into its target; kept only where the heads are then
   as far apart as without the tabs (up to a head's width), it runs along neither and keeps as clear of the marks.

## How it was checked

- **Every drawing outside the eight, against main.** The Cell, Unit, Digit and Nishio Forcing Chains, AIC, Nice Loop,
  X-Cycles, X-Chain, XY-Chain, 3D Medusa, Multi and Simple Colors, Remote Pair and W-Wing finds on offer at every
  position past the singles on the pools' and seeds' paths: 41,250 drawings, identical to main's path for path
  (the scan before the last gate found one difference, the Digit Forcing Chain of 3, now identical). The hard
  puzzles' forcing chains the regression lens named are pinned to main's paths in tests/hintGeometry.test.ts.
- **The set techniques, against round 3's tree and main.** (the scan was running at this commit; its figures follow with the merge)
- **The reviewers' named positions.** Of the 16 positions where ALS-XY-Chains drew two heads within 5 units that main
  drew apart, (the scan was running at this commit; its figures follow with the merge)
- The drawing snapshot (non-set) is unchanged; the set fixture changes only by under half a unit in its two
  ALS-XY-Chains of the hard path (`hard 0, step 8` and `step 9`), the angle measure.

## Known and accepted

- (the scan was running at this commit; its figures follow with the merge)
- **A bar moved by round 2's side rule now runs through an ALS tile** (low, logic lens, unverified). At
  `...86..3......3..7.13..7..94...5..2...6.3.1...7..4...81..6..39.5..2......6..95...` after 17 steps an AIC with ALS
  on offer has the 8s' bar of r7c23 above the 8s, through A's tile, and A's tab pushed out of it. Three finds of
  27,579. For the readability pass: give a side whose bar runs under a square-on head or across another set's tile a
  small cost rather than none.
- **An ALS-XY-Chain whose legend says its premise is impossible still ends on 'if A holds none, D holds one'** (low,
  words lens, unverified). 26 of 3,774 finds, all on offer, 18 of them since before round 2. Every sentence is true,
  but the words conclude through the branch the legend has just called impossible. For the readability pass: word
  such a chain as a clash (its true node's every candidate ruled out by a true candidate), in en, nb and es.

## Refuted

Three claims fell to both skeptics: that round 2's along pass only mends its own measure and leaves knots on a solve
path; that the bars still send grouped chains' arrows on long detours across others where main drew them clear; and
that the along pass can swap a short run along one arrow for a board-wide detour. Each was rated low, not a
regression the merge rule counts, by both skeptics.
