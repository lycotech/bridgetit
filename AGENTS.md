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
| **Admin** | ✅ Built | `admin.ts`, `admin-users.ts`, `admin-audit.ts`, `admin-invitations.ts`, `admin-support.ts` — registration/lead CRM, RBAC staff accounts, append-only audit log, CSV export, demo invitation lifecycle. Wired to real admin portal pages. **2026-09-01 addition**: `admin-test-access.ts` (`/admin/test-access`, permission `test_access.manage`, Super Admin only) provisions three standing, real, fully-eligible fixture accounts (one employer, one employee, one investor) so staff can check any real portal by signing in normally at `/sign-in` or `/employer-portal/login` — instead of registering a new real account every time. Deliberately NOT impersonation: no session-minting shortcut, no password-check bypass anywhere — each fixture is a genuinely real account (real password hash, KYC-approved, and for the employer/employee pair a real payroll cycle + active `ewa` `CreditLimit` so a Bridge draw actually works). A generated password is returned exactly once, at creation or reset, never stored in plaintext. Not cURL-tested against a live database in this session (none reachable here) — typecheck-verified only. |
| **Notifications** | ⚠️ Partial | `email/mailer.ts` — real SMTP/Resend send with safe log-only dev fallback, wired into registration/verification/support/welcome flows. Email only — no SMS/push. Currently unconfigured in production (no `MAIL_TRANSPORT`/`SMTP_HOST`/`RESEND_API_KEY` set), so OTP/verification emails are silently not sent — see §5. |
| **Risk & Compliance** | ✅ Wired (2026-08-01) | `backend/src/routes/admin-risk.ts` (`/api/admin/risk/*`) calls the untouched `eir/risk/*` engine for real: `backend/src/eir/scoring-input.ts` assembles a `ScoringInput` from actual `Employer`/`Director`/`BeneficialOwner`/`EmployerDocument`/`BankAccount`/`Consent`/`PayrollCycle`/`FinancialPeriod`/`EmployerUser` rows; `backend/src/eir/policy-store.ts` loads/seeds a `ScoringPolicyVersion` from `DEFAULT_POLICY`; `backend/src/eir/persist-score.ts` writes `EmployerScore`+`ScoreComponent`+`KnockoutEvaluation`+`LimitRecommendation` and updates `Employer.currentScore/currentTier/earlyWarningLevel`. A decision route resolves the engine's own authority matrix (`resolveAuthority`) and, on approval, sets `Employer.status = "active"` — the exact field the Eligibility Engine's `employerActive` check reads, so an approval now actually unblocks employees. Real UI at `/admin/risk` (needs `risk.view`/`risk.decide`, currently `super_admin` + `operations_admin` view-only). **Known, deliberate gaps** (see §3 and §6 below): the full 19-stage `eir/risk/workflow.ts` state machine is NOT enforced (a minimal `Application` row is auto-created only so `CreditDecision`'s required relation is satisfiable); `DEFAULT_POLICY`'s authority matrix ships with every threshold `null` (by the engine's own design — unconfigured means zero authority, not unlimited), so most decisions will correctly report "no authority configured" until a policy-editor screen exists to set real numbers; most `ScoringInput` fields (director identity verification, beneficial-owner/compliance screening, financial statements, behavioural history) have no capture flow anywhere in the product yet, so a fresh employer will score thin/low — that's the engine correctly reporting insufficient data, not a bug. |
| **Employee Management** | ✅ Built (2026-08-11, corrected from a stale "Missing: no employer-side roster" note) | Real: registration, KYC submission + document upload (`auth.ts`). Employer-side roster already existed as of 2026-08-01 (`GET /api/employer/payroll/employees`, real UI at `/employer-portal/payroll` — this file's own §2 Payroll Engine row just never cross-referenced it here). What was genuinely missing — eligibility, not the roster itself — is now built (2026-08-11): the roster endpoint joins each linked row's `User.kycStatus` and returns an employer-safe `kycApproved`/`eligible` per employee (same gate as `GET /api/auth/eligibility`, deliberately without the earned-wage amount or any draw history — that stays private, matching the public site's new `HrPrivacy.tsx` promise that employers get "only what's needed for eligibility"). Real UI: the Roster panel in `webapp/src/pages/employer-portal/Payroll.tsx` now shows "Eligible for Access" / "KYC pending" / "Not yet eligible" next to "Connected" for each linked employee. Not cURL-verified against a live database in this session (no reachable Postgres instance here) — verified by typecheck only (backend + webapp both clean); worth a real end-to-end check next time the app is run against Neon. |
| **Employer Management** | ✅ Built (2026-08-01) | `backend/src/routes/employer.ts` (mounted at `/api/employer`) + `backend/src/security/employer-session.ts` — a real, separate multi-seat login for a company (`EmployerUser`, own session cookie, own `employer_admin`/`employer_contributor`/`employer_viewer` roles). Register creates a real `Employer` row. Company profile read/update, team list, invite-by-email (signed stateless token, no schema change needed), accept-invite, suspend/reinstate. Real frontend at `/employer-portal/{register,login,accept-invite}` and a minimal (not the polished mock dashboard) home page. **Not done**: this is NOT wired to the existing `/employer/*` demo dashboard (`webapp/src/pages/employer/*`), which is still 100% mock data behind the private demo gate — see the row below and §3. Connecting that dashboard to this real service is separate follow-up work. **2026-08-31 addition**: `/admin/risk`'s employer list and detail view (`GET /api/admin/risk/employers`) now also show each employer's real `EmployerUser` team-seat count and real `EmployeeRecord` payroll-roster count — previously fetched (`employeeCount` self-reported band) but not the real live counts, which staff had no way to see anywhere. |
| **Payroll Engine** | ✅ Built (2026-08-01) | `backend/src/routes/employer-payroll.ts` (mounted at `/api/employer/payroll`) — create a pay cycle, upload a CSV of pay records against it (re-upload replaces, doesn't duplicate), view cycle detail, view the derived employee roster. Real UI at `/employer-portal/payroll`. Names/account numbers encrypted at rest like KYC fields. Deliberately does NOT compute `timeliness`/delay days — that's `eir/risk/payroll.ts`'s job (§ Risk & Compliance, still unwired). No provider integration (ADP/Gusto) — manual/CSV only, which is what a pilot needs. |
| **Eligibility Engine** | ✅ Built (2026-08-01) | `GET /api/auth/eligibility` (`backend/src/routes/employee-link.ts`) computes and returns every precondition from PRD.md's Business Rules that can be checked with data that now exists: employment verified, employer active, payroll verified, KYC approved — plus an honest prorated earned-wage-to-date estimate. Required a schema change: `EmployeeRecord.userId` (nullable, unique) now links a payroll roster row to the real `User` who claims it, via a signed invite-and-accept flow (`POST /api/employer/payroll/employees/:id/invite`, `POST /api/auth/link`) — mirrors the employer team-invite pattern, no new table needed. Real UI: an "Invite" button per unlinked roster row in `/employer-portal/payroll`, and a live "Bridge eligibility" panel on the customer's real `/account` page. **Does NOT decide a requested draw amount** — there is still no Bridge/draw model (see Bridge Engine, still not built); this only answers whether the preconditions for one are met today. |
| **Bridge Engine** | ✅ Built (2026-08-02) | New `BridgeDraw` model (migration `20260802175005_add_bridge_draw`) — the earned-wage draw individual `Utilisation` deliberately doesn't record ("never who", per its own schema comment). `POST /api/bridge/request` (`backend/src/routes/bridge.ts`): checks the same eligibility as §Eligibility Engine, plus the employer's real `ewa` `CreditLimit.availableAmount`, and decides **instantly and deterministically** — no per-draw manual review, matching how EWA products actually work. On approval it decrements the limit and rolls up into an aggregate `Utilisation` row. Real UI: "Request a Bridge" on the customer's `/account` page (`webapp/src/lib/bridge/eligibility.ts` factors the shared eligibility computation out of `employee-link.ts` so both routes use one source of truth). **Not done**: no money moves — `status` stops at `approved`/`rejected`, never `disbursed`/`repaid`. That's Disbursement/Repayment, still not built. |
| **Treasury** | ✅ Built as a byproduct of Bridge Engine (2026-08-02) | "Treasury approves funding" turned out not to need its own service: the real approval is the credit-risk decision (§ Risk & Compliance) that set the `ewa` `CreditLimit` in the first place. Every draw against it is treasury's pre-approved capacity being drawn down in real time — visible to staff at `/admin/risk` → select an employer → "Active facilities" / "Bridge draw activity" (`GET /api/admin/risk/employers/:id/draws`, `.../limits`), never exposed to the employer's own portal (same privacy rule as `Utilisation`). |
| **Repayments** | ❌ Not built | No route reconciles a payroll deduction against a Bridge balance. `employer/Repayments.tsx` and `operations/Reconciliation.tsx` are mock-service backed. |
| **Savings** | ✅ Built (2026-08-02) | New `SavingsGoal`/`SavingsTransaction` models. `backend/src/routes/savings.ts` (`/api/savings/*`) — create a goal, deposit, withdraw, all real and persisted. Real UI: a "Savings" panel on the customer's `/account` page. **Honesty limitation, stated in the UI and code, not hidden**: no bank rail exists (§ Disbursement/Repayment, deferred), so a deposit/withdrawal is a self-reported bookkeeping entry — real numbers the customer entered, not money PayBridge moved. The old mock `employee/Savings.tsx` page is untouched. |
| **Investments** | ✅ Built (2026-08-02) | New `InvestmentCommitment` model. `backend/src/routes/investments.ts` (`/api/investments/*`) — an investor-only (`accountType === "investor"`) commitment ledger, same honesty limitation as Savings, PLUS a real `GET /portfolio` snapshot computed live from `Employer`/`CreditLimit`/`BridgeDraw`/`PayrollCycle` — actual employer count, exposure, Bridge volume, an investor's own vs. total committed capital. Deliberately reports **no yield/return figure** — there is no interest-distribution model anywhere in this codebase, and inventing one would be fabricating a financial promise. Real UI: an "Investments" panel on `/account` for investor accounts. The old mock `employee/Invest.tsx` and the entire `investor/*` demo portal are untouched. **2026-08-31 addition**: staff previously had no way to see real investors individually — `/admin/reports` only ever showed a platform-wide committed-capital total. New `backend/src/routes/admin-investors.ts` (`GET /api/admin/investors`, permission `investors.view`) + real UI at `/admin/investors` lists every real investor with their own committed/withdrawn capital and commitment count. |
| **Reporting** | ✅ Partial (2026-08-02) | `backend/src/routes/admin-reports.ts` (`GET /api/admin/reports/overview`, new `reports.view` permission) — real portfolio-wide aggregates: employers by status/tier, KYC funnel, credit exposure, payroll totals, Bridge draw counts/volume, savings/investment totals. Every query is a `count`/`groupBy`/`aggregate` — no individual customer's name or balance appears, by construction. Real UI at `/admin/reports`. **Partial**: only the ops/admin-side aggregate view was built — the employer-facing `Reports.tsx`, investor-facing `Performance.tsx`/`Statements.tsx`, and every other per-portal reporting page are still mock-service backed; wiring those is dashboard-rewiring work, same category as the note below. |
| **AI Assistant** | ✅ Built (2026-08-28) | `backend/src/routes/ai-assistant.ts` (`POST /api/ai-assistant/chat`) — a real Claude call (`@anthropic-ai/sdk`, model `claude-opus-5`), gated behind `requireFinancialAccess()` so only a verified customer on the real `/account` page can reach it. Grounded ONLY in that signed-in customer's own real data, assembled server-side each request (Bridge eligibility/earned-wage estimate, Bridge draw history, Savings goal count/total, PayBridge Score, PayBridge Account status, investor committed capital) — never another customer's, never the employer/admin side. System prompt hard-codes the same forbidden-claims list as the public site (no guaranteed returns, no claiming Savings/Investments move real money, no claiming disbursement/repayment exists). Requires `ANTHROPIC_API_KEY` (optional at boot, same pattern as `OPENAI_API_KEY`; unset returns a clear 503 `AI_NOT_CONFIGURED` instead of failing) — **not yet set in production**, so the feature is code-complete but inactive until a key is added to Render. Real UI: a second floating launcher ("Ask PayBridge AI", bottom-left) on `/account`, `components/account/AIAssistantChat.tsx` — kept deliberately separate from `components/account/AIAssistWidget.tsx` (bottom-right), which stays exactly as it was: rules-based, no live AI call. Both widgets are kept, by explicit user decision. Not cURL-verified against a live Anthropic key or Postgres instance in this session (neither reachable here) — verified by typecheck only (backend + webapp both clean). **Not yet built**: the mock `employee/AIAssistWidget.tsx` (§10, mock demo) and the investor/employer/ops portals have no equivalent; scope was deliberately limited to the real `/account` page for this pass. |

**Bottom line (2026-08-28, updated for the real AI Assistant):** of 15 named services, 12 are
genuinely built and wired (Authentication, Admin, Employer Management, Payroll Engine, Eligibility
Engine, Risk & Compliance, Bridge Engine, Treasury, Savings, Investments, Reporting-partial, AI
Assistant), 2 are partially done (Notifications, Employee Management), and 1 does not exist as a
backend service at all: Repayments (folded into the deferred Disbursement/Repayment item, on hold
pending the Monnify verification approval). Every dashboard for the still-mock `/employer/*`
and `/employee/*` demo pages (which have NOT been
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
| Employer dashboard | ⚠️ Partial (2026-08-28) — Employees, Payroll and both Salary Account Requests pages each gained a real "Live data" tab reading `/employer-portal/*` (see §11); demo data stays the default. CommandCentre, Exceptions, Integrations, PayBridgePayroll, SalaryBuffer, BridgeActivity, Repayments, Reports, Settings remain mock-only. |
| Employee dashboard | ❌ mock UI only (`/employee/*`); real employee functionality (eligibility, Bridge, savings, investments) lives on the real `/account` page — see §2 |
| Operations dashboard | ⚠️ Partial (2026-08-28) — Support, Risk, Employers, Settings' audit log, and Reports each gained a real "Live data" tab (see §11); demo data stays the default so the prospect walkthrough is unchanged. Employees, Investors, Transactions, Funding, Portfolios, PayrollOps, Reconciliation, Compliance remain mock-only — no real backend concept to attach to yet. |
| Admin console | ✅ real, working today |
| Basic investor dashboard | ⚠️ Partial (2026-08-28) — real commitment ledger + real portfolio snapshot on `/account` for investor accounts (see §2, Investments); `investor/Overview.tsx`, `investor/Invest.tsx`, `investor/Withdrawals.tsx` and `investor/Transactions.tsx` in the polished mock portal each gained a real "Live data" tab reusing that same panel (see §11); the rest of the mock `investor/*` portal (Performance, Statements, Documents, Profile) is untouched — no real yield/statement/KYB backend exists |

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
- ✅ **CSRF false-positive on stale cookies (2026-09-01)** — `security/csrf.ts`'s `hasSessionCookie`
  check was a raw `cookieHeader.includes("pb_session=")`-style string match, not a real
  decode-and-verify. A browser carrying an idle-expired or otherwise invalid session cookie from
  an earlier visit (customer, admin, demo or employer) still tripped this check, which then
  required a matching CSRF token that was never issued for that dead session — permanently
  403'ing every anonymous POST from that browser (registration, waitlist, **demo invitation
  redemption**) with the generic `"Request rejected."` message until the stale cookie's 12h
  max-age finally elapsed. Fixed by replacing the string check with real
  `readSession`/`readStaffSession`/`readEmployerSession` calls (all already decode-and-verify),
  so only an *actually valid* session now triggers the token requirement. Caught via the
  `/private-demo` invitation form surfacing `csrf.token.rejected` in the audit log.

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
   real pilot employer, not the public demo. Provider decided (2026-08-28): **Monnify** — but
   its verification/KYB has **not yet been approved**, so this stays blocked until that clears.
   Do not start wiring Monnify integration code before verification is confirmed approved.
9. ✅ **Savings / Investments / Reporting** — done (2026-08-02), see §2. Built as ledger-only /
   aggregate-only by explicit user decision, given step 8's deferral means neither Savings nor
   Investments can move real money yet.
10. ✅ **Customer-facing 2FA** — done (2026-08-02), see §2.
11. Test coverage for every area above as it goes real — `risk.test.ts` is currently the *only*
    test file in the repo; no tests exist for any route, `session.ts`, `passwords.ts`, CSRF, or
    anywhere in `webapp/`.
12. ✅ **AI Assistant** — built (2026-08-28), see §2. Real Claude chat on `/account`, kept
    alongside (not replacing) the existing rules-based `AIAssistWidget.tsx`, by explicit user
    decision. Needs `ANTHROPIC_API_KEY` set in production before it actually responds.

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

## 8. Website copy — pending brand/positioning update (added 2026-08-10)

Full target copy lives in **[WEBSITE_COPY_BRIEF.md](WEBSITE_COPY_BRIEF.md)** — implement from
there, not from this summary. Status: **✅ complete (2026-08-28)** — all 17 items in the ordered
TODO below are done, including the final QA pass. Core shift: PayBridge must stop reading like a
second payroll system — it works around an employer's existing payroll, and employees keep their
existing bank.

**Structural conflicts found while grounding the brief against the live code** (resolved — kept
here as a record of the reasoning, not an open decision):

- **Primary tagline conflict — resolved (2026-08-28), no design change needed.** Re-audited where
  the illustrated lockup (`Logo` with `withTagline`, the SVG geometry that actually spells out
  "From payroll to prosperity" in vector rules) is used sitewide: only `components/sections/
  Manifesto.tsx` (the homepage's closing section, after every other section including the CTA
  build-up — its own comment already calls it "the closing beat of the page") and `pages/Brand.tsx`
  (the internal brand style-guide page, not public marketing). Every header/nav/footer usage across
  the whole app (`Navbar.tsx`, `Footer.tsx`, `DashboardShell.tsx`, `AuthLayout.tsx`, all portal
  shells, etc.) already renders the plain `<Logo />` with no tagline. The Hero already leads with
  "Financial wellbeing, built around work." (`Hero.tsx`'s `SectionLabel`), and `index.html`'s
  title/meta description/OG/Twitter tags lead with "You Work Every Day. Why Wait Until Payday?" —
  none of the public-facing lead surfaces use the old tagline. So structurally this was already
  secondary use, not primary; no vector-art redesign was required. The one place still worth fixing
  was non-visual: `public/site.webmanifest`'s `description` field (shown in PWA install prompts/app
  switchers) and its generator `scripts/build-brand.mjs` both still had `"From payroll to
  prosperity."` as the summary line — updated both to `"Financial wellbeing, built around work."`
  so they match the new lead line. `lib/brand.ts`'s `TAGLINE`/`TAGLINE_LOCKUP` constants, the
  `Tagline.tsx` footer component, and the JSON-LD `slogan` field in `index.html` were left as-is —
  a footer line and a schema.org `slogan` field are exactly what "secondary expression" describes,
  not the lead promise.
- **Pillar naming mismatch — resolved (2026-08-11).** User decided: renamed
  `components/sections/BeyondBridge.tsx`'s pillars Bridge/Build/Grow → Access/Save/Invest and
  added a fourth Learn tile. See item 9-11 below for detail.
- **Hero CTA conflicts with "don't lead with a waitlist CTA."** `components/sections/Hero.tsx`
  currently has one CTA ("Get on the Bridge", `hero_cta_click`) which registers interest — the
  brief wants two: "For Employees" / "For Employers".

**Terminology already live in code that the brief requires removing (public-facing only — the
in-app "Bridge ₦X" transaction label stays):**

- "Bridgers" as a public audience label: `pages/register/EmployeeRegistration.tsx:60,89` (also
  the `bridgers@getpaybridge.com` inbox address — flag for a call on whether to keep the alias
  even after the public label changes), `components/admin/StatTiles.tsx:17`,
  `pages/Privacy.tsx:29`, `components/registration/SegmentChooser.tsx:21`,
  `components/sections/Footer.tsx:148`, `pages/Contact.tsx:84`.
- "No documents" claim: `pages/register/EmployerRegistration.tsx:86`,
  `components/registration/SegmentChooser.tsx:104` ("no documents, no credit checks, no
  commitment") — replace with "Simple digital onboarding" per brief §12.

**Ordered TODO (brief section → target):**

1. ✅ Homepage hero copy + two-CTA split (brief §1, 2026-08-10) — `components/sections/Hero.tsx`:
   eyebrow is now "Financial wellbeing, built around work.", headline "Life does not always wait
   for payday.", body copy matches the brief verbatim, added the "For employees"/"For employers"
   audience statement pair, and split the single CTA into "For Employees" (→
   `/get-on-the-bridge/employee`) / "For Employers" (→ `/employers`) — both routes already
   existed. New analytics events `hero_employee_cta_click`/`hero_employer_cta_click` added in
   `lib/analytics.ts`, replacing the old single `hero_cta_click` on this button (still used
   elsewhere, kept in the type). Typecheck passes.
2. ✅ New "One payroll. No duplicate work." employer section (brief §2, 2026-08-10) — net-new
   `components/sections/OnePayroll.tsx`, copy matches the brief verbatim including the "designed
   to" hedge, wired into `pages/Index.tsx` right after `BeyondBridge` (pillars → employer
   objection, matching the brief's desired flow order). Typecheck passes.
3. ✅ New 4-step "How PayBridge fits into payroll" section (brief §3, 2026-08-11) — net-new
   `components/sections/PayrollFit.tsx`, modeled on the existing `HowItWorks.tsx` timeline
   pattern (mobile vertical / desktop horizontal, final step marked as the outcome), wired into
   `pages/Index.tsx` right after `OnePayroll`. Typecheck passes.
4. ✅ New "Your PayBridge Account" product section (brief §4, 2026-08-11) — net-new
   `components/sections/PayBridgeAccount.tsx`, copy matches the brief verbatim (capabilities list
   and a "you do not have to abandon your existing bank" callout), wired into `pages/Index.tsx`
   right after `PayrollFit`. Typecheck passes.
5. ✅ Access product copy (brief §5, 2026-08-11) — `components/sections/BridgeIt.tsx` was already
   the Access pitch section ("bridge it"); updated headline to "Access what you have earned.
   Responsibly.", body to the brief's wording, added the "subject to" list and the explicit
   "Access is available only to eligible employees whose employer participates…" sentence so the
   section stops implying universal/automatic access. Kept the existing Earned/Responsible/
   Protected principle cards — they reinforce rather than conflict with the brief. Typecheck
   passes.
6. ✅ Remove "Bridgers" as a public audience label (brief §6, 2026-08-11) —
   `pages/register/EmployeeRegistration.tsx`, `pages/register/EmployerRegistration.tsx` (a second
   "Bridge Partners" instance turned up here that the original grep missed),
   `components/admin/StatTiles.tsx`, `pages/Privacy.tsx`,
   `components/registration/SegmentChooser.tsx`, `components/sections/Footer.tsx`,
   `pages/Contact.tsx`. All now say Employees / Employers / Capital Partners. Judgment call: used
   the term "Capital Partners" (already established elsewhere in-app — route `/capital-partners`,
   `capital_partner` key) rather than introducing the brief's literal "Funding Partners", to avoid
   a second, competing name for the same audience. The `bridgers@getpaybridge.com` mailbox itself
   was left unchanged (it's a real configured address in `backend/src/email/identities.ts` and
   `backend/.env.example` — renaming a live mail alias is an infra decision, not a copy edit); only
   its visible label text changed. In-app "Bridge ₦X" transaction language is untouched, per the
   brief. Typecheck passes.
7. ✅ New HR privacy section (brief §7, 2026-08-11) — net-new `components/sections/HrPrivacy.tsx`,
   a two-column "employers receive only what's needed for" vs. "always stays private" comparison,
   wired into `pages/Index.tsx` right after `EmployerStory`. Deliberately does not say "your
   employer sees nothing" per the brief. Distinct from the existing `Trust.tsx` section, which is
   about product-mechanism trust (responsible-lending principles, security programme link), not
   employer visibility — left that section untouched. Typecheck passes.
8. ✅ Employer admin copy (brief §8, 2026-08-11) — `components/sections/EmployerStory.tsx`: added
   a callout ("PayBridge does not require HR to approve every employee request." + the
   pre-agreed-parameters/risk-controls supporting copy) between the existing "informal lending
   desk" line and the CTA row. Typecheck passes.
9. ✅ Save copy (brief §9, 2026-08-11) — no fixed-return claims. Resolved together with the
   pillar-naming conflict below.
10. ✅ Invest copy (brief §10, 2026-08-11) — doesn't imply PayBridge is the fund manager. Resolved
    together with the pillar-naming conflict below.
11. ✅ Learn copy (brief §11, 2026-08-11) — resolved together with the pillar-naming conflict below.

   **Pillar-naming conflict resolved (user decision, 2026-08-11):** renamed
   `components/sections/BeyondBridge.tsx`'s three pillars Bridge/Build/Grow → **Access/Save/
   Invest**, and added a fourth **Learn** tile (new `GraduationCap` icon, `--protected` colour —
   deliberately not `--primary-deep`, which the section's own design comment already rules out on
   this dark background). Tile bodies now carry the brief's §9/§10/§11 substance, condensed to
   fit the existing card format: Save mentions regulated partners, not a fixed return; Invest
   attributes regulation to "appropriately regulated providers," not PayBridge itself; Learn
   frames education around real employee decisions rather than generic "financial literacy."
   Updated the section headline's first line ("Bridge today" → "Access today") so it doesn't
   contradict the renamed pillars; kept "Build tomorrow" as ordinary prose (not a pillar name
   reference). Typecheck passes.
12. ✅ Replace "No documents" language (brief §12, 2026-08-11) — done, mostly as a side effect of
    item 6: `pages/register/EmployerRegistration.tsx`'s "No documents yet" card is now "Simple
    digital onboarding" with a verification-happens-later line;
    `components/registration/SegmentChooser.tsx`'s "no documents, no credit checks, no commitment"
    reworded. Fresh sitewide grep for "no documents" (2026-08-11) turned up two more matches, both
    reviewed and left as-is because they're unrelated functional empty-states, not onboarding
    claims: `components/admin/portal/kyc/KycCaseDetail.tsx:144` ("No documents uploaded yet." —
    an admin KYC case view saying a specific applicant hasn't uploaded anything) and
    `pages/investor/Statements.tsx:122` ("No documents in this view" — a statements-list empty
    state). Also checked `components/registration/fields.tsx`'s `NoDocumentsNotice` component —
    its *name* contains the phrase but its rendered copy is already honest/hedged ("verification
    happens later... once your employer activates PayBridge"); nothing user-facing to change.
13. ✅ Demote "From payroll to prosperity" to secondary use only (brief §13, 2026-08-28) — see the
    resolved tagline conflict above. No design/logomark change was needed; the illustrated lockup
    was already confined to secondary placements. Fixed the one non-visual place it still read as
    the lead line (`public/site.webmanifest` + its generator). Typecheck passes.
14. ✅ Employer value prop as four explicit benefits (brief §14, 2026-08-11) — net-new
    `components/sections/EmployerBenefits.tsx`, the brief's exact four benefits as icon cards,
    wired into `pages/Index.tsx` right after `BeyondBridge` and before the sections that dive
    deeper into each one (`OnePayroll`, `PayrollFit`, `PayBridgeAccount`, `EmployerStory`,
    `HrPrivacy`), so it reads as the overview those sections then unpack. Typecheck passes.
15. ✅ Sitewide scrub for forbidden claims (2026-08-11) — grepped `webapp/src` for 18%/fixed
    returns, "works with every payroll provider," "automatically deducts/sweeps," "employer
    cannot see," and "no credit assessment." Found and fixed one real violation:
    `i18n/catalogs/en.ts:93` and the matching Pidgin string in `i18n/catalogs/pcm.ts:93` — the
    `bridge.employer_cannot_see` translation key said "Your employer cannot see that you did
    this, or how much you asked for," the exact forbidden claim, word for word. Reworded to match
    `HrPrivacy.tsx`'s framing ("only sees what's needed to settle and reconcile payroll — not why
    you used this or how you spent it"). Note: nothing in the current UI code calls this
    translation key yet (only the two catalog files reference it), so this was latent, not live —
    worth fixing now regardless, before whatever surfaces it ships. Everything else that matched
    was reviewed and is already compliant or out of scope: `models.ts`/`mock-data.ts` already
    hedge return language ("indicative only, never presented as guaranteed"), `Terms.tsx`
    explicitly disclaims guaranteed returns, `operations/Portfolios.tsx`'s "expected return" is an
    internal ops table-column caption, and `AccessibilityBrief.tsx`'s "employer cannot see this
    panel" is a true architectural comment about a support-preferences feature with no employer
    endpoint, not a public claim. Typecheck passes.
16. ✅ Reorder homepage section flow (brief §16, 2026-08-11) — `webapp/src/pages/Index.tsx` now
    reads: Hero → PaydayGap → WhoItServes → BeyondBridge → EmployerBenefits → OnePayroll →
    PayBridgeAccount → BridgeIt → HowItWorks → PayrollFit → EmployerStory → HrPrivacy → Manifesto
    → Trust → GetOnTheBridgeSection → Faqs. Maps directly to the brief's 11 beats (brand/core
    proposition → pillars → employer objection → PayBridge Account → employee journey → employer
    journey → privacy → CTA), with two judgment calls for the sections the brief's beat list
    doesn't name: `WhoItServes` (audience overview) placed early, right after `PaydayGap`, as
    orientation before the product detail starts rather than duplicating the segmented picker
    that's already the final CTA (`GetOnTheBridgeSection`); `BridgeIt` (the Access product
    deep-dive, brief §5, done in item 5) placed right after `PayBridgeAccount` and before
    `HowItWorks`, grouped with the other employee-facing content rather than treated as a separate
    beat. `Manifesto`/`Trust`/`GetOnTheBridgeSection`/`Faqs` were already in roughly the right
    closing position and were left alone — `Manifesto` in particular is explicitly commented in
    its own source as "the closing beat of the page" for the full tagline lockup, which is exactly
    the item 13 tagline conflict still on hold. Nav anchor links (`#why`, `#how`, `#who`, `#trust`,
    `#faqs`) scroll by ID and don't depend on document order, so the reorder doesn't break them.
    Typecheck passes.
17. ✅ Final QA (2026-08-28): confirm the five core messages (brief "The five things a visitor must
    understand within two minutes") are legible on the homepage. Content/order audit (no browser
    available in this session, per the environment note in §5a-adjacent tooling — verified by
    reading rendered section copy and `pages/Index.tsx`'s section order, not a live click-through):
    all five are stated explicitly, and four of the five are already in the Hero's first fold —
    (1) "employer-enabled" platform → Hero's `SectionLabel` ("Financial wellbeing, built around
    work.") plus the "Employer-enabled · Verified earnings · Approved limits apply" microcopy line;
    (2) access part of verified earned income when eligible → Hero body copy verbatim; (3)
    employers shouldn't run another payroll → Hero's "For employers" callout ("One payroll process,
    less salary-advance administration...") and unpacked further in `OnePayroll.tsx`; (4) employees
    keep their existing bank → Hero's "For employees" callout ("...without abandoning your existing
    bank") and unpacked further in `PayBridgeAccount.tsx`; (5) PayBridge extends beyond Access into
    Save/Invest/Learn → `BeyondBridge.tsx`'s four pillar tiles, the 4th section on the page. No
    message requires scrolling past `BeyondBridge` to first encounter, well inside a two-minute
    read. Worth a real click-through next time the app is run, to confirm visual hierarchy (not
    just copy presence) reads the same way — this pass covers copy, not layout/rendering.

### Engineering dependencies this copy update exposes

Cross-checked the finished copy work above against the rest of this file (§1-7) for places where
the public site now promises something the backend doesn't do yet. Two kinds of finding: places
copy is ahead of engineering (needs to stay honest/hedged until the gap closes), and one place
copy is already fully backed by real code.

1. **`components/sections/PayBridgeAccount.tsx` vs. no bank rail (§2 "Savings"/"Investments";
   §3 "Funds disbursed"/"Repayment completed"; §6 punch-list item 8).** The section claims every
   verified user "can receive a dedicated account... through our regulated banking infrastructure"
   that funds savings/investments and supports Access settlement. Per §2, Savings and Investments
   are explicitly ledger-only today — "no bank rail exists... a deposit/withdrawal is a
   self-reported bookkeeping entry... not money PayBridge moved" — and per §3, "Funds disbursed" /
   "Repayment completed" are both ❌ not built anywhere in the codebase (no Plaid/Paystack/
   Flutterwave/Mono/Okra/Stripe/ACH integration exists). The copy itself is correctly hedged
   ("can be used to," "where activated," never "is" or "does") so it doesn't violate the brief's
   hard rules as written — but it is now the de facto public spec for the account feature. When
   Disbursement/Repayment eventually comes off deferral (§6 item 8 — still gated on "a real
   payment/banking integration decision first... a product conversation"), that build should be
   checked against this exact copy rather than re-deriving requirements from scratch. Not
   something to build now; flagging the dependency is the scope of this note.

2. **`components/sections/OnePayroll.tsx` / `PayrollFit.tsx` vs. Repayments (§2 "Repayments" ❌;
   §3 "Payroll deduction" ❌, "Repayment completed" ❌; §6 punch-list item 8).** These sections
   promise PayBridge is "being designed to automate eligibility, settlement and reconciliation
   within agreed employer rules," and the 4-step walkthrough ends with "the remaining salary can
   be transferred to the employee's nominated everyday bank account." Per §2, "No route reconciles
   a payroll deduction against a Bridge balance" — `employer/Repayments.tsx` and
   `operations/Reconciliation.tsx` are still mock-service backed. Same shape as item 1: correctly
   hedged copy ("designed to," "can be"), same underlying gap (Disbursement/Repayment, §6 item 8),
   same recommendation — build against this copy when that work is unblocked, don't build it now.

3. **`components/sections/HrPrivacy.tsx` vs. the same settlement/reconciliation gap.** The
   "employers receive only what's needed for eligibility, payroll settlement, reconciliation,
   programme administration" list names two things (payroll settlement, reconciliation) that
   don't operationally exist yet, for the same reason as items 1-2. This one carries less risk
   than 1-2 — it's phrased as a privacy *boundary* ("only what's needed for X"), not a claim that X
   is happening today — but it's the same dependency, worth tracking alongside the other two so
   all three get re-verified together once Disbursement/Repayment ships.

**For contrast — a claim that's already fully backed by shipped code, no dependency:**
`components/sections/EmployerStory.tsx`'s new callout, "PayBridge does not require HR to approve
every employee request," is not aspirational. Per §2 ("Bridge Engine"), the engine already
"decides instantly and deterministically — no per-draw manual review," built and wired
2026-08-02. Included here so the pattern above reads as "copy ahead of engineering in these three
specific, hedged places," not "the whole employer story is unbuilt."

**Lower-priority, no action needed:** the `StatTiles.tsx` Bridgers→Employees rename (item 6 above)
touched the real, live admin console, not a mock page, so it carries no dependency risk. None of
today's new sections have test coverage, but that's the pre-existing repo-wide gap (§6 item 11:
`risk.test.ts` is still the only test file), not something this update made worse.

## 9. Employer Portal demo — Salary Account workflow (mock, 2026-08-12)

A separate brief ("PayBridge Employer Portal — Demo Update Brief") asked for a demo showing
employers they have two payroll participation options: keep their existing payroll and use a
"PayBridge Salary Account" for participating employees (Option A), or run payroll fully through
PayBridge (Option B). Explicitly scoped by the brief itself as demo/mock work — "do not implement
real bank APIs... use realistic demo states and mock data" — so this targets the **mock**
`webapp/src/pages/employer/*` dashboard (`mock-service.ts`/`mock-data.ts`), not the real,
Postgres-backed `/employer-portal/*` built earlier in §2/§8. That scoping was confirmed with the
user before building (a real fork in the road, same category of decision as the pillar-naming
call in §8).

**Built, all typecheck + lint clean:**

- `lib/platform/models.ts` — new `PayrollModel` type + `Employer.payrollModel`/
  `eligibleEmployees`/`salaryAccountsActive` fields; new `SalaryAccountRequest` type. Documented
  as a **deliberate, narrow exception** to this file's existing "EMPLOYEE FINANCIAL PRIVACY —
  no bank details" rule: masked (last-4) account numbers only, nothing else about an employee's
  PayBridge activity attached. `EmployerOverview.salaryAccountsPending` added for the dashboard
  metric.
- `lib/platform/mock-data.ts` — demo employer gets `payrollModel: "existing_payroll"` (the
  default/recommended option) and `salaryAccountsActive: 68`; 12 seeded `SalaryAccountRequest`
  rows (8 `pending_review`, matching the brief's dashboard figure exactly, plus a few
  active/rejected/suspended for table variety).
- `lib/platform/mock-service.ts` — `employerApi.salaryAccountRequests`, `.salaryAccountRequest`,
  `.decideSalaryAccountRequest` (approve moves straight to `active` per the brief's own worked
  example in its item 7, not through an intermediate `approved` state), `.setPayrollModel`.
- `components/employer/PayrollSetupCard.tsx` — the two-option card (brief item 1), wired into
  `pages/employer/Overview.tsx` alongside a new 8-metric `StatGrid` (item 10: Workforce, Eligible,
  Access Activated, Exposure, Salary Accounts Pending/Active, Next Payroll, Action Required — the
  last linking straight to the requests queue when non-zero) and a standalone "Employee financial
  privacy" panel (item 11, copy matches the brief verbatim).
- `pages/employer/SalaryAccountRequests.tsx` (new route `/employer/salary-account-requests`) —
  the requests table (item 2) plus the 6-stage "Existing Payroll Model" flow diagram (item 8).
- `pages/employer/SalaryAccountRequestReview.tsx` (new route
  `/employer/salary-account-requests/:id`) — combines items 3-7: the review screen, the employee's
  authorization text + consent metadata, the Employer Protection Notice (with a visible "Subject
  to Legal Review" tag, per the brief's own engineering note), the approve/reject confirm modal
  (approve gated on an explicit "I confirm I am authorised..." checkbox), and the post-approval
  "Salary Account Updated" confirmation state ending in "One payroll. Nothing else changes."
- `pages/employer/PayBridgePayroll.tsx` (new route `/employer/paybridge-payroll`) — Option B (item
  9), explicitly labeled **Optional** with an `InfoNote`, and a "switch back" action so nothing is
  one-way in the demo.
- `components/dashboard/navigation.ts` — new "Payroll Setup" sidebar section linking both new
  routes; Salary Account Requests gated on `employer.employees.manage` (same permission as the
  existing Employees page — the `employer_hr` role already holds it, matching the brief's own "HR
  reviews the request" narrative), PayBridge Payroll gated on `employer.settings.manage`
  (`employer_admin` only — switching the whole payroll model is a bigger call than approving one
  request).

**Deviated from the brief's literal text in one place, deliberately:** the brief's own review-
screen example shows a full unmasked account number ("Account Number: 0123456789"); everywhere in
this build shows only masked last-4 digits, consistent with how every other bank account in this
codebase is displayed (`BankAccount.accountNumberMasked`) and with standard data-minimization
practice. Judgment call, not asked before making it — low-risk, doesn't change any functional
requirement.

**Not done — items 12/13/14/15 of the brief are narrative/rules/constraints, not build items**
(the demo script, the "do not build real X" list, language rules, the core demo message) — nothing
to build for those, they're guidance the built screens above already follow.

## 10. Employee demo dashboard — Account, Refer, Save-to-Bridge, Credit score (mock, 2026-08-20)

A brief asked for four additions to the employee side of the demo: a per-employee PayBridge
account, a referral system, the ability to Bridge 50% of savings held 30+ days, and a credit
score. Scoped to the **mock** `webapp/src/pages/employee/*` dashboard (`mock-service.ts`/
`mock-data.ts`), same as §9 — the real `/account` page (§2) is untouched. A fifth item, "employee
can register directly" (self-serve signup bypassing the invite-code gate), was explicitly
descoped by the user rather than built — the demo stays invite-only.

**Built, all typecheck + lint clean:**

- `lib/platform/models.ts` — new `PayBridgeAccount` (bankName/accountNumber/accountName) and
  `Referral`/`ReferralStatus` types; `Employee` gained `payBridgeAccount`, `creditScore` (300-850,
  a demo-internal score, deliberately separate from the existing `wellbeingScore`), and
  `referralCode`; `SavingsGoal` gained `startedAt` (when 30-day Bridge eligibility starts
  counting).
- `lib/platform/mock-data.ts` — every seeded employee gets a deterministic PayBridge account
  number (`004` + 7 digits) and referral code; the demo employee's account is `PayBridge MFB ·
  0040594321 · Adaeze Okonkwo` (matches the brief's own example format). New `referrals` export
  (3 seeded rows, 2 Joined + 1 Invited) and `startedAt` on the 3 seeded savings goals (2 past the
  30-day mark, 1 not yet).
- `lib/platform/mock-service.ts` — `savingsBridgeEligible(goal)` (exported helper: 50% of balance
  once `daysBetween(startedAt, now) >= 30`, else 0), `employeeApi.bridgeFromSavings` (fee-free,
  instant `BridgeRequest` sourced from a savings goal — does not touch payroll-based
  `accrual.availableToBridge`, a deliberately separate lane), `employeeApi.referrals` /
  `.sendReferral`.
- UI: "Your PayBridge Account" panel on `Overview.tsx` (dashboard home, includes credit score) and
  `Profile.tsx`, both with copy-to-clipboard on the account number, following the existing
  Bridge.tsx reference-copy pattern. Credit score also gets a full `StatCard` + band
  (Excellent/Good/Fair/Building) on `Grow.tsx`, next to the existing wellbeing score — labeled
  "PayBridge internal score" to avoid implying a bureau-reported score. New `pages/employee/
  Refer.tsx` (route `/employee/refer`, nav item "Refer & Earn" under "Your money") — referral code
  with copy, an invite form (name + email), and a list of past referrals with reward earned.
  `Savings.tsx` — each goal panel now shows "Eligible to Bridge" and, when eligible, a "Bridge from
  savings" button opening a dedicated modal capped at the 50% figure.
- `components/dashboard/StatusBadge.tsx` — added `Invited`/`Joined` tones (neutral/positive) to
  the shared status-color map, matching the pattern already used for every other status in the
  app rather than a one-off badge in the new page.
- `components/employee/AIAssistWidget.tsx` (2026-08-21 follow-up) — floating "AI Assist" button on
  `Overview.tsx`, opening a `Modal` that suggests saving part of `remainingAvailable` (unused
  earned pay) and projects interest at 3/6/12 months using whichever open savings product's real
  `ratePct` the chosen amount qualifies for. Explicitly documented in the component's own comment
  as rules-based, not a live AI call — everything shown is computed from the employee's own
  overview numbers and the existing product rates, same honesty bar as `Savings.tsx`, with the
  same "illustrative, not a guaranteed return" disclosure the products already carry.

## 11. Operations demo dashboard — real "Live data" tabs (2026-08-28)

Started rewiring the three remaining mock dashboards (employer, investor, operations — the last
item on the standing punch list) to their real counterparts, operations first per user decision.

**The blocker that shaped this, and how it was resolved.** `/operations/*` is reachable through
the exact same instant demo login (`signInAsDemo`, `RequireDemoAccess`) that prospects use for the
employer/investor walkthroughs — there is no separate "this viewer is real staff" boundary. Wiring
the mock pages straight to `/api/admin/*` would have meant any demo guest could see real
registrant PII and real KYC submissions (confirmed live in the database — this app is pre-launch
for money but not for personal data; see §5's live-environment notes). The user's explicit call:
**keep the demo fully functional for prospects, and add real data on top rather than replacing
mock data with it.**

**What was built.** A new `components/operations/LiveModeTabs.tsx` splits each rewired page into
two tabs: **Demo data** (the existing mock content, byte-for-byte unchanged, still the default tab
so the prospect walkthrough is untouched) and **Live data**, which wraps the real page behind
`components/admin/AdminSessionGate.tsx` — the exact inline staff-login gate `operations/
DemoAccess.tsx` already used for issuing demo invitations, reused here for viewing data instead.
No new auth system was built: the legacy env-admin login behind that gate is treated server-side
(`backend/src/security/staff-session.ts`) as a break-glass Super Admin session, so it already
satisfies every `requireAdminPermission()` check the real routes below make.

Rather than reshape real API responses into each mock page's bespoke table/column config, the Live
tab renders the **actual real admin page component** from `pages/admin/portal/*` directly — those
already share the same `@/components/dashboard/*` design system the mock pages use, so they drop
in without a visual seam:

| Mock page | Live tab renders | Real route it mirrors |
|---|---|---|
| `operations/Support.tsx` | `admin/portal/SupportRequests.tsx` | `/admin/support`, `admin-support.ts` |
| `operations/Risk.tsx` | `admin/portal/CreditRisk.tsx` | `/admin/risk`, `admin-risk.ts` |
| `operations/Employers.tsx` | `admin/portal/CreditRisk.tsx` (same page — the real employer list with limits/tiers lives there, not in a separate real "Employers" screen) | `/admin/risk` |
| `operations/Settings.tsx` | `admin/portal/AuditLogs.tsx`, swapped in for just the audit-log `DataTable` at the bottom of the page — the fee/automation/internal-access panels above it stay mock (§ decision below) | `/admin/audit`, `admin-audit.ts` |
| `operations/Reports.tsx` | `admin/portal/Reports.tsx` | `/admin/reports`, `admin-reports.ts` |

All five typecheck and lint clean (`npx tsc --noEmit -p tsconfig.app.json`, `eslint`).

**Left on mock data, deliberately, this round:** `operations/Employees.tsx`, `Investors.tsx`,
`Transactions.tsx`, `Funding.tsx`, `Portfolios.tsx`, `PayrollOps.tsx`, `Reconciliation.tsx`,
`Compliance.tsx`, and the non-audit parts of `Settings.tsx` (service fee, auto-disburse/auto-match
toggles, "invite a colleague"). None of these has a real backend concept to attach to yet — per
the user's earlier decision for no-backend pages, they stay mock and are not being visually
relabeled as demo-only in this pass (worth a follow-up: right now the Live/Demo tab pattern above
makes those five wired pages look more "real" than these untouched ones, with no visual cue
distinguishing "no live tab exists" from "live tab not yet implemented"). `Reconciliation.tsx` and
the payroll-deduction side of `Repayments.tsx` (employer tree) remain hard-blocked on the deferred
Disbursement/Repayment work (§6 item 8).

**Not done, worth a real click-through:** no browser was available in this session to click into
each Live tab and complete a real staff sign-in end-to-end — verified by typecheck/lint only.

### Employer dashboard batch (2026-08-28, same session)

Same pattern, different gate: the mock `/employer/*` pages don't sit behind a staff session — the
real data behind them belongs to one company's own account (`EmployerUser`/`Employer`, a separate
session cookie from admin staff — see `lib/employer/session.ts`, `backend/src/security/
employer-session.ts`). So rather than reuse `AdminSessionGate`, this batch adds its own sibling
pair: `components/employer/EmployerCredentialsForm.tsx` (inline email/password + optional TOTP,
mirroring `AdminCredentialsForm.tsx` but calling `useEmployerLogin()`) and `components/employer/
EmployerSessionGate.tsx` (mirrors `AdminSessionGate.tsx`, gated on `useEmployerSession()` instead
of the admin one), plus a sibling `components/employer/LiveModeTabs.tsx` (identical shape to the
operations one, just wired to the employer gate — kept as a separate small file rather than a
shared generic component, matching the existing pattern of one gate component per session domain).

| Mock page | Live tab renders | Real route it mirrors |
|---|---|---|
| `employer/SalaryAccountRequests.tsx` | `employer-portal/SalaryAccountRequests.tsx` | `/employer-portal/salary-account-requests` |
| `employer/SalaryAccountRequestReview.tsx` | `employer-portal/SalaryAccountRequestReview.tsx` (same `:id` route param name in both trees, so `useParams` resolves correctly when the real component is rendered inside the mock route) | `/employer-portal/salary-account-requests/:id` |
| `employer/Payroll.tsx` | `employer-portal/Payroll.tsx` | `/employer-portal/payroll` |
| `employer/Employees.tsx` | `employer-portal/Payroll.tsx` (same page — the real roster with `eligible`/`kycApproved` flags lives inside the real Payroll page, not a separate real "Employees" screen; same reasoning as pointing the ops mock Employers page at the real CreditRisk page) | `/employer-portal/payroll` |

All four typecheck and lint clean. Left mock this round, same "no real backend concept" reasoning
as operations: `payroll/CommandCentre.tsx`, `payroll/Exceptions.tsx`, `payroll/Integrations.tsx`,
`payroll/Records.tsx`, `PayBridgePayroll.tsx`, `SalaryBuffer.tsx`, `BridgeActivity.tsx` (real data
exists but is staff-only today, not employer-facing — would need a new employer-scoped endpoint),
`Repayments.tsx` (hard-blocked on deferred Disbursement/Repayment), `Reports.tsx`, `Settings.tsx`.

### Investor demo dashboard batch (2026-08-28, same session) — C is now fully addressed

Weakest of the three, as flagged going in: there is no separate real investor portal or login at
all. Real investing is one panel (`InvestmentSection`, previously a private function inside
`pages/account/AccountHome.tsx`, now exported from there) rendered on the real `/account` page for
`accountType === "investor"` customers — same real customer session `/account` itself uses
(`lib/account/session.ts`), not a new one.

Added a third gate sibling, `components/investor/InvestorSessionGate.tsx` (+ `InvestorCredentialsForm.tsx`,
`LiveModeTabs.tsx`), with one extra check the admin/employer gates don't need: real investing needs
both `accountType === "investor"` AND `gate === "active"` (verified + KYC approved) before
`/api/investments/*` does anything — signing in with a non-investor or still-verifying real account
now shows an honest explanation ("not a capital-partner account" / "not yet active") instead of an
empty or erroring panel.

| Mock page | Live tab renders | Real route it mirrors |
|---|---|---|
| `investor/Overview.tsx` | `InvestmentSection` (real portfolio snapshot + commitment list) | `/account`'s Investments panel |
| `investor/Invest.tsx` | `InvestmentSection` (same panel — the real commit flow is one amount field, not the mock's mandate/portfolio picker) | `/account`'s Investments panel |
| `investor/Withdrawals.tsx` | `InvestmentSection` (2026-08-28 — the real "Withdraw" action per commitment IS the real withdrawal flow; there is no separate real withdrawal request/review step to mirror) | `/account`'s Investments panel |
| `investor/Transactions.tsx` | `InvestmentSection` (2026-08-28 — the real commitment list IS the real transaction history; no separate real ledger exists) | `/account`'s Investments panel |

Both typecheck and lint clean. Left mock, deliberately, same as the employer/ops batches — no real
backend exists for any of it: `Performance.tsx` (no yield/return model — explicit non-goal per §2
Investments), `Statements.tsx` (no statement generator), `Documents.tsx`
(no investor KYB flow), `Profile.tsx` (no investor-specific profile endpoint).

**With this batch, all three items C named — employer, investor, operations — have at least one
real "Live data" slice landed**, each following the same Demo/Live tab pattern with a gate matched
to who actually owns that data (staff session for operations, company session for employer, customer
session for investor). What's left in each portal is left because no real backend concept exists yet
for it, not because the wiring pattern doesn't reach it — see the per-batch "left on mock" lists
above for the full remaining list, and §6 item 8 (Disbursement/Repayment) for the biggest shared
blocker (Repayments, Reconciliation, Funding, SalaryBuffer).

**Not done, worth a real click-through:** no browser was available in this session for any of the
three batches — everything above was verified by `tsc --noEmit` + `eslint` only. Sign in through
each Live tab with a real staff/employer/customer account next time the app is run against Neon.

**Naming:** every screen calls it "PayBridge Account" per the brand rule in the project's
CLAUDE.md (never "virtual account"/"virtual salary wallet" in user-facing copy) — the user's own
request used "virtual account" only as a description of the feature, not as label text.

**Verification note:** this session had no browser available to click through the pages — verified
by `npx tsc --noEmit -p tsconfig.app.json` (the root `tsconfig.json` is a project-reference shell
with `"files": []` and checks nothing on its own — use `tsconfig.app.json` directly) and `eslint`
on every touched file. Both clean for this work; `tsc` reports 7 pre-existing errors elsewhere in
the codebase (`TwoFactorPanel.tsx`, `CreditRisk.tsx`, `Reports.tsx`, `employer-portal/Home.tsx`,
`employer-portal/Payroll.tsx`, one `makeReference()` call in `mock-data.ts`) that predate this
session and were not touched by it. Worth a real click-through next time the app is run, and worth
fixing that pre-existing baseline separately.
