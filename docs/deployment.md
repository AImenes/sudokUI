# Deploying sudokui.app — Cloudflare, the GitOps way

sudokUI is a fully static PWA: the engine, generator and workers all run in
the visitor's browser. There is no backend to host, so the app deploys to
Cloudflare's edge network directly from GitHub — free, globally cached, and
effectively unlimited in scale. (An earlier plan used a Hetzner VPS; that is
unnecessary until the app grows a real backend.)

## How it works

- Cloudflare is connected to the `AImenes/sudokUI` GitHub repository
  (Workers & Pages → the `sudokui` project).
- Every push to `main` triggers a Cloudflare build:
  - **Build command:** `npm run build`
  - **Deploy command:** `npx wrangler deploy`
  - **Output:** `dist/`
- [`wrangler.jsonc`](../wrangler.jsonc) in the repo root tells wrangler this
  is an **assets-only Worker**: it uploads `dist/` as static assets with
  SPA-style not-found handling. With the config file present, wrangler skips
  its framework auto-detection (which requires Vite ≥ 6) — no code changes
  needed to deploy.

Releases are therefore just: merge to `main`. Rollback: revert the commit and
push.

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

## When a backend eventually arrives

Accounts, stats or leaderboards can live in the same Cloudflare project:
switch the assets-only Worker into a Worker with code (API routes) + D1
(SQLite at the edge) or KV storage. No migration of the static hosting is
needed — the `wrangler.jsonc` grows a `main` entry and the API deploys with
the same `git push`.
