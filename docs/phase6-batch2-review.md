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

<!-- FIXED -->

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
