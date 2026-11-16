# The advent calendar

The owner's decisions of 12 November 2026, as built: 24 doors from 1 to
24 December, door n opening on n December by the player's own date, each
a little harder than the one before, the same puzzle for everyone. A door
is a game like any other: the one slot keeps it, Back to it brings it
back, and its unassisted time can go into everyone's times on its day and
up to a week late, on the daily's own tables. This page says how it
works, what it sends and keeps, the public pages that show the doors to
search engines, the dashboard's Christmas section, and how to make next
year's doors.

## A gentle climb (the decision of 15 November 2026)

The calendar is there to bring people to sudokUI, so most players must be
able to open all 24 doors, and a friend who taps a shared door must be
able to play it. The doors of 12 November climbed from 100 to 2400 on
HoDoKu's scale, about 100 a day: Hard from 9 December and chains from 19
December, beyond most players. The owner changed that on 15 November,
before any door had opened (every door is locked until 1 December, so
nobody had played one and nothing had been sent for one):

- **The targets.** Door 1 aims at about 100 and door 24 at about 1000,
  some 39 more each day: `doorTarget(door)` is
  `Math.round(100 + (door - 1) * 900 / 23)` (src/content/advent.ts): 100,
  139, 178, 217, 257, 296, 335, 374, 413, 452, 491, 530, 570, 609, 648,
  687, 726, 765, 804, 843, 883, 922, 961, 1000.
- **The levels.** A door is of the level its target's score names
  (`doorLevel`, scripts/adventDoors.ts): doors 1 to 18 are Easy (up to
  800), solved with singles alone, Full House, Naked Single and Hidden
  Single; doors 19 to 24 are Medium (up to 1000), with at most the Medium
  techniques, pairs, triples and locked candidates. No door needs a Hard
  technique.
- **Every door** has one solution, is rated higher than the door before,
  and its level never goes down.
- **What singles alone reach.** HoDoKu's limit for Easy is 800, but a
  puzzle of singles does not come near it. A Hidden Single counts 14 and
  a Full House or a Naked Single 4, and the solver takes the 4 whenever
  one is on the board, which it always is for the last 20 cells or so.
  With 21 clues, about the fewest a puzzle of singles has, that leaves
  some 40 Hidden Singles: 640. Measured: of 3000 fresh minimal puzzles
  the highest Easy one was 550; directed climbs of 50,000 steps ended at
  620 to 640, and of 400,000 steps at 630 to 654. So the targets of doors
  15 to 18 (648, 687, 726, 765) cannot be met by Easy puzzles, and the
  decision's levels come first: those four doors stay Easy and share the
  stretch below what singles reach (`SINGLES_REACH`, 640), an even climb
  from door 14's target, 609 (`doorAim`: 617, 625, 632, 640), each still
  rated higher than the one before. Door 19, the first Medium one, is at
  its own target, 804: the step from door 18 to door 19 is the step from
  singles to the first pairs and locked candidates. The other way to
  read the decision, Medium doors from door 15 at 648 to 765, would keep
  the ratings on the line and ask for pairs and locked candidates four
  days earlier, from 15 December; it is a small change (`doorLevel`, and
  the tests and the page's words follow the doors' own levels where they
  do not name doors 18 and 19), and the doors can be made again until
  29 November UTC.
- **The words** everywhere say this climb and no other: "Door 1 is very
  easy, and each door is a little harder than the one before; the last
  ones are a good Medium".

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
| From 1 January | Nothing of the calendar shows, no door opens, and no door's time is sent, until November (`closed`). A door game in progress stays where it is, on the board or in the slot, and can be finished; asked for again (its address, a reload), it comes back, since it is the player's own game. Finished then, it still counts as a play, with its door, as every play is counted (the owner's decision 4: the started and completed lines), and its line can still be shared; its win screen says "This door is closed for new times". Any other door says "The advent calendar is closed until November". |

## A locked door opens nothing

A door whose day has not come is locked by the rule that locks a daily
whose day has not come (decision 3 of the same day): its day is after the
player's local today, one check for both (`dayToCome`,
src/content/dailies.ts; `dailyLocked` for a daily, `doorState` for a
door). [src/ui/links.ts](../src/ui/links.ts) asks it before anything else
wherever a door is asked for: its address at start-up (`/advent/2026/5`,
`/nb/advent/2026/5`, `/es/advent/2026/5`), the same address in the tab (a
link put in, Back, Forward), Import of its address, and the calendar's own
doors (a locked door's button is `aria-disabled`: Tab reaches it, and pressing it
does nothing). The toast is the daily's, in
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
  times" after that. A copy of a door whose day has not come (a clock
  that went back after it opened) offers no Send and says when it can go
  ("Door 5 of the advent calendar opens at midnight. Its time can be sent
  then."), and so does a copy of a daily still to come (`countedWhen`,
  `soon`): the switch sends nothing for it, and a time of such a day
  waiting in the queue stays there until its day (`flushPending`). The
  screen follows the date while open (`useToday`). A door solved before keeps its first solve as its
  result, with the daily's rule (`dailyKept`, `keptResultOf`). The switch
  "Send my daily times automatically" is the player's word for daily times
  and is neither offered nor used for a door: a door's time goes only when
  the player taps Send (the owner may change this; it is one line in
  `recordDaily`).
- **Its share line.** "I opened door 5 of the sudokUI advent calendar in
  4:12 · Easy (258) · unassisted · {link}" (`doorLine`,
  src/content/dailyLine.ts), with where the time stands once it is in, and
  the door's address with the time to beat. The win screen's Challenge a
  friend shares it; the Share dialog gives the door's address as the
  puzzle link, a picture whose line names the door ("sudokui.app · Advent
  door 5 · Easy 258"), and, once the door is solved on the device, "Your
  result in door 5". A door's line is counted as a `challenge` share: the
  share kinds are a closed list, and nothing new is sent for it.
- **The calendar** (src/ui/Advent.tsx): New, then Advent calendar, from 1
  November to 31 December, every door locked in November. The 24 doors: an open one with its day and its band and
  rating, marked ✓ when it was solved on this device and "in progress" when
  it is on the board or in the slot; a locked one with its day and a lock.
  Each door's level and score sit on a line each, on every door alike, and
  every row is as tall as the tallest, so the doors line up. A locked door
  is `aria-disabled`, not `disabled`: Tab reaches every door in its order
  and a screen reader reads when it opens; pressing it does nothing.
  Today's door wears the daily's ring. A December whose doors this build
  does not have (`advent.json` holds only earlier years) says "The doors of
  the 2027 advent calendar are not ready yet", in the calendar and as the
  toast of a door's address, not that the connection failed; and
  tests/adventDoors.test.ts fails from 1 October of a year whose doors are
  not in the file, so they are built before their season.

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
  31 December of its calendar. Behind, it keeps one day of grace too
  (`BEHIND_DAYS`, src/content/dailies.ts): a player west of UTC is still
  on the day UTC has left, so the evening of a door's seventh late day,
  and the evening of 31 December, are already the next day in UTC there;
  the server takes a time up to `LATE_DAYS` + 1 behind by its date, and
  through 1 January UTC, while the app stops offering Send by the
  player's own date (`doorCounts`), so a time it offers is never refused
  for the hour. A future door, one more than that behind, one from
  2 January UTC, a grid that is not the door's solution, and an assisted
  solve are all refused (tests/adventApi.test.ts).
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
no band, rating or puzzle; and so, from November 2026, does a daily whose
day has not come ("sudokUI Daily #75 opens on 20 December", with no
challenge), since the app will not open it either. Titles stay within 75
characters and descriptions within 160 without a challenge, in every
language (tests/adventApi.test.ts measures every door). `wrangler.jsonc` sends `/advent/*` (and
`/nb/advent/*`, `/es/advent/*`) to the Worker first; any other address
under them, the static `/advent/` page among them, goes back to the assets
as it is.

**A picture for every door (the decision of 15 November 2026, being
built).** As a paper calendar has a picture behind every door, a shared
door is to show its own: 24 pictures in Nordic knitting, the same every
year, `public/og/advent/door-01.png` ... `door-24.png`. The generator is
in: [scripts/og-advent-doors.ts](../scripts/og-advent-doors.ts) draws the
frame (a knitted ground in pine or cranberry, the door's number on a
sewn-on patch, the brand and the address) and each door's motif is one
file under scripts/advent-doors/, a felt cut-out in snow and gold;
[scripts/advent-doors/README.md](../scripts/advent-doors/README.md) says
how to draw one, and tests/adventDoorPictures.test.ts holds the rules a
motif file can break unseen. Doors 1, 12 and 24 are drawn. Until the 24
pictures are in public/ and `adventCopy` names them, a door previews with
its band card as above.

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
  clock and stays open until 31 December; door 1 is rated about 100 and
  door 24 about 1000, every door higher than the one before, doors 1 to
  18 Easy, singles only, and doors 19 to 24 Medium, the two door numbers
  read from the doors themselves; an unassisted time can be sent on the
  door's day and up to a week late; from 1 January the calendar is closed
  and a door under way can still be finished), and the card at the end
  links to the app and
  to today's daily (`/#daily`), each in the page's language, and says the
  calendar is under New in the app from 1 November, its doors opening
  from 1 December. No puzzle is ever on the page.
- **The doors open by the visitor's date.** The page is one file for
  everyone, so every door is written locked: an `<a>` with no address,
  its day, its rating and the word Locked. A small inline script
  (`doorScript`, no file to fetch, nothing stored or sent: it reads the
  device's date only) gives each door whose day has come its address in
  the app, `/advent/2026/5` (under `/nb/` and `/es/` on those pages), the
  class `open` (and `today` on its own day, with a holly ring) and the
  word Open, and from 1 January marks every door Closed (a solid border
  on the page's ground, its words at full strength: never dimmed). It
  paints again, every door from as it was written, a moment after each
  local midnight and whenever the page is shown again or gets the focus
  (as the app's `useToday`), so a page left open follows the date: the
  door of the day becomes a link at midnight, and on 1 January the links
  go. Its rule is the calendar's own, `doorOpen`; tests/adventPage.test.ts
  runs the script over a stand-in for the page on every day from 25
  November to 3 January and checks it door by door against `doorOpen`,
  and runs it across the midnight of 10 December and into 1 January. The
  quiet line on the home pages and /learn/ follows the date the same way. Without JavaScript every
  door reads as locked, with its day, and the status line says what is
  true on any day ("Door 1 opens on 1 December 2026, and door 24 on 24
  December"). A door opened from here is opened, or refused, by the app
  (`startDoor`): the page is a way in, not the lock.
- **For search.** Title and description in each language, within 60 and
  160 characters, with the year ("Sudoku advent calendar 2026: a little
  harder each day", "Sudoku-julekalender 2026: litt vanskeligere hver
  dag", "Calendario de adviento de sudoku 2026: de menos a más"; "24
  doors, a little harder each day" is three characters too long for a
  title beside the name and the year, so the 24 doors open the
  description instead: "A sudoku behind each of 24 doors, one opening
  each day from 1 to 24 December. Very easy at first, a little harder
  each day, up to Medium. Free, no account."); canonical; hreflang among
  the three and x-default to
  `/advent/` (`Page.alternates`, since the names differ); the sitemap, with
  the same three; structured data that is true: a `CollectionPage` whose
  `ItemList` names the 24 doors with their days and ratings, and no
  `Event`. The address stays the same every year; the year is in the
  title.
- **Its card.** `og:type` website and a card of its own per language,
  `public/og-advent-2026.png` (`.nb.png`, `.es.png`), made by
  `scripts/og-advent-card.ts`: the name and the year, "A door a day, 1
  to 24 December, a little harder each day. Free." in the language, and
  24 closed doors in pine and gold, out of order as on a paper calendar.
  A new year's doors need their card (the test fails without it).
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
  fails says so. The daily's own table of times sent (`dailySent`) leaves
  the doors' numbers out (`puzzle_no < ADVENT_BASE`): a door's time is
  counted here only, so the daily's Sent share never counts a door's.
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

Made by `scripts/build-advent.ts 2026 --replace` on 15 November 2026 (262
seconds on the development machine), in place of the doors of 12
November, which no one had opened. Each is within the search's tolerance
of what it aimed at (1% of the rating, 5 points for the first doors),
rising door by door:

| Door | Target | Rating | Level | Clues | Door | Target | Rating | Level | Clues |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 100 | 104 | Easy | 55 | 13 | 570 | 568 | Easy | 24 |
| 2 | 139 | 144 | Easy | 45 | 14 | 609 | 606 | Easy | 22 |
| 3 | 178 | 176 | Easy | 37 | 15 | 648 | 620 | Easy | 21 |
| 4 | 217 | 212 | Easy | 33 | 16 | 687 | 626 | Easy | 22 |
| 5 | 257 | 258 | Easy | 34 | 17 | 726 | 630 | Easy | 21 |
| 6 | 296 | 296 | Easy | 32 | 18 | 765 | 636 | Easy | 22 |
| 7 | 335 | 330 | Easy | 31 | 19 | 804 | 812 | Medium | 33 |
| 8 | 374 | 370 | Easy | 36 | 20 | 843 | 836 | Medium | 27 |
| 9 | 413 | 408 | Easy | 29 | 21 | 883 | 882 | Medium | 28 |
| 10 | 452 | 454 | Easy | 25 | 22 | 922 | 926 | Medium | 27 |
| 11 | 491 | 494 | Easy | 25 | 23 | 961 | 956 | Medium | 27 |
| 12 | 530 | 530 | Easy | 26 | 24 | 1000 | 998 | Medium | 24 |

Doors 1 to 18 are solved by Full House, Naked Single and Hidden Single
alone: door 1 has 26 empty cells and no Hidden Single at all, door 18 has
40 Hidden Singles among its 59 steps. Doors 15 to 18 are the four whose
targets singles do not reach (above): they aimed at 617, 625, 632 and
640. Doors 19 to 24 take 8 to 12 Medium steps each, Locked Candidates,
Naked and Hidden Pairs, Naked Triples and one Locked Pair, each puzzle
meeting its hardest step with 37 cells or more still empty. Door 1 is a
puzzle of singles with few empty cells; no minimal puzzle scores so
little, so it is a minimal one with clues of its own solution given back,
as most of the doors are (doors 10, 14, 15, 17 and 18 are minimal: no
clue of theirs can go).

## Next year's doors

1. In October or November, run `npx vite-node scripts/build-advent.ts 2027`
   (four to five minutes). It adds the year's 24 doors to
   `src/content/advent.json` and never touches a year already there: a
   published door is a promise, as a published daily is.
2. Read what it prints: each door's rating, level, clues and distance from
   what it aimed at. A door that could not come within its tolerance in
   its fixed number of tries is the nearest found, and says so by its
   distance. The run fails, and writes nothing, if a door is not of its
   level or not rated higher than the door before.
3. Make the public page's card for the year: `npx vite-node
   scripts/og-advent-card.ts` (OG_BROWSER or PW_CHROMIUM may name a
   Chromium), which writes `public/og-advent-<year>.png` and its `.nb` and
   `.es` versions.
4. Run the tests (tests/adventDoors.test.ts checks every published year's
   doors: one solution by brute force and by the engine's solver, the
   hash, the rating, the climb as decided, doors 1 to 18 Easy by singles
   alone and doors 19 to 24 Medium with nothing above Medium;
   tests/adventPage.test.ts that the page shows the new year with its
   card and says the climb as the doors have it), update the table above,
   and commit the files. Nothing else changes: the app, the Worker and
   the calendar take the year from the date, the public page and the
   dashboard the year from the file.

**Making a year again.** A year in the file can be replaced only by
asking, `npx vite-node scripts/build-advent.ts 2026 --replace`, and only
while its first door has not opened anywhere: until 29 November UTC of
its year. From 30 November UTC a player a day ahead of UTC reaches
1 December (the Worker's `EARLY_DAYS`), so the run refuses and leaves the
file as it is: a door somebody may have played never changes
(`yearPlan`, scripts/adventDoors.ts; tests/adventDoors.test.ts walks the
dates, and tests/adventBuild.test.ts runs the script itself in a folder
of its own on each side of that day). The other years in the file stay
as they are. That is how the doors of 2026 were changed on 15 November.

How a door is found (scripts/adventDoors.ts): its own seed, the year and
the door, and a fixed number of tries, so a run on any machine makes the
same doors while the generator and the rater stay as they are
(tests/adventDoors.test.ts makes the first three doors of 2026 again and
compares them with the file). First, up to 400 fresh minimal puzzles are
rated and the nearest of the door's level kept; one rated above the aim
may have clues of its own solution given back, one at a time, which takes
the singles it no longer needs off its rating. Doors 1 to 11 come this
way, and so did door 19 in 2026. A door those tries do not bring within
its tolerance is climbed to (`climb`): a full grid is dug down, a clue at
a time, while the level's techniques still solve it (the singles for an
Easy door, with pairs, triples and locked candidates for a Medium one),
and then walked, a clue taken away, given back or moved at a time,
towards the aim; a step is kept when the puzzle is still solved by those
techniques and is no further from the aim, or further by a slack that
falls to nothing over 40,000 steps, after which another grid is tried, up
to 480,000 steps in all. In 2026 the climbs took 500 to 110,000 steps.
Every door has one solution, is solved by the catalogue without guessing,
is of its level and rated higher than the door before, and a Medium one
meets its hardest technique on a board with room in it (`fitForLevel`),
as a puzzle served for its level must.

## Edge cases left

By the owner's rule of 12 November 2026, a finding that loses no game,
moves or time does not hold back a merge; these are written down instead.
Each was reproduced by an independent checker.

- **A door's puzzle can be played early as a plain puzzle.** advent.json
  is a file of the app, loaded on demand, so a door's puzzle can be read
  before its day and pasted into Import (or put in a `/p/` link), where it
  plays as an ordinary puzzle. Nothing of the door goes with it: no door
  time can be sent and it is not the door in the calendar.
- **A device clock set forward** opens the door (and the daily) for that
  date on that device. The Worker still refuses a time for a day more than
  a day ahead of UTC.
- **The game clock follows the device clock forward.** A device clock put
  forward while a game runs in view adds that time to the game. A clock put
  back no longer takes time away: the timer stands still until the clock
  passes it again, and never goes below zero (src/state/gameStore.ts,
  elapsedMs; tests/clockBack.test.ts). A clock that cannot be moved by the
  device (a monotonic one) is the fuller answer.
- **A copy of a day still to come opened by an earlier build** stays where
  it is, never lost; it no longer sends its time before its day (by the
  button or the auto-send switch), and with the auto-send switch on it does
  not send by itself once its day comes either: Send on its win screen
  does.
- **The Worker judges a day by whole UTC days**, with a day of grace each
  side for time zones: a time can arrive up to eight days late, on
  1 January, or before a door has opened somewhere, by a few hours. The app
  itself offers Send only from the door's or the daily's own local day to
  seven days after it, never after 31 December for a door.
- **Share previews** (the Worker) show tomorrow's daily or a door as open
  up to ten hours before a time zone reaches its day, for the same reason;
  the app still opens it only on its day.
- **The admin panel's calendar query** has never run against the real
  Analytics Engine (only against the test double): if the API refuses it,
  that section says so and the rest of the page is unaffected. Look at
  /admin once in December.


## The door pictures (parked on 16 November 2026, not live)

The owner's decision of 15 November 2026: a shared door link shows its
own picture, one per door, in the Nordic knit style the owner chose.
This work is on the branch `claude/adoring-curie-nlizdj` only, not on
main, and was parked part-way to save the owner's usage.

Done:
- The generator, `scripts/og-advent-doors.ts`, with one file per motif
  under `scripts/advent-doors/` and a README for whoever draws the rest.
  `npx vite-node scripts/og-advent-doors.ts 1 2 3 --out <dir>
  --sheet-small <file.png>` renders doors and a sheet of them at chat
  size.
- 17 of 24 motifs: doors 1 to 16 and 24.

Left:
- Doors 17 to 23: sleigh, wreath, bauble, cabin with chimney smoke, snow
  crystal, paper star in the window, bowl of Christmas porridge.
- A look at all 24 together, and redrawing any weak one.
- Writing the 24 PNGs (1200 x 630, under 300 KB) to `public/og/advent/`.
- `src/content/share.ts`, `adventCopy`: an open door shows its picture,
  with an alt text in en, nb and es; a locked door shows the calendar's
  own card. Until this is done a shared door shows the level's generic
  card, as before.
- Keeping the pictures out of the service worker's precache
  (`vite.config.ts`, `globIgnores`), tests for the preview and the
  files, and "The preview" section above.
- The first door opens on 1 December 2026.
