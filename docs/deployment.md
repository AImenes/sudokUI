# Deploying sudokui.app — Cloudflare, the GitOps way

sudokUI is a static PWA with one small Worker in front of it. The engine,
the generator and the hints all run in the visitor's browser; the Worker
renders the share pages, `/p/<puzzle>` and `/daily/<date>`, and answers
the daily's API, the telemetry route and the private dashboard
([online-goals.md](online-goals.md), phases 1 to 3). The app deploys to
Cloudflare's edge network directly from
GitHub — free, globally cached, and for the static part effectively
unlimited in scale. (An earlier plan used a Hetzner VPS; that is
unnecessary.)

## How it works

- Cloudflare is connected to the `AImenes/sudokUI` GitHub repository
  (Workers & Pages → the `sudokui` project).
- Every push to `main` triggers a Cloudflare build:
  - **Build command:** `npm run build`
  - **Deploy command:** `npx wrangler deploy`
  - **Output:** `dist/`
- [`wrangler.jsonc`](../wrangler.jsonc) in the repo root names the Worker
  script (`main: worker/index.ts`) and the static assets (`dist/`, reached
  from the script as `env.ASSETS`). A request that matches a file in
  `dist/` is answered by the asset hosting before any code runs, free and
  uncounted. The Worker runs only for the paths that are no file: it
  renders a share address from `share.tpl` (the built app shell with its
  placeholders intact, which `vite build` writes next to `index.html`) and
  hands everything else back to the assets, which answer with the 404
  page of the nearest language (`not_found_handling: "404-page"`). With
  the config file present, wrangler also skips its framework
  auto-detection (which would demand Vite ≥ 6).
- `wrangler` is pinned in `devDependencies`, so a deploy runs the same
  version locally and on Cloudflare (CI does not run wrangler).

Releases are therefore just: merge to `main`. Rollback: revert the commit and
push.

## Checking a deploy

- `npx wrangler deploy --dry-run` bundles the Worker and validates the
  config without deploying anything.
- `npm run build` followed by `npm run preview` serves `dist/` locally, and
  `vite preview` answers the share addresses the way the Worker does
  (`vite.config.ts`), so `http://localhost:4173/p/<81 chars>?b=hard` can be
  looked at before it ships. The browser smoke test (`npm run test:e2e`)
  lands on one.
- After a deploy: paste a `/p/` link into a chat app and watch the preview
  arrive; `curl -I https://sudokui.app/p/<81 chars>` answers 200 with
  `x-robots-tag: noindex`, and an unknown path still answers 404.
- Then the same as a browser would ask for it:
  `curl -I -H 'Sec-Fetch-Mode: navigate' https://sudokui.app/p/<81 chars>`
  must answer 200 too. A click is a navigation request, and for those the
  asset hosting serves the 404 page for any path that is no file *before*
  the Worker runs, unless the path is listed under `run_worker_first` in
  `wrangler.jsonc`. The first check alone passed for a week while every
  real click on a share link opened "Page not found".
- The home pages run the Worker first too, to count a visit from outside
  the site (`worker/index.ts`, `HOME_PATHS`):
  `curl -I -H 'Sec-Fetch-Mode: navigate' https://sudokui.app/nb/` must
  answer 200 with the page as before (a HEAD request counts nothing).

The free plan allows 100,000 Worker requests a day; static files are not
counted. Only share landings, the three home pages and unknown paths
reach the Worker, so the budget in [online-goals.md](online-goals.md)
holds.

## IndexNow: telling Bing what changed

Every push to `main` also tells [IndexNow](https://www.indexnow.org) which
pages are new or changed, so Bing (and the other engines that share its
submissions) fetches them within hours instead of whenever its crawler
next comes by. AI assistants that search the web with Bing see a changed
page as soon as Bing does. Nothing about players is involved: it is a list
of the site's own public pages, so the privacy page does not change.

- **The key** is `public/<key>.txt`, a random 32-hex-digit key in a file
  named after it. It is public by design: IndexNow fetches it from
  `https://sudokui.app/<key>.txt` to check that a submission comes from
  the site, so no secret is needed. It is a static file, answered by the
  asset hosting; no `run_worker_first` pattern catches it
  (`tests/indexnow.test.ts` checks that, and that the file holds exactly
  its key).
- **The build** writes `dist/indexnow.json` as its last step
  (`scripts/build-indexnow.ts`): every URL of `dist/sitemap.xml`, each
  with a hash of the page the build wrote for it, and the commit it was
  built from (`WORKERS_CI_COMMIT_SHA` on Cloudflare, else git). The hash
  leaves out the fingerprints in the names of the scripts and styles under
  `/assets/`, so a change to the app's code alone does not count as a
  change to the home pages. A sitemap URL with no page fails the build.
- **The job**, [indexnow.yml](../.github/workflows/indexnow.yml), runs on
  every push to `main`, beside CI. First it reads the live
  `https://sudokui.app/indexnow.json`, the list from before this push;
  then it waits, looking every 20 seconds, until the site serves the list
  of the pushed commit, compares the two, and POSTs only the new or
  changed URLs (at most 10,000) to `https://api.indexnow.org/indexnow`,
  with the host, the key and the key's location
  (`scripts/indexnow.ts`, `submitChanges`). A page that left the sitemap
  is not sent.
- **When it sends nothing, or less:** with no old list to read (the
  first run, or a read that failed) it sends the three home pages only,
  not every page at once; when the deploy has not shown up after about
  15 minutes it gives up quietly and sends nothing; when no page changed
  it sends nothing.
- **It never fails a push's checks:** every step may fail without failing
  the job, and the script ends with exit code 0 whatever IndexNow or the
  network answer. What it did is one line in the job's log
  (`IndexNow: sent 4 URLs: HTTP 200`, or why it sent nothing).

To see the submissions arrive, open [Bing Webmaster
Tools](https://www.bing.com/webmasters) for sudokui.app (the site is
verified with `public/BingSiteAuth.xml`) and go to **IndexNow**: it lists
the URLs received, when, and whether the key was accepted. HTTP 202 in the
job's log means the key is still being checked; 403 means the key file was
not reachable or did not match.

Cloudflare's Crawler Hints ([search.md](search.md), the owner's list), if
switched on, sends IndexNow its own signals from what Cloudflare sees
change; it does not replace this job, which follows the sitemap and
sends a page only when its words changed, and the two do not get in each
other's way.

To try the job's step by hand without sending anything:

```bash
curl -s https://sudokui.app/indexnow.json -o /tmp/old.json
GITHUB_SHA=<a deployed commit> node --experimental-strip-types scripts/indexnow-submit.ts /tmp/old.json --dry-run
```

To change the key, replace the file in `public/` with a new
`<key>.txt` holding the new key, and nothing else; the job reads it from
the checkout.

## Domain & TLS (one-time, already applicable)

1. In the Worker/Pages project → **Custom Domains** → add `sudokui.app`
   (and `www.sudokui.app` if wanted). Cloudflare creates the DNS records
   automatically since the domain lives in the same account.
2. Under the domain's **SSL/TLS → Overview**: set mode to **Full (strict)**.
3. **SSL/TLS → Edge Certificates**: enable **Always Use HTTPS**.
   (`.app` is an HSTS-preloaded TLD, so HTTPS is mandatory anyway.)

## CI vs deployment

GitHub Actions ([ci.yml](../.github/workflows/ci.yml)) remains the quality
gate: typecheck, the full test suite including the technique soundness
harness, and a build. Cloudflare's build is what actually deploys. A second
workflow, [indexnow.yml](../.github/workflows/indexnow.yml), runs on a push
to `main` only and tells IndexNow what the deploy changed ("IndexNow", above); it can
never fail.

Note they are independent — a push to `main` deploys even if CI fails. For
stricter gating, protect `main` with a required CI status check in GitHub
settings so nothing lands on `main` without green tests (PRs already run CI).

## The database (phase 2: the daily's global times)

The shared daily's results live in D1, in the same project: the database
`sudokui-db`, bound as `DB` in [`wrangler.jsonc`](../wrangler.jsonc), and
two JSON routes in the same Worker script (`worker/daily.ts`), as
[online-goals.md](online-goals.md) lays out. The static hosting does not
move, and there are no accounts, ever.

The binding ships with the code; the tables do not. They are created once,
by hand, from [`migrations/0001_daily.sql`](../migrations/0001_daily.sql):

```bash
npx wrangler login
npx wrangler d1 migrations apply sudokui-db --remote
```

Until that has run, the Worker answers the daily's API with 503, the win
screen says the global times are unavailable, and play is unaffected; the
moment the tables exist the next request works. To look at the data:

```bash
npx wrangler d1 execute sudokui-db --remote --command "SELECT puzzle_no, SUM(n) AS results, SUM(n_unassisted) AS unassisted, COUNT(*) AS buckets FROM daily_hist GROUP BY puzzle_no"
```

Budget rules the code keeps ([online-goals.md](online-goals.md)): every
query is on a primary key, a day's histogram is at most 481 rows (15-second
buckets, two hours and up together), statistics are edge-cached a minute,
and a result costs two writes in one batch. Watch `rows_written` in the D1
metrics; past the free cap the routes answer 503 until midnight UTC and
the app keeps playing.

For local work, `npx wrangler dev` needs the local tables too
(`--local` on the migration command) and, on Windows, `npm approve-scripts
workerd` once. The dev and preview servers do not need any of it: they
answer the API over a store in memory (`vite.config.ts`).

## The analytics (phase 3: counting plays)

The app's `started` and `completed` lines and the landings on the share
pages and the home pages go to a Workers Analytics Engine dataset, `sudokui_events`, bound as
`EVENTS` in [`wrangler.jsonc`](../wrangler.jsonc) and written by the same
Worker (`worker/telemetry.ts`, `POST /api/t`). The dataset needs no
creating. The dashboard, `/admin` (`worker/admin.ts`), reads it through
the SQL API with two secrets set by hand, and sits behind Cloudflare
Access, also set by hand, whose signed token the Worker verifies
(`worker/access.ts`) against two more secrets, the Access team domain
and the application's AUD tag:

```bash
npx wrangler secret put ADMIN_ACCOUNT_ID
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put ACCESS_TEAM_DOMAIN
npx wrangler secret put ACCESS_AUD
```

Until all four exist and Access is in front of `/admin`, the page is a
404, and so is any request without a valid Access token; play and
counting are unaffected. The Worker has no `workers.dev` address and no
preview URLs (`workers_dev` and `preview_urls` are `false` in
`wrangler.jsonc`), so it answers on `sudokui.app` only. The steps, and how to see the first
numbers, are in [connect-the-analytics.md](connect-the-analytics.md).
`npx wrangler deploy --dry-run` must list `env.EVENTS (sudokui_events)`
among the bindings. The dev and preview servers answer `/api/t` over a
dataset in memory (`vite.config.ts`), so the browser smoke test's beacons
are answered and nothing is logged.
