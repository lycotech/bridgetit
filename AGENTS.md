# AGENTS.md — engineering status for AI coding agents

This file is the factual companion to **[PRD.md](PRD.md)**. PRD.md says what the product should
be — a set of named backend services (Payroll Engine, Eligibility Engine, Bridge Engine,
Treasury, etc.) driving one business flow (employer onboarded → ... → repayment completed).
This file says, service by service and step by step, what actually exists in the code today, so
an agent picking up work here doesn't have to rediscover it by reading 70 pages and 14 route
files. **Keep this updated as work lands** — when something moves from "not built" to "built,"
move the line, don't just add a new one.

Last audited: 2026-08-01.

---

## 1. Repo shape

```
webapp/    — React + Vite + TS + Tailwind frontend. Vercel. See webapp/CLAUDE.md.
backend/   — Hono API + Prisma + Postgres (Neon). Render. See backend/CLAUDE.md.
```

Shared API contracts live in `backend/src/types.ts` (Zod). Cross-cutting conventions
(response envelope, CORS, Prisma strategy) are in `.claude/rules/api-patterns.md`.
Deployment/infra migration history (Bun→Node, SQLite→Postgres, Vibecode→Vercel/Render) is in
`MIGRATION_NOTES.md` — read that before touching build/deploy config.

## 2. Core Services — status against PRD.md's list

PRD.md names 14 backend services. Here is what actually exists for each, in
`backend/src/routes/*.ts` unless noted:

| Service (per PRD) | Status | Evidence |
|---|---|---|
| **Authentication** | ✅ Built | `auth.ts` — custom session system (not Better Auth): Argon2id, HMAC-signed `__Host-` cookies, rate limiting/lockout, double-submit CSRF. Separate `admin-auth.ts`/`staff-session.ts` with real TOTP MFA for staff. |
| **Admin** | ✅ Built | `admin.ts`, `admin-users.ts`, `admin-audit.ts`, `admin-invitations.ts`, `admin-support.ts` — registration/lead CRM, RBAC staff accounts, append-only audit log, CSV export, demo invitation lifecycle. Wired to real admin portal pages. |
| **Notifications** | ⚠️ Partial | `email/mailer.ts` — real SMTP/Resend send with safe log-only dev fallback, wired into registration/verification/support/welcome flows. Email only — no SMS/push. Currently unconfigured in production (no `MAIL_TRANSPORT`/`SMTP_HOST`/`RESEND_API_KEY` set), so OTP/verification emails are silently not sent — see §5. |
| **Risk & Compliance** | ⚠️ Built, not wired | `backend/src/eir/risk/*` — a complete, tested scoring/decisioning engine (identity/financial/payroll/behavioural/compliance/industry scoring, knockouts, composite score, limit recommendation, an authority-matrix approval workflow). **No route calls it.** No file outside `eir/` imports from it. It is the only tested code in the backend (`risk.test.ts`, ~50 cases) but is unreachable from any API. |
| **Employee Management** | ⚠️ Partial | Real: registration, KYC submission + document upload (`auth.ts`). Missing: no employer-side roster/eligibility management route — an employer cannot view or manage "their" employees for real. |
| **Employer Management** | ✅ Built (2026-08-01) | `backend/src/routes/employer.ts` (mounted at `/api/employer`) + `backend/src/security/employer-session.ts` — a real, separate multi-seat login for a company (`EmployerUser`, own session cookie, own `employer_admin`/`employer_contributor`/`employer_viewer` roles). Register creates a real `Employer` row. Company profile read/update, team list, invite-by-email (signed stateless token, no schema change needed), accept-invite, suspend/reinstate. Real frontend at `/employer-portal/{register,login,accept-invite}` and a minimal (not the polished mock dashboard) home page. **Not done**: this is NOT wired to the existing `/employer/*` demo dashboard (`webapp/src/pages/employer/*`), which is still 100% mock data behind the private demo gate — see the row below and §3. Connecting that dashboard to this real service is separate follow-up work. |
| **Payroll Engine** | ❌ Not built | `PayrollCycle`/`PayrollRecord`/`EmployeeRecord` models exist (annotated as feeding the risk engine) but zero routes read or write them. Frontend payroll data is a seeded pseudo-random generator (`webapp/src/lib/platform/payroll-data.ts`) — no upload, no sync, no provider integration. |
| **Eligibility Engine** | ❌ Not built | No route or module computes "is this employee eligible for a Bridge right now." Nothing enforces the eligibility preconditions listed in PRD.md's Business Rules. |
| **Bridge Engine** | ❌ Not built | No route creates/approves/tracks a Bridge (earned-wage draw). The employee "Bridge" page is 100% mock data (`webapp/src/lib/platform/mock-service.ts`). |
| **Treasury** | ❌ Not built | No funding/liquidity-approval route or model logic exists. |
| **Repayments** | ❌ Not built | No route reconciles a payroll deduction against a Bridge balance. `employer/Repayments.tsx` and `operations/Reconciliation.tsx` are mock-service backed. |
| **Savings** | ❌ Not built | `employee/Savings.tsx` is mock UI; no backend model/route for a savings balance or contribution schedule. |
| **Investments** | ❌ Not built | `employee/Invest.tsx` and the entire `investor/*` portal are mock-service backed; no backend model/route for capital commitment, portfolio performance, or withdrawals. |
| **Reporting** | ❌ Not built | Every `Reports`/`Performance`/`Statements` page across employer/investor/operations is mock-service backed. No real reporting route aggregates actual data (there is no real data to aggregate yet, in most of these domains). |

**Bottom line:** of 14 named services, 2 are genuinely done (Authentication, Admin), 2 are
partially done (Notifications, Employee Management), 1 is built but disconnected (Risk &
Compliance), and 9 do not exist as backend services at all. Every dashboard for those 9 reads
and writes through `webapp/src/lib/platform/mock-service.ts`, whose own header comment says:
*"Swapping this file for Supabase (or the Hono backend) is the single integration point for
going live."*

## 3. Core Business Flow — status per step

Mapping PRD.md's flow (`Employer onboarded → ... → Repayment completed`) to reality:

| Step | Status |
|---|---|
| Employer onboarded | ✅ Real (2026-08-01) — `POST /api/employer/register` creates a real `Employer` + first `employer_admin`. Downstream steps (payroll, eligibility) still don't consume this yet. |
| Payroll uploaded/synchronised | ❌ Not built (Payroll Engine) |
| Employees invited | ⚠️ Partial — demo invitations exist (`admin-invitations.ts`) but that's the *pre-launch demo* invite, not an employer inviting its real workforce |
| Employee completes KYC | ✅ Real — submission, encryption, document upload all work |
| Eligibility calculated | ❌ Not built (Eligibility Engine) |
| Employee requests Bridge | ❌ Not built (Bridge Engine); frontend page is mock |
| Risk validation | ⚠️ Engine exists and is tested, but not invoked by any route |
| Treasury approves funding | ❌ Not built |
| Funds disbursed | ❌ Not built — no payment/bank/disbursement integration exists anywhere in the codebase (no Plaid/Paystack/Flutterwave/Mono/Okra/Stripe/ACH) |
| Payroll deduction | ❌ Not built |
| Repayment completed | ❌ Not built |

**Only the first real step of the entire pipeline — KYC — is functional today.** Everything
from "Eligibility calculated" onward is either unimplemented or (for Risk validation) built but
unreachable.

✅ **KYC review queue is now built** (2026-08-01): `backend/src/routes/admin-kyc.ts` (mounted at
`/api/admin/kyc`) — `GET /queue` (paginated, filterable by status), `GET /:userId` (decrypted
case detail, logged), `GET /:userId/documents/:documentId/view-url` (5-minute presigned R2
link), `POST /:userId/decision` (approve/reject, gated on `kyc.decide`). Real UI at
`webapp/src/pages/admin/portal/KycReview.tsx`. A KYC submission can now actually reach
`approved`/`rejected`, not just `pending`.

## 4. MVP Deliverables checklist (per PRD.md)

| Deliverable | Status |
|---|---|
| Employer onboarding | ✅ backend + minimal real UI (2026-08-01); not yet wired to the polished `/employer/*` dashboard |
| Employee registration and KYC | ✅ registration/submission real; ✅ review/approval step (2026-08-01) |
| Payroll upload/synchronisation | ❌ |
| Eligibility calculation | ❌ |
| Bridge request workflow | ❌ |
| Risk approval | ⚠️ engine built, not wired to a workflow |
| Treasury funding | ❌ |
| Payroll repayment | ❌ |
| Employer dashboard | ❌ mock UI only |
| Employee dashboard | ❌ mock UI only (except Profile/auth, which are real) |
| Operations dashboard | ❌ mock UI only (including the "Risk" page, which does not call the real risk engine) |
| Admin console | ✅ real, working today |
| Basic investor dashboard | ❌ mock UI only |

## 5. Known live-environment issues

Resolved since the 2026-07-30 audit:
- ✅ Vercel build failure (webapp couldn't resolve `zod` from `backend/src/types.ts`) — fixed
  via an alias in `webapp/vite.config.ts`.
- ✅ All required Render env vars set (`SESSION_SECRET`, `LOG_SALT`, `KYC_ENCRYPTION_KEY`,
  `ADMIN_PASSWORD_HASH`, `KYC_S3_*` for Cloudflare R2).
- ✅ `ALLOWED_ORIGINS` on Render now matches the live frontend origin(s) — was causing every
  unsafe request to fail with a generic `"Request rejected."` (403) from `security/csrf.ts`.
- ✅ `webapp/vercel.json` — placeholder Render URL replaced with the real one; added a SPA
  catch-all rewrite so direct navigation to client-side routes (e.g. `/paybridge-admin`,
  `/private-demo`) no longer 404s on Vercel.
- ✅ Demo environment logout bug — sign-out only cleared client-side mock role state, never
  the server-issued `pb_demo` cookie, so users couldn't actually leave the demo. Fixed in
  `webapp/src/components/dashboard/DashboardShell.tsx` to call `POST /api/demo/logout`.
- ✅ Demo role switcher now scoped to the invitation's assigned portal (was: any demo viewer
  could switch to any of the four portals regardless of what their invitation was issued for).

Still open:
- ⏳ **Mail transport** — being configured now (Resend). Until verified working end-to-end
  (registration → OTP email arrives → verify succeeds), treat registration as broken in
  production: the mailer never throws on missing config, so failures are silent.

## 5a. How to re-verify after the Resend setup lands

1. Confirm `MAIL_TRANSPORT=resend` and `RESEND_API_KEY` are set on Render, and that
   `getpaybridge.com` shows verified in Resend's domain list.
2. Register a fresh test account on the live site.
3. Confirm the OTP email actually arrives (check spam too — a freshly verified sending domain
   has no sender reputation yet).
4. Confirm `/verify-email` accepts the code and lands on the real account home.
5. Once confirmed, flip this section's status to ✅ and move on to §6 item 1.

## 6. Working punch list (current — updated 2026-08-01)

Following PRD.md's own business flow, in dependency order. This is the live, ordered backlog —
tick items off here as they land rather than treating this as a static plan.

1. ⏳ **Verify mail end-to-end** (§5a) — in progress now (Resend).
2. **KYC review queue** — smallest scope of the missing pieces, unblocks "can a real employee
   actually get approved," no external dependency.
3. ✅ **Employer Management** — done (2026-08-01), see §2.
4. **Payroll Engine** — even manual CSV upload against the existing `PayrollCycle`/
   `PayrollRecord` models is enough for a pilot; needed before real employee balances mean
   anything.
5. **Eligibility Engine** — encode the Business Rules from PRD.md as an actual checked
   precondition, reading real employer/payroll/KYC state.
6. **Wire the Risk & Compliance engine to a real route** — logic already exists and is tested;
   needs a controller + persistence to `CreditDecision`/`CreditLimit`/`ApprovalVote`.
7. **Bridge Engine + Treasury** — the actual draw-request and funding-approval workflow.
8. **Disbursement/Repayment** — largest, highest-risk, do last and only for a real pilot
   employer, not the public demo. Requires a real payment/banking integration decision first.
9. **Savings / Investments / Reporting** — lower priority than the core lending lifecycle per
   PRD.md's own MVP framing ("basic investor dashboard" is explicitly de-scoped from full).
10. Customer-facing 2FA (currently staff/admin-only).
11. Test coverage for every area above as it goes real — `risk.test.ts` is currently the *only*
    test file in the repo; no tests exist for any route, `session.ts`, `passwords.ts`, CSRF, or
    anywhere in `webapp/`.

## 7. Infra/deploy status

- Vercel (frontend) + Render (backend) + Neon (Postgres) + Cloudflare R2 (KYC storage) — all
  reachable and configured as of this audit; see `MIGRATION_NOTES.md` for the full history and
  `backend/render.yaml` / `webapp/vercel.json` for the actual deploy config.
- `KYC_ENCRYPTION_KEY` has no rotation path — treat as permanent once real KYC data exists
  (see the comment in `backend/src/env.ts`).
