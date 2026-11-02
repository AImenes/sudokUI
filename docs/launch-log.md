# Launch log

One line per thing the owner does to bring people to sudokui.app, so its
effect can be read on `/admin` and judged later
([reach-plan-2026-11.md](reach-plan-2026-11.md), "Measuring it"). The
measurement it relies on shipped on 2 November 2026: landings on the home
pages, the landing words, and the kind of game and the language on every
start and solve ([online-goals.md](online-goals.md), "Measured per
channel").

## How to use it

- **Baseline first.** Once the measurement is live, two weeks pass with no
  outreach. Then write the baseline's numbers in "Readings" below.
- **One channel per week.** Add the line on the day you act, not later:
  the date, what you did, the exact link you used, and the landing word
  you expect it to show as.
- **Use a link that can be counted.** A `/p/` link or a `/daily/<date>`
  link is counted on its own page; a home page link (`https://sudokui.app/`,
  `/nb/`, `/es/`) is counted as `home`. The Learn pages are counted only in
  Search Console.
- **Judge it 14 days later**, on two things: (a) the landings with its word
  in the first 7 days (`/admin`, "Where landings came from"); (b) the 7-day
  averages of completions and of daily participants at day 14, against the
  baseline. At about 5 completions a day, a rise of 3 a day or more, held
  for a week, is real; anything smaller counts as no effect. A spike in
  landings that leaves completions and daily participants unchanged two
  weeks later is not reach.

## The word to expect

The word comes from what the visitor's browser says about where the link
was opened from, and most apps say nothing, so a link sent in a chat or an
e-mail app mostly reads as `none`. Each word stands for the sites named
in `worker/telemetry.ts` (FROM_HOSTS); a site not named there reads as
`other`.

| Where the link is | Landing word |
|---|---|
| Google, Bing, DuckDuckGo and the other big search engines | `search` |
| The Enjoy Sudoku forum | `enjoysudoku` |
| AlternativeTo, SaaSHub, Product Hunt, pwa.directory, PWA Store, store.app | `directory` |
| menneske.no, sudokuwiki.org, SudokuPad, sudoku.coach and a few more sudoku sites | `sudoku` |
| kode24, Teknisk Ukeblad (tu.no), Aftenposten | `press` |
| Lemmy (lemmy.world, lemmy.ml), Mastodon (mastodon.social, snabelen.no and a few more large servers) | `fediverse` |
| Reddit | `reddit` |
| Hacker News | `hackernews` |
| YouTube, X, Bluesky, LinkedIn, Instagram and a few more social sites | `social` |
| GitHub | `github` |
| ChatGPT, Perplexity, Claude, Gemini, Copilot | `ai` |
| Any site not named | `other` |

## Actions

| Date | Action | Link used | Landing word expected |
|---|---|---|---|
| | | | |

## Readings

Read as 7-day averages per day: the baseline when it ends, then on each
action's day 14. Everything but daily participants is on `/admin`. Daily
participants are the times sent for each day's daily puzzle, which live in
D1, not in the analytics:

```sh
npx wrangler d1 execute sudokui-db --remote --command "SELECT puzzle_no, COUNT(*) AS sent FROM daily_result GROUP BY puzzle_no ORDER BY puzzle_no DESC LIMIT 14"
```

| Date | Read for | Completed per day | Begun per day, by kind (daily, new, practice, shared) | Begun per day in Norwegian and Spanish | Daily participants per day | Landings per day, by word (home landings apart) | Shares per day, by kind |
|---|---|---|---|---|---|---|---|
| | | | | | | | |
