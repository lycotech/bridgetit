# Deploying PayBridge to a VPS

Replaces Vercel (webapp) + Render (backend) with one VPS running both behind
Nginx in Docker. Neon (Postgres) and Cloudflare R2 (KYC document storage)
stay exactly as they are — nothing about the database or file storage
changes, only where the app process itself runs.

## Architecture

```
                 ┌─────────────── VPS ───────────────┐
 Browser ──HTTPS──▶  nginx (webapp container)         │
                 │   ├─ serves built React app        │
                 │   ├─ proxies /api/* ─▶ backend:3000 │──▶ Neon (Postgres)
                 │   └─ terminates TLS (Let's Encrypt) │──▶ Cloudflare R2
                 └─────────────────────────────────────┘
```

The browser only ever talks to your one domain — same as today, where
`webapp/vercel.json` rewrites `/api/*` to Render. That's why none of the
webapp or backend source needed to change: relative `/api/...` calls and the
session/CSRF cookie design both depend on the browser seeing a single origin,
and this setup preserves that.

New files added for this (nothing existing was modified):
- `backend/Dockerfile`, `backend/.dockerignore`
- `webapp/Dockerfile`, `webapp/.dockerignore`
- `docker-compose.yml`, root `.env.example`, root `.gitignore`
- `deploy/nginx/app.conf.template` — Nginx site config (reverse proxy + the
  same security headers `vercel.json` used to set)
- `deploy/init-letsencrypt.sh` — one-time TLS certificate bootstrap

`webapp/vercel.json` and `backend/render.yaml` are left in place, unused —
harmless, and your rollback path if anything goes wrong.

## 1. Point DNS at the VPS

Create an A record for your domain (e.g. `app.getpaybridge.com`) pointing at
the VPS's IPv4 address. Wait for it to resolve (`dig +short yourdomain.com`)
before continuing — the TLS step needs this to already work.

## 2. Provision the VPS

Any provider is fine (Hetzner, DigitalOcean, Linode...). Minimum: 1 vCPU / 2GB
RAM, Ubuntu 22.04+.

```bash
ssh root@169.58.244.187

# Docker + Compose plugin
curl -fsSL https://get.docker.com | sh

# Firewall: only SSH, HTTP, HTTPS
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
```

## 3. Get the code onto the VPS

```bash
git clone <your-repo-url> paybridge
cd paybridge
```

## 4. Configure environment

```bash
cp .env.example .env
# edit .env: set DOMAIN=yourdomain.com

cp backend/.env.example backend/.env
```

Edit `backend/.env` and fill in real values. Everything from the existing
Render setup carries over unchanged (same Neon `DATABASE_URL`/`DIRECT_URL`,
same R2 `KYC_S3_*` credentials, same mail config) — you're reusing the same
secrets, just pointing them at a new process. Two values need to change
because the domain changed:

```
NODE_ENV=production
BACKEND_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com
PUBLIC_SITE_URL=https://yourdomain.com
```

`ALLOWED_ORIGINS` matters even though the browser only ever sees one origin:
the backend checks the raw `Origin` header for CSRF protection, and the proxy
forwards it unchanged (see `backend/src/security/config.ts`) — so it must
list the real domain, not the internal Docker hostname.

## 5. First-time TLS bootstrap

```bash
chmod +x deploy/init-letsencrypt.sh
./deploy/init-letsencrypt.sh yourdomain.com you@example.com
```

This builds both images, starts the stack, and issues the real Let's Encrypt
certificate (see the script's comments for why it's multi-step). Takes a
couple of minutes. When it finishes, `https://yourdomain.com` should load the
app with a valid certificate. Renewal is automatic from here (a `certbot`
container checks twice a day; Let's Encrypt certs renew inside their last 30
days of validity).

## 6. Verify

```bash
curl -s https://yourdomain.com/api/health
docker compose ps
docker compose logs -f backend
```

Run through the actual app in a browser next — sign in, check a page that
hits the database, confirm a KYC upload if you have a test account, same as
you'd smoke-test any deploy.

## Redeploying after a code change

```bash
git pull
docker compose up -d --build backend webapp
```

Backend migrations run automatically on start (`prisma migrate deploy`,
same as the old `render.yaml`), so a schema change just needs a normal
redeploy — no separate migration step.

## Logs & troubleshooting

```bash
docker compose logs -f backend   # app logs
docker compose logs -f webapp    # nginx access/error logs
docker compose ps                # container status
```

If `/api/*` returns 502: the backend container is down or still starting —
check `docker compose logs backend`.
If the browser rejects a login/CSRF check: re-verify `ALLOWED_ORIGINS` in
`backend/.env` matches the exact scheme+domain the browser is using.

## What did NOT change

- Neon Postgres — same connection strings, same data, no migration needed.
- Cloudflare R2 — same bucket, same KYC documents, no migration needed.
- Mail (Resend/SMTP) — same credentials.
- Application code — zero changes to `backend/src/` or `webapp/src/`.
