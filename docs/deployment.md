# Deploying sudokui.app — Hetzner + Cloudflare, the GitOps way

Goal: push to `main` → CI runs the tests → the site updates on
https://sudokui.app automatically. No manual steps after the one-time setup.

sudokUI is currently a fully static PWA (the solver runs in the browser), so
the server only has to serve files. We still use a real server rather than a
static-only host because you want a database later (accounts, stats,
leaderboards) — the same box will run the API next to the static files.

## 0. What to buy

| Item | Choice | Cost |
| --- | --- | --- |
| Server | Hetzner Cloud **CX22** (2 vCPU, 4 GB RAM, 40 GB SSD) | ~€4/month |
| Domain | sudokui.app on Cloudflare | done ✔ |

The CX22 is the cheapest current plan and is *far* more than a static site
needs — with Cloudflare caching in front, it will serve tens of thousands of
users without noticing. It also has plenty of headroom for a Postgres + API
container later. You can resize upward at any time without reinstalling.

Create the server in [Hetzner Cloud Console](https://console.hetzner.cloud):

1. New project → Add server.
2. Location: Falkenstein or Helsinki (both EU, cheap egress).
3. Image: **Ubuntu 24.04**.
4. Type: Shared vCPU → **CX22**.
5. Networking: enable IPv4 + IPv6.
6. SSH key: paste your public key (`cat ~/.ssh/id_ed25519.pub`).
7. Create. Note the server's IPv4 address — call it `SERVER_IP` below.

## 1. One-time server setup (~10 minutes)

SSH in and set up a deploy user, Caddy, and the web root:

```bash
ssh root@SERVER_IP

# updates + basic hardening
apt update && apt upgrade -y
apt install -y ufw
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable

# a dedicated deploy user (CI will rsync as this user)
adduser --disabled-password --gecos "" deploy
mkdir -p /home/deploy/.ssh /var/www/sudokui
chown -R deploy:deploy /home/deploy/.ssh /var/www/sudokui

# Caddy web server (automatic HTTPS)
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
  | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
```

Configure Caddy (`/etc/caddy/Caddyfile`):

```caddyfile
sudokui.app {
    root * /var/www/sudokui
    file_server
    encode zstd gzip

    # SPA: unknown paths fall back to the app shell
    try_files {path} /index.html

    # never cache the service worker or manifest; cache hashed assets forever
    @sw path /sw.js /manifest.webmanifest
    header @sw Cache-Control "no-cache"
    @assets path /assets/*
    header @assets Cache-Control "public, max-age=31536000, immutable"
}

www.sudokui.app {
    redir https://sudokui.app{uri} permanent
}
```

Then `systemctl reload caddy`.

Generate a deploy SSH key **on your laptop** (not on the server) and install
its public half for the deploy user:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/sudokui_deploy -N "" -C "github-actions-deploy"
ssh root@SERVER_IP 'cat >> /home/deploy/.ssh/authorized_keys && chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 600 /home/deploy/.ssh/authorized_keys' < ~/.ssh/sudokui_deploy.pub
```

## 2. Cloudflare DNS + TLS

In the Cloudflare dashboard for sudokui.app:

1. **DNS**: add `A` record `sudokui.app → SERVER_IP` and `CNAME www → sudokui.app`,
   both **proxied** (orange cloud).
2. **SSL/TLS → Overview**: set mode to **Full (strict)**. (`.app` is an
   HSTS-preloaded TLD, so HTTPS is mandatory — Caddy obtains the origin
   certificate automatically via Let's Encrypt.)

   > Note: with the proxy enabled, Let's Encrypt's HTTP challenge still works
   > through Cloudflare. If certificate issuance ever fights the proxy,
   > either grey-cloud the record for a minute or switch Caddy to the
   > [Cloudflare DNS challenge](https://caddyserver.com/docs/automatic-https).
3. Optional but nice: **Speed → Optimization** defaults are fine; Cloudflare
   will cache the immutable `/assets/*` files at the edge.

## 3. GitHub Actions secrets

In the repo: Settings → Secrets and variables → Actions → New repository
secret:

| Secret | Value |
| --- | --- |
| `HETZNER_HOST` | `SERVER_IP` |
| `HETZNER_USER` | `deploy` |
| `HETZNER_PATH` | `/var/www/sudokui/` |
| `HETZNER_SSH_KEY` | contents of `~/.ssh/sudokui_deploy` (the *private* key) |

## 4. Enable the deploy job

`.github/workflows/ci.yml` already contains a commented-out `deploy` job.
Uncomment it. From then on every push to `main`:

1. installs, typechecks, runs the full test suite (including the technique
   soundness harness — a broken solver never deploys),
2. builds the production bundle,
3. rsyncs `dist/` to the server (atomic enough for a static site; the service
   worker versioning means clients pick up the new build on next load).

Rollback = `git revert` the bad commit and push; CI redeploys the previous
state.

## 5. The database, when you need it

Nothing to decide today, but the path is smooth:

- Install Docker on the same CX22 and run **Postgres + a small API**
  (e.g. Hono/Fastify on Node, reusing the engine's TypeScript types) behind
  Caddy: add `reverse_proxy /api/* localhost:3000` to the Caddyfile.
- Keep the app functional offline-first: the PWA plays fully without the API;
  accounts/stats sync when online.
- Back up Postgres with a nightly `pg_dump` to Hetzner's Storage Box
  (€3.5/month for 1 TB) or object storage.
- If load ever demands it: resize the server (minutes of downtime) or split
  the API onto a second box. Cloudflare stays the single entry point.

## Checklist

- [ ] CX22 created, SSH key added
- [ ] Server setup script run (deploy user, ufw, Caddy)
- [ ] Caddyfile in place, `systemctl reload caddy`
- [ ] Cloudflare A/CNAME records proxied, SSL mode Full (strict)
- [ ] Four GitHub secrets added
- [ ] Deploy job uncommented in `ci.yml`
- [ ] Push to `main` → https://sudokui.app is live
