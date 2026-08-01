import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { requestId } from "hono/request-id";
import { timeout } from "hono/timeout";
import "./env";
import { sampleRouter } from "./routes/sample";
import { waitlistRouter } from "./routes/waitlist";
import { registrationsRouter } from "./routes/registrations";
import { authRouter } from "./routes/auth";
import { employerRouter } from "./routes/employer";
import { adminRouter } from "./routes/admin";
import { adminAuthRouter } from "./routes/admin-auth";
import { invitationsRouter } from "./routes/admin-invitations";
import { auditRouter } from "./routes/admin-audit";
import { adminUsersRouter } from "./routes/admin-users";
import { supportAdminRouter } from "./routes/admin-support";
import { adminKycRouter } from "./routes/admin-kyc";
import { preferencesRouter } from "./routes/preferences";
import { consentsRouter } from "./routes/consents";
import { supportRouter } from "./routes/support";
import { demoRouter } from "./routes/demo";
import { logMailPosture } from "./email/mailer";
import { securityHeaders } from "./security/headers";
import { csrfProtection } from "./security/csrf";
import { rateLimit } from "./security/rate-limit";
import { isAllowedOrigin, isProduction } from "./security/config";
import { accessLog, audit } from "./security/audit";
import { SESSION_COOKIE_NAME } from "./security/session";
import { ADMIN_COOKIE, DEMO_COOKIE } from "./security/staff-session";
import { EMPLOYER_SESSION_COOKIE } from "./security/employer-session";

const app = new Hono();

/*
 * Middleware ORDER is itself a security decision. Read top to bottom:
 * headers → request id → access log → body limit → timeout → CORS → rate limit
 * → CSRF → routes. Cheap rejections happen before expensive work, and the
 * security headers are attached even to responses produced by a middleware that
 * short-circuits (a 429 or a 403 must still be nosniff/no-store).
 */

// 1. Security headers on every response, including errors and rejections.
app.use("*", securityHeaders());

// 2. Correlation id. WHY: an audit trail you cannot join to an access log is
//    half an investigation. Also echoed to the client so support can quote it
//    without the user having to describe what they clicked.
app.use("*", requestId());

// 3. Redacting access log (replaces hono's logger(), which prints query strings
//    — see security/audit.ts for why that matters).
app.use("*", async (c, next) => {
  const started = Date.now();
  await next();
  accessLog({
    method: c.req.method,
    path: new URL(c.req.url).pathname, // pathname only: never the query string
    status: c.res.status,
    ms: Date.now() - started,
    requestId: c.get("requestId"),
  });
});

// 4. Request body cap: 256 KB for JSON, 10 MB for the one upload route.
//    WHY: an unbounded JSON body is a free denial-of-service — one request can
//    exhaust memory before any validation runs. 256 KB is far above any legit
//    JSON payload here.
//    WHY the exception is a path allowlist rather than raising the global cap:
//    exactly one endpoint accepts a file (KYC document upload), so exactly one
//    endpoint gets the larger budget. Raising the global limit would hand every
//    unauthenticated JSON route a 10 MB allowance it has no use for.
const UPLOAD_PATHS = ["/api/auth/kyc/documents"];
const tightBodyLimit = bodyLimit({
  maxSize: 256 * 1024,
  onError: (c) =>
    c.json({ error: { message: "Request body too large.", code: "PAYLOAD_TOO_LARGE" } }, 413),
});
// 10 MB, not 8: the route itself enforces the real 8 MB file cap, and multipart
// framing plus the other form fields add overhead. The transport limit has to sit
// above the business limit or a legitimate 8 MB file is rejected as too large
// with the wrong error.
const uploadBodyLimit = bodyLimit({
  maxSize: 10 * 1024 * 1024,
  onError: (c) =>
    c.json({ error: { message: "That file is too large. Upload 8 MB or less.", code: "PAYLOAD_TOO_LARGE" } }, 413),
});
app.use("*", async (c, next) => {
  const handler = UPLOAD_PATHS.includes(new URL(c.req.url).pathname) ? uploadBodyLimit : tightBodyLimit;
  return handler(c, next);
});

// 5. Hard request timeout. WHY: slow requests and hung upstream calls otherwise
//    pin a connection indefinitely, which is a cheap denial-of-service.
app.use("*", timeout(15_000));

// 6. CORS — echo the specific allowed origin, never "*".
//    WHY not "*": browsers refuse wildcard with credentials, and even where they
//    did not, it would let any site read authenticated payroll responses. The
//    method/header allowlists are explicit so nothing new is accepted by
//    accident; maxAge cuts preflight chatter.
app.use(
  "*",
  cors({
    origin: (origin) => (isAllowedOrigin(origin) ? origin : null),
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "X-CSRF-Token", "X-Requested-With"],
    exposeHeaders: ["X-Request-Id", "RateLimit-Limit", "RateLimit-Remaining", "Retry-After"],
    credentials: true,
    maxAge: 600,
  }),
);

// 7. Global rate limit — a coarse ceiling so no single client can flood the API.
//    Per-route limits (much tighter) are applied inside the routers.
app.use("*", rateLimit({ name: "global", limit: 300, windowMs: 60_000 }));

// 8. CSRF: origin pinning on every unsafe method + double-submit token once a
//    session cookie is present.
//    All three session families are named here: the customer session, the admin
//    dashboard session and the private-demo session. Leaving the admin cookie
//    out would exempt the highest-privilege surface from the token check.
app.use(
  "*",
  csrfProtection({ cookieNames: [SESSION_COOKIE_NAME, ADMIN_COOKIE, DEMO_COOKIE, EMPLOYER_SESSION_COOKIE] }),
);

// Health check. Deliberately returns nothing about versions, build, git sha,
// database status or uptime — a health endpoint is the first thing scanned, and
// every extra field is free reconnaissance.
app.get("/health", (c) => c.json({ status: "ok" }));

// Routes
app.route("/api/sample", sampleRouter);
app.route("/api/waitlist", waitlistRouter);
// Public, unauthenticated: the four segmented registration forms.
app.route("/api/registrations", registrationsRouter);
// Public customer accounts: register, sign in, verify contact details, KYC.
// This is the only one of the three access routes that belongs in the main
// navigation. It cannot reach the admin portal or the private demonstration.
app.route("/api/auth", authRouter);
// A company's own multi-seat login — separate session, separate cookie, from
// the individual customer accounts above. See routes/employer.ts.
app.route("/api/employer", employerRouter);
// Session-gated: how PayBridge should behave for one person. Functional
// preferences only, keyed by the session's own user id, with no employer-facing
// counterpart anywhere in the service.
app.route("/api/preferences", preferencesRouter);
// Reading the wording is public; accepting it needs a session. Terms that can
// only be read after you have agreed to them are not terms, so GET answers
// anonymously and POST /accept is the gated half.
app.route("/api/consents", consentsRouter);
// Deliberately reachable WITHOUT a session on the create path: the people who
// most need to reach a human are the ones who cannot sign in. Reading is
// strictly the caller's own tickets.
app.route("/api/support", supportRouter);
// Non-public. Both routers gate themselves; nothing is readable without a
// staff session, and the demo router answers 404 rather than 403 so the
// surface is not discoverable by probing.
//
// Mounted BEFORE /api/admin so the database-backed administrator endpoints own
// /api/admin/auth/*, leaving the legacy environment-credential login in
// adminRouter as a documented break-glass path.
app.route("/api/admin/auth", adminAuthRouter);
// Likewise ahead of /api/admin: the code-based invitation manager owns
// /api/admin/invitations. The link-based predecessor has been removed.
app.route("/api/admin/invitations", invitationsRouter);
// Also ahead of /api/admin: the read-only audit-trail reader. It owns
// /api/admin/audit and contains no write route at all.
app.route("/api/admin/audit", auditRouter);
// And ahead of /api/admin: administrator management (create, change role,
// suspend, reissue a temporary password). Super-admin only, enforced per call.
app.route("/api/admin/admins", adminUsersRouter);
// And ahead of /api/admin: the support desk. Reads are logged as well as
// writes, and the ticket shape it returns has nowhere to put a financial field.
app.route("/api/admin/support", supportAdminRouter);
// And ahead of /api/admin: KYC review. Decrypted identity fields are returned
// only from this router, one case at a time, each read logged.
app.route("/api/admin/kyc", adminKycRouter);
app.route("/api/admin", adminRouter);
app.route("/api/demo", demoRouter);

// 404 in the standard envelope — no route listing, no framework fingerprint.
app.notFound((c) => c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404));

/*
 * Central error handler.
 *
 * WHY: an unhandled throw renders a stack trace by default. Stack traces
 * disclose absolute file paths, dependency versions, ORM internals and
 * sometimes the failing query with parameter values. That is textbook sensitive
 * data exposure and the fastest way for an attacker to map the codebase. The
 * full error goes to our logs, where it belongs; the client gets a request id it
 * can quote to support, and nothing else.
 */
app.onError((err, c) => {
  const rid = c.get("requestId");
  console.error(
    JSON.stringify({
      type: "error",
      at: new Date().toISOString(),
      requestId: rid,
      path: new URL(c.req.url).pathname,
      message: err instanceof Error ? err.message : String(err),
      stack: isProduction ? undefined : err instanceof Error ? err.stack : undefined,
    }),
  );
  audit({
    action: "request.error",
    actor: "system",
    outcome: "failure",
    target: new URL(c.req.url).pathname,
    requestId: rid,
  });
  return c.json(
    { error: { message: "Something went wrong. Please try again.", code: "INTERNAL_ERROR", requestId: rid } },
    500,
  );
});

// Print which mail transport is live and which credentials are PRESENT (never
// their values). WHY at boot: a misconfigured mailer is otherwise invisible —
// registrations keep succeeding and nobody notices the confirmations stopped.
logMailPosture();

const port = Number(process.env.PORT) || 3000;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(JSON.stringify({ type: "listening", port: info.port }));
});
