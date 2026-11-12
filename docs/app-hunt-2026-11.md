# The app-wide hunt, November 2026: games kept, the clock, the keyboard, offline and the Learn pages

## Why

The hints had had their reviews; the app around them had not. The owner's first rule is that sudokUI never
loses a player's game, so on 11 November 2026 the whole app was hunted, from five angles at once: what opens a
game over another (links, Import, the Daily button, custom entry), the game's state (the win, Undo after it,
the clock), offline and after a deploy, the keyboard and the screen reader, and the static Learn pages.

## How it ran

1. **Hunt** (on cf7ce55): one explorer per angle, each finding reproduced by an independent checker with its
   own scripts on the built app. 17 confirmed (3 high, 14 medium), 1 rejected, 18 lows.
2. **Five fixer groups** (on 810aa23), one per angle, each in its own tree. Each group's work was checked by an
   independent checker that tried to break it, and repaired, until no high or medium was open: games kept took
   three rounds, the win and the clock three, the keyboard two, offline and the Learn pages one each.
3. **One tree**: the five groups and the owner's auto-pause (below) were put together, their clashes resolved
   by hand (the dialogs' Escape, the saved game's rehydrate, the docs), and a last fixer took what the groups'
   checkers had left open and what only showed with all of them together.
4. **A last check from three angles** on that tree, repaired until nothing high or medium was left: first on
   two windows that merged each other's games, then, when that would not settle, on the rule that one page plays
   at a time (see "The last round").

## What was found and fixed

### Games kept: links, Import, the Daily button, custom entry

The rule is in [architecture.md](architecture.md), "A game is never lost".

- **High: a link opened at start-up replaced the game under way** (a friend's share, a challenge, a position,
  another day's daily), with no word and no way back. Now the game under way goes into one saved slot, a note
  beside the board says "Your game in progress is kept." with **Back to it**, and Back to it swaps the two
  games. The same holds for a link in the same tab, a new tab, Import, and a Learn page's Practice link. All
  paths share one reader (src/content/share.ts, readAppLink) and one opener (src/ui/links.ts, openAppLink).
- **High: New > Daily puzzle restarted today's daily when it was under way.** It now resumes it ("Today's
  daily, where you left it", or "You have solved this daily. Restart plays it again").
- **High: a second custom entry, or a scan from custom entry, overwrote the backup**, so Cancel no longer
  brought the game back. The first backup is now kept.
- **Medium: Import read only the bare puzzle from the app's own links.** It now reads them as opening them
  does: a position keeps its entries and marks, a challenge its time, a daily link opens that day's daily.
- Found by the group's checkers and fixed: two links in a row lost today's daily (the slot counted a sender's
  shared entries and a practice puzzle's opening digits as the player's own work); after a swap the kept game
  could not be reached; New > Daily over a puzzle typed in over today's daily started a second copy; the error
  screen's "Clear the board and reload" deleted the kept game.
- Lows fixed: with the dailies file out of reach, Daily played a puzzle derived from the date as everyone's
  board; Share and Restart during custom entry; focus after Back to it; two notes pushing the number keys off a
  small phone; Import's refusal shown twice.

### The win screen and the clock

- **Medium: Check, Steps, Scan or Auto used after a win marked the finished solve as assisted**, taking the
  daily's Send button away. A solved game now stays as it was played.
- **Medium: no win screen on a second solve of the same puzzle** (Restart, or the solved daily chosen again).
- **Medium: Undo after a win, or a Steps jump on a solved board, left the board behind the pause card.** Both
  now leave a board to play on, the clock going on from the winning time; Undo of the jump solves it again.
- **Medium: the clock was saved only when the board changed**: a reload rolled it back to the last move, a
  paused game came back running, and time with the page hidden counted.
- **Medium (found twice): the win screen was not a dialog** for the keyboard or a screen reader: no focus,
  Escape did nothing, Tab walked the page behind it. It now shares Modal's behaviour (useDialog in
  src/ui/Dialogs.tsx).
- Found by the group's checkers and fixed: a daily time never sent could not be sent after a replay; a second
  tab, shown again, put its older board back; the first repair of that made a hidden tab give up its own game
  to another tab's (a Learn page's Practice opened in a new tab lost the game in the first), now a hidden tab
  keeps a game under way; Redo after Ctrl+Z of a Steps jump left the board paused; the same solve showed a
  longer time after an Undo; Scan and the Assist box on a solved board said things that were not true there.
- Lows fixed: after a win the pause button read "Resume game"; the update bar's Reload rolled the clock back.

### Auto-pause, the owner's decision

Asked whether coming back to the app should show the pause card, the owner said yes (11 November 2026): when
the page is hidden or closed, a game under way (played on, not won, not a puzzle being typed in) pauses as the
Pause button pauses it, is saved paused, and comes back behind the pause card, after a reload or a reopen
too. A game not yet played on only stands still and runs on when shown (src/state/gameStore.ts, setAway).

### Keyboard and screen reader

- **Medium: Space on a focused button changed the entry mode** instead of pressing it.
- **Medium: Ctrl+Z and the letter shortcuts followed the key's place, not its letter**, so Ctrl+Z did not undo
  on a German keyboard and wiped cells on a French one. Shortcuts now go by the letter
  (src/ui/shortcutKeys.ts).
- **Medium: a screen reader could not tell the entry mode, whether Auto candidates was on, or the Colour
  keys' colours.**
- **Medium: the chain trainer could not be used from the keyboard.**
- Found by the group's checker and fixed: a mouse player who closed a dialog with Escape got it back on Space;
  digits built the chain behind the pause card; focus after Build it yourself; a key event with no key threw;
  W on a Hebrew keyboard; Rosé's conflict red too near its givens.
- Lows fixed: Escape on a question over Settings also closed Settings; low-contrast board text in Daylight and
  Rosé; the number row at 200% zoom; a smooth scroll under reduced motion.

### Offline and after a deploy

- **Medium: the update bar's Reload did nothing after a part of the app failed to load** with no new version
  waiting. It now saves the game, clock included, and reloads.
- **Medium: a Learn guide file that failed to load replaced the whole app with "Something went wrong".** It
  now shows the update bar (src/ui/lazyPart.ts).
- Lows fixed: Nutella is precached; the privacy page works offline; the board and side column keep inside an
  iPhone's safe area in landscape.

### The Learn pages

- **Medium: worked-example legends made 193 of the 273 static pages wider than a phone**; they now wrap.
- Lows fixed: the rating page's tables scroll in their own box; /learn/ no longer says all 80 techniques can
  be practised (61 can); the Exocet page no longer says it has no pattern to spot under "How to spot it";
  seven descriptions over 160 characters; the brand link was read as "UI sudokUI", and the footer's language
  label was dropped.

## Rejected

- "The first session offline gives a different daily and a false update bar": reproduced only under the
  preview server, which sends no-cache for /assets/. With the headers production sends (public/_headers,
  immutable), the uncontrolled first page gets every part of the app from the HTTP cache and the published
  daily opens offline.

## The last round

**Two windows that merged each other's games did not settle.** The groups had made a hidden window keep its own
game against another window's save, and the last fixer made each window also keep the other's games in its
slot. Three rounds of checks on that found 8, then 5, then 3 high or medium findings, nearly all with two tabs
open, and each round's repairs made the next round's cases: a fresh copy of a game replacing another tab's at the
first move, a game called "still open in your other tab" lost when that tab closed, a solve counted twice after
it came back from the other tab's slot. Two pages both writing one save and merging each other's games was the
root cause, so on 12 November 2026 it was replaced, not patched again.

**One page plays at a time** ([architecture.md](architecture.md), "One page plays at a time";
src/state/play.ts). The page that holds a Web Lock is the only one that writes the game, the record and the
dailies; every other open tab or window of the app is a view that writes nothing. The tab the player opens or
turns to takes the play: the one that had it writes its game with its clock first (a game under way pauses, as
on hide), then lets go. A page that takes the play back goes on as it was when nothing changed (its win screen,
Send, undo steps and open panels stay), and reloads into the saves when another page played, with its own game
kept behind Back to it. Only two windows side by side show a cover, "open in another tab or window", with
**Play here**. A link opened in a background tab opens, and says what it let go, once it is looked at. Without
Web Locks (browsers from before 2022) a page plays as one window does. Nothing of it is sent: the tabs pass the
play to each other inside the browser, and the privacy page says so in en, nb and es.

**Within one page**, in the same round: Back and Forward bring back only a game the page holds and never open a
fresh copy over a game under way (main had no such handler; Back only changed the address); a reload, Back or
Forward goes on with the saved game instead of reading the address as a new link; a position link opened in the
same tab no longer stays in the address; Back to it names the game that came back, and is heard by a screen
reader each time.

Checks on the one-player tree: round 1 found 3 high and 6 medium (the address on Back, Forward and reload; the
cover left up with no one playing; the focus behind a dialog after the cover; a game nobody played on reloading
on every tab switch; a tab still on the previous build writing outside the play); round 2 found 2 medium (a
solved daily reloading on every tab switch, because the other tab fetched the day's numbers; a game let go by a
link in a background tab never told); round 3 found 2 (with the chain trainer open, a look at another tab
reloaded the first, closing the trainer and its undo steps; a link in a background tab that the browser restored
after a restart was ignored); round 4 found 1 (a new game or the daily still loading when the player switched
tabs opened later with the other game's clock, so a daily could have sent a wrong time). Each was fixed, and each
round confirmed the previous round's fixes (none came back). Round 5 found 1 medium: pressing Back while "Keep
your candidates?" was open brought the other game back with the question still up, and answering it switched
that game's auto candidates on and marked it as helped (a daily would lose Send). A link opened in the same tab
while Restart? was open did the same with Restart (rated low there, but it wipes moves). Both are fixed by one
rule: a question or dialog asked of the board's game closes when another game comes in.

**The owner's rule for what is left** (12 November 2026): a finding that loses no game, no moves and no time
does not hold back a merge; it is written down below, under "Edge cases left".

GitHub CI had not run the browser tests since 11 November: GitHub's ubuntu-latest became Ubuntu 26.04, where
Playwright 1.56 cannot install Chromium, so browser-smoke failed in 13 seconds on every push. It now runs on
ubuntu-24.04 (.github/workflows/ci.yml), and three new tests that read the page a moment too early on the
slower runner now wait for what the app does.

## Decisions made for the owner, open to change

- **One game waits aside, not several**, and when a third game must push one out, the one with less of the
  player's own work goes, and the player is told which. Keeping two or three (about 6 KB each) is the fuller
  answer.
- **New > Daily resumes today's daily**; Restart plays it again.
- **Check & play on a custom entry, and New > a level, start a new game** and put nothing aside: a deliberate
  new game, not a link.
- **One page plays at a time** (above): the tab the player is using plays, every other open tab of the app
  shows the game and writes nothing, and two windows side by side offer Play here. This replaces "a hidden window
  keeps its own game", which three rounds of checks could not make safe.

## Left for later

Limits, written into architecture.md:

- Undo history is not kept across a reload (one step is a full copy of the board, about 6 KB, written on
  every move), nor across Cancel of a custom entry.
- Without Web Locks (navigator.locks, in every browser since 2022) a page plays as one window does, with no
  hand-over.
- Chrome passes storage between tabs asynchronously, so a move made in the very instant of the switch to another
  tab can miss it.

Lows left:

- An entry-mode change is not announced in the board's live line; AZERTY's Shift+digit makes a corner mark;
  on a Hebrew keyboard W does nothing until a letter has been typed; a digit Check flashes red is low in
  contrast while it flashes.
- GeneratingDialog is still hand-made (no focus move, no Escape to Cancel); the Share dialog's onClose
  workaround is redundant but kept.
- Offline: the privacy links that open a new tab need a connection in an installed iOS app; the update bar is
  capped at half the width of a phone.
- Pages: the 320 px rating table hides its third column with no cue that it scrolls; the Norwegian rating
  page's h1 breaks mid-word at 320 px.
- A solved daily whose result is recorded starts a second copy from New > Daily once it has left the board.

## Edge cases left

None of these loses a game, moves or time (the owner's rule, above). Each was reproduced by a checker on the
built app.

- Two different games can be named with the same words in the let-go line and in Back to it (a plain game and a
  position game of one puzzle, or the game behind a typed puzzle against a kept game).
- With two windows side by side, a holder whose reload takes longer than about two seconds hands the play to the
  window beside it and takes it back once (the window beside reloads once); a shorter wait would keep a window
  beside a closed holder under its cover longer.
- Moving between pages of the app by typing addresses into one tab, a page can reload itself once as it takes
  the play (the page before it wrote its last state as it went).
- The counts' "started" line follows the board, not the game, across a hand-over: a practice handed to another
  tab before the player's first move sends no "started" (its "completed" arrives alone), and a game whose moves
  were undone before a hand-over sends "started" again. Only the anonymous counts are off; nothing of the game is.
