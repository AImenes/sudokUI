# Connecting sudokui.app to its database, step by step

This is for doing it the first time, on any computer with the repository
checked out. It takes about ten minutes, and nothing in it can break the
site: until the last step is done, the daily's "everyone's times" panel
simply says the global times are unavailable, and everything else plays
as before.

## What you are connecting, in plain words

- **The site** (`sudokui.app`) runs on Cloudflare. Every push to `main`
  deploys it. That part is done and works today: share links, the daily
  puzzle, the touch handling.
- **The database** is a Cloudflare D1 database called `sudokui-db`. It
  already exists in your Cloudflare account, and the deployed code is
  already bound to it (`wrangler.jsonc`). It is empty: it has no tables.
- **The tables** are what is missing. They are two small ones:
  `daily_result` (one row per time a player sends in) and `daily_hist`
  (the day's times counted in 15-second buckets). Their definition is the
  file `migrations/0001_daily.sql`. Creating them is called "applying the
  migration", and a deploy never does it on its own: you do it once, by
  hand, with the command below.
- **What players get once the tables exist.** When someone finishes the
  daily, the win screen shows how many have solved it without help and
  their median time. After an unassisted solve, the button "Send my time
  and compare" sends the player's time and tells them the share of those
  solvers they were faster than. A solve that used anything from the
  Assist box (a hint, Check, Steps, auto candidates...) offers no button:
  its time says nothing about the player, so only unassisted times count.
  No account, no cookie: a random token per day is all the server ever
  sees.

## Before you start

You need Node.js (version 20 or newer) and the repository. In a terminal,
inside the repository folder:

```bash
git pull
```

```bash
npm ci
```

`npm ci` installs `wrangler`, Cloudflare's command-line tool, at the exact
version the project pins. You never install it separately.

## Step 1: sign in to Cloudflare from the terminal

```bash
npx wrangler login
```

A browser window opens on Cloudflare. Sign in with the account that owns
sudokui.app and click **Allow**. The terminal then says you are logged
in. This is a one-time step per computer.

If the browser does not open, the terminal prints a link: copy it into a
browser yourself.

## Step 2: create the tables

```bash
npx wrangler d1 migrations apply sudokui-db --remote
```

`--remote` means the real database on Cloudflare, not a local copy.
Wrangler lists the migration it is about to apply (`0001_daily.sql`) and
asks you to confirm. Answer **y**. The output ends with a line saying the
migration was applied, something like:

```
┌───────────────┬────────┐
│ name          │ status │
├───────────────┼────────┤
│ 0001_daily.sql│ ✅     │
└───────────────┴────────┘
```

That is the whole connection. The deployed code notices on the very next
request; there is nothing to redeploy and nothing to click in the
Cloudflare dashboard.

## Step 3: check that it worked

In a browser, open this address (any computer, any network):

```
https://sudokui.app/api/daily/2/stats
```

- Before step 2 it shows `{"error":"unavailable"}`.
- After step 2 it shows `{"no":2,"count":0,"median":null,"histogram":[]}`:
  the second daily, with no times yet.

The number in the address is the daily's: 7 October 2026 is #1, so 9
October is #3. Then the real test: open `https://sudokui.app`, choose
**New** → **Daily puzzle**, finish it without anything from the Assist
box, and tap **Send my time and compare**. The win screen should say
"Your time is the first one in" (or a percentile, if someone got there
first). Open the address again with today's number in it, and `count`
has gone up by one.

## If something goes wrong

- **"You are not authenticated"** or a login prompt during step 2: step 1
  did not complete. Run `npx wrangler login` again.
- **"Couldn't find a D1 DB with the name or binding 'sudokui-db'"**: you are
  signed in to a different Cloudflare account than the one that owns the
  site. Run `npx wrangler logout`, then `npx wrangler login` with the right
  one. If the account has several, `npx wrangler whoami` shows which is
  active.
- **"No migrations to apply"**: the tables already exist (you, or someone,
  applied them before). That is fine; go to step 3.
- **The win screen has no "Send my time and compare" button**: the solve
  used something from the Assist box (it says "Solved with assistance").
  Only unassisted solves are sent. Restart the puzzle and solve it
  without help.
- **The stats address still says unavailable after step 2**: wait a
  minute (the answer is cached that long at the edge) and reload. If it
  persists, run `npx wrangler d1 migrations list sudokui-db --remote` to
  see whether the migration is listed as applied.
- **Anything else**: nothing you did can have broken play. The site keeps
  working without the tables; ask for help with the exact error text.

## Looking at the data later

How many times have come in, per day:

```bash
npx wrangler d1 execute sudokui-db --remote --command "SELECT puzzle_no, SUM(n) AS results, SUM(n_unassisted) AS unassisted, COUNT(*) AS buckets FROM daily_hist GROUP BY puzzle_no"
```

The Cloudflare dashboard (Storage & Databases → D1 → `sudokui-db`) shows
the same tables and the daily reads and writes against the free
allowance (5 million rows read and 100,000 written a day; the code keeps
each day's statistics under 481 rows and every query on a key, so even
thousands of players a day stay far below it).

## What this does not do

It does not count plays, visitors or shares: that is phase 3 in
[online-goals.md](online-goals.md), not yet built. It does not store
anything about a player beyond the time they chose to send. And it does
not need to be repeated: future deploys keep using the same tables, and
a future migration file (`migrations/0002_….sql`) is applied with the
same command in step 2.
