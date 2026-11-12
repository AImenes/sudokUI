# The advent calendar

The owner's decisions of 12 November 2026, as built: 24 doors from 1 to
24 December, door n opening on n December by the player's own date, its
puzzle rated about n x 100 on HoDoKu's scale (door 1 about 100, door 24
about 2400), the same puzzle for everyone. A door is a game like any
other: the one slot keeps it, Back to it brings it back, and its
unassisted time can go into everyone's times on its day and up to a week
late, on the daily's own tables. This page says how it works, what it
sends and keeps, the public pages that show the doors to search engines,
the dashboard's Christmas section, and how to make next year's doors.

## The season, in dates

One module says what the season allows on a date,
[src/content/season.ts](../src/content/season.ts), for the Christmas look
and the calendar alike, and everything else asks it: the app's links and
calendar (`calendarOpen`, `doorState`, `doorOpen`), the win screen and the
queue of times (`doorCounts`), the Worker (`calendarEnd`) and the public
pages, whose inline script tests/adventPage.test.ts holds to `doorOpen`
day by day. The dates are the player's local date (`localDateKey`), as the
daily's are. src/content/advent.ts keeps what is the calendar's own and
no date rule: the doors' numbers, their addresses and the published list.

| Date (local) | What the calendar does |
|---|---|
| 1 to 30 November | New has Advent calendar (`calendarOpen`), "Its doors open from 1 December": the 24 doors, every one locked, each with the day it opens. No door opens. |
| 1 to 24 December | Door n opens on n December (`doorState` is `open`); a door still to come is `locked`. |
| 25 to 31 December | Every door is open (an earlier door is always allowed until 31 December). |
| From 1 January | Nothing of the calendar shows, no door opens, and nothing of it is sent, until November (`closed`). A door game in progress stays where it is, on the board or in the slot, and can be finished; asked for again (its address, a reload), it comes back, since it is the player's own game. Any other door says "The advent calendar is closed until November". |

## A locked door opens nothing

A door whose day has not come is locked by the rule that locks a daily
whose day has not come (decision 3 of the same day): its day is after the
player's local today, one check for both (`dayToCome`,
src/content/dailies.ts; `dailyLocked` for a daily, `doorState` for a
door). [src/ui/links.ts](../src/ui/links.ts) asks it before anything else
wherever a door is asked for: its address at start-up (`/advent/2026/5`,
`/nb/advent/2026/5`, `/es/advent/2026/5`), the same address in the tab (a
link put in, Back, Forward), Import of its address, and the calendar's own
doors (a locked door's button is disabled). The toast is the daily's, in
one style (`lockedLine`): "Door 2 of the advent calendar opens at
midnight" for tomorrow's door, as "Tomorrow's daily opens at midnight";
"Door 5 of the advent calendar opens on 5 December" for a later one, as
"That daily opens on 20 November"; Import says it in its own dialog.
Nothing goes over the game on the board: no slot, no new game, and the
address goes back to the board's game. A position link (`#s=`) on a
locked door's address is refused with it, so the door's puzzle is not
played under another name either. A first visit to a locked door's
address plays a game of its own, and the toast stays over it.

A copy of a locked door the player already holds (opened on its day, then
the device's clock put back) is left where it is, never lost, as a daily's
copy is: on the board its address changes nothing, quietly; in the slot
its link, Back and Forward leave it there and say when it opens, and Back
to it brings it as always. A door whose day has come but whose calendar
has closed (January) is the other case: a door game the player holds is
theirs and comes back where it was left, by its address too.

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
  calendar pages (below) are matched by `STATIC_ROUTES` alone, never
  `/advent/<year>/<door>`, or an installed app would fetch a door's
  address from the network instead of answering it offline
  (tests/advent.test.ts and tests/adventPage.test.ts check it).
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
  November to 31 December, every door locked in November. The 24 doors: an open one with its day and its band and
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

## The public pages

Decision 5: a page for search engines and for anyone a link brings, live
all year, in three languages, each under its own name: `/advent/`,
`/nb/julekalender/` and `/es/calendario-de-adviento/`. The copy is in
[src/content/adventPage.ts](../src/content/adventPage.ts);
src/content/learnPages.ts builds the pages with the Learn pages
(`adventCalendarPage`), so scripts/build-learn.ts writes them into dist/
and the sitemap, and the dev server serves them.

- **What it shows.** The latest calendar in `advent.json`
  (`pageCalendar`): its 24 doors in a grid, three a row on a phone, four,
  then six, each with its day, its level and its HoDoKu rating, and a word
  for where it stands. A status line says where the calendar stands, a
  section says how it works (a door opens on its day by the player's
  clock and stays open until 31 December; door n is rated about
  n x 100; an unassisted time can be sent on the door's day and up to a
  week late; from 1 January the calendar is closed and a door under way
  can still be finished), and the card at the end links to the app and
  to today's daily (`/#daily`), each in the page's language. No puzzle is
  ever on the page.
- **The doors open by the visitor's date.** The page is one file for
  everyone, so every door is written locked: an `<a>` with no address,
  its day, its rating and the word Locked. A small inline script
  (`doorScript`, no file to fetch, nothing stored or sent: it reads the
  device's date only) gives each door whose day has come its address in
  the app, `/advent/2026/5` (under `/nb/` and `/es/` on those pages), the
  class `open` (and `today` on its own day, with a holly ring) and the
  word Open, and from 1 January marks every door Closed. Its rule is the
  calendar's own, `doorOpen`; tests/adventPage.test.ts runs the script
  over a stand-in for the page on every day from 25 November to 3 January
  and checks it door by door against `doorOpen`. Without JavaScript every
  door reads as locked, with its day, and the status line says what is
  true on any day ("Door 1 opens on 1 December 2026, and door 24 on 24
  December"). A door opened from here is opened, or refused, by the app
  (`startDoor`): the page is a way in, not the lock.
- **For search.** Title and description in each language, within 60 and
  160 characters, with the year ("Sudoku advent calendar 2026: 24
  puzzles, easy to extreme", "Sudoku-julekalender 2026: 24 luker, fra
  lett til ekstrem", "Calendario de adviento de sudoku 2026: de fácil a
  extremo"); canonical; hreflang among the three and x-default to
  `/advent/` (`Page.alternates`, since the names differ); the sitemap, with
  the same three; structured data that is true: a `CollectionPage` whose
  `ItemList` names the 24 doors with their days and ratings, and no
  `Event`. The address stays the same every year; the year is in the
  title.
- **Its card.** `og:type` website and a card of its own per language,
  `public/og-advent-2026.png` (`.nb.png`, `.es.png`), made by
  `scripts/og-advent-card.ts`: the name and the year, and 24 closed doors
  in pine and gold, out of order as on a paper calendar. A new year's
  doors need their card (the test fails without it).
- **The look.** The site's own night and day, with the Christmas look's
  palette on the calendar alone (`ADVENT_STYLE`, src/content/learnPages.ts;
  the app's src/ui/styles.css, data-theme christmas): open doors in its
  top bar's deep pine with gold numbers and snow words, dashed ones while
  locked, its string of lights on a pine ribbon above them, and today's
  door ringed in its holly. It fits 320 px (tests/e2e/pages.spec.ts checks
  every sitemap page at 320, 360 and 390 px).
- **Where it is linked from.** One quiet line, "Advent calendar: a sudoku
  behind each door, from 1 to 24 December", on the home pages (in the
  block crawlers read before the app starts) and on `/learn/`, in each
  language (`seasonLine`, src/content/adventLine.ts, kept apart so the
  app's bundle, which carries home.ts, takes the line and not the page's
  copy). It is in the HTML all year, hidden, and a
  one-line script shows it in November and December by the visitor's
  date, so a search engine finds the link and a reader sees it only in
  season. llms.txt lists the page too.
- **Not the app's.** `STATIC_ROUTES` matches the three pages, so the
  service worker never answers them with the app; `/advent/` is under
  `/advent/*` in wrangler.jsonc's `run_worker_first`, and the Worker hands
  it back to the assets as it is, counting nothing (tests/telemetry.test.ts).
- **IndexNow** reads the sitemap (scripts/build-indexnow.ts), so the
  three pages go to IndexNow on the first deploy with them, and again
  whenever they change. No other page's HTML changes with them but the
  home pages' and `/learn/`'s, in their three languages, which carry the
  quiet line.

## The admin panel's Christmas section

At the end of `/admin` (worker/admin.ts, `adventSection`), below the
daily's times sent, for the calendar in season: its November, December
and the January after; outside that, the next one published (October
shows the coming one), else the last.

- **Where it stands**, by the UTC day: before 1 December it says the
  calendar opens on 1 December, by each player's own date, and every door
  shows zeros; in December that it is open; after, that it closed on 31
  December and that a door game under way can still be finished.
- **Five numbers**: door games begun and completed, the completion rate,
  the unassisted times sent, and the landings on a door's address.
- **A row per door**: its day, its band and rating (from `advent.json`),
  games begun and completed, the completion rate, the unassisted times
  that reached the database and their median, and a row for all.
- **Where the door landings came from**, by the referrer's word, as the
  main table of landings has it.

Where the numbers come from, each read kept bounded:

- **Begun and completed** are the door games' play lines (kind `advent`),
  summed by their door, the seventh blob (`adventQuery`): a second query
  to the SQL API, run only for the UTC days from 30 November (a player a
  day ahead of UTC opens door 1 then) to 31 January (a month for the door
  games under way on 1 January), at most 63 days back, and kept to the
  calendar's own lines (the doors' starts and solves, and the landings in
  the `advent` slot): two events of 24 doors and the landing words, a day.
  Before 30 November nothing is asked and the doors show zeros; after 31
  January the counts are no longer read (Analytics Engine keeps three
  months) and the section says so. If that query fails, the section says
  so and the rest of the page stands.
- **Times and the median** come from D1 (`adventTimes`), as the daily's
  times table does: one read of `daily_hist` on the primary key's range of
  the year's 24 door numbers (`adventNo(year, 1)` to `adventNo(year, 24)`),
  at most 481 rows a door, and the median as the win screen reads it
  (`statsFromHistogram`). Without a database bound, no times; one that
  fails says so.
- **Landings** are the `landing` points with `advent` in the source slot,
  by the word in the fifth blob.
- Nothing counts the Christmas look: no line says which theme a player
  uses, and the section says that too.

tests/telemetry.test.ts holds it: the year in season, the phase, the
query and its window, the rows, each door's numbers and the totals, the
database read, the page before 1 December (zeros), open, past and failed,
the two queries in December and one in October, and the static page left
to the assets.

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
3. Make the public page's card for the year: `npx vite-node
   scripts/og-advent-card.ts` (OG_BROWSER or PW_CHROMIUM may name a
   Chromium), which writes `public/og-advent-<year>.png` and its `.nb` and
   `.es` versions.
4. Run the tests (tests/adventDoors.test.ts checks every published year's
   doors: one solution, the hash, the rating, rising;
   tests/adventPage.test.ts that the page shows the new year with its
   card), update the table above, and commit the files. Nothing else
   changes: the app, the Worker and the calendar take the year from the
   date, the public page and the dashboard the year from the file.

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
