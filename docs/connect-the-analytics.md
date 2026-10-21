# Connecting sudokui.app to its analytics, step by step

This is for doing it the first time, on any computer with the repository
checked out. It takes about twenty minutes, most of it clicking in the
Cloudflare dashboard, and nothing in it can break the site: until the
last step is done, the counts simply pile up unseen, and everything plays
as before. It is the companion of
[connect-the-database.md](connect-the-database.md), for phase 3 of
[online-goals.md](online-goals.md).

## What you are connecting, in plain words

- **The counts.** The app sends one short line when a game starts and one
  when it is solved, while online: the event, the band, the time in
  15-second steps, whether the app runs installed, and the version. The
  Worker adds the country and writes each line to **Workers Analytics
  Engine** (WAE), Cloudflare's store for exactly this kind of counting.
  Nothing identifies a player and no IP address is ever written; the
  privacy page (`/privacy/`) says the same to players. The share pages
  count a landing there too when a person arrives from outside the site.
- **The dataset** is called `sudokui_events`. It needs no creating: the
  deployed code is bound to it (`wrangler.jsonc`, `analytics_engine_datasets`)
  and it appears the moment the first line is written. WAE keeps three
  months of data; the free allowance is 100,000 lines a day, and a player
  costs two or three.
- **The dashboard** is `https://sudokui.app/admin`: a page the Worker
  renders from the dataset through Cloudflare's SQL API. For that it
  needs two **secrets** stored with the Worker, `ADMIN_ACCOUNT_ID` and
  `ADMIN_TOKEN` (an API token that may read the account's analytics).
  Until both exist, `/admin` answers "Page not found" like any unknown
  address. That is what is missing.
- **The lock.** `/admin` shows numbers only, never a player, but it is
  yours. It must sit behind **Cloudflare Access**, which asks for a login
  (a one-time code to your e-mail) before the Worker even sees the
  request. After the login, Access hands every request a signed pass (a
  token), and the Worker checks that pass itself: that Cloudflare signed
  it for your team, for this one application, and that it has not run
  out. For that it needs two more **secrets**, `ACCESS_TEAM_DOMAIN` (your
  team's login address) and `ACCESS_AUD` (the application's tag). A
  request without a good pass, on any address, gets "Page not found",
  so until steps 4 and 5 are done the page is a 404 for everyone,
  secrets or not. The Worker also answers on `sudokui.app` only: its
  spare `workers.dev` address and its preview addresses are switched off
  (step 6), since Access does not stand in front of those.
- **The opt-in.** By default nothing is stored on a player's device for
  this. A player who turns on "Help count plays, including offline ones"
  in Settings lets the app keep lines made offline and send them later;
  the dashboard uses those players as a sample to estimate what everyone
  else plays offline, and labels the result an estimate.

## Before you start

You need Node.js (version 20 or newer), the repository, and to be signed
in to Cloudflare from the terminal (step 1 of
[connect-the-database.md](connect-the-database.md): `npx wrangler login`).
In a terminal, inside the repository folder:

```bash
git pull
```

```bash
npm ci
```

## Step 1: check that the account may use Analytics Engine

Workers Analytics Engine is included with Workers, free plan included, but
its billing status has changed over time, so look once:

1. Open the Cloudflare dashboard, choose the account that owns
   sudokui.app, and go to **Workers & Pages**. In the left column, or by
   typing "Analytics Engine" in the dashboard's search box, open
   **Analytics Engine**. If the page offers an **Enable** button, click
   it. If it shows a dataset list (empty for now), the account is ready.
2. Read the current pricing page once:
   <https://developers.cloudflare.com/analytics/analytics-engine/pricing/>.
   The free allowance should still read 100,000 data points written a
   day and 10,000 read queries a day. If it says something else, write
   the new numbers into the budget table of
   [online-goals.md](online-goals.md) before going on.

## Step 2: deploy the code

Merging the `telemetry` branch to `main` deploys it (every push to `main`
does, see [deployment.md](deployment.md)). From then on the Worker writes
to the dataset. To see that it does, open the app, finish any puzzle, and
after a few minutes look at **Workers & Pages → Analytics Engine**: the
dataset `sudokui_events` is listed, with a count of data points. Nothing
else changes for players.

Once that check is done, keep your own plays out of the numbers: on every
browser you play in, and inside the app wherever you added it to a home
screen or desktop (it may keep its own settings), open **Settings →
Counting plays** and turn on **Leave this device out of the counts**. Do
the same on testers' devices. From then on the dashboard's starts and
solves leave those devices out. Landings cannot be switched off: the
server counts one from the request when a share or daily link is opened
from outside the site in a browser that does not hold the app yet (one
that does answers the link itself, and counts nothing). A link you tap
in a chat on your own phone, which opens in that app's own browser,
can still count as one.

## Step 3: give the dashboard its two secrets

The dashboard reads the dataset through Cloudflare's API, as you, with a
token that may read the account's analytics and do nothing else.

1. **The account id.** In the dashboard, **Workers & Pages → Overview**
   shows **Account ID** in the right column; copy it. (The terminal says
   it too: `npx wrangler whoami`.)
2. **The token.** Click your profile picture (top right) → **My Profile**
   → **API Tokens** → **Create Token** → at the bottom, **Create Custom
   Token** → **Get started**. Fill in:
   - Token name: `sudokui admin`
   - Permissions: **Account** · **Account Analytics** · **Read**
   - Account Resources: **Include** · the account that owns sudokui.app
   - leave the rest as it is, **Continue to summary**, **Create Token**.
   Copy the token now; it is shown once.
3. **Store both with the Worker.** In the terminal, inside the repository
   folder, run the first command, paste the account id when it asks and
   press Enter; then the second, and paste the token:

```bash
npx wrangler secret put ADMIN_ACCOUNT_ID
```

```bash
npx wrangler secret put ADMIN_TOKEN
```

Each answers with a line saying the secret was uploaded. A secret is
stored with the Worker on Cloudflare, never in the repository, and a
deploy keeps it; you do this once. (The dashboard can do the same:
**Workers & Pages → sudokui → Settings → Variables and Secrets → Add**,
type **Secret**.)

## Step 4: put /admin behind Cloudflare Access

Access is part of Cloudflare Zero Trust, free for up to fifty users. It
makes `https://sudokui.app/admin` ask for your e-mail and a one-time
code before anything is shown.

1. Open <https://one.dash.cloudflare.com/> and choose the account. The
   first time, it asks for a team name (any short name; it becomes
   `<name>.cloudflareaccess.com`, the login page's address) and the free
   plan. Confirm.
2. **Access controls → Applications → Add an application → Self-hosted**
   (older dashboards call the menu **Access → Applications**).
   - Application name: `sudokUI admin`
   - Session duration: a day, or what you like
   - Public hostname: domain `sudokui.app`, path `admin`
   - **Next**.
3. **Add a policy**: name `Owner`, action **Allow**; under **Include**,
   selector **Emails**, value: your own e-mail address. **Next**, then
   **Add application** (the remaining settings keep their defaults).
4. The login method is the one-time PIN by default, which needs no
   setting up: Access e-mails you a code.

From now on a request for `/admin` reaches the Worker only after that
login, and carries the signed pass the Worker checks in the next step.

## Step 5: tell the Worker which team and which application to trust

The Worker checks Access's pass against two things only you can give
it: your team's login address and the application's tag. Until both are
stored, `/admin` stays "Page not found", even after the login.

1. **The team domain.** In Zero Trust (<https://one.dash.cloudflare.com/>),
   open **Settings**. **Team name and domain** shows an address that ends
   in `.cloudflareaccess.com`, such as `myteam.cloudflareaccess.com`;
   copy it. (It is also the address of the login page Access shows when
   you open `/admin`.) The bare team name, `myteam`, works too.
2. **The AUD tag.** Still in Zero Trust, open **Access controls →
   Applications** (older dashboards: **Access → Applications**), find
   `sudokUI admin` and click **Configure** (or the three dots → **Edit**).
   Under **Additional settings** (older dashboards: the **Overview** tab),
   **Application Audience (AUD) Tag** is a long string of letters and
   digits; copy it with the copy button beside it.
3. **Store both with the Worker.** In PowerShell, inside the repository
   folder, run the first command, paste the team domain when it asks and
   press Enter; then the second, and paste the tag. The value may not
   show on the screen as you paste it; that is normal.

```bash
npx wrangler secret put ACCESS_TEAM_DOMAIN
```

```bash
npx wrangler secret put ACCESS_AUD
```

Each answers with a line saying the secret was uploaded. To see that all
four are there, run `npx wrangler secret list`: it names `ACCESS_AUD`,
`ACCESS_TEAM_DOMAIN`, `ADMIN_ACCOUNT_ID` and `ADMIN_TOKEN` (never their
values). If you ever delete the Access application and make a new one,
its tag changes: store the new one with the second command again.

## Step 6: check that the Worker has no other address

Cloudflare can give a Worker a spare address of its own,
`sudokui.<your-subdomain>.workers.dev`, and a preview address for each
version. Access stands in front of `sudokui.app/admin` only, not in
front of those. The Worker refuses a request without a valid pass on any
address, but it is simpler still if the spare addresses do not exist.
The repository switches both off (`"workers_dev": false` and
`"preview_urls": false` in `wrangler.jsonc`), and every deploy applies
that. To see it:

1. In the Cloudflare dashboard, open **Workers & Pages → sudokui →
   Settings → Domains & Routes**.
2. `sudokui.app` is listed as a custom domain. The **workers.dev** line
   must say it is disabled (or be missing), and so must **Preview URLs**.
   If either is on, click it, or the three dots beside it, and choose
   **Disable**. The next deploy keeps it off.
3. To be sure, open the old address in a browser: it is
   `https://sudokui.<your-subdomain>.workers.dev`, where the subdomain is
   the one **Workers & Pages → Overview** shows for the account (on the
   right, under **Subdomain**). It must not show the game: Cloudflare
   answers it with an error page of its own.

## Step 7: see the first numbers

Open <https://sudokui.app/admin>. Access asks for your e-mail, sends a
code, and shows the page: twelve numbers for the last seven days, a line
of completed games per day over thirty days, and a table of every day.
On the first day it is mostly zeros and dashes; the **Offline, estimated**
number reads "—" until some player has turned the opt-in on and finished
a game online, because the estimate is the ratio of that cohort's offline
to online solves applied to everyone else.

The same numbers from the terminal, if you ever want them raw. In
PowerShell, put the token and the account id in two variables first
(they last until the window is closed):

```powershell
$env:ADMIN_TOKEN = "paste the token here"
$env:ADMIN_ACCOUNT_ID = "paste the account id here"
```

```powershell
curl.exe -s -H "Authorization: Bearer $env:ADMIN_TOKEN" "https://api.cloudflare.com/client/v4/accounts/$env:ADMIN_ACCOUNT_ID/analytics_engine/sql" --data "SELECT index1 AS event, SUM(_sample_interval * double2) AS n FROM sudokui_events WHERE timestamp > NOW() - INTERVAL '7' DAY GROUP BY event FORMAT JSON"
```

(`curl.exe`, not `curl`: in Windows PowerShell, `curl` is another
command.)

## If something goes wrong

- **/admin says "Page not found"**: one of four things. A secret is
  missing (steps 3 and 5; `npx wrangler secret list` names the ones that
  exist, and all four must be there). Access is not in front of the path
  yet, or you reached the page without going through it (step 4; the
  Worker refuses a request without Access's pass). The team domain or
  the AUD tag stored is not the one Zero Trust shows: copy both again
  (step 5) and store them again with the same commands. Or the branch is
  not deployed yet (step 2).
- **`npx wrangler secret put` says the latest version of your Worker
  isn't currently deployed**: a branch pushed to GitHub has uploaded a
  newer preview version of the Worker since `main` last deployed, and
  the command will not put a secret on top of it. Run it again just
  after the next deploy of `main`, before any other branch is pushed.
  Do not use `wrangler versions secret put` or deploy a version instead:
  those start from the newest uploaded version, which may be a branch's
  code.
- **/admin says "The analytics API answered 403"** (or 401): the token
  cannot read the analytics. Make a new one with exactly **Account
  Analytics: Read** on this account (step 3) and store it again with
  `npx wrangler secret put ADMIN_TOKEN`.
- **"The analytics API answered 400"** with a message about the table or
  dataset: nothing has been written yet, so the dataset does not exist.
  Finish a puzzle in the app and wait a few minutes.
- **Access shows a login page but never e-mails a code**: check the
  policy's e-mail address in Zero Trust → Access controls → Applications.
- **Every number is zero although people play**: the Worker's version
  may predate the binding. `npx wrangler deploy --dry-run` lists the
  bindings the code ships with; **Analytics Engine Datasets: EVENTS** must
  be among them.
- **Anything else**: nothing you did can have broken play. Players never
  wait for any of this; ask for help with the exact error text.

## Looking at the data later

The dashboard is the intended way. The dataset is also listed under
**Workers & Pages → Analytics Engine** with its daily volume against the
allowance, and the SQL API answers any query over it, such as the
landings per band (in PowerShell, with the two variables of step 7):

```powershell
curl.exe -s -H "Authorization: Bearer $env:ADMIN_TOKEN" "https://api.cloudflare.com/client/v4/accounts/$env:ADMIN_ACCOUNT_ID/analytics_engine/sql" --data "SELECT blob1 AS band, SUM(_sample_interval * double2) AS n FROM sudokui_events WHERE index1 = 'landing' AND timestamp > NOW() - INTERVAL '30' DAY GROUP BY band FORMAT JSON"
```

What each column holds: `index1` the event (`started`, `completed`,
`landing`); `blob1` the band; `blob2` where it came from (`pwa`, `tab`, or
for a landing `p` or `daily`); `blob3` the version; `blob4` the country;
`double1` the 15-second time bucket; `double2` how many events the row
stands for; `double3` installed; `double4` kept offline; `double5` the
sender has the opt-in on; `double6` the sender had played on an earlier
day. Always multiply a count by `_sample_interval`: at volume WAE samples.

## What this does not do

It does not identify anyone, and it cannot: there is no identifier to
look up. It does not change what the daily's database holds
([connect-the-database.md](connect-the-database.md)). And it does not
need to be repeated: future deploys keep the binding and the secrets.
