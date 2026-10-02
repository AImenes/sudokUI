# sudokUI architecture

One codebase, three layers, strict dependency direction:

```
ui  →  state  →  engine        (engine imports nothing above it)
```

## The engine (`src/engine/`) — pure TypeScript, no DOM

The engine knows nothing about React, browsers or storage. It runs
identically in the page, in a Web Worker, and under Node in tests.

**Board model** ([board.ts](../src/engine/board.ts)). A `Grid` is three typed
arrays of length 81: `values` (0 = empty), `cands` (9-bit candidate masks,
bit 0 = digit 1) and `given` (original clues — needed by uniqueness-based
techniques that must distinguish clues from deduced digits). Units (rows 0–8,
columns 9–17, boxes 18–26) and the 20 peers of every cell are precomputed
constants. `setValue` places a digit and strips it from all peers' masks.

**Brute force** ([bruteForce.ts](../src/engine/bruteForce.ts)). Bitmask
backtracking with minimum-remaining-values cell choice, propagating naked
and hidden singles before every branch. Used for: solving, counting
solutions (uniqueness checks), and as ground truth in tests.

**Technique catalogue** ([ratings.ts](../src/engine/ratings.ts)). Every
strategy — implemented or not — with its HoDoKu-compatible score, difficulty
band, category, and solver-order index. `SOLVE_ORDER` is the implemented +
enabled subset sorted by index; `PRACTICE_TECHS` and `ALL_TECHS` feed the UI.
This is the single source of truth the app's "N of M techniques" view reads.

**Technique finders** ([techniques/](../src/engine/techniques/)). One module
per family. Every finder has the same shape: `(g: Grid) => Step | null`,
returning the *first* instance found. A `Step` carries placements,
eliminations, highlight data (primary/secondary/fin candidates, chain cells)
and a human-readable description — everything the hint renderer needs.

**Human solver** ([humanSolver.ts](../src/engine/humanSolver.ts)).
`findNextStep` tries finders in `SOLVE_ORDER` and returns the first hit —
i.e. always the cheapest applicable technique, which is how HoDoKu rates.
`ratePuzzle` plays a puzzle to completion this way, summing technique scores
into the final score and difficulty band (brute-force placements as last
resort mark the puzzle "not human-solvable").

**Generator** ([generator.ts](../src/engine/generator.ts)). Random full grid
→ dig holes (optionally symmetrically) while the solution stays unique, so
the result is minimal (as pairs, with symmetry) → rate. `generateFor` retries until a puzzle hits a
`Target`: a band (in the band, and the crux on a live board) or a technique
(needed before anything harder). The rating is capped at the target, so a
puzzle past it costs nothing more. [transform.ts](../src/engine/transform.ts)
holds the grid isomorphisms that serve the seed library. The design and
the numbers are in [generator.md](generator.md).

**Worker** ([worker.ts](../src/engine/worker.ts)). Generation is CPU-heavy,
so it runs in Web Workers, in time slices per macrotask (so cancel
messages get through). Every rated puzzle but the answer is reported back
and pooled — a background search for an X-Wing puzzle, rated in full, also
stocks the Easy pool it stumbled over. An urgent request, from a waiting
player, has a worker of its own, rates only as far as its target and
serves seeds first.

## State (`src/state/`) — zustand stores

**Game store** ([gameStore.ts](../src/state/gameStore.ts)). The active game:
81 `CellState`s (`value`, `given`, `corner`/`center` mark masks, `excluded`
mask, `colors`), selection, entry mode, undo/redo history (snapshots), timer,
hint state, transient toast. The candidate model:

- *corner marks* = notation (Snyder-style, partial by design),
- *centre marks* = exhaustive candidate list (absence = eliminated),
- *auto candidates* = engine-computed list minus `excluded` (strike-throughs).

`engineGrid(cells)` converts UI cell state into an engine `Grid` (values +
canonical candidates minus exclusions); it's the bridge used by hints, fill,
auto-view and check. All mutating actions snapshot into `history` first.

**Settings** ([settings.ts](../src/state/settings.ts)). Persisted user
preferences (theme, highlights, timer, auto-off materialisation behaviour).
Separate store so settings changes never touch game history.

**Pools** ([pools.ts](../src/state/pools.ts)). localStorage-backed puzzle
pools keyed per difficulty and per technique, plus the worker plumbing
(`requestPuzzle` with progress + cancel, `justifyMove`). New games and
practice sessions usually start instantly from a pool; the worker restocks
in the background. A worker that dies settles every request waiting on it
with null and is replaced on the next request.

**Stats** ([stats.ts](../src/state/stats.ts)). The player's record, on the
device: unaided and hinted uses per technique (every unaided move credited
by `src/engine/justify.ts`), the running game's tally, band records and
the daily days ([technique-stats.md](technique-stats.md)).

**App status** ([appStatus.ts](../src/state/appStatus.ts)). The app's own
health: a new build waiting (the service worker registers in `prompt` mode
from `src/main.tsx`, so a deploy never replaces a running tab until the
player reloads), a lazily loaded file this version can no longer fetch
(Vite's `vite:preloadError`), offline readiness. The update bar in App
shows it; the error boundary in `src/ui/ErrorBoundary.tsx` catches a
render error with a reload and a clear-the-board recovery.

## UI (`src/ui/`) — React components

- [App.tsx](../src/ui/App.tsx): layout shell, global keyboard handling,
  dialog routing, toast display, first-visit bootstrap. The Learn dialog
  is loaded on demand (`React.lazy`), so the guide's prose and diagrams
  are their own chunk, precached for offline but never parsed to start a
  game.
- [Progress.tsx](../src/ui/Progress.tsx): the path and the record
  ([technique-stats.md](technique-stats.md)).
- [ErrorBoundary.tsx](../src/ui/ErrorBoundary.tsx): the recovery panel.
- [Grid.tsx](../src/ui/Grid.tsx): the SVG board. Layered per cell:
  background → user colours → peer/same-digit tints → hint tint → selection →
  error tint, then content (value, corner marks at digit-bound 3×3 positions,
  centre marks, or the auto-candidate 3×3 view), then hint candidate circles,
  chain polyline, and grid lines. Pointer events implement drag
  multi-select; double-click selects all cells of a digit.
- [Controls.tsx](../src/ui/Controls.tsx): mode switcher, number pad (turns
  into the colour palette in colour mode), undo/redo/erase, hint/check/auto/
  fill/convert.
- [HintPanel.tsx](../src/ui/HintPanel.tsx): progressive hint disclosure —
  technique name → full explanation (board highlights come from the `Step`) →
  apply.
- [Dialogs.tsx](../src/ui/Dialogs.tsx): new game, practice (full technique
  catalogue with ✗ for unimplemented), import/export, generation progress,
  victory; plus the `useNewGame` hook that ties pools + worker + store
  together.
- [SettingsInfo.tsx](../src/ui/SettingsInfo.tsx): settings and help dialogs.

## Tests (`tests/`)

- `engine.test.ts` — solver/generator basics against known puzzles.
- `practice.test.ts` — technique-targeted generation really produces puzzles
  requiring the technique.
- `bruteForce.test.ts`, `generator.test.ts`, `worker.test.ts`,
  `seeds.test.ts` — the generator's promises (docs/generator.md): counts
  agree with plain backtracking, puzzles are proper and minimal, capped
  ratings agree with full ones, the worker reports the answer once, the
  seed library is what it says it is.
- `soundness.test.ts` — the core guarantee: solve batches of random puzzles;
  every step's placements must match the brute-force solution and no
  elimination may remove a solution digit.
- `hunt-new.test.ts` — probes rarer finders at *every* position of every
  solve path (not just when the solve order picks them) and validates hits.
- `synthetic.test.ts` — deterministic positions for patterns too rare to hit
  randomly.
- `hunt-sdc.test.ts` — Sue de Coq occurrence hunt.

CI (`.github/workflows/ci.yml`) runs typecheck + all tests + build on every
push and pull request; the browser smoke test runs on the production build.
Deployment is separate (docs/deployment.md): a push to `main` deploys whether
or not CI passed, so `main` should carry a required CI status check.

## Adding a technique (the whole loop)

1. Finder in `src/engine/techniques/`, returning a `Step`.
2. Register in `humanSolver.ts`; flip `implemented: true` in `ratings.ts`.
3. `npm test` — the harnesses validate it wherever it fires; add a synthetic
   test if it's rare. It automatically appears in practice mode, hints and
   ratings.
