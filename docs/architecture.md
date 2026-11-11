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
mask, `colors`, and `took`: the marks a placed digit cleared, given back when
it goes), selection, entry mode, undo/redo history (snapshots of the cells,
the auto-candidates flag and the marks' contract), timer, hint state,
transient toast. The candidate model:

- *corner marks* = notation (Snyder-style, partial by design),
- *centre marks* = exhaustive candidate list (absence = eliminated),
- *auto candidates* = engine-computed list minus `excluded` (strike-throughs),
  which live only while auto is on: switching it off clears them
  ([candidates-2026-11.md](candidates-2026-11.md)).

`engineGrid(cells)` converts UI cell state into an engine `Grid` (values +
canonical candidates minus exclusions); it's the bridge used by hints, fill,
auto-view and check. All mutating actions snapshot into `history` first.
`listLayer(mode)` says where the app writes a candidate list (the Corner or
Centre tab's layer, else the "Candidates go in" setting).

The clock is `elapsedBefore` plus the time since `startedAt` while it runs;
the save writes `elapsedMs()` on every store write. A pause is saved and
comes back after a reload. While the page is hidden (`visibilitychange`,
`pagehide`, a reload among them) `setAway` stops the clock and so saves it
as it stood. A game under way (played on, not won, not a custom entry) is
paused then, as the Pause button pauses it, and saved paused: the player
comes back to the pause card, after a reload or a reopen too (the owner's
choice, 11 November 2026). A game not yet played on only stands still while
away and runs on when the page is shown again. A win pauses the clock for
good: nothing can resume it, and Undo or a Steps jump off the solved board
(or Redo of the jump) starts it again from the winning time. Solved again,
it is the same solve, so the clock stops at the time the solve was recorded
with (`solvedMs`, `winClock`) and the game takes back the help flag it was
recorded with (`solvedAssisted`): a Steps jump or a hint used since does
not make an unassisted solve one with help, so its win screen still calls
it unassisted and a daily's still offers Send. The win screen tells a
daily's own solve from an earlier one by the game's `dailyKept`, not by
its time. A game put back in play and set aside keeps these with it.

The game, the record (`stats.ts`) and the dailies (`dailyStats.ts`) are
each one save shared by every tab and window of the app. A window that is
hidden takes in what another one saves (a `storage` listener in each
store), so shown again it plays on from there and its next save does not
put an older board back; a window in front keeps its own. The game comes
in only when it is the window's own game (the same puzzle and day) or the
window's own is not under way (solved, nothing played on it, or none; a
practice or a shared position is under way once the player moves on it in
that window: `takesInSaved`): a hidden window with another game under way
keeps it,
so a link or a practice opened in a new tab, or another window going
away, takes no game from it. The game's own tally (`stats.ts`, `game`)
goes with the game. A game read from storage comes without the window's
undo steps, hint, chain trainer and Check marks, which belonged to the
board it had (`freshSession`).

**Settings** ([settings.ts](../src/state/settings.ts)). Persisted user
preferences (theme, highlights, timer, auto-off materialisation behaviour).
Separate store so settings changes never touch game history. The theme is a
choice of four looks or Match device, which shows Daylight or Dark as the
device is set; [theme.ts](../src/ui/theme.ts) puts the look shown on the
page and gives the browser's bar the top bar's colour.

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
player reloads), a lazily loaded file that cannot be fetched (Vite's
`vite:preloadError`: a deploy took it, or a first visit, which no service
worker controls yet, went offline), offline readiness. The update bar in
App shows it. Its Reload (`reloadIntoLatest`) saves the game, clock
included, then asks a waiting worker to take over and reloads once it has,
or reloads at once when none is waiting. The guide, the one part loaded
with `React.lazy`, has a stand-in for a file that cannot be had
([lazyPart.ts](../src/ui/lazyPart.ts)): the dialog closes and the bar
offers the reload, with the game still on the board. The error boundary in
`src/ui/ErrorBoundary.tsx` catches a render error with a reload and a
clear-the-board recovery. Offline, the precache holds the app, its lazy
files, Nutella (`public/poodle.png`) and the privacy page in its three
languages ([search.md](search.md)).

### A game is never lost

The rule (November 2026): a game under way is never lost silently, with
one exception still open (the one slot, below). *Under way* is `underWay`
in the game store: not won, and played on by the player since it opened
(a digit, a mark, a strike or a colour the board did not open with, or
auto candidates switched); or a puzzle being typed in that has a digit on
it or was opened over a game under way (an empty entry board over nothing
begun holds nothing to lose). A board that opens with more than its
givens, a shared position, a practice puzzle the app fast-forwarded, a
pasted pencil-mark grid, keeps how it opened (`GameInfo.opening`, packed
as a position link packs a board): what it opened with is someone else's
work, so a friend's position nobody touched is not under way, and holds
none of the player's work.

- **Links and Import set it aside.** A link of the app's own (a share or
  challenge link, a position link `#s=`, another day's daily), opened at
  start-up, in a new tab of the same browser or in the same tab (a hash
  change), a Learn page's Practice link (`#practice=`, at start-up, where
  the game under way cannot be seen), and anything Import opens, go
  through `openOver`: the game under way is put into **one saved slot**,
  `setAside` (a `GameBackup` like a custom entry's, with its solved flag,
  practice target, the running game's tally and, for a puzzle being typed
  in, the game Cancel brings back), then the other game opens. The address
  is read one way everywhere, `readAppLink` (src/content/share.ts), and
  opened one way, `openAppLink` (src/ui/links.ts); the same-tab path no
  longer refuses. Import reads only the app's own addresses that way
  (sudokui.app, or the host the app is served from); another site's
  `/p/`, `/daily/` or `#s=` is not taken for one.
- **The note brings it back.** While the slot holds a game, a quiet line
  beside the board in the past-daily note's place says "Your game in
  progress is kept" with **Back to it**, which swaps: the kept game
  returns, and the game on the board takes the slot if it is under way,
  so neither is lost, and the note then offers that one, so either game
  is one tap away. The toast says which game is back; pressed from the
  keyboard, the focus goes on from the board. While this note shows, the past-daily note does not (two
  notes would push the digit keys off a small phone's screen; New still
  has the daily). Put away (✕), the note goes but the game stays kept,
  and **New** offers it at the top of its list ("Back to your game in
  progress") for as long as the slot holds it.
- **Asking for it again brings it back.** A link to the puzzle on the board
  resumes it, as a reload does; a link to the puzzle in the slot, or Import
  of it, swaps it back where it was left (a challenger's time then goes on
  its moves). So does a link to the game behind a puzzle being typed in,
  on the board or in the slot: that game comes back as Cancel would bring
  it, and the typed puzzle, once it has a digit, goes into the slot.
  Practice is another game and never matches.
- **One slot, the most work kept.** When the slot already holds a game and
  another under way is replaced, the slot keeps whichever of the two holds
  more of the player's own work, `workOf`: the cells written in since each
  game opened, with those of the game a typed-in puzzle was opened over;
  on a tie, the newer. A kept game whose note was put away has it shown
  again when it stays over another. The other game is dropped, and
  nothing says so: this is the one loss left, never of the game with more
  of the player's own work, and it takes two games under way, one in the
  slot and one on the board, and a third opened over them by a link,
  Import, the Daily button or a Learn page's Practice link. How to close
  it (keep two or three games, about 6 KB each; ask before one is dropped;
  or at least say which was) is the owner's decision.
- **The daily.** New, then Daily puzzle (and the past-daily note's link,
  and the daily's own address) go on with that day's daily when it is on
  the board, solved or not, in the slot, or behind a puzzle being typed
  in, on the board or in the slot; never a second copy of it. A daily in
  none of those places starts fresh: one never started, and one that has
  gone, solved and then replaced by another game (a solved game is not
  kept), or dropped by New and a level, which keeps nothing. Restart
  starts the one on the board again (`startDaily`, src/ui/links.ts).
  Without the published list (`loadDailies` gives null: offline before
  the app could keep the file, a network error) a day the list should
  cover is not made up from the date: the board stays as it was and the
  player is told; a day before the list began is still derived from its
  date.
- **Custom entry.** Opened again over a puzzle being typed in (New, then
  Custom, or a scan from New), the backup stays the game the first entry
  was opened over, so Cancel always brings that back. Restart there asks
  "Clear the board?" (Clear, Keep typing), then clears the typed digits;
  Share says the puzzle has no link until Check & play.
- **The error screen.** Its Clear the board and reload
  (src/ui/ErrorBoundary.tsx, `boardCleared`) clears the game on the
  board, since what broke is most likely there. The slot's game stays: it
  is never drawn until it comes back, so it cannot be what broke, and the
  note (or New) still offers it back. With a puzzle being typed in, the
  game it was opened over is not drawn either: with the slot empty it
  takes the slot, and the note offers it back (unless it was solved, as a
  solved game is not kept); with a game in the slot already, that one
  stays and the game behind the typed puzzle goes with the board.
- **Undo is not saved.** The undo history stays in memory: a reload (and
  Cancel of a custom entry) keeps the board but not the steps back. Each
  step is a full copy of the 81 cells, about 6 KB as saved, so even a short
  history would multiply the save written at every move; a compact form
  needs an encoding of every cell field and is left for later.
- Two tabs of one browser each hold the game in memory, and each saves
  over the other's at its next move; that is not solved here.

## UI (`src/ui/`) — React components

- [App.tsx](../src/ui/App.tsx): layout shell, global keyboard handling,
  dialog routing, toast display, first-visit bootstrap. The Learn dialog
  is loaded on demand (`React.lazy`), so the guide's prose and diagrams
  are their own chunk, precached for offline but never parsed to start a
  game.
- [links.ts](../src/ui/links.ts): what opens from outside, a link of the
  app's own (at start-up, in the same tab, pasted into Import) or the
  day's daily, with a game under way set aside first ("A game is never
  lost", above).
- [shortcutKeys.ts](../src/ui/shortcutKeys.ts): which shortcut a key is
  (a letter by the character printed on it, so Ctrl+Z undoes on QWERTZ
  and AZERTY; anything else, and a letter of another script, by its
  place; punctuation on a letter's place is no shortcut on a Latin
  layout, but goes by its place once the last letter typed was of
  another script, so W still wipes on Hebrew. Until a letter is typed a
  layout counts as Latin, so a Hebrew W pressed first does nothing
  rather than a Dvorak comma wiping), and whether Space is a
  focused button's (the player reached it with Tab) or the board's mode
  cycle (a button the mouse pressed, even after Escape gives focus back
  to it).
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
