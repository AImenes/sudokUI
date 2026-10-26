# Hint drawings: where the work stands (handoff)

For whoever continues this work. The design and its rules (G1-G25), the
phases and the running status are in `docs/hint-drawing.md`; this note
says what is in flight, what is left before the next merge, and how the
work has been run. Written 2026-10-26.

## State

- **Phase 1 (the board foundation) is merged and live**: merge commit
  `a858042` on `main`, deployed to sudokui.app after eight review rounds.
  What is left of it, all low, is listed under Status in the spec, for
  phases 6 and 7.
- **Phase 2b (truth discs and rings) is built, not merged**, on branch
  `claude/hint-drawings` (pushed to origin), worktree
  `C:\Users\ai\projects\sudokUI\.claude\worktrees\hint-drawings`.
  Commits: `29ab7b1` (2b itself) and the commit after it (the fix for the
  review's high finding, below). A derived chain draws each node as the
  chain makes it from its first node's premise: true a green filled disc,
  false a blue ring; the legend says under which premise, in en/nb/es.
  Code: `src/content/hintMarks.ts` (`truthOf`, `premiseOf`), the false ring
  and true disc in `src/ui/Grid.tsx` and `src/content/boardSvg.ts`, the
  legends in `src/ui/HintPanel.tsx` and `boardSvg.ts` `legendOf`.

## Phase 2b review, round 1

Run as a workflow (four lenses: logic, words, design, code; two refuting
skeptics per finding). The run hit the usage limit part way, so several
findings were never verified. A copy of the full result (findings with
their scenarios and fixes) is kept locally at
`.vite/reviews/phase2b-r1.json` in the worktree (git-ignored).

Fixed:

- **High, confirmed by three lenses**: an inverted Grouped X-Cycle (rule 3,
  weak first, its start a group assumed true) drew every member of the
  start group as a true disc in the walk's open frames (two 5s in one
  column). `truthOf` now gives a group assumed true no truth mark (the
  pattern's disc, like every true group); a test walks every frame.

Left before 2b can merge (the merge rule: nothing high or medium, nothing
false, no regression against main):

- **Medium, unverified**: a W-Wing can be built with its weak link between
  two cells that do not see each other, and 2b paints a true disc through
  it. `src/engine/techniques/wings.ts` around line 142 picks the link order
  by `sees(e1, A)` alone; pick it by the full condition,
  `sees(e1, A) && sees(e2, B) ? [A, e1, e2, B] : [A, e2, e1, B]`. Repro:
  puzzle `3....681..8......6.....8.5.......27...4.....5.57..1..91....4...9.6....3.7...9..62`
  after 24 findNextStep steps (findWWing, in "What's in this position?"),
  and `..5......1.2..5....6.3...1...1.893.6.7..6..21.....3.8.8.....4...576........7.....`
  after 31. Add every W-Wing's links to a link-validity check in
  `tests/truth.test.ts` (each weak link's ends see each other; each strong
  link is a conjugate pair or a bivalue cell). If the stored W_WING example
  changes, refresh the examples: `npx vite-node scripts/hunt-examples.ts refresh`.
  The false sentence is on main too; the true disc through it is new.
- **Low** (fix or list for later):
  - the legend says "the first candidate (by the dot)" when the first node
    is a group (word it as a group, or draw the dot for the whole group);
  - `src/engine/hintFrames.ts` around line 48 says "(the cell has only
    these two)" for an ALS's in-cell link in a cell with more candidates
    (pre-existing);
  - pattern-blue discs (a true group's members) and the trainer's gold
    suggestions now sit beside true-green discs; the spec's "The blue
    clash, resolved" forbids it, so either note the exception until phase
    4 (hulls) or give those a mark that is not a disc;
  - the spec's G5 still says a removed chain node keeps its truth ring
    under the removal mark; 2b draws only the removal; update G5;
  - the trainer's legend does not name its gold suggestions and purple
    goal (phase 6); "the dot" in words while walk numbers are dots too.

Then run a second review round on the fixed commit, and merge if it
passes the rule.

## How the work has been run

- **Node**: `export PATH="/c/Program Files/nodejs:$PATH"` in Git Bash.
- **Checks**: `npx tsc -b`; `npx vitest run`; `npm run build`; the browser
  tests with Edge:
  `CI=1 PW_CHROMIUM="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" npx playwright test`
  (if port 4173 is busy, another worktree is testing; never kill its
  server).
- **Screenshots** (scratch, git-ignored, in the worktree's `.vite/`):
  `.vite/shots.spec.ts` run with `-c .vite/pw-4174.config.ts`, env
  `SHOTS=<dir> TECHS=AIC,... THEMES=dark,light W= H= DPR=2 WALK=1 PANEL=1`;
  it opens each worked example's position (`.vite/positions.json`) and
  photographs the board (and the walk's last frame, and the hint panel).
  The Learn diagrams: `npx vite-node scripts/hint-gallery.ts <out.html>`,
  then `node .vite/shoot.mjs <out.html> <dir> [TECH ...]`.
- **Reviews**: a workflow per round (four lenses, two refuting skeptics
  each), given the commit, the diff, the screenshot folders, what earlier
  rounds settled and the merge rule. Each fix round has been kept small:
  most rounds' medium findings were regressions from the previous round's
  fixes. Every fix gets a test that fails when the fix is undone (checked
  by reverting it).
- **Merging**: in the main checkout (`C:\Users\ai\projects\sudokUI`, on
  `main`), `git merge --no-ff claude/hint-drawings`, run the unit tests and
  the build there, `git push origin main` (this deploys), then compare the
  live bundle with the build:
  `curl -s https://sudokui.app/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js'`
  against `dist/index.html`. Only GET the live site; never POST to its
  `/api` routes.
- **Preview**: the main checkout's `.claude/launch.json` (git-ignored) has a
  `hint-drawings` configuration serving this worktree on port 5175.

## After 2b

Phase 3 (colouring: `truth: 'parity'`, hue per cluster, shade per parity),
phase 4 (sets: group and ALS hulls), phase 5 (forcing chains per branch),
phase 6 (words: Eureka notation, legend chips, the trainer's legend),
phase 7 (polish: the low list in the spec's Status). See the spec.
