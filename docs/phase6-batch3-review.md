# Phase 6, batch 3, and the Match device theme: the review and the fix

Five fixers built this batch on 3 November 2026 from main at 6e3619b, and their commits stand in one line on it
(9736f69..2ce8d53):
- 9736f69, Settings: a Match device theme (nb "Som enheten", es "Automático") that shows Daylight while the device
  is in light mode and Dark while it is in dark mode, switching with the app open; the browser's and an installed
  app's bar wear the top bar's colour in every theme; a new player still starts dark;
- b91effa, Empty Rectangle walks as the grouped 2-String Kite it is, bands its box, row and column solid and the
  pair's line dashed, and its guide entry says "only two places" where it said "conjugate pair";
- ef9b696, Fireworks and Exocet walk their argument and band the lines it uses (a line's band cut to a box,
  `UnitBand.within`, and a walk frame that draws only its digits, `digits`);
- e301a81, the WXYZ-Wing drawn and walked as the ALS-XZ it is, and a walk frame's legend that names only what the
  frame draws (`Step.walk` frame labels), used by the XY- and XYZ-Wing (batch 1's low);
- d3651cf, the words pass: plain, exact words and one lead line (L2, L3) for BUG+1, Unique Rectangle Type 3, the
  Extended Rectangle, the ALS-XY-Wing and ALS-XY-Chain, the Grouped Nice Loop, 3D Medusa and the AIC, and a hint
  panel that leaves out the "Name:" its title repeats;
- 2ce8d53, after the five: the words pass's name-strip test, held for the descriptions batch 3 now leads without
  the name.

Each fixer scanned its own sentences along the 336 practice solve paths in English, Norwegian and Spanish, held to
the board and to the puzzle's solution, and found nothing false: ER_SCAN=all (4,227 Empty Rectangle finds, each
with the Copy step line, roles and removal equal to main's), FIREWORKS_EXOCET_SCAN=all (1,949 finds), WING_SCAN=all
(every XY-, XYZ- and WXYZ-Wing find) and WORDS_SCAN=all (every find of the words pass's techniques). The theme
fixer tested the store, the device's scheme and returning players (tests/theme.test.ts), the bars' colours on the
static pages, and in the browser switched the device with emulateMedia while the app was open and checked the fit
on phones in the three languages. The path digest (solve paths, conclusions, ratings) is unchanged, and so is every
Copy step line.

It was reviewed by six agents in two lenses (truth, and words and design), with two refuting skeptics on each
blocking claim.

## What the review found

Nine findings: two standing, none split or refuted, seven lows. Nothing high.

1. **Empty Rectangle's guide taught a false rule (medium, a regression).** The batch's "why" read: "Either way the
   cell where that column meets the other place's row sees an X and loses it", and neither it nor the "what" kept
   main's "outside the box". Where the pair's other place lies in the box's band, that cell is inside the box and
   can be the answer: on the reviewer's board (the solution v(r,c) = (3r + floor(r/3) + c) mod 9 + 1, box 1's 5s in
   r1c2, r1c3 and r2c2, column 5's only two in r1c5 and r2c5) the rule took the 5 from r2c2, the solution's 5. The
   finder never makes this step (its band check in singleDigit.ts), so only the guide was wrong, on the Learn page
   and the static technique page, in all three languages. Both skeptics confirmed it.
2. **Exocet's walk proved a base digit impossible that the step then left (filed medium; both skeptics: real, but
   low).** "So neither base cell can be 5" was written whatever the targets held, but the finder takes a digit
   from the base only where neither target holds it. At 42 of the 830 Exocet finds on the practice paths (in 12
   puzzles) a frame said a base cell could not be a digit, the step removed nothing of it, and the frame still drew
   it as a blue base candidate. Every sentence was true; the step stopped short of its own walk. Exocet is never the
   chosen step on a practice path, so a player sees this only through "What's in this position?" or a custom
   puzzle.

The lows:
3. Fireworks' first wing frame and Exocet's one-digit frames drew part of a role while their legend named the whole
   of it (G23), and Exocet's second frame labelled the targets with the conclusion ("each digit the base holds is
   in one of them") before frames 3 on argued it. Found by both lenses.
4. The WXYZ-Wing's one-line description never said why the removed cells lose z, as the other ALS leads end.
5. Exocet's template sentence put a bare count where the app writes digits: "the 6 that use a base cell" reads as
   the digit 6 (nb "bruker 6 en basisrute" too).
6. The Norwegian Match device help line read as a garbled sentence ("Som enheten følger enheten din": unquoted at
   the start, "Som" reads as "As"), and the English was redundant with the name unquoted.
7. Empty Rectangle draws its removal inside a solid band (row 1 and column 2 run the whole board) and the
   confining pair's line dashed, the reverse of the shapes G15 teaches elsewhere. Left, below.

(The craft lens filed item 2 again as a low; it is counted once above.)

## Fixed

In the fix on 2ce8d53 (the commit that adds this record; `git log` has each one's detail):
1. Empty Rectangle's guide says again that the cell that loses X is outside the box, in all three languages: "Either
   way the cell outside the box where that column meets the other place's row sees an X and loses it" (nb "ruten
   utenfor boksen", es "la casilla fuera de la caja"). It keeps "only two places", and fits the guide's limits (44
   words of 45). tests/erWalks.test.ts now applies the guide's rule as it reads: on the reviewer's board it takes
   nothing (without "outside the box" it would take r2c2's 5, the answer, which the test shows); it removes no answer
   at any position along the practice paths that hold an Empty Rectangle (eight by default, all of them with
   ER_SCAN=all), every finder removal is one of its own, and each language's "why" carries the restriction.
2. Exocet's frames claim no more than the step does. Where the walk keeps a digit out of the base and a target holds
   it, the frame says "so 5 is not one of the base's two digits. This step does not remove it from r8c5." (nb, es
   the same), and draws that digit in no cell, only the bands, so it does not read as part of the base. Where no
   target holds the digit, "so neither base cell can be 5" stays, and the step removes it from every base cell
   holding it. The finder finds what it found before; the path digest passes unchanged. The scan now checks every
   frame that keeps a digit out of the base against the step's removals, and the two positions the reviewers gave
   are pinned in three languages; the full scan finds 485 frames whose digit goes and 42 that say it stays.
3. G23 for the new frames, as frame labels on `Step.walk`: Fireworks' first frame names "the row's wing: the only
   cell of row 8 outside box 8 that can be 1, 4 or 8" (the second, which draws both wings, keeps the plural);
   Exocet's second frame "the targets, in row 7 and row 8"; each digit frame "5 in the base" and "5 in the
   targets", or the bands alone where a frame draws no candidate of a role ("the targets' lines, column 4 and column
   6" where no target holds the digit; "the base, where column 5 meets box 8" too where the step leaves it). The
   legend-by-frame check in tests/fireworksExocetWalks.test.ts now compares the label text, frame by frame, at every
   find (FIREWORKS_EXOCET_SCAN=all, all 1,949). An empty `digits` list on a frame now means it draws its bands alone
   (src/engine/steps.ts says so).
4. The WXYZ-Wing's description ends as the other ALS leads do: "... holds a 4. Set A or set B holds a 4, so no cell
   that sees every 4 of both can be 4." (nb, es the same); the description regex in tests/wingWalks.test.ts holds
   the ending to z at every find.
5. Exocet's template sentence puts the noun after the count: "the board leaves 9 ways to place all nine 5s; 6 of
   those ways use a base cell, and each of them uses a target too" (and "one of those ways uses a base cell, and it
   uses a target too"), in en, nb ("6 av disse måtene") and es ("6 de esas formas").
6. The Match device help line quotes the option name: "“Match device” shows Daylight while your device is in light
   mode, and Dark while it is in dark mode", nb "«Som enheten» viser Dagslys mens enheten din er i lys modus, og
   Mørk mens den er i mørk modus", es "«Automático» muestra Claro mientras ...". The browser test reads the new line.

Stored examples refreshed (scripts/hunt-examples.ts refresh): three changed, in words only. WXYZ_WING: its
description's new ending. FIREWORKS: frame 1's legend label. EXOCET: frame 2's and each digit frame's legend labels,
and the two counted sentences (frames 4 and 5). Drawing fixture (DRAWING_SNAPSHOT=write-all): only EXOCET's frame
texts 4 and 5 and its frame legends' labels, and FIREWORKS' frame 1 legend label; no mark, band or arrow moved,
and the set fixture is unchanged. The stored examples hold no Exocet digit the step leaves, so no stored drawing
changed for item 2.

The checks after the fix: tsc, the whole unit suite (1637 passed, 17 skipped), the path digest with its menus
unchanged, the build (270 pages), the browser tests in both font setups (112 of 112 each), and the full scans
FIREWORKS_EXOCET_SCAN=all (1,949 finds), WING_SCAN=all for the WXYZ-Wing's ending, and ER_SCAN=all for the guide's
rule.

## Left for later (low)

- Empty Rectangle's band shapes: row 1 and column 2 are banded solid across the whole board and the removal sits
  in one of them, while the pair's line, the house that confines, is dashed, the reverse of G15's "solid for the
  house that confines, dashed for the house that loses" that Locked Candidates and the fish follow. The labels are
  true. Whether to dash the box's lines and make the pair's solid, or cut the box's row and column to the box
  (`UnitBand.within`), is a design question for later, with the Status sentence to match.
- Exocet's finder could take what its walk proves: a base digit no template, box or line lets into the base goes
  from both base cells and from both targets (sound, since the targets hold exactly the base's two digits). That
  changes what the finder finds, so it is a measured engine change, not a words fix; for now the frame says the
  step leaves the digit.
- Exocet's conclusion frame and full view still draw such a digit in the base's and the targets' colours, under
  the step's own labels ("two different digits of 1, 2, 5 and 6", "each digit the base holds is in one of them"),
  which are true of them.
