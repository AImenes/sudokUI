# Hint drawings: where the work stands (handoff)

For whoever continues this work. The design and its rules (G1-G25), the
phases and the running status are in `docs/hint-drawing.md`; this note
says what is done, what comes next, and how the work has been run.
Updated 2026-10-26.

## State

- **Phase 1 (the board foundation)** merged and live: merge commit
  `a858042` on `main`, after eight review rounds.
- **Phase 2 (truth)** built, in its confirmation review (round 3 of
  phase 2b, on `a819369`), to merge to `main` when it passes the rule. A derived
  chain draws each node as the chain makes it from its first node's
  premise: true a green filled disc, false a blue ring; a true group's
  candidates are their own mark (`oneTrue`, the pattern's disc until phase
  4); the legend says under which premise, in en/nb/es. Code:
  `src/content/hintMarks.ts` (`truthOf`, `premiseOf`, `refuted`), the
  marks in `src/ui/Grid.tsx` and `src/content/boardSvg.ts`, the legends in
  `src/ui/HintPanel.tsx` (`truthWords`, also the chain trainer's) and
  `boardSvg.ts` (`truthWords`, `legendOf`), the walk's sentences in
  `src/engine/hintFrames.ts` (`linkText`, `closureText`).
- What each review round found is in the spec's Status. What is left for
  later, all low, is listed there under phase 2 and phases 6 and 7.

## Next: phase 3 (colouring)

`truth: 'parity'` on Simple Colors, Multi Colors, 3D Medusa and Remote
Pair: a cluster index and a parity per candidate, the parity proven false
where one is; hue per cluster, shade per parity (G19); witnesses as arrows
only in the walk frame that names them. Accept: `tests/coloringViz.test.ts`
updated, the prose's colour words match the drawn hues. Then phase 4
(sets: group and ALS hulls, which also retire the `oneTrue` exception),
phase 5 (forcing chains per branch), phase 6 (words), phase 7 (polish).

## How the work has been run

- **Checks**: `npx tsc -b`; `npx vitest run`; `npm run build`; the
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
  `TRAINER=1` the chain trainer); `--puzzle <puzzle> <steps> [TECH]` any
  position on a solve path (a review's repro); `--gallery <html>` the
  Learn diagrams from `npx vite-node scripts/hint-gallery.ts <html>`. For
  main's drawings to compare, a worktree of `main` with its own
  `node_modules` (`cp -al` is quick) served on another port.
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
