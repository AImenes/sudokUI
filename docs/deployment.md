# Deploying sudokui.app — Cloudflare, the GitOps way

sudokUI is a static PWA with one small Worker in front of it. The engine,
the generator and the hints all run in the visitor's browser; the Worker
renders only the share pages, `/p/<puzzle>` ([online-goals.md](online-goals.md),
phase 1). The app deploys to Cloudflare's edge network directly from
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

The free plan allows 100,000 Worker requests a day; static files are not
counted. Only share landings and unknown paths reach the Worker, so the
budget in [online-goals.md](online-goals.md) holds.

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
harness, and a build. Cloudflare's build is what actually deploys.

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
