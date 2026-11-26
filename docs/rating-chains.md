# One technique, one price: the AIC filed with the Nice Loops

The owner's decision of 25 November 2026, after comparing the app with
HoDoKu on the Washington Post puzzle
`.4......1...7.5...9...3.........15.6.....2..8.79......4.2....3...53..8...9..4...7`
(HoDoKu 3356; sudokUI 1322 with uniqueness, 6508 without): "We strive to
be the world's best app, so we shouldn't put too much emphasis on matching
HoDoKu, but we should at least make sure we don't have any bugs."

## What was wrong

A Nice Loop is a loop of strong and weak links in turn. Where the
alternation breaks at one candidate, the loop is discontinuous:

- two strong links meet there: the candidate is true and is placed;
- two weak links meet there: the candidate is false and is removed.

`findNiceLoop` (src/engine/techniques/aic.ts) found continuous loops and
the two-strong-links kind at Nice Loop's place, index 5600 and 280
points. The two-weak-links kind, the most common, was left to the plain
AIC search: the candidate where the two weak links meet conflicts with
both ends of the chain between them, which is exactly what `findAic`
removes. That search was filed as Alternating Inference Chain at index
5950 and 320 points, after ALS-XZ (5700, 300), ALS-XY-Wing (5800, 320)
and ALS-XY-Chain (5900, 340). The same reasoning cost 40 points more and
was tried after three harder techniques. Nothing in the code or the docs
gave a reason; the comment in aic.ts said only that the chain search "runs
at its own index".

HoDoKu has no such split. Its `NICE_LOOP` step is named "Nice Loop/AIC"
and its `SolutionType.getStepConfig` files `CONTINUOUS_NICE_LOOP`,
`DISCONTINUOUS_NICE_LOOP` and `AIC` all under it (5600, 280), and
`GROUPED_CONTINUOUS_NICE_LOOP`, `GROUPED_DISCONTINUOUS_NICE_LOOP` and
`GROUPED_AIC` under `GROUPED_NICE_LOOP` (5650, 300) (SolutionType.java,
r147). `tests/hodoku.test.ts` now holds AIC at 280 and AIC with Groups at
300 with the rest of HoDoKu's scores.

## What changed

Only where a step is filed and what it costs; every finder removes and
places exactly what it did.

| Technique | Before | After |
| --- | --- | --- |
| Nice Loop | 5600, 280 | the same |
| Alternating Inference Chain | 5950, 320 | 5610, 280 |
| Grouped Nice Loop | 5650, 300 | the same |
| AIC with Groups | 5960, 340 | 5660, 300 |
| AIC with ALSs | 5970, 360 | the same |

- **The AIC right after the Nice Loop, at its price.** The two stay
  separate techniques with their own names, Learn pages and practice: the
  Nice Loop search runs first, so a loop that places a digit or clears a
  whole loop is taken before a chain that removes one candidate, and the
  AIC search runs next. They are not one finder because the AIC is the
  name players know the removal by (the Learn page, the glossary, the
  chain trainer and every hint call it that), and filing a two-weak-links
  loop as a Nice Loop would have left no step ever named AIC. Their
  indices differ (5600 and 5610) so the practice filter, which reads "a
  step with a higher index before the technique" as harder, keeps the two
  apart.
- **The grouped pair the same way.** A grouped AIC is the grouped Nice
  Loop broken by two weak links, so it now comes right after the Grouped
  Nice Loop at 300. The grouped engine (groupedAic.ts) used to serve AIC
  with Groups and AIC with ALSs in one call at 5960, naming a step by what
  it held. With the grouped AIC moved, that one call would have filed
  chains through almost locked sets at 5660, before the ALS techniques
  they generalize. So the engine now runs twice: `findGroupedAic` without
  sets, at 5660, and `findAlsAic` with them, at 5970, which reports only
  chains that use a set. Each step found is the step the old engine found
  for that chain.
- **AIC with ALSs stays where it was.** The grouped Nice Loop search has
  no almost locked sets, so there is no loop of that shape for it to be
  priced against; it generalizes the ALS-XY-Chain (340), and stays above
  it at 360. HoDoKu has no AIC with ALSs to compare with.
- **X-Chains and X-Cycles were already consistent.** The single-digit
  AIC is the X-Chain (5400, 260), tried before the X-Cycles loop (5450,
  280), so the cheaper reading already ran first there.

## What it does to the ratings

Measured with `.vite` scripts on the engine before and after, every
puzzle rated in full with HoDoKu's order (uniqueness on) unless said.

- **The 451 dailies and the 24 advent doors: none changes.** Not one of
  them reaches a technique at index 5600 or above: the dailies are Easy
  to Hard, the doors Easy and Medium, and the change only touches the
  path from the first chain step on. Their published ratings
  (dailies.json, advent.json) stay true.
- **The Washington Post puzzle without uniqueness: 6508 becomes 2226.**
  Before, at the step where an AIC removes a candidate, the solver had to
  pass it by and take a Finned Swordfish, six ALS-XZs, an ALS-XY-Wing,
  two ALS-XY-Chains, two 3D Medusas and four Nice Loops on the way. Now it
  takes the AIC (280) and the rest is Hard-class. With uniqueness it stays
  1322: its path has no AIC.
- **200 generated Unfair and Extreme puzzles** (rated Unfair or Extreme
  before; 70 Unfair, 130 Extreme):

  | | Before | After |
  | --- | --- | --- |
  | Mean score | 2496 | 2524 |
  | Median | 2144 | 2138 |
  | 10th percentile | 1200 | 1248 |
  | 90th percentile | 4360 | 4358 |
  | Puzzles with an AIC | 12 | 61 |
  | with an AIC with Groups | 4 | 22 |
  | with an ALS-XZ | 43 | 13 |
  | with an ALS-XY-Wing | 43 | 12 |
  | with a Grouped Nice Loop | 17 | 6 |

  137 keep their score, 34 rise and 29 fall (from 2070 lower to 2234
  higher); 2 move from Unfair to Extreme and 3 from Extreme to Unfair.
  Without uniqueness the picture is the same: 130 keep their score, 37
  rise, 33 fall, mean 2495 to 2519, 4 up a level and 3 down.

So the distribution hardly moves, but single puzzles can move a long way
either way. Why up: the solver takes the cheapest step that works, and an
AIC at 280 now comes before a Grouped Nice Loop, an ALS-XZ or an
ALS-XY-Wing that did more. One saved practice puzzle,
`91.6...7.....1.5.3..4.2.1.....876..946..........3....51.92...8..2..3.......9..2..`,
was cracked by one Grouped Nice Loop placing a digit (1186, Unfair); now
an AIC removing one candidate comes first and the path needs four AICs, a
Nice Loop, a Finned Swordfish, a W-Wing and a 3D Medusa (2916, Extreme).
Why down: the Washington Post case, where the AIC was all that was needed
and the solver used to have to go round it. Both are the rating's one
rule, the easiest step first, applied to a catalogue that now prices the
same reasoning the same.

## The stored content, moved with it

- **Saved practice puzzles** (src/content/practicePuzzles.json): each was
  rated again and kept if it still needs its technique with nothing harder
  first. Lost: Grouped Nice Loop 8 of 12, AIC with ALSs 6, Aligned Pair
  Exclusion 6, Death Blossom 3, AIC 1, Fireworks 1; 43 more kept their
  technique with another rating. `scripts/build-practice.ts` made new ones
  for the Grouped Nice Loop, the AIC with ALSs and the AIC (12 each again);
  the three rarest (Aligned Pair Exclusion 6, Death Blossom 9, Fireworks
  11) were left with what they kept, since one new Fireworks puzzle takes
  about 100,000 attempts.
- **The seed library** (src/content/seeds.json): 11 of the 144 seeds
  changed band (6 Unfair to Extreme, 4 Extreme to Nightmare, 1 Nightmare
  to Extreme) and moved with it; `scripts/build-seeds.ts` (6 minutes)
  filled each band to 48 again, round robin over the crux.
- **Worked examples** (src/content/examples.json): the AIC, AIC with
  ALSs, ALS-XZ, ALS-XY-Wing and ALS-XY-Chain examples were hunted again
  (`scripts/hunt-examples.ts` with `only=`, a targeted hunt added for
  this, which leaves the other examples and the frequencies alone): the
  old puzzles no longer reach their technique, or reach it elsewhere. The
  two examples decision 22 of docs/hint-drawing-sets.md chose by their
  groups were chosen again the same way: the AIC with Groups is the same
  puzzle and the same chain, now at step 14 (an AIC comes first), its end
  group TRUE; the Grouped Nice Loop is a new puzzle, at step 18, with a
  TRUE group of three and a false group (the old one's TRUE and FALSE
  groups of three on the same cells could not be found again in 16
  minutes of search).
- **The frequencies** (src/content/frequency.json, "Needed in 1 in N
  puzzles" on the Learn pages) were measured over 5.5 million puzzles
  under the old filing. See "Not done" below.
- **The test fixtures** that hold every solve path step by step
  (tests/fixtures/pathDigest.json, colouringRemovals.json,
  drawingSnapshot.json's and setDrawings.json's examples) were written
  again, since this change means to move paths
  (`PATH_DIGEST=write`, `COLOURING_REMOVALS=write`,
  `DRAWING_SNAPSHOT=write-kept`, the last two added for it). The tests
  that name a board by its place on a solve path keep the nine positions
  that moved as the paths reached them before
  (tests/fixtures/pathsBefore.json, tests/pathBefore.ts), and the tests
  that pin an example's words and drawing keep the seven examples from
  before (tests/fixtures/examplesBefore.json, tests/examplesBefore.ts):
  the finders are the same, so every step there is still the one the
  test was written for.

## Not done

- The frequencies were not measured again: that takes days of rating.
  The chain and ALS techniques' "Needed in" figures on the Learn pages
  are the old filing's until the next long run of
  `scripts/hunt-examples.ts`; on the 200 puzzles above the AIC is now
  needed about five times as often and the ALS-XZ and ALS-XY-Wing about a
  third as often.
- Two drawings the moved paths now meet break a rule the drawing tests
  hold everywhere else, and are named as accepted in their tests so that
  any other is still caught: a 3D Medusa (rule 3) whose walk number
  overlaps a mark, at
  `.9..2.........4..83.....2...2.19......6.8.5..7...........8.3.6.....4..2...5..714.`
  after 51 steps (tests/colouring.test.ts), and an AIC with Groups on
  offer in a seed at step 33 whose arrow 6 its bars push along arrow 5
  (tests/pathDigest.ts). Neither is a wrong step; both are for the hint
  drawings' next round.
- sudokUI's finders return the first instance they find in a position.
  Which of several AICs worth the same is taken was left alone: changing
  it would change what the finders find, which this change was not to do.
