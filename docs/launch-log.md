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
  you expect it to show as. (The advent calendar's launch, 30 November
  to 3 December 2026, sets this aside and is judged as one launch on day
  14: [launch-posts-2026-12.md](launch-posts-2026-12.md), "When to
  post".)
- **Use a link that can be counted.** A `/p/` link or a `/daily/<date>`
  link is counted on its own page; a home page link (`https://sudokui.app/`,
  `/nb/`, `/es/`) is counted as `home`. The Learn pages are counted only in
  Search Console.
- **Judge it 14 days later**, on two things: (a) the landings with its word
  in the first 7 days (`/admin`, "Landings per day by word", which keeps
  28 days); (b) the 7-day
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
`other`. One exception to "the browser says": since 4 November 2026 a
landing with no referrer whose link carries `utm_source` naming an AI
assistant by its address (ChatGPT tags its links `utm_source=chatgpt.com`)
reads as `ai`; nothing else in the link is read, and nothing of it kept
(`landingWord`, and the privacy page). Since 26 November 2026 our own
links can carry a tag in the same place, for channels that send no
referrer: `utm_source=poster` on the QR code of a poster or a flyer reads
as `poster`, and `utm_source=chat` on a link posted in a chat reads as
`chat`. The tag also wins over a referrer that names only the Android
app that opened the link (Google Lens, a phone's camera). A site's
address as the referrer still decides. The advent
calendar's launch posts say which link each one uses and the word it
shows as ([launch-posts-2026-12.md](launch-posts-2026-12.md)).

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
| ChatGPT, Perplexity, Claude, Gemini, Copilot, as the referrer or, with none, as the link's `utm_source` | `ai` |
| A poster's or a flyer's QR code (`?utm_source=poster`, promo/print/) | `poster` |
| Facebook, as the site or its Android app | `facebook` |
| A chat: WhatsApp, Messenger, Telegram, Slack, Teams and the like, as the site or the Android app, or, with none, a link with `?utm_source=chat` | `chat` |
| Webmail (Gmail, Outlook and the like) or the Gmail and Outlook apps on Android | `mail` |
| A link typed or bookmarked, or opened from an app that says nothing (most mail apps, most chat apps on an iPhone) | `none` |
| Any site not named | `other` |

## Actions

| Date | Action | Link used | Landing word expected |
|---|---|---|---|
| | | | |

## Notes

Things learnt about how people arrive and why they stay, dated, so the
numbers above can be read against them.

- **4 November 2026: the first fan from outside, through ChatGPT.** Matt,
  a player from the feedback e-mails and the first fan who does not know
  the owner, found sudokUI by asking ChatGPT for apps to get better at
  sudoku. What he values, in his words: "I can just play and research
  techniques and get hints at my own pace. There isn't some structured
  thing." Sending daily times automatically gave him a regular
  competitor on the daily's times, and he has shared the app with his
  friends. AI assistants are now a channel of their own
  ([reach-plan-2026-11.md](reach-plan-2026-11.md), "AI assistants"): a
  link an assistant tags counts as `ai` even with no referrer, and
  `/llms.txt` and the home pages' structured data say what the app is.
  The same week the r/sudoku moderators were discussing whether to allow
  promotion again. Until they decide, and after, the owner stays within
  the ban: no posts or comments there, no second account, and nothing
  through Matt or any other player (the plan's "Reddit" and "Do not").

## Readings

Read as 7-day averages per day: the baseline when it ends, then on each
action's day 14. Since 25 November 2026 the top of `/admin` ("Toward 100
a day") shows the whole reading as one line, daily participants
included (the daily times that reached D1), and its button copies it as
a row of this table: paste it below and write what it is read for. The
landings per word for each of the last 28 days, the first 7 days after
an action among them, are in `/admin`'s "Landings per day by word". To
count daily participants by the daily's number instead of the day a time
arrived, ask D1:

```sh
npx wrangler d1 execute sudokui-db --remote --command "SELECT puzzle_no, COUNT(*) AS sent FROM daily_result GROUP BY puzzle_no ORDER BY puzzle_no DESC LIMIT 14"
```

| Date | Read for | Completed per day | Begun per day, by kind (daily, new, practice, shared) | Begun per day in Norwegian and Spanish | Daily participants per day | Landings per day, by word (home landings apart, then the calendar's page) | Shares per day, by kind |
|---|---|---|---|---|---|---|---|
| | | | | | | | |
