# AGENTS.md — engineering status for AI coding agents

This file is the factual companion to **[PRD.md](PRD.md)**. PRD.md says what the product should
be — a set of named backend services (Payroll Engine, Eligibility Engine, Bridge Engine,
Treasury, etc.) driving one business flow (employer onboarded → ... → repayment completed).
This file says, service by service and step by step, what actually exists in the code today, so
an agent picking up work here doesn't have to rediscover it by reading 70 pages and 14 route
files. **Keep this updated as work lands** — when something moves from "not built" to "built,"
move the line, don't just add a new one.

Last audited: 2026-07-30.

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
| **Employer Management** | ❌ Not built | No `employer.ts`/equivalent route exists. `Employer`/`EmployerUser`/`EmployerContact` Prisma models exist but nothing outside the admin CRM lead pipeline (which manages *registration/lead* records, not live employer accounts) reads or writes them. There is no employer-facing account/roster API. |
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
| Employer onboarded | ❌ No employer account/onboarding route (Employer Management not built) |
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
unreachable. There is also **no KYC review queue**: `admin/portal/KycReview.tsx` is a literal
`<SectionInBuild>` placeholder and no backend route approves/rejects a submitted case, so a KYC
submission can reach `pending` and then goes nowhere without a direct DB edit.

## 4. MVP Deliverables checklist (per PRD.md)

| Deliverable | Status |
|---|---|
| Employer onboarding | ❌ |
| Employee registration and KYC | ✅ registration/submission real; ❌ review/approval step |
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

## 5. Known live-environment issues (fix before demoing to anyone external)

- **Mail transport is unconfigured in production** — no `MAIL_TRANSPORT`/`SMTP_HOST`/
  `RESEND_API_KEY` set on Render, so verification-code emails silently never send (the mailer
  never throws, by design — see `email/mailer.ts`). Registration completes but the user is
  stuck on `/verify-email` forever. Needs Resend or SMTP configured on Render.
- **`ALLOWED_ORIGINS`** on Render must exactly match every origin the frontend is actually
  served from (e.g. `https://getpaybridge.com`, `https://www.getpaybridge.com`) — a mismatch
  here causes every unsafe request (register, login, etc.) to fail with a deliberately generic
  `"Request rejected."` (403) from `security/csrf.ts`'s origin check.

## 6. Suggested priority order (engineering judgment, not committed roadmap)

Following PRD.md's own business flow, in dependency order:

1. **Fix the live-environment issues in §5** — nothing else matters if new users can't verify
   their email today.
2. **KYC review queue** — smallest scope of the missing pieces, unblocks "can a real employee
   actually get approved," no external dependency.
3. **Employer Management** — a real employer account/onboarding path; everything downstream
   (payroll, eligibility, employees invited) depends on an employer existing for real.
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
