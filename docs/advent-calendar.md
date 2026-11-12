# The advent calendar

The owner's decisions of 12 November 2026, as built: 24 doors from 1 to
24 December, door n opening on n December by the player's own date, its
puzzle rated about n x 100 on HoDoKu's scale (door 1 about 100, door 24
about 2400), the same puzzle for everyone. A door is a game like any
other: the one slot keeps it, Back to it brings it back, and its
unassisted time can go into everyone's times on its day and up to a week
late, on the daily's own tables. This page says how it works, what it
sends and keeps, and how to make next year's doors.

## The season, in dates

One module says what the calendar allows on a date,
[src/content/advent.ts](../src/content/advent.ts), and everything else
asks it. The dates are the player's local date (`localDateKey`), as the
daily's are.

| Date (local) | What the calendar does |
|---|---|
| 1 to 30 November | New shows one quiet line: the calendar opens on 1 December (`calendarSoon`). No door opens. |
| 1 to 24 December | New has Advent calendar (`calendarOpen`). Door n opens on n December (`doorOpen`); a door still to come is locked. |
| 25 to 31 December | Every door is open (an earlier door is always allowed until 31 December). |
| From 1 January | Nothing of the calendar shows, no door opens, and nothing of it is sent. A door game in progress stays where it is, on the board or in the slot, and can be finished; asked for again (its address, a reload), it comes back, since it is the player's own game. |

The season module of the Christmas look (decision 1 of the same day, built
in another branch) has its own functions for the look; this module's date
checks (`calendarOpen`, `calendarSoon`, `doorOpen`, `doorCounts`) are the
calendar's, and the two can be joined into one `season.ts` when the
branches meet.

## A locked door opens nothing

A door whose day has not come is refused wherever it is asked for, by
`startDoor` in [src/ui/links.ts](../src/ui/links.ts), which every way in
goes through: its address at start-up (`/advent/2026/5`, `/nb/advent/2026/5`,
`/es/advent/2026/5`), the same address in the tab (Back, Forward, a link
put in), Import of its address, and the calendar's own doors (a locked
door's button is disabled). The toast says when it opens ("Door 5 of the
advent calendar opens on 5 December"), and nothing goes over the game on
the board: no slot, no new game, and the address goes back to the board's
game. A position link (`#s=`) on a locked door's address is refused with
it, so the door's puzzle is not played under another name either.

Two limits, as with the daily's spoilers (docs/online-goals.md, phase 2):
`advent.json` is a lazy chunk of the app, so a determined player can read
a door's puzzle early and paste the string into Import, which plays it as
a plain puzzle (not as the door: no door time can go in for it); and a
device whose clock is set forward opens the door its date says. The
Worker still refuses a time for a door whose day has not come anywhere
(below).

## A door as a game

- **Its kind.** `GameInfo.adventYear` and `adventDoor` (as a daily has
  `dailyKey` and `dailyNo`), set by `startDoor`; Restart keeps them. The
  notes and toasts name it "door 5 of the advent calendar" ("luke 5 i
  julekalenderen", "la casilla 5 del calendario de adviento"), in
  `gameName`. Its kind for the counts is `advent` (`kindOf`).
- **Never lost.** A door opens over a game under way through `openOver`
  and the one slot, as links do ("A game is never lost",
  [architecture.md](architecture.md)). Asked for again (the calendar, its
  address, a link to it), the door on the board, in the slot or behind a
  puzzle being typed in comes back where it was left, never a second copy,
  as New > Daily resumes today's daily; `holds` and `backTo` know a door by
  its year and number for Back and Forward.
- **Its address.** The address bar follows a door game as
  `/advent/<year>/<door>` in the app's language (`boardAddress`, App.tsx).
  The service worker answers it with the app (`APP_NAVIGATION`,
  src/content/home.ts), and `langOfPath` reads its language. The static
  calendar pages of decision 5 (`/advent/`, `/nb/julekalender/`,
  `/es/calendario-de-adviento/`) are another branch's: their entry in
  `STATIC_ROUTES` must match those pages alone, not
  `/advent/<year>/<door>`, or an installed app would fetch a door's
  address from the network instead of answering it offline
  (tests/advent.test.ts checks it).
- **Its win screen.** As the daily's: the door's numbers fetched when it
  opens, and "Send my time and compare" for an unassisted solve while the
  door's time can still count (`doorCounts`: its day and up to
  `LATE_DAYS`, 7, late, within its December), "This door is closed for new
  times" after that. A door solved before keeps its first solve as its
  result, with the daily's rule (`dailyKept`, `keptResultOf`). The switch
  "Send my daily times automatically" is the player's word for daily times
  and is neither offered nor used for a door: a door's time goes only when
  the player taps Send (the owner may change this; it is one line in
  `recordDaily`).
- **Its share line.** "I opened door 5 of the sudokUI advent calendar in
  4:12 · Easy (498) · unassisted · {link}" (`doorLine`,
  src/content/dailyLine.ts), with where the time stands once it is in, and
  the door's address with the time to beat. The win screen's Challenge a
  friend shares it; the Share dialog gives the door's address as the
  puzzle link, a picture whose line names the door ("sudokui.app · Advent
  door 5 · Easy 498"), and, once the door is solved on the device, "Your
  result in door 5". A door's line is counted as a `challenge` share: the
  share kinds are a closed list, and nothing new is sent for it.
- **The calendar** (src/ui/Advent.tsx): New, then Advent calendar, from 1
  to 31 December. The 24 doors: an open one with its day and its band and
  rating, marked ✓ when it was solved on this device and "in progress" when
  it is on the board or in the slot; a locked one with its day and a lock.
  Today's door wears the daily's ring.

## What is sent, and what is kept

- **A door's time** goes as the daily's does, to the same route,
  `POST /api/daily/<n>/result`, under the door's own number,
  `adventNo(year, door) = 100000 + year x 100 + door` (door 5 of 2026 is
  302605), a range no daily reaches (the daily's count of days passes
  100000 in the year 2300). The server stores it on the same two D1
  tables, with no schema change. Its statistics come from
  `GET /api/daily/<n>/stats`.
- **The Worker's window** (worker/daily.ts, `checkResult`): the door's day
  by the UTC date, with the daily's `EARLY_DAYS` (1) of grace ahead for a
  player a day ahead of UTC, and up to `LATE_DAYS` (7) behind; never after
  31 December of its calendar. A future door, one more than a week behind,
  a grid that is not the door's solution, and an assisted solve are all
  refused (tests/adventApi.test.ts).
- **The counts.** `PLAY_KINDS` has `advent`; a door's started and
  completed lines carry its door, 1 to 24, as a seventh blob after the six
  an older line has, so no older line moves (worker/telemetry.ts checks
  it: a door's line must carry its door, no other line may). A door's
  address opened from outside the site counts a landing with `advent` in
  `LANDING_SLOTS`, and the door's band once it is open. Nothing else is
  sent: no count of who opens the calendar, and none of the Christmas look.
- **On the device**, with the dailies' own record
  (src/state/dailyStats.ts): each door solved, its time and whether it had
  help, at most 48 (two calendars), kept apart from the 31 days of daily
  solves so the doors never push a day out; and, as for a daily, the
  random token of a door whose time was sent, and a time waiting to be
  sent. A door's time that waited past its window (offline over New Year)
  is dropped unsent.
- **The privacy page** says all of it in three languages: the kind of
  game with its door, the section "The advent calendar's doors".

## The preview

The Worker answers a door's address with the app and a share preview
(`shareParamsOf`, `renderSharePage` in src/content/share.ts), `noindex` as
every share page: "Door 5 · sudokUI advent calendar" with the door's band
card, its day and its HoDoKu rating; a challenge keeps the door in the
headline. A door whose day has not come anywhere on earth (the UTC date
plus `EARLY_DAYS`) previews with the day it opens, the site's own card and
no band, rating or puzzle. `wrangler.jsonc` sends `/advent/*` (and
`/nb/advent/*`, `/es/advent/*`) to the Worker first; any other address
under them, the static `/advent/` page among them, goes back to the assets
as it is.

## The doors of 2026

Made by `scripts/build-advent.ts 2026` (69 seconds on the development
machine), each within 1% of its target (5 points for the first doors),
rising door by door, in bands that never fall:

| Door | Rating | Band | Door | Rating | Band |
|---|---|---|---|---|---|
| 1 | 104 | Easy | 13 | 1302 | Hard |
| 2 | 196 | Easy | 14 | 1408 | Hard |
| 3 | 302 | Easy | 15 | 1504 | Hard |
| 4 | 396 | Easy | 16 | 1588 | Hard |
| 5 | 498 | Easy | 17 | 1698 | Unfair |
| 6 | 602 | Medium | 18 | 1788 | Unfair |
| 7 | 700 | Medium | 19 | 1912 | Extreme |
| 8 | 806 | Medium | 20 | 1988 | Extreme |
| 9 | 900 | Hard | 21 | 2118 | Extreme |
| 10 | 1004 | Hard | 22 | 2216 | Extreme |
| 11 | 1102 | Hard | 23 | 2316 | Extreme |
| 12 | 1212 | Hard | 24 | 2418 | Extreme |

Door 1 is a puzzle of singles with 26 empty cells; no minimal puzzle
scores so little, so it is a minimal one with clues of its own solution
given back. A puzzle of singles alone rarely adds up to 600, so a door may
be in the band its target names or the one above (door 6 is Medium at
602, door 9 Hard at 900), and never below the door before.

## Next year's doors

1. In October or November, run `npx vite-node scripts/build-advent.ts 2027`
   (about a minute). It adds the year's 24 doors to
   `src/content/advent.json` and never touches a year already there: a
   published door is a promise, as a published daily is.
2. Read what it prints: each door's rating, band and distance from its
   target. A door that could not come within its tolerance in its fixed
   number of tries is the nearest found, and says so by its distance.
3. Run the tests (tests/adventDoors.test.ts checks every published year's
   doors: one solution, the hash, the rating, rising), update the table
   above, and commit the file. Nothing else changes: the app, the Worker
   and the calendar take the year from the date.

How a door is found (scripts/adventDoors.ts): its own seed, the year and
the door, and a fixed number of tries, so a run on any machine makes the
same doors while the generator and the rater stay as they are
(tests/adventDoors.test.ts makes the first three doors of 2026 again and
compares them with the file). Fresh minimal puzzles are rated and the
nearest kept; one rated above its target may have clues of its own
solution given back, one at a time, which takes the singles it no longer
needs off its rating. Every door has one solution, is solved by the
catalogue without guessing, and from Medium up meets its hardest technique
on a board with room in it (`fitForLevel`), as a puzzle served for its
band must.
