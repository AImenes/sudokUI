# Online goals: what a database opens, and what it must not change

Companion to [goals.md](goals.md). That document is the mission; this one
is what sudokUI may do once it has a server-side store (Cloudflare D1 next
to the assets-only Worker), in what order, and the lines it will not cross.
It is written to be pasted into a prompt as context, so it states the
current code, the decisions, the budgets and the open questions in one
place. It is not translated.

Status: decided, nothing built yet. Dates and limits were checked in
October 2026 and must be re-checked before each phase ships.

## The one-paragraph version

Build three things, in this order: path-based share URLs that unfurl with a
proper preview, a shared daily with anonymous global stats and a
spoiler-free share line, and ID-less telemetry to Workers Analytics Engine
so the first two can be measured. Most of the reach comes from the daily
plus share loop and from fixing link previews, and very little of it needs
the database. D1 holds product data only (daily results, one histogram).
Telemetry never goes to D1. There are no accounts, no banner, no third-party
script, and the board never waits for the network.

## Principles that hold online as well

The six principles in [goals.md](goals.md) stand. Principle 6, "offline,
free, private", is the one every online feature is measured against, so it
gets sharper here:

1. **The core never awaits the network.** Generation, rating, play, hints,
   practice and the local record work exactly as today. Every online
   feature is an island that renders "unavailable offline" and never blocks
   the board. If D1 is down or over its daily cap, play is unaffected.
2. **No account, ever.** No sign-in, OAuth, email capture or password. The
   roadmap line "optional accounts (Cloudflare D1) for sync across devices"
   in README.md is withdrawn. If sync is ever wanted it is a user-initiated
   encrypted blob under a random code with a TTL, not an identity.
3. **No identifier by default.** The server never stores an IP, a cookie, a
   fingerprint or an install ID. Anything that stores information on the
   player's device for analytics, or links one session to another, sits
   behind a single honest opt-in toggle. See "Norwegian law" below for why.
4. **The player asks, the server answers.** The default online flows are
   things the player explicitly requests: "submit my daily result and show
   me how I compare", "give me a link that previews". That is the legal
   footing as well as the product one.
5. **Measured, not asserted, applies to the product too.** Ship the daily
   and the share links together with the telemetry that can tell whether
   they worked. Decide v2 from four to eight weeks of data, not from hope.
6. **Stay on the free tier until the numbers force a decision.** Design so
   the first wall is the Worker request cap at roughly twenty thousand
   daily players, and the answer at that wall is the five-dollar plan, not
   a redesign.

## Where the code stands today

Facts a prompt can rely on, with the files that hold them:

- **Hosting is an assets-only Worker.** `wrangler.jsonc` has no `main`;
  `npx wrangler deploy` uploads `dist/`. Unknown paths are real 404s
  (`not_found_handling: "404-page"`). Adding API routes means adding a
  `main` entry and a Worker script; the static hosting does not move
  ([deployment.md](deployment.md)).
- **The daily is derived at runtime from the date.** `src/engine/daily.ts`
  seeds a PRNG from the UTC date string, swaps it in for `Math.random`, and
  runs the ordinary generator until it finds a Medium, Tricky or Hard
  puzzle. This is deterministic only while the generator and the rater
  never change. They change often (every new technique moves ratings), so
  history re-rolls silently. Global stats need a pinned puzzle per day, so
  this must change before phase 2.
- **The streak is local.** `src/state/stats.ts` keeps `dailyDays`, a list of
  date keys, persisted with zustand `persist` in localStorage. The win
  dialog in `src/ui/Dialogs.tsx` computes the streak from it.
- **Share links are hash URLs.** The win dialog builds
  `https://sudokui.app/<lang>/#p=<81 chars>` and the app reads `#p=` on
  boot (`src/ui/App.tsx`). Fragments are never sent to the server, so every
  shared puzzle unfurls as the homepage. The learn pages also link to
  `#p=` for "play this puzzle from the start" (`src/content/learnPages.ts`).
- **"Faster than N%" is modelled, not measured.** `src/content/solveTimes.ts`
  holds a hand-set median per band and one log-normal spread, calibrated
  to published online-solver figures and championship times. The share
  text already carries this percentile. Crowd data can replace the model
  band by band once there is enough of it.
- **The service worker answers only the app roots with the shell.**
  `vite.config.ts` allows navigation fallback for `/`, `/nb/`, `/es/` and
  denies `STATIC_ROUTES` (`src/content/staticRoutes.ts`), so the learn
  pages, `/daily-sudoku/`, `/sudoku-solver/` and the rest are real
  documents. New Worker-rendered routes such as `/p/` and `/daily/` must be
  added to that deny list or an installed app will answer them with the
  game.
- **Static pages are built post-build.** `scripts/build-learn.ts` writes the
  learn pages and `sitemap.xml` into `dist/`. The social card is one static
  `og-card.png` made by `scripts/og-card.ts`.
- **Languages.** The site is being translated to Norwegian (`/nb/`) and
  Spanish (`/es/`) on the same branch as this document. Any new route or
  share text must go through the same `t()` templates and language roots as
  the rest of the app, and share pages must carry the language of the
  sender.

## The road, in order

### Phase 1: share links that preview (no database)

The smallest change with the largest reach effect. A Worker route
`/p/<81 chars>` returns HTML with a puzzle-specific `<title>`, description,
Open Graph and Twitter tags, `noindex`, and a static OG image chosen by
band, then boots the same app bundle. Optional query hints such as
`?b=tricky&t=xw,sky` come from the client and are spoofable, which is
harmless because the page is not indexed. `#p=` keeps working.

- Do not rate the puzzle server-side on the free plan. The hardest puzzles
  take most of a second to rate, against a 10 ms CPU limit per invocation.
  The client already knows band, score and techniques when it builds the
  link, so it puts them in the query.
- Eight static OG images, one per band, not a rendered board per puzzle.
- "Challenge a friend" costs nothing extra: `/p/…?vs=9:12` puts the
  challenger's time in the URL and the win screen compares against it.
- `/daily/<date>` gets the same treatment in phase 2.
- Schema.org markup only on indexable pages (daily archive, learn pages),
  never on `/p/`.

Needs: a `main` Worker script, the route, the OG images, the service
worker deny list, and tests that the route returns the right tags for a
sample puzzle in each language.

### Phase 2: the shared daily with global stats and a share line

**The puzzle itself needs no server.** Replace runtime date seeding with a
committed `daily/<year>.json` of puzzle strings with band, score and
technique list, generated by the engine at build time and precached by the
service worker so an installed app always holds thirty to sixty days
ahead. Static assets are free and unlimited. Key the puzzle number by the
player's local date, Wordle-style, so streaks feel fair. Publishing future
dailies in cleartext lets a determined player peek; for a no-prize daily
that is acceptable, and shipping only the next seven days is the fallback
if it bothers us.

**D1 holds results only.** Two tables, one upsert per solve, and the median
and percentile come from a sixty-row read:

```sql
-- One row per submitted daily result. token is a random per-day value the
-- client keeps next to its own local result, so a resubmit is a no-op.
CREATE TABLE daily_result (
  puzzle_no    INTEGER NOT NULL,
  token        TEXT    NOT NULL,
  seconds      INTEGER NOT NULL,
  unassisted   INTEGER NOT NULL DEFAULT 0,
  hints        INTEGER NOT NULL DEFAULT 0,
  source       TEXT,              -- 'pwa' | 'tab'
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (puzzle_no, token)
) WITHOUT ROWID;

-- Pre-aggregated histogram in 15-second buckets.
CREATE TABLE daily_hist (
  puzzle_no    INTEGER NOT NULL,
  bucket       INTEGER NOT NULL,  -- floor(seconds / 15)
  n            INTEGER NOT NULL,
  n_unassisted INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (puzzle_no, bucket)
) WITHOUT ROWID;
```

Write path per solve, as one batch: `INSERT OR IGNORE INTO daily_result`,
then `INSERT INTO daily_hist … ON CONFLICT DO UPDATE SET n = n + 1`. Never
scan all results per request. A median computed over ten thousand rows on
every page view would burn the whole daily read budget and, since
1 September 2026, take the feature offline until midnight UTC.

**Endpoints**, all JSON, all cacheable:

- `GET /api/daily/:n/stats`: count, median, histogram. Edge-cached 60 s
  through the Cache API.
- `POST /api/daily/:n/result`: validated, two D1 writes.

**Server checks**, all under a millisecond: the final grid equals the
published solution, elapsed time is at least a floor (for example 0.4 s per
empty cell), the hint count matches the unassisted flag, one submission
per token, rate limit per IP in memory without storing the IP. Full
logical replay is not worth it; a cheater can solve elsewhere and replay
plausible timings, and no cheap scheme stops that. The headline is the
median and the percentile, which a few cheats cannot move.

**The win screen** gains an optional, lazy-loaded panel: "4,212 solved
today, median 9:12, you were faster than 71%". Offline it says "available
when online" and the submission is retried on the next open.

**The share line** is text plus a path URL, never an emoji grid that leaks
the solution:

```
sudokUI Daily #142 · Hard (1420) · 9:12 · unassisted · faster than 71% · sudokui.app/daily/2026-10-06
```

An optional emoji row may show the techniques used unaided (a fish glyph
for X-Wing), which gives the expert audience something to brag about
without spoiling the puzzle. `/daily/<date>` unfurls with a preview and
lands the newcomer on the puzzle, not the homepage.

Needs: the static daily file and its build step, the two tables and a
migration, the two routes, the panel, the share line in every language,
and a test that `meta.rows_read` of every query stays bounded.

### Phase 3: counting plays, including offline ones

Ships together with phase 2, because without it we cannot tell whether
phases 1 and 2 worked.

**Where it goes: Workers Analytics Engine, not D1.** WAE has its own
allowance of 100,000 data points a day, is built for high write volume with
SQL on top, keeps three months, and does not compete with the D1 write
budget. One data point per event: index = event type, blobs = band,
source, version, country from `request.cf`, doubles = seconds and count.
Batched, up to 250 points per request, through `POST /api/t`. If permanent
history is wanted, roll one aggregate row per day from WAE into D1.

**What is sent by default** (live, ID-less, nothing stored on the device
for it): game started or completed while online, with band, time bucket,
whether `display-mode: standalone` matched, and app version. Never an IP.
Disclosed plainly on a privacy page.

**What needs opt-in**: a random install ID, an offline event queue flushed
later, or any self-computed retention bucket sent without an ID. Each of
these stores or reads information on the device for analytics.

**The UX.** No banner. One line in the win dialog the first time, and a
toggle in Settings: "Help count plays, including offline ones. Sends
anonymous totals, no ID by default." Opt-in rates will be low, so the
opted-in cohort is a sample: scale offline plays by the ratio of opted-in
offline to online completions and label the result an estimate.

**Transport.** `navigator.sendBeacon`, with `fetch` keepalive as the other
path (Firefox has a long-standing keepalive gap). Background Sync is
Chromium-only; the opted-in queue flushes on `visibilitychange` and app
open everywhere and uses Background Sync only as an enhancement.

**The dashboard** is a private `/admin` route in the same Worker behind
Cloudflare Access, calling the WAE SQL API with a token held as a Worker
secret, rendering a dozen numbers and a thirty-day sparkline.

**Metrics, in order of importance:**

1. Completed games per day, online plus estimated offline.
2. Daily participants and completion rate, starts against completes.
3. Installed-PWA share of completions.
4. Share-link landings per day: Worker hits on `/p/` and `/daily/` with
   no internal referrer.
5. New against returning, from the opted-in cohort only.
6. Search clicks from Search Console for archive and learn pages.

### Phase 4, after four to eight weeks of data

- **Daily archive pages.** One page per day at `/daily/<date>` with the
  puzzle, band, technique path folded behind a spoiler, solver count and
  median, plus monthly indexes, interlinked with the `/learn/` technique
  pages ("this week's daily needed a Skyscraper"). About 365 new pages a
  year, each carrying data that exists nowhere else. Worker-rendered from
  D1 or rebuilt nightly.
- **Crowd-calibrated solve times.** Nobody publishes a real median human
  time per HoDoKu score band. Start from daily submissions only, since they
  are the cleanest sample (same puzzle, known band), roll them up weekly
  into a `band_calibration (band, week, n, median_s)` table, and publish
  "median human time per band, n = …" on `/sudoku-difficulty-rating/`.
  Then let the measured median replace the hand-set one in
  `src/content/solveTimes.ts` band by band, with the model kept as the
  fallback where n is small. This is the most distinctive thing the data
  can produce for the HoDoKu and enjoysudoku audience; its value is
  credibility and forum discussion more than traffic.
- **A launch moment.** A Show HN or enjoysudoku post built around that
  data, once the daily and the previews are live.
- **An RSS or Atom feed of dailies.** One static file; forum regulars use
  feeds.
- **Only then**, a lightweight daily leaderboard: median first, unassisted
  filter, display names from an adjective-animal generator or an opt-in
  free-text name we can delete. Leaderboards score low on reach and high on
  cheating and moderation, and the percentile on the share line already
  captures most of their pull.

## Do not build

- Accounts, OAuth, email capture or passwords of any kind.
- An indexable page per generated puzzle, or storage of every generated
  puzzle in D1. Google's scaled-content and doorway-page policies describe
  exactly that, and a 500 MB database fills up with it.
- An all-time global speed leaderboard.
- Push-notification streak nags, streak freezes, or any loss-aversion
  mechanic.
- Real-time multiplayer on Durable Objects or WebSockets.
- Any third-party analytics script with cookies or fingerprinting, and any
  consent banner. The telemetry is designed so it does not need one.
- Server-side generation of the daily from a date seed. Pin published
  puzzle strings instead.
- Server-side rating on the free plan.

## Budgets (free tier, checked October 2026)

| Service | Free allowance | What binds first |
|---|---|---|
| Workers requests | 100,000 a day, 10 ms CPU per invocation; static assets free and unlimited | This. About four Worker calls per daily player (stats, submit, telemetry, share render) means roughly 20,000 to 25,000 daily players |
| D1 | 5M rows read a day, 100,000 rows written a day, 5 GB account, 500 MB per database, 50 queries per invocation | Hard failure past the cap since 1 September 2026. One unindexed query can take stats offline until midnight UTC |
| Workers Analytics Engine | 100,000 data points written a day, 10,000 read queries a day, three months retention | About three events per player, so around 30,000 daily players |
| Workers KV | 100,000 reads a day, 1,000 writes a day | Too few writes for counters. Not used in v1 |
| Durable Objects | 100,000 requests a day, SQLite only, rows billed like D1 | Buys nothing on the free plan. Not used |
| Workers Logs | 200,000 events a day, 3 days | Moves to Observability pricing on 1 December 2026 |

Expected load at 10,000 daily players, v1 scope: 35,000 to 50,000 Worker
requests, about 20,000 D1 writes, under 1M D1 rows read with caching, about
30,000 WAE points. At the request wall the answer is the five-dollar Paid
plan with 10M requests a month, not a redesign.

Operational rules that follow:

- Every D1 query is on a primary key or an index. Test `meta.rows_read`
  for each query before shipping.
- Alert on `rows_written` in the D1 metrics.
- Stats return 503 past the cap; the UI shows "stats unavailable"; play is
  unaffected.
- Re-check the WAE billing status on the account before phase 3; one
  preview copy of the pricing page said billing had not yet started.

## Norwegian law, in brief (not legal advice)

sudokUI is run from Norway, so Ekomloven § 3-15 (in force since 1 January
2025) applies. It forbids storing or accessing information on the user's
equipment without information and consent, is technology-neutral, and
applies whether or not the data is personal. The two exemptions are
transmission of communication and what is strictly necessary to provide a
service the user explicitly asked for. Nkom calls the exemptions narrow
and gives no analytics exemption, unlike France's CNIL. Nkom's own site
uses a cookieless analytics tool that stores nothing on the device. EDPB
Guidelines 2/2023 extend the rule to pixels, URLs, unique identifiers and
locally processed information later read remotely, so "anonymous" is not
an escape hatch.

The reading this document builds on, with no Norwegian ruling on the exact
pattern:

| Data flow | Consent? | Decision |
|---|---|---|
| Live, ID-less beacon on game start or end while online | Gray, analogous to Nkom's own setup | Default. Store nothing for it. Disclose it |
| Daily result the player taps to submit for global stats | No: explicitly requested service | Default daily flow. Also the best play-count proxy |
| Random install ID for D1/D7 retention | Yes | Opt-in only |
| Offline event queue flushed later | Yes | Opt-in only |
| Self-computed retention bucket sent without an ID | Yes, it reads local history for analytics | Opt-in only |

If certainty is wanted, Nkom is the designated authority for exemption
questions and can be asked directly.

## Open questions

- Local date or UTC date for the daily number? Local is kinder to streaks
  and matches Wordle; the current code uses UTC. Decision pending phase 2.
- Seven days or sixty days of dailies in the static file? Sixty keeps a
  long flight covered; seven keeps spoilers short.
- Which eight OG images, and whether the band name on them is localised.
- Whether the share line carries the technique emoji row by default or
  behind a setting.
- What the privacy page says, in all three languages.

## Evidence this rests on

Daily mechanics driving return play is well supported; sharing driving
acquisition rests mostly on Wordle, which grew from 90 players to over
300,000 in two months after it added spoiler-free sharing, and is an
outlier. LinkedIn reports 84 % next-day return for its games, self-reported
and login-gated. Indie daily-puzzle numbers (Tiled Words, Termo) are
anecdotal. Expect a modest lift for a niche expert audience, not virality.
The full research note with sources lives outside the repository; this
document is the distilled, decided version.
