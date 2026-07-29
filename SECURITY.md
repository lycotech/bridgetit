# PayBridge — Security Audit & Hardening Report

**Reviewer:** Lead Security Architect
**Date:** 25 July 2026
**Scope:** Full application — every page, component, API route, authentication flow,
session mechanism, database interaction and file-upload path.
**Framework:** OWASP Top 10 (2021) + OWASP ASVS L2 expectations for a financial product.

---

## 0. The one thing to read if you read nothing else

**PayBridge's authenticated product is currently a front-end prototype.** Sign-in, roles,
portals, payroll, Bridge availability, investor balances and operations tooling all run
from mock data inside the browser. The backend exposes exactly two routes (`/api/waitlist`,
`/api/sample`) and the database holds exactly one table (`WaitlistEntry`).

This single fact determines the risk rating of almost everything below. **A control that
lives only in the browser is a user-experience feature, not a security control.** Anyone
can open developer tools and change what the browser believes. Every guard in
`RequireAuth`, every role check, every "employers must not see employee Bridge activity"
rule is — today — advisory.

That is *acceptable for a prototype* and *catastrophic if shipped*. So this report does two
things:

1. **Hardens everything that can be hardened now** — the real backend, the real database,
   the transport layer, the browser's own defences, and the client-side flows so they fail
   safely rather than fail open.
2. **Names precisely what must be built server-side before real money or real payroll data
   touches this system**, and leaves the enforcement scaffolding (`requireSession`,
   `requirePermission`, `requireOwnership`, `requireMfa`) in place so that work is wiring,
   not design.

---

## 1. Risk posture

| | Before | After | Notes |
|---|---|---|---|
| **Critical** | 3 | 1 | The remaining one is architectural and cannot be closed by code alone |
| **High** | 13 | 0 | All closed |
| **Medium** | 9 | 3 | Remaining three are accepted with documented reasoning |
| **Dependency CVEs (webapp)** | 34 (19 high) | 6 (3 high) | All 6 remaining are build/dev-time only |
| **Dependency CVEs (backend)** | 40 (6 high) | 36 (5 high) | Our own Hono is patched; the rest are vendor-pinned transitives |

**Current overall risk: HIGH** — driven entirely by finding **C-1**. Once server-side
authorisation exists, the same codebase sits at **Low–Medium**.

---

## 2. Findings

Every finding is stated as: **Risk → Business Impact → Likelihood → Recommended Fix → Priority**,
followed by *why* the chosen fix is the right one.

---

### 🔴 CRITICAL

---

#### C-1 · Authentication and authorisation are enforced only in the browser

**Status: OPEN — architectural. Scaffolding delivered; server-side enforcement is the next build.**

**Risk.** There is no server-side session, no protected API, and no server-side ownership
check. Roles (`employee`, `employer_admin`, `ops_admin`, `investor`, …) are decided by
client-side code reading client-side state. An attacker edits one value in browser storage
and becomes an operations administrator. Broken Access Control is OWASP #1 for a reason:
it is the most common serious flaw and it requires no technical skill to exploit.

**Business Impact.** Total. Privilege escalation into the operations portal exposes every
employer, every employee, funding positions and reconciliation. It breaks the product's
single most important promise — that **employers cannot see which employee has used Bridge,
how much, or how often**. That promise is currently enforced by *not rendering* the data,
which is the weakest possible enforcement: the moment those figures come from a real API,
"don't render it" stops being privacy and starts being decoration. Regulatory exposure
under NDPA/GDPR for a payroll processor is direct and personal.

**Likelihood.** *Certain* the moment real data exists. This is not an exotic attack; it is
right-click → Inspect.

**Recommended Fix.**
1. Move authentication server-side. `backend/src/security/session.ts` already issues
   HMAC-SHA256-signed, HttpOnly, `__Host-`-prefixed cookies with absolute (12h) and idle
   (30m) expiry.
2. Put `requireSession()` + `requirePermission()` on every future `/api` route
   (`backend/src/security/auth.ts`). The permission matrix is already written in
   `backend/src/security/rbac.ts`.
3. **Filter privacy-sensitive fields in the SQL/Prisma query, not in the response mapper
   and never in the UI.** An employer's payroll query must be structurally incapable of
   returning per-employee Bridge amounts. If the field never enters the result set, no
   future refactor can leak it.
4. Use `requireOwnership()` for any record addressed by an ID in the URL.

**Priority: P0 — blocks production launch.**

> **Why this design.** Three deliberate choices.
> **(a) Deny-by-default RBAC.** `hasPermission` returns false for anything not explicitly
> granted. A permission model built on exclusions silently grants every capability added
> later; one built on inclusions fails closed when someone forgets to update it. Forgetting
> should cost you a bug report, not a breach.
> **(b) `requireOwnership` returns 404, not 403.** A 403 confirms the record exists —
> that is an enumeration oracle. An attacker walking `/api/employees/1..10000` learns your
> customer count from the status codes alone. 404 tells them nothing.
> **(c) MFA is tracked per session, not per user.** A `user.mfaEnabled` flag says the user
> *can* do MFA; it does not say *this browser did*. Checking the wrong one is how step-up
> authentication gets bypassed by an attacker riding a stolen pre-MFA session.

---

#### C-2 · Live API key committed to the git repository

**Status: PARTIALLY CLOSED — code side fixed; the key itself must be rotated by the owner.**

**Risk.** `backend/.env` and `backend/.env.production` are tracked by git and contain a real
`OPENAI_API_KEY`. Neither `.gitignore` excluded them. Secrets in version control are OWASP
A07 and the most reliably exploited class of finding in the wild — automated scanners find
committed keys within minutes of a repository becoming public.

**Business Impact.** Direct financial loss (API billing is uncapped by default), and the
key is a foothold: whatever that account can reach, the finder can reach. If the repository
is ever made public, shared with a contractor, or pushed to a mirror, this is already spent.

**Likelihood.** *High.* It only takes one clone.

**Recommended Fix.**
1. ✅ **Done:** `.env`, `.env.*`, `*.pem`, `*.key`, `*.db`, `audit.log` added to
   `backend/.gitignore` and `webapp/.gitignore`, with `!.env.example` kept tracked.
2. ✅ **Done:** `.env.example` files rewritten as documentation with placeholders only.
3. ⚠️ **Owner action — I cannot and must not do these for you:**
   - **Rotate the OpenAI key now.** Assume it is compromised. `.gitignore` does not remove
     anything from history; the key is still in every past commit and in every clone.
   - Untrack the files (`git rm --cached backend/.env backend/.env.production webapp/.env
     webapp/.env.production`) and, if the repo was ever shared, purge history.
   - Move real values into **Render's environment variable dashboard** (see `backend/render.yaml`),
     which keeps them out of the repo entirely.

**Priority: P0 — rotate today.**

> **Why the code refuses to paper over this.** `backend/src/env.ts` validates secrets at
> boot and **exits** if `SESSION_SECRET` or `LOG_SALT` are missing in production. It prints
> the variable *name* and the *rule*, never the value — echoing the offending value into an
> error is exactly how secrets end up in CI logs, which are usually more widely readable
> than the secret store they came from. And there is deliberately **no default signing key**:
> a default signing key is a *published* signing key, and anyone reading the source could
> then forge an administrator session offline, with no network attack and nothing in the logs.

---

#### C-3 · One-click demo role switching could ship to production

**Status: CLOSED.**

**Risk.** The demo panel signs a user straight into any portal — including employer and
operations — with no credentials. In a production build this is a complete, unauthenticated
administrative bypass, reachable by anyone who finds the button.

**Business Impact.** Equivalent to publishing an admin password. Total compromise of every
portal, plus the reputational damage of the bypass being trivially reproducible.

**Likelihood.** *High* — demo affordances are the single most commonly forgotten thing in a
launch checklist, precisely because they are useful right up until the day they aren't.

**Fix applied.** `signInAsDemo()` now throws unless `DEMO_LOGIN_ENABLED` — automatically true
in development, and false in a production build unless `VITE_ENABLE_DEMO_LOGIN=true` is set
deliberately.

**Priority: P0 — done.**

> **Why gate in code rather than "remember to delete it".** A checklist item is a promise;
> a build-time flag is a mechanism. The default is the secure state, so shipping insecurely
> now requires someone to *take an action* and type the flag. Security that depends on
> remembering is security that fails on the busiest day.

---

### 🟠 HIGH — all closed

---

#### H-1 · No CSRF protection on state-changing requests

**Risk.** Any website could make a logged-in user's browser POST to the PayBridge API.
Cookies ride along automatically; the attacker never sees the response but the *action*
succeeds — which is all that matters when the action is "request a Bridge" or "approve payroll".

**Business Impact.** Unauthorised money movement and payroll approval, triggered by a victim
merely visiting a page. Attributable to the victim in the logs, which makes disputes ugly.

**Likelihood.** *High* once authenticated write endpoints exist. CSRF is cheap to attempt and
invisible to the victim.

**Fix applied.** `backend/src/security/csrf.ts` — two independent layers on every unsafe method:
1. **Origin/Referer pinning** against the shared allowlist. A request with **no** Origin
   header on an unsafe method is treated as hostile, not as unknown.
2. **Double-submit token** — `X-CSRF-Token` must match the `pb_csrf` cookie, enforced
   whenever a session cookie is present. The webapp attaches it automatically (`src/lib/api.ts`).

**Priority: P1 — done.**

> **Why both, and why "no Origin" is hostile.** SameSite=Lax already blocks most cross-site
> POSTs, but it is a *browser* behaviour: it does not exist in older clients, and it does not
> cover every navigation shape. Defence in depth means the control still holds when one layer
> is absent. Treating a missing Origin as hostile is the counter-intuitive part — the instinct
> is to be lenient — but "absent" is exactly what an attacker produces when they strip the
> header, so leniency there is a bypass. Every legitimate browser sends Origin on unsafe methods.
> **Why one shared origin list.** CORS and CSRF read the *same* array in
> `backend/src/security/config.ts`. When they are configured separately they drift, and a
> permissive CORS entry silently re-opens CSRF months later. One list cannot disagree with itself.
> **Why the regexes are anchored.** An unanchored `vibecode\.dev` matches
> `https://vibecode.dev.evil.com`. Verified rejected.

---

#### H-2 · Session state was unsigned, plain-text, and permanent

**Risk.** The session was a JSON blob in `localStorage`. The `role` field was editable by
hand. It never expired. It persisted after the browser closed, on any device.

**Business Impact.** Self-promotion to any role (see C-1); indefinite access from a shared
or stolen device long after the user believed they were done.

**Likelihood.** *High.* Editing a storage value requires no tools beyond the browser.

**Fix applied.** `webapp/src/lib/security/session-store.ts` — checksum-fingerprinted records,
12h absolute + 30m idle expiry, **`sessionStorage` by default** with `localStorage` used only
on an explicit "remember me", cross-tab change detection, and fail-closed loading (any
mismatch or expiry wipes the session rather than degrading).

**Priority: P1 — done.**

> **Why the fingerprint is honestly labelled tamper-*evident*, not tamper-*proof*.** The
> checksum algorithm ships in the bundle, so a determined attacker can recompute it. It is
> a speed bump against casual editing and an integrity check against corruption — nothing
> more. Calling it "encryption" would be the dangerous move, because it would invite someone
> to trust it later. **Browser storage cannot be made trustworthy; only the server can.**
> **Why sessionStorage by default.** Persistence should be a choice the user makes, not one
> the developer makes for them. On a shared laptop, `localStorage` means the next person
> gets the account.
> **Why both an absolute and an idle timeout.** Idle-only means an attacker who keeps a
> stolen session warm holds it forever. Absolute-only means a genuinely abandoned session
> stays live for its full window. Real products need both, and 12h/30m matches what a
> payroll operator does in a working day.

---

#### H-3 · Session fixation — the session ID never changed

**Risk.** The same identifier survived sign-in, OTP verification and role change. An attacker
who plants or observes an ID before authentication still holds a valid one afterwards.

**Business Impact.** Account takeover with no credential theft; the attacker's session simply
inherits the victim's privileges the moment the victim logs in.

**Likelihood.** *Medium* — needs a pre-auth foothold, but this is a textbook, well-tooled attack.

**Fix applied.** A new session ID is minted on every sign-in, on OTP verification, and on any
role change (`startSession`, `updateSessionUser`). `rotateSession()` does the same server-side.

**Priority: P1 — done.**

> **Why rotate on *privilege change* too, not just login.** Fixation is really about a
> *privilege boundary*, and login is only the most famous one. Any moment where the same
> identifier carries more authority than it did a second ago is the same bug wearing a
> different hat.

---

#### H-4 · Open redirect in the `next` parameter

**Risk.** `Login.tsx` and `Verify.tsx` accepted any `?next=` value that started with `/`.
`//evil.example` starts with `/` — and browsers read it as a protocol-relative URL to another
site. `/\evil.example` behaves the same way in several browsers.

**Business Impact.** A phishing link on the *real* PayBridge domain that lands on an attacker's
pixel-perfect "session expired" page. The victim has already verified the domain — that is the
entire defence users are taught, and this defeats it. For a financial brand this is credential
theft with your name on the envelope.

**Likelihood.** *High.* Open redirects are actively harvested for phishing campaigns.

**Fix applied.** `webapp/src/lib/security/safe-redirect.ts` — `safeNextPath()` strips control
characters, rejects `//` and backslash forms, then **resolves the candidate with the URL parser
and keeps it only if the resulting origin equals ours**. `safeHref()` does the same for
user-supplied links, allowing only `http`/`https`/`mailto`/`tel`.

**Priority: P1 — done.**

> **Why parse instead of pattern-match.** Every hand-written redirect validator loses to the
> URL grammar eventually — `//`, `/\`, `\/`, `%2f%2f`, tabs and newlines inside the scheme,
> userinfo tricks like `https://evil.example#@ours.example`. Rather than enumerate the tricks,
> we hand the string to the same parser the browser uses and compare the answer. If the parser
> and the browser agree on the origin, there is no gap left to exploit.

---

#### H-5 · No Content Security Policy

**Risk.** Nothing constrained what scripts could run or where data could be sent. Any XSS —
from a future code change, a `dangerouslySetInnerHTML`, or a compromised npm package — would
execute with full privileges and could exfiltrate freely.

**Business Impact.** Session theft, silent transaction manipulation, mass payroll data
exfiltration. In a bundle with 19 high-severity transitive CVEs, "we have no XSS today" is a
statement about today only.

**Likelihood.** *Medium* today, *High* over the product's life. Supply-chain injection does not
require anyone on the team to make a mistake.

**Fix applied.** `webapp/vite-csp-plugin.ts` injects a policy that **hashes our inline scripts
at build time**, so production runs `script-src 'self' 'sha256-…'` with no `'unsafe-inline'`
and no `'unsafe-eval'`. Verified in the built output. `webapp/public/_headers` carries the
directives a `<meta>` tag legally cannot.

**Priority: P1 — done.**

> **Why hashes rather than `'unsafe-inline'`.** The JSON-LD SEO block is inline, and the lazy
> fix is to allow all inline script — which disables the directive's entire purpose. Hashing
> keeps the block working while an injected `<script>` still cannot run. The hash is computed
> from the built HTML, so it can never drift from the content.
> **Why `style-src 'unsafe-inline'` is kept — a documented compromise.** Removing it breaks
> the product: the shadcn chart component injects a `<style>` element at runtime, Radix
> positions popovers via inline styles, and Framer Motion animates through the style attribute.
> Hashes cannot cover styles generated at runtime. Accepted residual risk: CSS-based
> exfiltration and UI redressing — both far below script execution, and both requiring an
> injection point `script-src` would already have to have permitted. A CSP that breaks the
> app gets switched off; a CSP with one honest exception stays on.
> **Why `connect-src` matters as much as `script-src`.** It is the *exfiltration* control. Even
> if script somehow runs, it cannot POST the payroll data it just read to an attacker's collector.
> **Why `base-uri 'none'`.** An injected `<base href="https://evil.example/">` silently
> re-points every relative script URL on the page. It is the most commonly forgotten directive
> and it defeats an otherwise-correct `script-src`.
> **Why dev and production policies differ.** Vite's HMR client needs `'unsafe-inline'` and
> `'unsafe-eval'`. Applying the strict policy in dev would either break hot reload or — worse —
> train the team to disable CSP. The dev server serves the relaxed policy so violations still
> surface early, and the build ships the strict one.

---

#### H-6 · Clickjacking — no framing restrictions

**Risk.** Any site could iframe PayBridge invisibly over its own buttons and harvest a click
on "Approve and Process Payroll" or a Bridge request. The victim is authenticated, so the
action succeeds.

**Business Impact.** Unauthorised payroll approval or fund movement performed by a real user
who believed they clicked something else. Indistinguishable from a legitimate action in the logs.

**Likelihood.** *Medium.* Cheap to build, and money-moving dashboards are the classic target.

**Fix applied.** Backend: `frame-ancestors 'none'` + `X-Frame-Options: DENY` (safe — the API
serves no HTML). Webapp: `webapp/public/_headers` sets `frame-ancestors 'self'` plus the
Vibecode preview domains.

**Priority: P1 — done.**

> **Why the webapp is not `'none'`.** The Vibecode preview renders the app inside an iframe on
> a Vibecode domain — `'none'` would break the owner's ability to see their own product. The
> allowlist is the tightest policy that keeps the preview working, and the file records the
> pre-launch action: reduce to `frame-ancestors 'self'`.
> **Why `X-Frame-Options` is deliberately absent from the webapp.** It can only express DENY
> or SAMEORIGIN — it cannot express a cross-origin allowlist. Adding SAMEORIGIN would break the
> preview on older browsers that prefer it over CSP. It goes back in when the policy tightens.
> **Why headers and not a JavaScript frame-buster.** Frame-busting scripts are defeated by
> `sandbox` on the iframe. The header is enforced by the browser before a line of our code runs.

---

#### H-7 · No rate limiting anywhere

**Risk.** Unlimited requests to every endpoint: credential stuffing against sign-in, brute
force against the 6-digit OTP (one million combinations is minutes at machine speed), waitlist
spam, and trivial resource exhaustion.

**Business Impact.** Account takeover at scale, a waitlist database poisoned with fabricated
demand (which then misleads investor reporting), and uncapped infrastructure cost.

**Likelihood.** *High.* Credential-stuffing tooling is commodity.

**Fix applied.** `backend/src/security/rate-limit.ts` — sliding-window limiter: 300 req/min
globally, 5 per 10 minutes on the waitlist. Returns `429` with `Retry-After` and `RateLimit-*`
headers. Verified live. Client-side, `webapp/src/lib/security/attempt-guard.ts` adds
exponential backoff (30s doubling to 15m) and a 30-minute lock after 10 failures.

**Priority: P1 — done.**

> **Why sliding window rather than fixed buckets.** A fixed window lets an attacker send the
> full quota at 11:59:59 and again at 12:00:00 — double the intended rate at the boundary,
> exactly where a tuned attack aims.
> **Why the client IP is derived carefully.** `clientKey()` takes the **left-most** entry of
> `X-Forwarded-For`, then `cf-connecting-ip`, then `x-real-ip`, then the socket address.
> `X-Forwarded-For` is attacker-controlled; naively trusting the right-most or the whole
> string lets someone rotate a header value and get a fresh quota per request — a rate limiter
> that can be reset on demand is theatre.
> **Stated limitation:** the store is in-memory and per-process. It is correct for one instance
> and must move to Redis before horizontal scaling, or each replica grants a full quota. This is
> documented in the module rather than left as a surprise.

---

#### H-8 · Weak password policy

**Risk.** Any password of six or more characters was accepted. "password", "paybridge",
"123456" all passed.

**Business Impact.** Account takeover by guessing. For an employer administrator, that is
access to an entire company's payroll.

**Likelihood.** *High.* Weak passwords are the first thing tried and the most often successful.

**Fix applied.** `webapp/src/lib/security/password-policy.ts` — 12-character minimum, a
blocklist of common and PayBridge-specific guesses (`paybridge`, `payroll`, `naira`, `lagos`),
keyboard-run detection, low-variety detection, and rejection of passwords derived from the
user's own name or email. `PasswordStrength.tsx` shows live feedback and submission is blocked
until the password passes.

**Priority: P1 — done.**

> **Why length and unpredictability, not a character-class checklist (NIST SP 800-63B).**
> "One uppercase, one number, one symbol" reliably produces `Password1!` — it satisfies the
> rule and is in every cracking dictionary. Composition rules measure compliance, not strength.
> A four-word passphrase is easier to remember and vastly harder to guess.
> **Why blocklist the product's own vocabulary.** Users of a Nigerian payroll product choose
> Nigerian payroll words. Generic lists miss the words most likely to be chosen *here*.
> **Why reject name- and email-derived passwords.** They are the first mutations any targeted
> attack tries, and they are the passwords users pick under time pressure.
> **Why show the meter live rather than reject on submit.** A policy discovered only after
> failing is a policy users work around. Moving feedback before the commitment is the
> difference between raising real-world strength and just annoying people into predictable patterns.

---

#### H-9 · Unrestricted file upload

**Risk.** The dropzone accepted anything. Its only filter was the HTML `accept` attribute —
a file-picker *hint*, bypassed entirely by drag-and-drop, by "All files" in the OS dialog, and
by any scripted call. The UI advertised "up to 10MB" while nothing enforced a size at all.

**Business Impact.** This dropzone takes payroll files, buffer documents and KYC evidence —
the three highest-value ingestion points in the platform. Concretely: malware relay (an `.exe`
renamed `payroll.csv`, later downloaded by an operations reviewer who trusts the source —
**we become the distribution channel**); stored XSS via an uploaded `.html` or `.svg` served
back from our own origin; oversize DoS; and path traversal through crafted filenames.

**Likelihood.** *Medium-High.* Upload endpoints are probed automatically.

**Fix applied.** `webapp/src/lib/security/file-upload.ts` — extension **allowlist** plus a
belt-and-braces denylist, declared-MIME consistency check, filename sanitisation (directory
components, control characters, traversal sequences), and per-file (10MB) / per-batch (40MB,
10 files) caps. Wired into **both** the drop and picker paths in `forms.tsx`, with rejected
files listed and the reason shown.

**Priority: P1 — done (client side).**

> **Why an allowlist, never a denylist.** A denylist must predict every dangerous extension —
> `.phtml`, `.cshtml`, `.svgz`, whatever is invented next — and will always be one entry behind.
> **Why SVG is blocked despite being an image.** SVG is XML and can carry `<script>`. It is the
> image format people forget, and it is a reliable stored-XSS vector when served from your own origin.
> **Why the MIME check is explicitly labelled non-authoritative.** `file.type` is the browser's
> guess *from the extension* — the attacker controls it. Real verification means reading magic
> bytes server-side. This module does the cheap pass for instant user feedback; **the server must
> repeat every check.** Documenting that boundary is what stops someone later assuming the file
> was validated.
> **Why the filename is sanitised even though we only display it.** It ends up in a storage path,
> a `Content-Disposition` header and a UI label — three separate injection surfaces from one string.

---

#### H-10 · Vulnerable dependency: react-router open redirect → XSS

**Risk.** `react-router-dom` 6.30.2 carried four advisories, including open redirect via
protocol-relative URLs and via backslash (a CVE-2025-68470 bypass) leading to XSS. This is the
same class as H-4, but inside the router where our own validation cannot reach.

**Business Impact.** Phishing and script execution on the PayBridge origin, from a bug we did
not write and could not fix in our code.

**Likelihood.** *Medium.* Publicly disclosed with published exploit paths.

**Fix applied.** Upgraded to **react-router-dom 7.18.1**. Typecheck, lint and production build
all pass; the import surface is a single module and required no code changes.

**Priority: P1 — done.**

> **Why the major upgrade was accepted rather than deferred.** There is no patched v6 —
> 6.30.4 is the last release on that line and remains vulnerable, so "wait for a patch" was
> never an option. The remaining v7 advisory (`GHSA-qwww-vcr4-c8h2`) applies to **RSC mode
> only**; this is a client-rendered SPA with no server components and no router actions, so it
> is not reachable. That is a reasoned exclusion, not a dismissal — recheck it if the app ever
> adopts framework mode.

---

#### H-11 · User enumeration on the waitlist endpoint

**Risk.** The endpoint returned a different status (`already_registered`) for an email already
on file, turning it into an oracle: submit an address, learn whether that person is a PayBridge user.

**Business Impact.** A verified list of PayBridge customers is a targeting list for phishing
that names the real product. It also leaks commercially sensitive information about who is
engaging with PayBridge.

**Likelihood.** *High.* Trivial to script.

**Fix applied.** `backend/src/routes/waitlist.ts` — find, update and create collapse into one
path returning **identical body and identical status code** either way. Verified live.

**Priority: P2 — done.**

> **Why the response had to be byte-identical, not merely similar.** Enumeration works on any
> observable difference — status code, body, header, or timing. Changing the wording while
> keeping two branches leaves the oracle intact. Confirmed unused in the UI before removing it,
> so nothing regressed.

---

#### H-12 · Insecure cookie configuration

**Risk.** No cookie security attributes were set anywhere.

**Business Impact.** Session theft by network interception (no `Secure`) or by any script on
the page (no `HttpOnly`) — turning any XSS into a full account takeover.

**Likelihood.** *High* once cookies carry sessions.

**Fix applied.** `backend/src/security/session.ts` — `HttpOnly`, `Secure`, `SameSite=Lax`,
`Path=/`, no `Domain`, and the **`__Host-` prefix** in production.

**Priority: P1 — done.**

> **Why `__Host-`.** The browser *itself* refuses to accept the cookie unless it is Secure,
> path `/`, and has no Domain attribute. That converts our configuration into a browser-enforced
> invariant — a subdomain (including one taken over by an attacker) cannot overwrite the session
> cookie. It is the only cookie protection that survives a developer later changing the settings.
> **Why `SameSite=Lax` and not `Strict`.** `Strict` drops the cookie on inbound navigation, so a
> user clicking a PayBridge link in email lands logged out. `Lax` blocks cross-site *writes* —
> the attack — while keeping normal navigation working. Combined with the CSRF layer (H-1), the
> gap `Lax` leaves is already covered.
> **Why the CSRF cookie is deliberately readable by JavaScript.** It has to be — the double-submit
> pattern requires the page to read it and echo it in a header. It carries no authority on its own;
> the *session* cookie stays HttpOnly.

---

#### H-13 · Verbose error responses leaking internals

**Risk.** Validation failures returned raw Zod issue objects; the framework logger echoed
request details; unhandled errors could surface stack traces.

**Business Impact.** Free reconnaissance — internal field names, schema structure, library
versions and file paths, all of which shorten an attacker's path to a working exploit.

**Likelihood.** *High.* Error-message mining is step one of any assessment.

**Fix applied.** Validation now returns only a deduplicated list of field names (max 10).
`app.onError` logs the detail server-side with a request ID and returns a generic message,
with stack traces in development only. `X-Powered-By` and `Server` headers are stripped.

**Priority: P2 — done.**

> **Why keep the field names.** Total opacity ("invalid request") makes a form unusable. Field
> names are information the user already has — they filled the form in. Schema internals,
> regexes and library versions are information only an attacker benefits from. The line is drawn
> between the two.
> **Why the request ID.** Support can trace a specific failure through the logs without the
> error response itself carrying anything sensitive.

---

### 🟡 MEDIUM

---

#### M-1 · CSV formula injection in exports · CLOSED

**Risk.** Exported CSV cells starting `=`, `+`, `-` or `@` are executed as formulas by Excel
and Google Sheets. A value like `=cmd|'/c calc'!A0` stored through a form and later exported
runs on the reviewer's machine (CWE-1236).

**Business Impact.** Remote code execution on a finance or operations workstation — the machine
with the most access to payroll and banking. The user did nothing wrong; they opened a report
from their own system.

**Likelihood.** *Medium.* Well known, and the payload survives any amount of input sanitisation
because the vulnerability is in the *consumer*, not in us.

**Fix applied.** `webapp/src/lib/platform/format.ts` — dangerous leading characters are prefixed
with a single quote, and tab/CR are treated as triggers alongside quoting.

> **Why fix at export rather than at input.** The value is legitimate data — a name may genuinely
> begin with `-`. Rejecting it at input breaks real users. The danger only exists in the
> spreadsheet context, so the escape belongs where that context begins. Fix at the boundary
> where the meaning changes.

---

#### M-2 · Log injection and PII in logs · CLOSED

**Risk.** Logs took raw user input. Newlines and carriage returns let an attacker forge log
entries; emails and financial details were written in clear text.

**Business Impact.** A forged log line destroys the evidentiary value of the audit trail during
an incident — exactly when it matters. And logs are routinely shipped to third-party
aggregators with far broader access than the production database, so PII in logs quietly
creates a second, less-protected copy of the customer database.

**Likelihood.** *Medium.*

**Fix applied.** `backend/src/security/audit.ts` — structured JSON lines (no free-text
concatenation), control characters stripped, sensitive keys redacted recursively, and actors
recorded as **salted SHA-256 pseudonyms**.

> **Why pseudonymise rather than omit.** Omitting the actor makes the audit log useless for
> investigation. A salted hash keeps entries *linkable* — the same person is the same pseudonym
> across events, so you can follow a sequence — while staying non-reversible. Unsalted hashing
> would be pointless: anyone with a list of candidate emails could reverse it, and that is everyone.
> **Why JSON lines.** Structured logs cannot be broken by injected delimiters, and they are
> queryable during an incident when time is the scarce resource.

---

#### M-3 · No account lockout · CLOSED (with a stated limitation)

**Fix applied.** `attempt-guard.ts` — free attempts, then exponential backoff to 15 minutes,
then a 30-minute lock after 10 failures, with per-scope decay after an hour.

> **Why the module documents itself as "a speed bump, not the control of record".** It runs in
> the browser, so an attacker scripting the API ignores it entirely. Its real value is stopping
> opportunistic guessing and giving honest users clear feedback. The server-side limiter (H-7)
> is the actual control. Writing that down in the code is the point — the failure mode here is
> not the weak control, it is someone later *believing* it is strong.
> **Why backoff before hard lockout.** A pure lockout is a denial-of-service tool: an attacker
> locks a CFO out of payroll on payday by failing their login ten times. Escalating delay
> defeats automation while leaving a real user a way back in.

---

#### M-4 · MFA not implemented · PARTIALLY ADDRESSED

**Risk.** The OTP screen is cosmetic — the code is not verified against anything.

**Business Impact.** Passwords alone protect payroll approval and fund movement. Credential
stuffing succeeds on the first correct guess.

**Likelihood.** *High* for a financial product.

**Recommended Fix.** Server-side TOTP or WebAuthn, required for `employer_admin` and all
operations roles before any approval or disbursement action.

**What is in place now.** MFA state is carried on the *session* (`mfaSatisfied`), `requireMfa()`
exists and is session-scoped, and `Permissions-Policy` deliberately keeps
`publickey-credentials-get=(self)` enabled so passkeys work when built.

**Priority: P1 — before real money moves.**

> **Why the readiness work was done now.** Retrofitting step-up authentication into a session
> model that has no concept of it is the expensive version of this task. Ten lines today saves
> a refactor later — and, more importantly, prevents the classic bug of checking "this user has
> MFA enabled" instead of "this session completed MFA".

---

#### M-5 · Missing security response headers · CLOSED

`nosniff`, `Referrer-Policy: same-origin`, `Permissions-Policy`, COOP, CORP,
`Origin-Agent-Cluster`, `X-Permitted-Cross-Domain-Policies`, HSTS (production), and `no-store`
on API responses.

> **Why `nosniff` matters here specifically.** Without it the browser may sniff an uploaded file
> served as `text/plain`, decide it is HTML, and execute it — stored XSS that bypasses every
> input filter because the payload never went through one.
> **Why `Referrer-Policy: same-origin` rather than the browser default.** Dashboard URLs contain
> employer and employee identifiers. The default still leaks our origin to third parties. For a
> payroll product the *URL itself* is sensitive data.
> **Why `Cache-Control: no-store` on API responses and on the HTML entry point.** Payroll figures
> cached in a shared proxy can be served to the wrong user, and a cached dashboard means a
> logged-out user can press Back and read it. Hashed JS/CSS assets are still cached for a year —
> their filenames change when their content does, so it is safe and fast.
> **Why middleware order is fixed.** Security headers are applied **first**, so they are present
> even on a 500 or a 429. Rate limiting sits **before** CSRF, so a flood is rejected cheaply
> rather than after signature work. Body limits sit before parsing, so an oversized payload is
> refused before it is read into memory. Ordering *is* the control here.

---

#### M-6 · Remaining dependency CVEs · ACCEPTED, with reasoning

Webapp went from **34 (19 high)** to **6 (3 high)** via upgrades and pinned `overrides`
(postcss, picomatch, minimatch, brace-expansion, js-yaml, flatted, rollup, lodash, ajv).
Backend Hono upgraded 4.6.0 → **4.12.32**.

**What remains, and why it is accepted:**
- **vite / esbuild** — both are **development-server** advisories. They do not exist in the
  production build, which is static HTML, CSS and JS. Closing them requires Vite 7, a major
  version bump not attempted as part of the Bun→Node/SQLite→Postgres migration (2026 — see
  CLAUDE.md migration notes); the former blocker (a Vibecode-only preview plugin without Vite 7
  support) is gone now that `@vibecodeapp/webapp` has been removed, so this is worth revisiting
  as its own change, with its own test pass.
- **brace-expansion** — no fixed version exists yet. Build-time tooling only (eslint, tailwind).
- **react-router** — RSC mode only; not reachable in this app (see H-10).
- **Backend transitives** — `@hono/zod-validator` pins its own older Hono copy. Our application
  runs on the patched Hono release; this is vendor-controlled. (`@vibecodeapp/cloud-studio`,
  the other source of this note, has since been removed entirely — see CLAUDE.md.)

> **Why the report says this out loud instead of quietly reporting "34 → 6".** A number without
> a residual-risk statement reads as "we covered everything". Silent truncation of scope is how
> the next reviewer inherits a false sense of safety.

---

#### M-7 · `VITE_EXAMPLE_SECRET` in the webapp environment · DOCUMENTED

`webapp/.env` and `webapp/.env.production` contain a variable named `..._SECRET`.

**Risk.** Not the value itself — it is a placeholder — but the **naming pattern**. Vite inlines
every `VITE_`-prefixed variable into the public JavaScript bundle. A variable named "secret"
in that file teaches the next developer that secrets can live there. The next one will be real.

**Business Impact.** A published credential, with "view source" as the entire attack.

**Likelihood.** *Medium* — this is exactly how frontend key leaks happen.

**Recommended Fix.** Remove the variable, or rename it so it cannot be mistaken for a secret.
`webapp/.env.example` now opens with a prominent warning explaining that **nothing in that file
is ever secret.**

**Priority: P3.**

---

### ✅ Assessed and found clean

Not every OWASP category produced a finding. These were examined and are genuinely fine —
recorded so a future reviewer knows they were checked rather than skipped.

| Category | Finding |
|---|---|
| **SQL Injection** | **None.** All database access goes through Prisma's query builder, which parameterises. No raw SQL, no `$queryRawUnsafe`, no string-built queries anywhere. |
| **SSRF** | **None.** The backend makes no outbound HTTP requests from user-supplied URLs. There is no URL-fetch, webhook or image-proxy feature. |
| **XSS (stored/reflected)** | **No injection point found.** React escapes interpolated values by default. The one `dangerouslySetInnerHTML` (`components/ui/chart.tsx:70`) is fed from a closed set of internal chart configuration, not user input. CSP (H-5) is the containment layer for future changes. |
| **IDOR** | **Not reachable today** — there are no server-side object lookups. `requireOwnership()` is built and ready for when there are. |
| **Insecure external links** | Both `target="_blank"` links already carry `rel="noopener noreferrer"`. |
| **Password reset enumeration** | `ForgotPassword.tsx` already returns non-committal copy that does not reveal whether an account exists. |

---

## 3. Owner actions I cannot perform

1. **Rotate the OpenAI API key immediately.** It is in git history. `.gitignore` does not
   retroactively remove it, and every existing clone still has it.
2. **Untrack the four committed `.env` files**, and purge history if the repository has ever
   been shared or made public.
3. **Move real values to Render's environment variable dashboard** (backend) **and Vercel's
   project environment variables** (webapp).
4. **Generate and set production secrets** — `SESSION_SECRET` (`openssl rand -base64 48`) and
   `LOG_SALT` (`openssl rand -base64 24`). The backend refuses to start in production without them.

*(Git operations are managed by the platform in this environment, so I have deliberately not
run them. Reporting them is the correct action, not silently attempting them.)*

---

## 4. Pre-production gate

Do not launch with real payroll data until all of these are true:

- [ ] **C-1 closed** — every `/api` route behind `requireSession()` + `requirePermission()`
- [ ] Employer queries **structurally incapable** of returning per-employee Bridge data (filter in the query, not the view)
- [ ] OpenAI key rotated; `.env` files untracked
- [ ] `SESSION_SECRET` and `LOG_SALT` set from a secret manager
- [ ] `NODE_ENV=production` verified in the deployed environment (it gates HSTS, `Secure`, and `__Host-`)
- [ ] MFA enforced for `employer_admin` and all operations roles
- [ ] Server-side file validation (magic bytes, AV scan, storage outside the web root)
- [ ] Rate-limit store moved to Redis before running more than one instance
- [ ] `frame-ancestors` tightened to `'self'`; `X-Frame-Options: SAMEORIGIN` restored
- [ ] `VITE_ENABLE_DEMO_LOGIN` confirmed unset in the production build
- [ ] Audit logs shipped to append-only storage with retention and alerting
- [ ] Independent penetration test

---

## 5. Where the controls live

| Area | File |
|---|---|
| Origin allowlist (shared by CORS + CSRF) | `backend/src/security/config.ts` |
| Rate limiting | `backend/src/security/rate-limit.ts` |
| Audit logging + pseudonymisation | `backend/src/security/audit.ts` |
| Session issue/verify/rotate, CSRF tokens | `backend/src/security/session.ts` |
| Security response headers | `backend/src/security/headers.ts` |
| CSRF enforcement | `backend/src/security/csrf.ts` |
| Roles and permission matrix | `backend/src/security/rbac.ts` |
| Route guards (`requireSession`/`requirePermission`/`requireOwnership`/`requireMfa`) | `backend/src/security/auth.ts` |
| Secret validation at boot | `backend/src/env.ts` |
| Input schemas + control-character rejection | `backend/src/types.ts` |
| Redirect and link safety | `webapp/src/lib/security/safe-redirect.ts` |
| Password policy | `webapp/src/lib/security/password-policy.ts` |
| Login backoff / lockout | `webapp/src/lib/security/attempt-guard.ts` |
| Client session store | `webapp/src/lib/security/session-store.ts` |
| Upload validation | `webapp/src/lib/security/file-upload.ts` |
| Content Security Policy | `webapp/vite-csp-plugin.ts` |
| HTTP security headers (static host) | `webapp/public/_headers` |
| CSRF token + relative-URL enforcement on fetch | `webapp/src/lib/api.ts` |
| CSV export escaping | `webapp/src/lib/platform/format.ts` |

---

## 6. The principle behind all of it

Four ideas decided nearly every choice above.

1. **Fail closed.** Every guard denies by default: unknown permission → denied; corrupt session
   → wiped; missing Origin → rejected; missing secret in production → the process refuses to start.
   An outage is recoverable in minutes. A silent authorisation bypass is discovered by someone else.

2. **Defence in depth, because one layer will be wrong.** CSRF has Origin pinning *and* a token.
   Uploads have an allowlist *and* a denylist. XSS has React escaping *and* CSP. Not because any
   single layer is weak, but because the one that fails is never the one you expected.

3. **Enforce at the right boundary.** CSV escaping belongs at export, not input, because the
   danger begins in the spreadsheet. Authorisation belongs in the database query, not the view,
   because a future refactor changes the view. Ask where the meaning changes, and put the control there.

4. **Be honest in the code about what a control does not do.** The client session fingerprint is
   labelled tamper-*evident*. The upload MIME check is labelled non-authoritative. The lockout is
   labelled a speed bump. The rate limiter documents that it is per-process. **The most dangerous
   security control is one that is weaker than the next developer believes it to be** — and the
   only fix for that is writing the limitation down next to the code.
