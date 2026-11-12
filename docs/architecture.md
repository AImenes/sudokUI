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
as it stood. A game under way (`underWay`: played on by the player since
it opened, not won; not a custom entry) is paused then, as the Pause
button pauses it, and saved paused: the player comes back to the pause
card, after a reload or a reopen too (the owner's choice, 11 November
2026). A game not yet played on only stands still while away and runs on
when the page is shown again: a friend's position or a fast-forwarded
practice nobody touched among them, and a board whose only change is the
auto candidates the chain trainer switched on, which Done and a reload
take off again. Such a game's clock may run in another tab or window
that shows it; a page that takes the play back with nothing else of the
game changed takes that clock on, its time and whether it is paused, as
it stands in the save, rather than reload ([main.tsx](../src/main.tsx),
`clockOnly`, `inPlace`); and the kept game's note put away there (✕) is
put away here too. It compares its own last write with the save as
a page reading them takes them in (`asRead`, the steps the save's read
makes: the chain trainer closed as Done closes it, among them): a page
that read the save with the trainer open closed it as it read it, so
what it wrote back has the trainer's auto candidates off with nothing
played, and the page that comes back keeps its trainer, its undo steps
and its auto candidates, which its next write puts back in the save. The
game in its memory must still be the one it last wrote: one that is not
(an opening that landed while it was a view) has no clock of the save's,
and the page reloads into the saves instead. While the pause card covers the board, keys act on
nothing behind it (no Undo, hint, mode or Escape; only P resumes), a key
meant for the board says why in the toast, and the board's status line,
which a screen reader hears, says the game is paused instead of reading
the hidden cells; it says so again when the page is shown, and a page
that comes up behind the card (a reload, the app opened again) has the
line empty for a moment first, so the words arrive as a change and are
read out. The controls the card dims beside it rest too (`useResting`):
they are inert, out of the Tab order and a screen reader's reach, so Tab
reaches the top bar, the board (whose keys act on nothing, above), the
card's Resume, the notes and the menu row; their questions (Use Hint?,
Keep your candidates?, and how hints should read the pencil marks) wait
until the game resumes and then come back, so a hint the player asked for
still goes on; and the store's actions behind them (the mode, Hint, Check,
Auto and Fill candidates, the mark question's answer, the chain trainer,
Steps and its jumps, Back to correct) change nothing while paused, as
input and Undo do not. Resumed from the
keyboard, the focus goes back to the board. A win pauses the clock for
good: nothing can resume it, and Undo or a Steps jump off the solved board
(or Redo of the jump) starts it again from the winning time. Solved again,
it is the same solve, so the clock stops at the time the solve was recorded
with (`solvedMs`, `winClock`) and the game takes back the help flag it was
recorded with (`solvedAssisted`): a Steps jump or a hint used since does
not make an unassisted solve one with help, so its win screen still calls
it unassisted and a daily's still offers Send, which sends it with no
hint (`dailyResultOf`: an unassisted solve took none). Its verdict judges
the time with the candidates the solve was made with (`solvedAuto`), not
the auto candidates a Steps jump switched on, and moves, slips and hints
on a board solved before are no new work: they go into neither the
game's tally nor the record, so the win screen shows the solve's; nor
does a practice's target found on it (`practiceFound`), so the win screen
keeps the verdict the solve was made with. The win screen tells a
daily's own solve from an earlier one by the game's `dailyKept`, not by
its time. A game put back in play and set aside keeps these with it.

**One page plays at a time** ([play.ts](../src/state/play.ts)). The
game, the record (`stats.ts`) and the dailies (`dailyStats.ts`) are each
one save shared by every tab and window of the app, and one page plays
at a time (the rule of 12 November 2026, after three review rounds of
two windows that both wrote one save and took in each other's games).
The page that holds the play, a Web Lock
(`navigator.locks`, `sudokui-play`), is the only one that writes them,
and every write goes through it: the persist storages of the three
stores, `setAway`'s save on hide and on `pagehide`, the update bar's
Reload and the error screen's Clear. A page that closes or crashes lets
go of the lock by itself. The holder keeps a random name for itself in
the browser's storage (`sudokui-play`; never sent, and the privacy page
says so), and a page checks it before every write, so a page that was
frozen and wakes up writes nothing before it hears that its lock was
taken. Every other open page of the app is a view that writes nothing.

- **Who takes it.** A page in view when it starts takes the play (the
  player opened it: a new tab, a link from a chat app, a Learn page's
  Practice link, a reload). It asks the holder over a `BroadcastChannel`
  (`sudokui-play`); the holder writes its game with its clock first (what
  `setAway(true)` writes for a hidden page: a game under way pauses),
  lets go and becomes a view. A holder that does not answer within a
  second and a half (a frozen or discarded tab) has the lock taken from it
  (`steal`), and writes nothing from then on. A page that starts hidden
  takes the play only when no page holds it; otherwise it is a view,
  writes nothing, and takes the play the first time it is shown. A view
  shown again takes the play back by itself when no page holds it, or
  when the holder is hidden (the player switched tabs in one window): it
  asks, and the hidden holder gives it. Beside a holder in view (two
  windows side by side) it stays a view, with Play here. A holder says so
  each time it is hidden (`free`): a view in view then takes the play
  after a second (`GONE_MS`), unless a page took it meanwhile (the tab
  the player turned to in the holder's window, which takes it at once as
  it is shown), so the window beside one that was minimised plays; only
  one the holder told no as it was shown again, a moment before
  (`SETTLE_MS`: the two tabs' events can come in either order), takes it
  at once, so a window beside told no by a click into it does not beat
  the tab the player turns to. The lock that comes once the hidden holder
  lets go is let go again when another page took the play from that
  holder first (its name in storage), and the view stays one. A view in view that has played, whose
  window gets the focus (the player clicked into it), asks as one shown
  again does (never from a holder in view), and a
  view in view looks every three seconds whether any page holds the play
  (`check`, `navigator.locks.query`): a holder that crashed or was
  discarded says nothing as it goes, so once no page has held it for a
  second the view takes it, and no cover stays up for a game that
  carries on nowhere; it takes it only if it is still free then, so it
  never waits behind a page that took it meanwhile. An
  ask heard while a page is taking the play itself is answered once it
  holds it, as any ask is (by a page reloading as it took it too, below),
  so two views shown at once (the screen unlocked) end with
  one playing and the other told no, not one taking it from the other
  after the wait. A page going into the back-forward cache gives the play
  up as it goes, and one coming back from it takes the play as a page
  that starts does (the player went Back or Forward to it). A holder that
  closes, or leaves for a page that is not the app's, says so as it goes
  (`gone`): a page in view then takes the play by itself after a second
  (`GONE_MS`; two when it would reload into moves made there, so a holder
  slow to reload takes it back first), if no page took it back meanwhile
  (the one that went, reloading, or another view: the holder has let go,
  so a lock that is held is another's, and the view stays one), so the
  window beside it does not keep a cover for a game
  that carries on nowhere. A page in view reloading to start from the
  saves (Coming back, below) still holds the lock until it goes: asked
  meanwhile as a page shown again asks, it keeps the play, so of two
  views beside a holder that closed, one takes it and reloads, and the
  other stays a view with its cover rather than take it from the
  reloading page and reload too. A holder whose name was replaced while
  it was frozen finds out when it is shown again, and asks as a view
  does.
- **Read after taking.** The stores read the saves as the page loads;
  the first render waits for the play (and for the language's tables),
  and once the page holds it a save whose text changed meanwhile is read
  again ([main.tsx](../src/main.tsx)). Only then does App's start-up read
  the address and open a link, so a link opened in a new tab puts the
  game under way into the slot exactly as one opened in the same tab
  does (`openOver`, the one slot and its told drop). A page that came up
  hidden (a link opened in a background tab) runs its start-up only once
  it is first shown, whether it is a view behind the page that plays or
  took the play itself because no page held it (`seen`): what its link
  does, a game the one slot lets go among it, happens in a page the
  player sees, and the toast says it there; until then it keeps the link
  it was opened with (the address bar follows the board only once the
  start-up has run). The start-up also waits for the language's tables
  (`useTablesReady`), so a /nb/ or /es/ link's first toast is in its
  language even when the page took that language only as it took the
  play.
- **Coming back.** A page that takes the play back goes on as it is when
  the game's save is exactly what it last wrote or read, or differs only
  in the clock of a game nobody played on (or in the kept game's note put
  away), both read as a page reading
  the save takes it in (above: the chain trainer open in this page, and
  another page that only looked, among them), and its own game is still
  the one it last wrote: its win screen and
  Send, its undo steps, its open panels and questions stay, and the focus
  goes back where it was in the app (a dialog left open keeps it, so Tab
  stays inside; with that gone, the top open dialog, then the board). The
  record and the dailies' save, which hold nothing of the page's own and
  which another page writes without playing (it shows the day's win
  screen and fetches the day's numbers from the server, or sends the
  time), are then read again in place (`inPlace`). When the game's save
  changed otherwise (another page played on it, or opened another game),
  it reloads, at the home address, so it starts from the saves the way
  every page starts: the
  board another page left, with what that page did (a link, Import or
  the Daily button opened over this page's game keeps it in the slot,
  with Back to it; New and a level keep nothing). A page come back from
  the back-forward cache keeps its entry's address instead, and its start
  follows the rule of Back and Forward ("A game is never lost", below).
  The reload takes the play as a page shown again does, from no page or
  a hidden one, so it never takes it from the window the player is in;
  one that Play here brought takes it as a page that starts does, so a
  window beside it that took the play while it reloaded gives it back. A
  view wrote nothing of its own, so the reload loses nothing.
- **The view.** A page that does not hold the play shows a cover over the
  app, in the pause card's look: a line saying sudokUI is open in another
  tab or window and the game carries on there, and Play here, which takes
  the play as a page that starts does (then reloads only if another page
  played on the game or opened another, as Coming back says). The app
  behind it is inert: no key shortcut, no Tab stop, no
  click acts on the game; its clock stands still, as a hidden page's
  does, and it sends no daily time and no counts of its own (`countStart`
  and the telemetry store ask `play.acts()`). What was still on its way
  as the play went opens nothing there: the day's list the Daily button
  (or a daily's link) waits for (`startDaily`), a puzzle New or a
  practice is still making (`useNewGame`), a photo being read; so the
  page comes back to the game another page carried on, with its clock,
  and the player asks again. A page that comes up hidden
  at `/nb/` or `/es/` takes that language only once it holds the play
  (one that plays alone takes it at once).
  The cover is a dialog with its name, the focus on Play here. It is
  never drawn on a page nobody sees, nor while a page shown again is
  taking the play back, so it does not flash up in front of the player
  (told no by a holder still in view, a page shown again waits a moment,
  `SETTLE_MS`, before it draws the cover: the two tabs' events come in
  either order, and the hide of the tab the player left, which gives the
  play, may come just after);
  and a cover already up stays up while its page asks (its window got
  the focus, or Play here was pressed), so it does not blink away under
  the player's click and come back when the answer is no.
  A page that has played carries the home address while it is a view
  (not its old game's, which the address bar no longer follows), so a
  reload of it, or the browser bringing back a discarded tab, starts from
  the saves as coming back does; one going into the back-forward cache
  keeps its own. A link put into a view's address bar (a hash) waits for
  the play, and opens once the page holds it.
- **Limits.** Without Web Locks (an old browser) there is no cover and no
  hand-over: every page plays as one window does, and two of them write
  over each other's saves, the last write winning. Where the browser
  refuses the lock (the site may keep no data: its storage cannot be
  read either) a page plays alone in the same way, with no cover, and
  keeps its game only while it is open. A daily time on its way as the play goes is in the
  dailies' save as one to send later until its answer comes, so if the
  page that sent it cannot write the answer (it is a view by then, or
  closed), the page that plays next sends it once more with the same
  token and records the server's answer, and Send is not offered again. And the browser's
  storage reaches another page a moment after it is written, not at the
  same instant: a page given the play reads the saves right after the
  holder's last write, and could in that instant read the write before
  it; what that last write carries is mostly the clock and the pause the
  hand-over itself writes. A tab still on an older build of the app (from
  before this rule, until it is reloaded) writes the saves outside the
  play: the page that plays finds a save it did not write when it is
  shown again, and reloads into it (or reads it again, before its start),
  but a write of its own while hidden can still go over that tab's.

A game read from storage comes without the page's undo steps, hint,
chain trainer and Check marks, which belonged to the board it had
(`freshSession`).

**Settings** ([settings.ts](../src/state/settings.ts)). Persisted user
preferences (theme, highlights, timer, auto-off materialisation behaviour).
Separate store so settings changes never touch game history. The theme is a
choice of four looks or Match device, which shows Daylight or Dark as the
device is set; [theme.ts](../src/ui/theme.ts) puts the look shown on the
page and gives the browser's bar the top bar's colour.

**Pools** ([pools.ts](../src/state/pools.ts)). localStorage-backed puzzle
pools keyed per difficulty and per technique (written, as the saves
are, only by the page that plays: it is only a cache, so what a view's
workers find is not kept), plus the worker plumbing
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
included (from the page that plays; a view writes nothing), then asks a
waiting worker to take over and reloads once it has,
or reloads at once when none is waiting. The guide, the one part loaded
with `React.lazy`, has a stand-in for a file that cannot be had
([lazyPart.ts](../src/ui/lazyPart.ts)): the dialog closes and the bar
offers the reload, with the game still on the board. The photo reader
(`src/scan/`), fetched when Import first scans a photo, says the same in
the dialog's own words when its file cannot be had. The error boundary in
`src/ui/ErrorBoundary.tsx` catches a render error with a reload and a
clear-the-board recovery. Offline, the precache holds the app, its lazy
files, Nutella (`public/poodle.png`) and the privacy page in its three
languages ([search.md](search.md)).

### A game is never lost

The rule (November 2026): a game under way is never lost silently. The
one slot (below) may have to let one go, and then the toast says which. *Under way* is `underWay`
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
  start-up, in a new tab of the same browser (which takes the play and
  reads the saves first: "One page plays at a time", above) or in the same
  tab (a hash change), a Learn page's Practice link (`#practice=`, at start-up, where
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
  is one tap away. The toast says which game is back, named as the notes
  name it ("Back to today's daily, where you left it"; with its HoDoKu
  rating when the game now in the slot has the same name, so two Hard
  games are told apart); pressed from the keyboard, the focus goes on
  from the board. While this note shows, the past-daily note does not
  (two notes would push the digit keys off a small phone's screen; New
  still has the daily). Put away (✕), the note goes but the game stays
  kept (from the keyboard, the focus stays on the board), and **New**
  offers it at the top of its list ("Back to your game in progress") for
  as long as the slot holds it.
- **Asking for it again brings it back.** A link to the puzzle on the board
  resumes it, as a reload does; a link to the puzzle in the slot, or Import
  of it, swaps it back where it was left (a challenger's time then goes on
  its moves). So does a link to the game behind a puzzle being typed in,
  on the board or in the slot: that game comes back as Cancel would bring
  it, and the typed puzzle, once it has a digit, goes into the slot.
  Practice is another game: Import of its puzzle plays the puzzle. But
  the address bar names a practice by its puzzle (`/p/`), so that address
  at start-up or in the tab (a reload, Back, Forward) brings back a kept
  practice of the puzzle when no plain game of it is kept, with "Back to
  your X-Wing practice, where you left it". Back and Forward (`popstate`)
  bring back only a game the page holds (on the board, in the slot, or
  behind a puzzle being typed in: `holds`, src/ui/links.ts), as a link to
  it does, so the board is again the game the address bar names; an
  address that names no kept game (one let go, a friend's puzzle nobody
  played on and replaced) opens nothing over the board, and the address
  goes back to the board's game. Nor do they ever let a game go: the
  game behind a puzzle being typed in on the board stays behind it (it
  is the board's under the entry, and Cancel brings it), and a swap the
  one slot could not keep whole is not made (`backTo`, `resumeSetAside`'s
  `keep`): the board stays, and the address goes back to it. The same
  rule holds at start-up for a page of the app reached by Back or Forward
  from another document of the tab (`back_forward`, or a page come back
  from the back-forward cache and reloaded into the saves: `traversed`),
  so an address no game here answers to never opens a fresh copy over
  the game under way (with no game saved at all, it opens). It holds for
  an entry the app has started on: App's start-up leaves a mark in the
  entry's history state (`sudokuiStarted`, src/ui/links.ts, kept by every
  address the app writes; it says only that, stays in the tab's history
  and is never sent). A tab the browser restores (its last session, or
  Reopen closed tab) loads as Back and Forward do: where the app had
  started, it follows this rule; where it never started (a link opened in
  a background tab and never looked at, which kept its link) it opens its
  link as a link does once it is seen, the game under way set aside and
  any game the one slot lets go told. A link opened in the same tab by its hash (`#s=`,
  `#p=`, `#daily`) leaves the address once it has opened, which goes to
  the board's game, so a reload, or Back then Forward, never opens it
  again over the game played on since.
- **One slot, the most work kept, and never silently.** When the slot
  already holds a game and another under way is replaced, the slot keeps
  whichever of the two holds more of the player's own work, `workOf`: the
  cells written in since each game opened, with those of the game a
  typed-in puzzle was opened over; on a tie, the newer. A kept game whose
  note was put away has it shown again when it stays over another. The
  other game goes, never the one with more of the player's own work, and
  at that moment the toast says which, naming both games as the notes do
  (`gameName`: today's daily, the daily for a date, your game on a shared
  puzzle, your X-Wing practice, your Hard game, the puzzle you were typing
  in, and, for two of one name, each with its HoDoKu rating): "Only one
  game in progress is kept at a time: your game on a shared puzzle is
  gone, today's daily is kept" (the owner's lead, 11 November 2026: one
  slot, but never silent); several gone at once, in one sentence, listed
  the language's way. Two games of one name, the game on the board among
  them, are told apart by their rating (`nameAmong`; a rating that tells
  nothing apart, two copies of one daily, is left out). It takes two
  games under way, one in the slot and one on the board, and a third
  opened over them by a link (in the tab or in a new one), Import, the
  Daily button, Check & play or a Learn page's Practice link. The line
  rides with the notice the opening brings (`letGo`, in memory), each
  ended as a sentence of its own, so a screen reader reads two. A game
  that opens, and a puzzle to type in (New, then Custom), clears the
  notice and the line standing over the game before; what opens it says
  its own after, so no toast stays over a different board. The toast is one live region, always in the page
  (`role="status"`), so a screen reader hears each notice as it comes:
  every notice and line the store sets has a number of its own
  (`noticeId`), which draws the toast's words anew and starts its fade
  again, so the same words said again (Back to it pressed twice) are
  heard again. It is empty while the page is hidden and fades only once
  it can be seen, so a notice that came while hidden is told when the
  page is shown. While the update bar is up the toast stands above it, so
  neither covers the other.
- **The daily.** New, then Daily puzzle (and the past-daily note's link,
  and the daily's own address) go on with that day's daily when it is on
  the board, solved or not, in the slot, or behind a puzzle being typed
  in, on the board or in the slot; never a second copy of it (a second
  tab reads the saves once it takes the play, so it finds the daily
  where the first tab left it). A daily in none of those places starts
  fresh: one never started, and one that has
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
  was opened over, so Cancel always brings that back. The backup keeps
  that game's solve (a solved game put back in play by Undo or a Steps
  jump) and its practice target, so wherever it comes back from (Cancel,
  a link asking for it, the slot, the error screen) it is still the same
  solve, recorded once. Check & play puts that game, if under way, into
  the slot as a link would (`openOver`), by the one-slot rule and with
  its toast when one must go, then starts the typed puzzle; the game's
  own puzzle typed in again brings it back where it was left instead,
  and the puzzle of the game in the slot swaps it back as Back to it
  does, the game behind the entry taking the slot, so none goes; the
  toast names the game back. Restart there asks
  "Clear the board?" (Clear, Keep typing), then clears the typed digits;
  Share says the puzzle has no link until Check & play.
- **The error screen.** Its Clear the board and reload
  (src/ui/ErrorBoundary.tsx, `boardCleared`) clears the game on the
  board, since what broke is most likely there; a page that does not
  hold the play takes it first, as Play here does, and reads what another
  page wrote meanwhile in place of reloading into it (`clearing`), so the
  board it clears is the one in the save. The slot's game stays: it
  is never drawn until it comes back, so it cannot be what broke, and the
  note (or New) still offers it back. With a puzzle being typed in, the
  game it was opened over is not drawn either: with the slot empty it
  takes the slot, with its solve, its practice target and its tally (the
  record's, which is still that game's while a puzzle is typed in), and
  the note offers it back (unless it was won, as a solved game is not
  kept); with a game in the slot already, that one stays and the game
  behind the typed puzzle goes with the board.
- **Undo is not saved.** The undo history stays in memory: a reload (and
  Cancel of a custom entry) keeps the board but not the steps back. Each
  step is a full copy of the 81 cells, about 6 KB as saved, so even a short
  history would multiply the save written at every move; a compact form
  needs an encoding of every cell field and is left for later.
- **Two tabs or windows** play one at a time ("One page plays at a
  time", above): the one that does not play is a view behind its cover,
  and nothing it holds in memory reaches the saves. A link opened in a
  new tab takes the play and keeps the first tab's game in the slot; back
  in the first tab, the play comes back with the saves, its own game one
  tap away. Without Web Locks, two pages write over each other's saves.

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
