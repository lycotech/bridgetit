# AGENTS.md — engineering status for AI coding agents

This file is the factual companion to **[PRD.md](PRD.md)**. PRD.md says what the product should
be — a set of named backend services (Payroll Engine, Eligibility Engine, Bridge Engine,
Treasury, etc.) driving one business flow (employer onboarded → ... → repayment completed).
This file says, service by service and step by step, what actually exists in the code today, so
an agent picking up work here doesn't have to rediscover it by reading 70 pages and 14 route
files. **Keep this updated as work lands** — when something moves from "not built" to "built,"
move the line, don't just add a new one.

Last audited: 2026-08-02.

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
| **Authentication** | ✅ Built | `auth.ts` — custom session system (not Better Auth): Argon2id, HMAC-signed `__Host-` cookies, rate limiting/lockout, double-submit CSRF. Separate `admin-auth.ts`/`staff-session.ts` with real TOTP MFA for staff. **Customer and employer 2FA added (2026-08-02)**: `User.twoFactorSecretEnc`/`twoFactorEnabledAt`/`twoFactorBackupCodes` and the identical fields on `EmployerUser` (migration `20260802204121_add_two_factor_auth`) — the same TOTP design staff already had, extended to real customer (`/api/auth/2fa/*`) and employer (`/api/employer/2fa/*`) accounts. Login now supports the two-step password-then-code flow (`MFA_REQUIRED` response, optional `totp`/`recoveryCode` fields), with single-use recovery codes as a backup. Real UI: a "Two-factor authentication" panel on the customer `/account` page and on `/employer-portal`, sharing one component (`webapp/src/components/account/TwoFactorPanel.tsx`). The "coming soon" 2FA placeholders in the mock demo dashboards (`employee/Profile.tsx`, `employer/Settings.tsx`, `investor/Profile.tsx`, `operations/Settings.tsx`) are a different, still-unwired system and were left untouched. |
| **Admin** | ✅ Built | `admin.ts`, `admin-users.ts`, `admin-audit.ts`, `admin-invitations.ts`, `admin-support.ts` — registration/lead CRM, RBAC staff accounts, append-only audit log, CSV export, demo invitation lifecycle. Wired to real admin portal pages. |
| **Notifications** | ⚠️ Partial | `email/mailer.ts` — real SMTP/Resend send with safe log-only dev fallback, wired into registration/verification/support/welcome flows. Email only — no SMS/push. Currently unconfigured in production (no `MAIL_TRANSPORT`/`SMTP_HOST`/`RESEND_API_KEY` set), so OTP/verification emails are silently not sent — see §5. |
| **Risk & Compliance** | ✅ Wired (2026-08-01) | `backend/src/routes/admin-risk.ts` (`/api/admin/risk/*`) calls the untouched `eir/risk/*` engine for real: `backend/src/eir/scoring-input.ts` assembles a `ScoringInput` from actual `Employer`/`Director`/`BeneficialOwner`/`EmployerDocument`/`BankAccount`/`Consent`/`PayrollCycle`/`FinancialPeriod`/`EmployerUser` rows; `backend/src/eir/policy-store.ts` loads/seeds a `ScoringPolicyVersion` from `DEFAULT_POLICY`; `backend/src/eir/persist-score.ts` writes `EmployerScore`+`ScoreComponent`+`KnockoutEvaluation`+`LimitRecommendation` and updates `Employer.currentScore/currentTier/earlyWarningLevel`. A decision route resolves the engine's own authority matrix (`resolveAuthority`) and, on approval, sets `Employer.status = "active"` — the exact field the Eligibility Engine's `employerActive` check reads, so an approval now actually unblocks employees. Real UI at `/admin/risk` (needs `risk.view`/`risk.decide`, currently `super_admin` + `operations_admin` view-only). **Known, deliberate gaps** (see §3 and §6 below): the full 19-stage `eir/risk/workflow.ts` state machine is NOT enforced (a minimal `Application` row is auto-created only so `CreditDecision`'s required relation is satisfiable); `DEFAULT_POLICY`'s authority matrix ships with every threshold `null` (by the engine's own design — unconfigured means zero authority, not unlimited), so most decisions will correctly report "no authority configured" until a policy-editor screen exists to set real numbers; most `ScoringInput` fields (director identity verification, beneficial-owner/compliance screening, financial statements, behavioural history) have no capture flow anywhere in the product yet, so a fresh employer will score thin/low — that's the engine correctly reporting insufficient data, not a bug. |
| **Employee Management** | ⚠️ Partial | Real: registration, KYC submission + document upload (`auth.ts`). Missing: no employer-side roster/eligibility management route — an employer cannot view or manage "their" employees for real. |
| **Employer Management** | ✅ Built (2026-08-01) | `backend/src/routes/employer.ts` (mounted at `/api/employer`) + `backend/src/security/employer-session.ts` — a real, separate multi-seat login for a company (`EmployerUser`, own session cookie, own `employer_admin`/`employer_contributor`/`employer_viewer` roles). Register creates a real `Employer` row. Company profile read/update, team list, invite-by-email (signed stateless token, no schema change needed), accept-invite, suspend/reinstate. Real frontend at `/employer-portal/{register,login,accept-invite}` and a minimal (not the polished mock dashboard) home page. **Not done**: this is NOT wired to the existing `/employer/*` demo dashboard (`webapp/src/pages/employer/*`), which is still 100% mock data behind the private demo gate — see the row below and §3. Connecting that dashboard to this real service is separate follow-up work. |
| **Payroll Engine** | ✅ Built (2026-08-01) | `backend/src/routes/employer-payroll.ts` (mounted at `/api/employer/payroll`) — create a pay cycle, upload a CSV of pay records against it (re-upload replaces, doesn't duplicate), view cycle detail, view the derived employee roster. Real UI at `/employer-portal/payroll`. Names/account numbers encrypted at rest like KYC fields. Deliberately does NOT compute `timeliness`/delay days — that's `eir/risk/payroll.ts`'s job (§ Risk & Compliance, still unwired). No provider integration (ADP/Gusto) — manual/CSV only, which is what a pilot needs. |
| **Eligibility Engine** | ✅ Built (2026-08-01) | `GET /api/auth/eligibility` (`backend/src/routes/employee-link.ts`) computes and returns every precondition from PRD.md's Business Rules that can be checked with data that now exists: employment verified, employer active, payroll verified, KYC approved — plus an honest prorated earned-wage-to-date estimate. Required a schema change: `EmployeeRecord.userId` (nullable, unique) now links a payroll roster row to the real `User` who claims it, via a signed invite-and-accept flow (`POST /api/employer/payroll/employees/:id/invite`, `POST /api/auth/link`) — mirrors the employer team-invite pattern, no new table needed. Real UI: an "Invite" button per unlinked roster row in `/employer-portal/payroll`, and a live "Bridge eligibility" panel on the customer's real `/account` page. **Does NOT decide a requested draw amount** — there is still no Bridge/draw model (see Bridge Engine, still not built); this only answers whether the preconditions for one are met today. |
| **Bridge Engine** | ✅ Built (2026-08-02) | New `BridgeDraw` model (migration `20260802175005_add_bridge_draw`) — the earned-wage draw individual `Utilisation` deliberately doesn't record ("never who", per its own schema comment). `POST /api/bridge/request` (`backend/src/routes/bridge.ts`): checks the same eligibility as §Eligibility Engine, plus the employer's real `ewa` `CreditLimit.availableAmount`, and decides **instantly and deterministically** — no per-draw manual review, matching how EWA products actually work. On approval it decrements the limit and rolls up into an aggregate `Utilisation` row. Real UI: "Request a Bridge" on the customer's `/account` page (`webapp/src/lib/bridge/eligibility.ts` factors the shared eligibility computation out of `employee-link.ts` so both routes use one source of truth). **Not done**: no money moves — `status` stops at `approved`/`rejected`, never `disbursed`/`repaid`. That's Disbursement/Repayment, still not built. |
| **Treasury** | ✅ Built as a byproduct of Bridge Engine (2026-08-02) | "Treasury approves funding" turned out not to need its own service: the real approval is the credit-risk decision (§ Risk & Compliance) that set the `ewa` `CreditLimit` in the first place. Every draw against it is treasury's pre-approved capacity being drawn down in real time — visible to staff at `/admin/risk` → select an employer → "Active facilities" / "Bridge draw activity" (`GET /api/admin/risk/employers/:id/draws`, `.../limits`), never exposed to the employer's own portal (same privacy rule as `Utilisation`). |
| **Repayments** | ❌ Not built | No route reconciles a payroll deduction against a Bridge balance. `employer/Repayments.tsx` and `operations/Reconciliation.tsx` are mock-service backed. |
| **Savings** | ✅ Built (2026-08-02) | New `SavingsGoal`/`SavingsTransaction` models. `backend/src/routes/savings.ts` (`/api/savings/*`) — create a goal, deposit, withdraw, all real and persisted. Real UI: a "Savings" panel on the customer's `/account` page. **Honesty limitation, stated in the UI and code, not hidden**: no bank rail exists (§ Disbursement/Repayment, deferred), so a deposit/withdrawal is a self-reported bookkeeping entry — real numbers the customer entered, not money PayBridge moved. The old mock `employee/Savings.tsx` page is untouched. |
| **Investments** | ✅ Built (2026-08-02) | New `InvestmentCommitment` model. `backend/src/routes/investments.ts` (`/api/investments/*`) — an investor-only (`accountType === "investor"`) commitment ledger, same honesty limitation as Savings, PLUS a real `GET /portfolio` snapshot computed live from `Employer`/`CreditLimit`/`BridgeDraw`/`PayrollCycle` — actual employer count, exposure, Bridge volume, an investor's own vs. total committed capital. Deliberately reports **no yield/return figure** — there is no interest-distribution model anywhere in this codebase, and inventing one would be fabricating a financial promise. Real UI: an "Investments" panel on `/account` for investor accounts. The old mock `employee/Invest.tsx` and the entire `investor/*` demo portal are untouched. |
| **Reporting** | ✅ Partial (2026-08-02) | `backend/src/routes/admin-reports.ts` (`GET /api/admin/reports/overview`, new `reports.view` permission) — real portfolio-wide aggregates: employers by status/tier, KYC funnel, credit exposure, payroll totals, Bridge draw counts/volume, savings/investment totals. Every query is a `count`/`groupBy`/`aggregate` — no individual customer's name or balance appears, by construction. Real UI at `/admin/reports`. **Partial**: only the ops/admin-side aggregate view was built — the employer-facing `Reports.tsx`, investor-facing `Performance.tsx`/`Statements.tsx`, and every other per-portal reporting page are still mock-service backed; wiring those is dashboard-rewiring work, same category as the note below. |

**Bottom line (2026-08-02):** of 14 named services, 11 are genuinely built and wired (Authentication,
Admin, Employer Management, Payroll Engine, Eligibility Engine, Risk & Compliance, Bridge Engine,
Treasury, Savings, Investments, Reporting-partial), 2 are partially done (Notifications, Employee
Management), and only Repayments does not exist as a backend service at all — folded into the
deferred Disbursement/Repayment item. Every dashboard for the still-mock `/employer/*` and
`/employee/*` demo pages (which have NOT been
rewired to any of the real services above) reads and writes through
`webapp/src/lib/platform/mock-service.ts`, whose own header comment says: *"Swapping this file
for Supabase (or the Hono backend) is the single integration point for going live."*

## 3. Core Business Flow — status per step

Mapping PRD.md's flow (`Employer onboarded → ... → Repayment completed`) to reality:

| Step | Status |
|---|---|
| Employer onboarded | ✅ Real (2026-08-01) — `POST /api/employer/register` creates a real `Employer` + first `employer_admin`. Downstream steps (payroll, eligibility) still don't consume this yet. |
| Payroll uploaded/synchronised | ✅ Real, manual/CSV (2026-08-01) — synchronisation with a provider is still not built |
| Employees invited | ✅ Real (2026-08-01) — an employer can invite a payroll-roster row's real owner to link their account, alongside the still-separate pre-launch demo invite system |
| Employee completes KYC | ✅ Real — submission, encryption, document upload all work |
| Eligibility calculated | ✅ Real (2026-08-01) — see §2 |
| Employee requests Bridge | ✅ Real (2026-08-02) — see §2. The old mock `/employee/Bridge.tsx` page is untouched; the real flow is on `/account` |
| Risk validation | ✅ Real (2026-08-01) — see §2. Authority matrix unconfigured by design, so most approvals still need a policy-editor screen before they can finalise |
| Treasury approves funding | ✅ Real (2026-08-02) — see §2, folded into the credit-limit + instant-draw-check design rather than a separate approval step |
| Funds disbursed | ❌ Not built — no payment/bank/disbursement integration exists anywhere in the codebase (no Plaid/Paystack/Flutterwave/Mono/Okra/Stripe/ACH) |
| Payroll deduction | ❌ Not built |
| Repayment completed | ❌ Not built |

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
| Payroll upload/synchronisation | ✅ upload (2026-08-01); ❌ provider sync |
| Eligibility calculation | ✅ (2026-08-01) |
| Bridge request workflow | ✅ (2026-08-02) |
| Risk approval | ✅ (2026-08-01) — see §2; most decisions still blocked pending real authority thresholds |
| Treasury funding | ✅ (2026-08-02) |
| Payroll repayment | ❌ |
| Employer dashboard | ❌ mock UI only (`/employer/*`); real employer functionality lives at the separate `/employer-portal/*` — see §2 |
| Employee dashboard | ❌ mock UI only (`/employee/*`); real employee functionality (eligibility, Bridge, savings, investments) lives on the real `/account` page — see §2 |
| Operations dashboard | ❌ mock UI only (its "Risk" page still reads simulated data — the real engine is wired at `/admin/risk` in the admin portal, a separate page from the mock ops dashboard) |
| Admin console | ✅ real, working today |
| Basic investor dashboard | ⚠️ Partial (2026-08-02) — real commitment ledger + real portfolio snapshot on `/account` for investor accounts (see §2, Investments); the polished mock `investor/*` demo portal is untouched |

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

## 6. Working punch list (current — updated 2026-08-02)

Following PRD.md's own business flow, in dependency order. This is the live, ordered backlog —
tick items off here as they land rather than treating this as a static plan.

1. ✅ **Verify mail end-to-end** — done (Resend), confirmed working.
2. ✅ **KYC review queue** — done, see §2.
3. ✅ **Employer Management** — done (2026-08-01), see §2.
4. ✅ **Payroll Engine** — done (2026-08-01), see §2.
5. ✅ **Eligibility Engine** — done (2026-08-01), see §2.
6. ✅ **Wire the Risk & Compliance engine** — done (2026-08-01), see §2. Next real dependency
   this unblocks: a policy-editor screen to set real (non-null) authority thresholds, since
   `DEFAULT_POLICY` ships with every level unconfigured by design.
7. ✅ **Bridge Engine + Treasury** — done (2026-08-02), see §2.
8. ⏸️ **Disbursement/Repayment** — deliberately deferred (2026-08-02, by user decision). The
   next real gap once resumed: `BridgeDraw.status` stops at `approved`; nothing moves money or
   reconciles a payroll deduction against it. Largest, highest-risk item left — do it only for a
   real pilot employer, not the public demo. Requires a real payment/banking integration
   decision first (which provider, whose compliance obligations) — a product conversation, not
   something to pick while wiring a route.
9. ✅ **Savings / Investments / Reporting** — done (2026-08-02), see §2. Built as ledger-only /
   aggregate-only by explicit user decision, given step 8's deferral means neither Savings nor
   Investments can move real money yet.
10. ✅ **Customer-facing 2FA** — done (2026-08-02), see §2.
11. Test coverage for every area above as it goes real — `risk.test.ts` is currently the *only*
    test file in the repo; no tests exist for any route, `session.ts`, `passwords.ts`, CSRF, or
    anywhere in `webapp/`.

## 7. Infra/deploy status

- Vercel (frontend) + Render (backend) + Neon (Postgres) + Cloudflare R2 (KYC storage) — all
  reachable and configured as of this audit; see `MIGRATION_NOTES.md` for the full history and
  `backend/render.yaml` / `webapp/vercel.json` for the actual deploy config.
- `KYC_ENCRYPTION_KEY` has no rotation path — treat as permanent once real KYC data exists
  (see the comment in `backend/src/env.ts`).
- Five migrations exist in `backend/prisma/migrations/`: `20260729230713_init`,
  `20260801153307_link_employee_record_to_user` (adds `EmployeeRecord.userId`, nullable +
  unique), `20260802175005_add_bridge_draw` (new `BridgeDraw` table),
  `20260802184356_add_savings_investments` (new `SavingsGoal`/`SavingsTransaction`/
  `InvestmentCommitment` tables), and `20260802204121_add_two_factor_auth` (adds
  `twoFactorSecretEnc`/`twoFactorEnabledAt`/`twoFactorBackupCodes` to `User` and
  `EmployerUser`). Render's `startCommand` runs `prisma migrate deploy` on every deploy, so all
  five are applied automatically — nothing manual needed on the Render side.
