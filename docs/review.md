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

Four columns: the rating when this review was written; the rating after
the work it set out (the first minute, the highlighter, the learner's
loop, robustness, the path) and what followed it (the chain trainer, the
photo scanner, Learn as one place, the phone header and touch scrolling);
the rating after the online work of early October 2026 (the whole site in
three languages, share links that preview, a board that highlights the
moment a finger lands, the shared daily with everyone's times, links from
the other solvers, [online-goals.md](online-goals.md) phases 1 and 2);
and the rating on 21 October 2026, after plays began to be counted
without identifying anyone (phase 3 and its clean-up), the set tracker,
hints without uniqueness, spoiler-free share links, the phone and tablet
fits, and the site submitted to Google and Bing. The last column was
judged by three independent raters (a sudoku expert and teacher, a casual
player on a phone with a designer's eye, a web engineer and growth
strategist) on the production build and its tests (920 unit tests, 52
browser tests); they agreed on every row.

| | Then | Sept. | Oct. | 21 Oct. | Why not higher |
| --- | --- | --- | --- | --- | --- |
| Engine and correctness | 9 | 9 | 9 | 9 | 77 verified techniques, a soundness harness, per-position proofs, every wrong digit proved wrong; now a set tracker that proves two sets equal by counting houses, and hints that can leave uniqueness out. 15 techniques still have no worked example and four practice targets can never be served. |
| Technique highlighter | 5 | 8.5 | 8.5 | 8.5 | Every technique names its colours and draws its logic, with a walk through each drawing. The Forcing Net is not drawn, Exocet and Pattern Overlay keep plainer drawings, and the set tracker's proof is a sentence: the houses it counts are not shaded on the board. |
| Learning product | 6 | 8.5 | 8.5 | 8.5 | Hints, Steps and the proofs can now leave uniqueness out, as many teachers solve; the path says why the rarer techniques wait, and the glossary defines corner, floor and roof. Still no speed drills, and the set tracker has no page in the guide. |
| Playing experience | 6.5 | 8.5 | 9 | 9 | Share links no longer give the techniques away unless asked, all nine keys fit a 320 px phone, and tablets have finger-sized mode buttons. A challenge on a phone is copied to the clipboard rather than offered to the share sheet, the one daily is often Tricky or Hard, and there is no campaign for a newcomer. |
| UX design | 7 | 8 | 8.5 | 8.5 | New features keep the one visual grammar (the set tracker is a line under the board with a Why?), and the narrow-phone, landscape and tablet fits are fixed. The win screen is longer still (a first-win note about counting), Settings has grown to about twenty switches without grouping, and New game still reads as a list of bands. |
| Learnability | 6 | 8 | 8 | 8 | Small steps on a good base: Learn says why a technique waits and defines the rectangle terms. The welcome's main button can land a newcomer in a Hard daily, a phone shows every entry mode and assist from the first second, and there is still no guided first week. |
| Easiness (how little the app asks) | 7 | 8.5 | 9 | 9 | Plays are counted with no account, no cookie, no ID and no banner; counting offline is opt-in, and one switch leaves a device out. The first explanation of modes and candidates is the only friction, and Settings gains a switch with each feature. |
| Engineering | 6 | 7.5 | 8 | 8 | 920 unit tests and 52 browser tests, the counting tested end to end against a store in memory with five refuting review rounds, and a database that keeps no more than the privacy page says. But deploys are not gated on CI: the browser tests have failed on GitHub's Linux runner since the 320 px fit merged on 21 October, and both pushes went live. No lint, no bundle budget, migrations by hand, /admin trusts Access's header without checking its token, and the board is not a real grid for a screen reader. |
| Reach | 4 | 5 | 6.5 | 7 | Plays, solves and landings are counted without identifying anyone, the sitemap is in Google and Bing, and the GitHub page has a homepage and topics: the loop can be read for the first time. The English home page is titled just "sudokUI" while the Norwegian and Spanish ones carry keywords, a phone shares only by copying, there is no store listing, and nothing has been seeded where the expert audience reads. |

**Overall: 8.5 of 10 as a product, today** (was 6, then 7.5, then 8,
then 8.5). These two weeks were measurement and polish, not a new layer:
the counting is privacy by design and the loop can finally be read, and
experts got two tools no mainstream app has. For the sudoku lover, 9
(was 8, then 9): nothing else rates any puzzle, explains and draws 77
techniques in three languages, drills 65 of them, lets you build a chain
and checks every link, proves a mistake wrong, gives hints that respect a
solver who refuses uniqueness, and proves a Phistomefel-style set
equivalence by counting houses; it lacks speed drills, variants and a
guide page for its newest tool. For the casual player, 8 (was 5.5, then
7.5, then 8): the first minute is clean even on a 320 px phone, a
friend's link opens the very puzzle with a time to beat, and the daily
has a number at the end of it; what is missing is an easy way into the
day, the phone's share sheet, the shape of a campaign and a way to be
found.

The road to 9 is still reach and shape, not engine: make main green and
let only a green build deploy; the phone's share sheet for a challenge
and the daily line; a first minute that never starts in a Hard daily; a
keyword title for the English home page; teach and draw the set tracker;
speed drills on the stats that exist; a campaign; the board as a real
grid; and the forum and store work in search.md.

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
- Import reads a string, a pencil-mark grid, a photo, and links from
  SudokuPad, f-puzzles, Sudoku Exchange and sudoku.coach (classic puzzles;
  a SudokuPad short id still needs the site's own lookup).
- Hints and worked examples are English in Norwegian and Spanish.
- The name is hard to find and the README invites the SudokuPad
  comparison that variants make unwinnable; "classic sudoku trainer with
  the deepest technique library" is the honest position.

## The road from here

In order, each step shippable on its own and held by tests before it
touches the players. (When this road was written there were no counts
yet; since 13 October 2026 the plays are counted, see
[online-goals.md](online-goals.md), phase 3.)

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
   path (Learn → Your path, under the board): the practisable techniques needed in at least
   one puzzle in a hundred, in solver order, learned after three unaided
   uses, the next one a click from its practice; with the band records and
   the daily streak. Still to come: mastery in the practice picker.
4. **Robustness** (engineering findings): update prompt, lazy-chunk
   retry, error boundary, worker errors, focus traps, a focusable board
   that reads out its selection, the guide loaded on demand, a Playwright
   smoke test in CI (all built); still to come: the board as a real grid
   for screen readers, locales precached on demand, lint.
5. **Reach**: import of SudokuPad, f-puzzles, Sudoku Exchange and
   sudoku.coach links (built);
   statistics and streaks on top of step 3; print; a store build through
   Capacitor done for real or the claim removed; keyword-led titles and
   the r/sudoku and Enjoy Sudoku forum seeding search.md already plans;
   translated hints once descriptions are structured.

Steps 2 and 3 are what the app is proud of and what the rating rewards
most. Step 1 is what a new player judges it on before any of that is
seen.
