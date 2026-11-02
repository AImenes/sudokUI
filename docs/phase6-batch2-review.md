# Phase 6, batch 2, and reach item 3: the review and the fix

Four fixers built this batch on 2 November 2026, each from main at 64bd524:
- 1bf135e, chain links name the house that makes them (M17), the chain trainer's too;
- 8b6afd3, the singles, subsets and Locked Candidates walk their argument (H1, M20, L1);
- bae5d67, the nine fish walk their argument and draw the fins' box (H1, M4's fish part);
- 938cb2f, pictures of the board and of a hint, and "Share this hint" (reach plan item 3);
- 9357b5d, three browser tests pinned to the new link sentences.

Each fixer scanned its own sentences along all 336 practice solve paths in English, Norwegian and Spanish
(LINK_SCAN, FISH_SCAN, SINGLE_SCAN; 45,311 fish finds and 381,940 single and subset finds) and found nothing false.
The path digest (solve paths, conclusions, ratings) is unchanged. Copy step lines are unchanged and pinned.

It was reviewed by four lenses (truth, words, design, and code with privacy and regression), with two refuting
skeptics on each blocking claim.

## What the review found

Nothing high, nothing medium that stood, nothing false and no regression against main.

The one medium claim came from the code lens: in manual-marks mode the picture draws the app's candidates, not the
player's pencil marks. Both skeptics refuted it. The reach plan chose this on purpose: the picture is built from
`shownCandidates`, as main's "Position as text" is. Every candidate drawn is true, and they are the candidates the
hint was found from. The live preview shows exactly what goes out, and the Candidates tick removes them. A way to
share the player's own marks is a possible later feature (below).

## Fixed (all low)

In c41d998 (`git log` has each one's detail):
1. A degenerate Sashimi X-Wing (a base row whose only digits lie in the fins' box: really Locked Candidates) said its
   fin "stands in for" a corner in another box. The corner sentence is now written only when the corner lies in the
   fins' box; the finder is unchanged. The scan checks the rule along the practice paths, where the case does occur.
2. The sashimi line of a bigger fish names the cell and the digit: "..., in r8c2: the fins r8c7 and r8c9 stand in
   for a second 2." (nb and es name the digit too.)
3. A hidden subset's description says its cells "can hold nothing else", not that they hold nothing else while the
   board still shows the digits about to go.
4. The subset legends say the count in words ("the only two cells of column 8 where 2 and 8 can go").
5. A finned fish's removal frame lists its cells in reading order, as the conclusion does, and two cells read
   "neither of them".
6. The privacy page says a picture is one kind, whether or not a hint is drawn, and that the line does not say which;
   its heading names pictures; the nb and es descriptions are shorter than main's.
7. When a phone's share sheet refuses and the picture is saved instead, the button says "✓ Saved"; a failed picture
   no longer hides the buttons after a later one succeeds.
8. The fins' box dots in the picture and the Learn diagrams keep the board's one dot, one gap.
9. The picture of a walk frame leaves out the step numbers on its arrows, and the dialog, the spec (G25) and the
   reach plan now say so.
10. No-break spaces keep a level with its rating in the picture's footer, and a digit with its words in the fins'
    box legend.

The checks after the fix: tsc, the whole unit suite (1524 passed), the path digest unchanged, the build (270 pages)
and the browser tests in both font setups (95 of 95).

## Left for later (low)

- A picture with the player's own pencil marks instead of the app's candidates (manual mode), as an option.
- The picture has no legend: the player writes their own words, and a legend's role labels come close to naming
  the technique.
- With Candidates off, a walk frame's arrows are laid out around the digits the picture draws, so they can bend a
  little differently from the board's.
- The real share sheet with files (iOS Safari, Android Chrome) is tested only with a stubbed navigator. The owner's
  phone check (Reddit, Discord, Messages) is still to do.
- Copy image needs ClipboardItem with image/png; browsers without it show only Save image.
- The Franken fish still label their cover "where the base's 8s must land"; they are not among the nine fish.
- A hidden subset's conclusion frame keeps the shared "So 2 and 7 are removed from r8c4"; the "keeps only" wording is
  in the lead before it.
- Death Blossom's petal sentences and the forcing chains' link texts keep their own words (M17 does not list them).
- Phase 7's big-fish item (halve the band fills, digit focus on by default) and the singles' M8, M9's new item, M18,
  M5 and L3.
