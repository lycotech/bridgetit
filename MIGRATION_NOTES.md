# Migration record — Bun → Node, SQLite → Postgres, Vibecode → Vercel/Render

Date: 2026-07-29. Full plan: `C:\Users\DELL\.claude\plans\synthetic-skipping-turing.md`

## Why

Moving the app off Vibecode's managed hosting to run independently:
Vercel (frontend), Render (backend), Neon (Postgres database).

## Decisions made

- KYC document uploads: local disk → S3-compatible object storage (bucket/credentials supplied by owner).
- Genuinely monetary Prisma fields: `Float` → `Decimal(18,2)` (30 fields — payroll, credit limits, transactions, repayments). Ratios/percentages/scores stayed `Float`.
- All `@vibecodeapp/*` packages and the Vibecode-only Vite plugin removed.
- Suspicious junk dependencies (`a`, `copy`, `existed`, `forged`, `never`, `session`, `steal`, `the`, `took`, `who`) removed from `backend/package.json` — unused, looked like dependency-confusion/typosquat noise.

## What changed

**Backend runtime (Bun → Node)**
- `backend/src/index.ts` — `@hono/node-server`'s `serve()` instead of Bun's `export default { fetch }`.
- `backend/src/security/passwords.ts` — `argon2` npm package instead of `Bun.password` (same argon2id params, so existing hashes keep verifying).
- `backend/src/routes/auth.ts` — `node:crypto` instead of `Bun.CryptoHasher`.
- `backend/src/security/client-ip.ts` — rewritten to use `@hono/node-server/conninfo`'s `getConnInfo()` instead of Bun's `c.env.requestIP`. This was a real bug the migration would have introduced silently (rate-limiting/audit IP capture would have gone null on every request under Node without this fix).
- `backend/src/eir/risk/risk.test.ts` — `bun:test` → `vitest` (added as a dependency; near-identical Jest-style API, no assertion rewrites needed).
- `backend/package.json`, `backend/scripts/*` — Bun scripts replaced with `tsx`/npm equivalents; `scripts/start`, `scripts/env.sh`, `scripts/studio` deleted (Render's `render.yaml` now owns build/start commands).

**Database (SQLite → Postgres/Neon)**
- `backend/prisma/schema.prisma` — `datasource` now `postgresql`, reading `DATABASE_URL` (pooled) and `DIRECT_URL` (unpooled, for migrations) from env. 30 monetary fields converted to `Decimal(18,2)`.
- `backend/src/env.ts` — added required-in-production validation for `DATABASE_URL`, `DIRECT_URL`, and the `KYC_S3_*` vars.
- Admin search routes (`admin.ts`, `admin-audit.ts`, `admin-invitations.ts`, `admin-support.ts`) — added `mode: "insensitive"` to `contains` filters (SQLite's `LIKE` was case-insensitive by default; Postgres's isn't).
- No `prisma/migrations/` exists yet — first migration still needs to be created once a real Neon `DATABASE_URL`/`DIRECT_URL` are in place: `npx prisma migrate dev --name init`.

**KYC storage (local disk → S3-compatible)**
- New `backend/src/storage/kyc.ts` (`putKycObject`/`deleteKycObjects`), wired into the upload route in `auth.ts`. Works with AWS S3, Cloudflare R2, or Backblaze B2 depending on `KYC_S3_ENDPOINT`/`KYC_S3_FORCE_PATH_STYLE`.

**Cross-origin deploy (Vercel + Render)**
- `webapp/vercel.json` (new) — rewrites `/api/*` to the Render backend URL, so the browser only ever talks to the Vercel domain. Keeps the existing session/CSRF cookie design (SameSite=Lax, `__Host-` prefix, double-submit CSRF) working unmodified — no need for `SameSite=None`.
- Also caught and fixed: the app's security response headers (CSP, HSTS, frame-ancestors, etc.) previously shipped only via `webapp/public/_headers`, a Netlify/Cloudflare-Pages-only format Vercel doesn't read. Ported the same headers into `webapp/vercel.json`'s `headers` array so they actually apply on Vercel.
- `backend/src/security/config.ts` — removed the Vibecode-domain CORS/CSRF regexes; production origins now come entirely from `ALLOWED_ORIGINS`.
- `webapp/vite-csp-plugin.ts` — `connect-src` simplified to `'self'` now that API calls are same-origin via the Vercel rewrite (previously allowed the Vibecode preview domains).

**New deployment files**: `backend/render.yaml`, `webapp/vercel.json`.

## Verified

- Backend: `npm install`, `npx prisma generate`, `npm run typecheck` (clean), `npx prisma validate` (schema valid), `npx vitest run` — 58/59 tests pass. The 1 failure (`behavioural trust > non-disclosure is penalised heavily`) is a pre-existing business-logic issue in `eir/risk/behavioural.ts`, unrelated to this migration — not fixed, flagged for separate follow-up.
- Also fixed a `@hono/node-server` moderate CVE (path traversal in `serve-static`, not something this app actually uses, but bumped anyway) and an `esbuild`/`vite` dev-server CVE via upgrading vitest — both `npm audit` clean now.
- Webapp: `npm install`, `npm run build` (clean), `npx tsc --noEmit` (clean).

## Incident during setup: leaked Neon credential

While configuring env vars, a **real** Neon `DATABASE_URL` was pasted into `backend/.env.example` — the one `.env*` file that is *not* gitignored (it's the tracked template). Moved the real value into `backend/.env` (gitignored) and restored a placeholder in `.env.example`. No git history exists yet in this workspace, so nothing was actually leaked to a remote — but **rotate that Neon password** once the database is otherwise set up, as cheap insurance.

## Still needed before this runs for real

1. Neon: get the **pooled** connection string → `DATABASE_URL`, and the **direct** connection string → `DIRECT_URL` (only the pooled one has been provided so far).
2. Create the S3-compatible bucket (S3/R2/B2) → `KYC_S3_*` vars.
3. Generate `SESSION_SECRET`, `LOG_SALT`, `KYC_ENCRYPTION_KEY` (`openssl rand -base64 48`/`24`).
4. Replace the placeholder Render URL in `webapp/vercel.json`.
5. After first deploy: set `ALLOWED_ORIGINS` on Render to the real Vercel domain.
6. Run `npx prisma migrate dev --name init` once Neon is reachable, commit the generated `prisma/migrations/` folder.
7. Update `backend/.env.production`'s `BACKEND_URL` — still points at an old Vibecode preview URL.
