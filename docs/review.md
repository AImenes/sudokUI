# Review, October 2026

An honest rating of sudokUI against the best sudoku products in the
world, and the road from here. Four independent reviews were run on the
production build (a player driving the app in a browser at desktop and
phone sizes, a sudoku teacher reading the content and the hint texts, a
web engineer measuring the build, and a strategist surveying the market),
plus an audit of what every technique draws on the board. Every claim
below was seen in the code, measured, or screenshotted; where a number
comes from a reviewer's measurement it says so.

## The rating

Two columns: the rating when this review was written, and the rating
after the work it set out (the first minute, the highlighter, the
learner's loop, robustness, the path), re-measured on the production
build at the end of the same week.

| | Then | Now | Why not higher |
| --- | --- | --- | --- |
| Engine and correctness | 9 | 9 | 77 verified techniques, a soundness harness, per-position proofs, every unaided move justified and every wrong digit proved wrong. 15 techniques still have no worked example and four practice targets can never be served. |
| Technique highlighter | 5 | 8.5 | Every technique names its colours and draws its logic: bands for houses, arrows for inference with a start and an order, ties for conjugate pairs, forcing chains as their line of forced singles, and a walk through any drawing one idea at a time. The Forcing Net is not drawn, and the hand-made techniques (Exocet, Pattern Overlay) keep plainer drawings. |
| Learning product | 6 | 8 | A teacher now, not only a textbook: every move credited, "you found it" in practice, why-not on every mistake with the proof shown, the game summed up, mastery in the guide, "learn next", and the path with the next technique a click from its practice. Still no chain trainer, no speed drills, and the hints read English in Norwegian and Spanish. |
| Playing experience | 6.5 | 8 | Conflicts flagged, number-first entry, the hint in view, 44 px phone targets, a landscape layout, a tab that survives a deploy, nothing that goes blank, a printed puzzle scanned from a photo. No SudokuPad or f-puzzles link import yet, and no campaign-shaped way in for a newcomer. |
| Engineering | 6 | 7.5 | Error boundary, update prompt, workers that die cleanly, every lazy file failing soft, dialogs that trap focus, a board that takes focus and reads out its cell, the guide loaded on demand, 12 browser tests in CI, 600 unit tests. The board is still not a real grid for a screen reader, deploys are not gated on CI, no lint, no bundle budget. |
| Reach | 4 | 4.5 | Statistics, streaks and a path now exist. No store presence, no link import, a name that is hard to search, and the market work in search.md is still a plan. |

**Overall: 7.5 of 10 as a product, today** (was 6). For a specialist, 9
(was 8): nothing else rates any puzzle, explains 77 techniques, draws the
logic of each one, drills 65 of them, proves a mistake wrong and knows
what its player can do. For the general public, 7 (was 5.5): the first
minute no longer hits the gaps every mainstream app has closed, and the
learning the app is proud of is now on the board, in the win dialog and
in the path; what is missing is the shape of a campaign, translated
hints, and a way to be found.

The road to 8.5 is reach and shape, not engine: the chain trainer, speed
drills on the stats that now exist, link import, translated hints, the
board as a real grid, and the search and store work already planned.

## The technique highlighter, measured

What each technique's hint carried for the board when this review was
written, from the worked examples (the state since is in
[highlighting.md](highlighting.md): every technique names its colours and
draws its structure, and `tests/examples.test.ts` holds it there):

| Carries | Techniques |
| --- | --- |
| Nothing but the placed digit | Full House, Naked Single, Hidden Single |
| One or two candidates, no logic | Locked Candidates (both), BUG+1, Avoidable Rectangle 1 and 2, Pattern Overlay, Nishio, Digit, Cell and Unit Forcing, Forcing Net |
| Pattern candidates, no structure | subsets, fish and finned fish (no base versus cover), uniqueness (no floor versus roof), ALS-XZ, ALS-XY-Chain, Death Blossom (no arrows for the restricted common digits), Sue de Coq, Exocet, Fireworks, APE |
| Arrows, HoDoKu style | Skyscraper, 2-String Kite, Turbot Fish, W-Wing, colouring (three), X-Chain, X-Cycles (both), XY-Chain, Nice Loops (both), AIC (three) |
| A legend that names its colours | W-Wing, XY-Wing, XYZ-Wing, WXYZ-Wing, ALS-XY-Wing only |

Seen through a designer's eye on five real boards: the arrows are the
right idea and already clearer than sudokuwiki's, but every arrow is the
same amber, drawn dead straight, so long links cross the board over other
pencil marks and arrowheads land on digits; nothing marks where a chain
starts, which way inference runs, or in what order to read it; blue means
the pattern in a fish, one of two colours in Simple Colours and the stem
in Death Blossom, whose petals are heavy gold blocks with no link to the
stem; and a hidden single, the hint most players ever ask for, boxes the
target cell and shows nothing of the unit that forces it.

## The visual standard

Built: see [highlighting.md](highlighting.md) for the standard as it stands
in the code, family by family.

What "world's best technique highlighter" means, concretely, so it can be
built family by family and tested:

1. **One colour grammar.** Blue is the pattern (base cells, chain nodes,
   the locked set). Amber is what the pattern acts through (cover lines,
   pincers, the second colour). Purple is the exception (a fin, the
   extra candidate). Red is removed, green is placed. The legend always
   speaks: every technique carries labels for the colours it uses.
2. **Structure, not dots.** A fish shades its base lines and its cover
   lines as translucent bands. Locked Candidates shade the box and the
   line. A subset shades its unit and circles the set. Uniqueness names
   floor and roof. An Avoidable Rectangle shows its solved cells. A single
   shades the unit and points from the peers that block the digit to the
   one cell left: the why, not just the where.
3. **Arrows that are beautiful.** Routed around pencil marks (a curve or
   an orthogonal path with a light halo), a start marker, numbered in
   reading order, direction of inference always visible. ALS links draw
   their restricted common digits. Forcing chains draw the implication
   trail from the assumption to the contradiction, and both branches when
   two branches agree.
4. **A walk stage.** Between "the technique is X" and "apply", a stage
   that reveals the drawing one link at a time, with the sentence for
   that link, so a chain reads in order. This is also the first piece of
   the chain trainer (goals.md, item 2).
5. **The same drawing everywhere.** The in-app board and the static Learn
   pages (`src/content/boardSvg.ts`) share the renderer, so a technique
   looks the same in a hint, in the guide and in a shared link.
6. **Hint text to one standard.** The WXYZ-Wing, Chute Remote Pair and
   colouring descriptions are the model: the pattern cells with their
   candidates, the case split in one sentence, the removed candidates by
   cell. Half the catalogue is still a terse label ("a x-wing in 2 rows
   with fin(s)"). Descriptions become structured (a template and its
   cells and digits) so they can be rendered in any language, which is
   also what unblocks translated hints.

## What the reviewers found

Blockers and important findings, grouped by who feels them. Each has
evidence in the review transcripts; the ones marked (verified) were
confirmed in the code afterwards.

**Every player, first minute**

- A repeated digit in a row, column or box is never flagged; only Check
  finds it, and Check counts as assistance (verified: no conflict logic
  in Grid.tsx or settings.ts). NYT, SudokuPad and sudoku.coach all flag
  it by default, with no solution lookup.
- On a 1280 × 800 laptop the hint panel opens below the fold; its "Show
  me" and "Apply step" buttons sit at 850 to 925 px (measured).
- A wrong digit followed by Hint produces "Your pencil marks lead to an
  impossible deduction", with no pencil marks on the board (screenshot).
- The H key skips the "ask before the first assist" guard the button
  respects, and pressing it again never advances the hint (verified:
  App.tsx calls requestHint unguarded).
- No number-first entry and no digit filter, although the guide says
  "filter on one digit" (screenshots at both sizes).
- Phone: mode buttons 29 px tall, keypad 38 px wide, no landscape layout
  (measured at 390 × 844 and 844 × 390).

**The learner**

- Practice puzzles need nothing harder before the target, but anything
  after it: 7 of 10 X-Wing practice puzzles continued into Unfair or
  Extreme (measured), so "Another X-Wing" is rarely reachable. Fixed:
  the practice ceiling (technique-stats.md).
- Practice never says "you found it"; every fast-forwarded practice game
  is flagged assisted. Fixed: the practice target and "found".
- A mistake gets a red square. Road item 3 of goals.md is unbuilt. Built:
  Check says why, and shows it.
- Nothing is recorded about the player; the "worth learning first" order
  puts 3D Medusa third for a beginner. Road item 1 is unbuilt. Built:
  the stats, the summary, mastery in the guide and "learn next".
- Four practice targets can never be served (X-Cycles, Franken X-Wing and
  Swordfish, Tridagon: zero in 5.5 million puzzles, no stored puzzle),
  and 15 techniques have no worked example.
- The Solution path shows names and scores only; the step's explanation
  is a hover title.

**The engineer**

- The SVG board has no role, label, tabindex or live region: a screen
  reader user cannot reach a cell (measured: 60 Tab presses). Partly
  fixed: the board takes focus (one Tab from the top bar), names its
  keys, and a live region reads out the selected cell and its contents;
  the cells themselves are still not individual grid cells to a screen
  reader.
- A push to main deploys even when CI fails, and architecture.md says the
  opposite (verified). The seed-test flake this week went live for two
  minutes for exactly that reason.
- The service worker auto-updates and the lazy chunks (locales, seeds,
  practice puzzles, examples) have no failure path, no error boundary
  and no worker error handler: an open tab after a deploy can fail on a
  chunk that no longer exists. Fixed: a new build waits for the player
  (the update bar, checked hourly), a chunk that fails to load offers
  the same reload, every lazy loader fails soft, a worker that dies
  settles its requests and is replaced, and a render error shows a
  recovery panel instead of a blank page (`tests/resilience.test.ts`).
- The main chunk is 483 KB: 131 KB react-dom, about 135 KB of English
  Learn prose that could load with the Learn tab, and the technique code
  once more in the worker. The precache installs the Norwegian and
  Spanish bundles for every visitor (verified in dist/sw.js). Partly
  fixed: the guide is its own 111 KB chunk, fetched when it first opens
  (the main chunk is 417 KB); the locales and the worker's copy of the
  engine remain.
- Dialogs do not trap focus; 80 nested-interactive axe violations in the
  Learn guide; no lint, no UI test, no bundle budget. Fixed: dialogs trap
  Tab; a Playwright smoke suite (12 tests) runs in CI. Open: the axe
  findings in the guide, lint, a bundle budget.
- The README claims a Capacitor wrap that does not exist in the repo.

**The market**

- No store presence and no inbound links; sudoku.coach and SudokuWiki
  both sit on Google Play.
- No statistics, streaks, history or mastery, which every mainstream
  competitor ships.
- No campaign; sudoku.coach's 50-level campaign is what its reviews
  praise.
- Import takes an 81-character string only: no SudokuPad, f-puzzles or
  Sudoku Exchange links, no camera.
- Hints and worked examples are English in Norwegian and Spanish.
- The name is hard to find and the README invites the SudokuPad
  comparison that variants make unwinnable; "classic sudoku trainer with
  the deepest technique library" is the honest position.

## The road from here

In order, each step shippable on its own and held by tests before it
touches the 70 daily players.

1. **The first minute** (small, safe, days): conflict highlighting on by
   default; the hint panel above the fold with Hint and H stepping
   through name, explanation, apply; the wrong-digit message naming a
   placed digit; number-first entry and a digit filter; 44 px phone
   targets and a landscape layout; a hashchange that loads a shared
   link. And gate the deploy: a required CI check on main.
2. **The highlighter** (the standard above, family by family): singles and
   intersections first since that is where most players live, then fish
   and subsets, uniqueness and avoidable rectangles, ALS, forcing trails,
   the walk stage, the shared renderer. With it, the hint text standard
   and structured descriptions.
3. **The learner's loop** (road items 1 and 3, technique-stats.md), built:
   every unaided move justified, "you found it" in practice, why-not on
   every mistake, the post-game summary, mastery in the guide, "learn
   next", and practice puzzles within one band of their technique. The
   path (📈 in the top bar): the practisable techniques needed in at least
   one puzzle in a hundred, in solver order, learned after three unaided
   uses, the next one a click from its practice; with the band records and
   the daily streak. Still to come: mastery in the practice picker.
4. **Robustness** (engineering findings): update prompt, lazy-chunk
   retry, error boundary, worker errors, focus traps, a focusable board
   that reads out its selection, the guide loaded on demand, a Playwright
   smoke test in CI (all built); still to come: the board as a real grid
   for screen readers, locales precached on demand, lint.
5. **Reach**: import of SudokuPad, f-puzzles and Sudoku Exchange links;
   statistics and streaks on top of step 3; print; a store build through
   Capacitor done for real or the claim removed; keyword-led titles and
   the r/sudoku and Enjoy Sudoku forum seeding search.md already plans;
   translated hints once descriptions are structured.

Steps 2 and 3 are what the app is proud of and what the rating rewards
most. Step 1 is what a new player judges it on before any of that is
seen.
