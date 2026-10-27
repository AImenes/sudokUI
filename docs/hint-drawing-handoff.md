# Hint drawings: where the work stands (handoff)

For whoever continues this work. The design and its rules (G1-G25), the
phases and the running status are in `docs/hint-drawing.md`; this note
says what is done, what comes next, and how the work has been run.
Updated 2026-10-27, with phase 4 built and in review.

## State

- **Phase 1 (the board foundation)** merged and live: merge commit
  `a858042` on `main`, after eight review rounds.
- **Phase 2 (truth)** merged and live after three review rounds of
  phase 2b (round 3, the confirmation, on `a819369`; its one high, in a
  round-2 fix, reverted to main's removal bar). A derived
  chain draws each node as the chain makes it from its first node's
  premise: true a green filled disc, false a blue ring; a true group's
  candidates are their own mark (`oneTrue`, the pattern's disc until phase
  4); the legend says under which premise, in en/nb/es. Code:
  `src/content/hintMarks.ts` (`truthOf`, `premiseOf`, `refuted`), the
  marks in `src/ui/Grid.tsx` and `src/content/boardSvg.ts`, the legends in
  `src/ui/HintPanel.tsx` (`truthWords`, also the chain trainer's) and
  `boardSvg.ts` (`truthWords`, `legendOf`), the walk's sentences in
  `src/engine/hintFrames.ts` (`linkText`, `closureText`).
- **Phase 3 (colouring)** merged and live after three review rounds (the
  third a targeted confirmation on `e9df0f6`), a follow-up that fixed
  the third round's eight lows, and the colouring search orders in
  their own change (decision 13: Multi Colors gives a colour seeing
  both before any bridge, Simple Colors a wrap before any trap, on every
  digit). Simple Colors, Multi
  Colors, 3D Medusa and Remote Pair carry `truth: 'parity'`
  (`Step.colouring`): each cluster in two shades, dark and light purple
  (orange for Multi Colors' second), its ties quiet lines along the
  shortest drawn tree in its own walk frame, the argument as dashed weak
  ties or corner brackets, then a proof frame in phase 2's green and
  blue. Design: `docs/hint-drawing-colouring.md`. Code:
  `src/engine/techniques/colourTree.ts` and the four finders,
  `src/engine/truth.ts` (`checkParity`), `src/engine/hintFrames.ts` (the
  parity walk, `drawnLinks`), `src/content/hintMarks.ts` (`parityMarks`,
  `parityLegend`), `src/content/hintPalette.ts`, the tie and weak-tie
  routing and the brackets in `src/content/hintGeometry.ts`.
- **Phase 4 (sets)** built on its branch, in its nine stages, and in
  review (the commits are in the spec's Status): a group is its members'
  own marks on a bar in the gutter beside them, a TRUE group's members
  pale "one of these" squares; an almost locked set a tight tile in each
  of its cells, in one of three tints, with a lettered tab on every tile;
  ALS-XZ, ALS-XY-Wing and ALS-XY-Chain the derived chains they are, drawn
  with no truth where a chain whose sets share cells clashes; Death
  Blossom the pattern, its branch links emitted for phase 5; a walk that
  introduces each set before the chain uses it; Eureka with braces round
  the whole set. Design and what the build refined: `docs/hint-drawing-sets.md`
  (As built). Code: `Step.sets` and the links' `fromSet`/`toSet` in
  `src/engine/steps.ts`, the finders (`groupedAic.ts`, `groupedXCycles.ts`,
  `als.ts`), `checkSets` and `alsClash` in `src/engine/truth.ts`, the set
  walk and its words in `src/engine/hintFrames.ts`, the marks and tints
  in `src/content/hintMarks.ts`, the bars, tiles and tabs in
  `src/content/hintGeometry.ts` (`setShapes`, `tilesIn`, `hintDrawing`),
  both renderers and both legends, the notation in
  `src/content/eureka.ts`. Guards: `tests/fixtures/drawingSnapshot.json`
  and the path digest, unchanged since stage 1, and
  `tests/fixtures/setDrawings.json`, written again only by
  `DRAWING_SNAPSHOT=write-sets` in a commit that names its techniques.
- What each review round found is in the spec's Status. What is left for
  later, all low, is listed there under phases 2, 3 and 4 and phases 6
  and 7.

## Next

Phase 4's review rounds, as phases 1-3 had them (below), on the branch's
last commit: the screenshots of every set example and of the set
fixture's eleven named positions, in all four themes, desktop and phone,
every walk frame and the hint panel, with and without the player's own
cell colours (`WALK=1 PANEL=1 PLAYER=1`), and the Learn gallery, kept
outside the repository with a README that names each position. Fix each
round's findings, then merge the branch whole when nothing is high,
medium, false or regressed. After it, phase 5 (forcing chains per branch,
which also draws Death Blossom's branches from the links phase 4 emits),
phase 6 (words), phase 7 (polish), and a readability pass over every
technique's hint against HoDoKu, in all four themes and on a phone. The
relabelling of AIC with ALS steps whose only set is a bivalue cell is a
later measured engine change (the design's decision 14).

## How the work has been run

- **Checks**: `npx tsc -b`; `npx vitest run`; `npm run build`; before a
  merge, and after any change to a set technique's finder,
  `PATH_DIGEST=menus npx vitest run tests/pathDigest` (a plain run, and
  CI, hold the solve paths alone; this adds what the seven set finders
  first find at every position of every pool's and seed's path, about
  eight minutes of finders dealt to four files, `tests/pathDigest.ts`); the
  browser tests, `CI=1 npx playwright test`, with a browser of your own
  in `PW_CHROMIUM` (on the owner's Windows machine Edge,
  `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`, with
  Node from `/c/Program Files/nodejs` in Git Bash; in a Claude cloud
  container `/opt/pw-browsers/chromium`). If port 4173 is busy, another
  checkout is testing; never kill its server.
- **Screenshots** (`scripts/hint-shots.cjs`, written to a git-ignored
  folder such as `.vite/`): with `npx vite --port 4174` running,
  `node scripts/hint-shots.cjs .vite/shots` photographs the app's board
  with every stored example that has links, in all four themes, desktop
  and phone (`WALK=1` every walk frame, `PANEL=1` the hint panel,
  `TRAINER=1` the chain trainer, `PLAYER=1` the board again over the
  player's own cell colours: the hint's sets' and groups' cells and a
  neighbour of each, the full view in each of the nine colours, each walk
  frame in one); `--puzzle <puzzle> <steps> [TECH]` any position on a
  solve path (a review's repro; TECH's step is its finder's there, as the
  drawing fixtures find it); `--gallery <html>` the
  Learn diagrams from `npx vite-node scripts/hint-gallery.ts <html>`. For
  main's drawings to compare, a worktree of `main` with its own
  `node_modules` (`cp -al` is quick) served on another port. After a
  large pull, restart the dev server before photographing (a stale one
  can leave the hint panel unrendered). Stop servers by their process
  IDs: a `pkill -f` or `pgrep -f` pattern that appears in your own
  command line matches your own shell.
- **Reviews**: a workflow per round, five lenses (sudoku logic, words,
  design in all four themes, code, regression against main), each
  finding that claims high, medium, something false or a regression put
  to two refuting skeptics. The review is given the commit, the diff, the
  screenshot folders, what earlier rounds settled and the merge rule:
  nothing high or medium, nothing false, no regression against main. A
  workflow runs two agents at a time on a four-core machine, so a round
  is split into parallel workflows by lens. Fix a round's findings in a
  separate worktree while its agents still read the reviewed tree. Every
  fix gets a test that fails when the fix is undone (checked by undoing
  it).
- **Merging**: on `main`, `git merge --no-ff` the branch, run the unit
  tests and the build there, `git push origin main` (this deploys), then
  compare the live bundle with the build:
  `curl -s https://sudokui.app/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js'`
  against `dist/index.html`. Only GET the live site; never POST to its
  `/api` routes.
