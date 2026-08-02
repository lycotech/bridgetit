import { createHash } from "node:crypto";
import { Hono } from "hono";
import type { Context, MiddlewareHandler, Next } from "hono";
import { z } from "zod";
import { prisma } from "../db";
import { rateLimit } from "../security/rate-limit";
import { validate } from "../security/validate";
import { record } from "../security/audit-store";
import {
  clearSession,
  issueSession,
  readSession,
  touchSession,
} from "../security/session";
import {
  burnPasswordTime,
  checkPasswordPolicy,
  hashPassword,
  verifyPassword,
} from "../security/passwords";
import {
  generateOtp,
  hashOtp,
  maskDestination,
  otpMatches,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
} from "../security/codes";
import { encryptField, encryptOptional, decryptField, last4 } from "../security/field-crypto";
import {
  generateTotpSecret,
  totpEnrolmentUri,
  verifyTotp,
  generateRecoveryCodes,
  normaliseRecoveryCode,
} from "../security/totp";
import {
  computeGate,
  GATE_MESSAGES,
  hasFinancialAccess,
  serialiseSessionState,
  type AccountRow,
} from "../security/account-gate";
import { sendMail, TRANSPORT_KIND } from "../email/mailer";
import { isProduction } from "../security/config";
import { verificationCodeEmail } from "../email/templates";
import {
  changeEmailSchema,
  confirmTwoFactorSchema,
  confirmVerificationSchema,
  disableTwoFactorSchema,
  enrolTwoFactorSchema,
  kycSubmissionSchema,
  KYC_DOC_TYPES,
  registerAccountSchema,
  sendVerificationSchema,
  signInSchema,
  type KycDocType,
  type KycStatusView,
  type TwoFactorEnrolmentView,
} from "../types";
import { putKycObject, deleteKycObjects } from "../storage/kyc";

/**
 * Customer accounts: registration, sign-in, contact verification, KYC.
 *
 * This is the PUBLIC authenticated product. It is reachable from the main
 * navigation, and it is deliberately the only one of the three access routes
 * that is. It shares nothing with the demonstration router (which requires an
 * invitation) or the admin router (which is unlisted) beyond the primitives in
 * src/security — no session issued here can reach either.
 *
 * THE CENTRAL RULE, enforced in `requireFinancialAccess` and nowhere else:
 * a customer whose KYC is not approved cannot reach transactions, earned-income
 * features, savings or investments. The gate is computed server-side on every
 * request from the row in the database, not from anything the client sends.
 */

declare module "hono" {
  interface ContextVariableMap {
    /** The re-read customer row, set by `requireUser`. */
    account: AccountRow;
    /** Submitted sign-in email, captured for the per-account rate limiter. */
    loginEmail: string;
  }
}

const authRouter = new Hono();

/* ------------------------------------------------------------ RATE LIMITS */
/*
 * Per-route budgets. Note the two dimensions on sign-in: one bucket per IP and a
 * second keyed on the submitted email. WHY both: an IP-only limit lets a
 * botnet spread a password-spray attack across thousands of addresses at one
 * attempt each, and an email-only limit lets one host enumerate a whole user
 * list at one attempt per account. Neither alone is sufficient.
 */
authRouter.use("/register", rateLimit({ name: "auth:register", limit: 6, windowMs: 60 * 60_000 }));
authRouter.use("/login", rateLimit({ name: "auth:login:ip", limit: 12, windowMs: 15 * 60_000 }));

/*
 * Read the submitted email BEFORE the per-account limiter, so the limiter has a
 * key to work with. Hono caches the parsed body, so the zValidator on the
 * handler still receives it — this does not consume the stream.
 */
authRouter.use("/login", async (c, next) => {
  try {
    const body = (await c.req.json()) as { email?: unknown };
    if (typeof body?.email === "string") c.set("loginEmail", body.email.trim().toLowerCase().slice(0, 200));
  } catch {
    // Malformed body: the validator will produce the error message. Nothing to key on.
  }
  await next();
});

authRouter.use(
  "/login",
  rateLimit({
    name: "auth:login:email",
    limit: 6,
    windowMs: 15 * 60_000,
    keyExtra: (c) => c.get("loginEmail"),
  }),
);
authRouter.use("/verify/send", rateLimit({ name: "auth:verify:send", limit: 5, windowMs: 15 * 60_000 }));
authRouter.use("/verify/confirm", rateLimit({ name: "auth:verify:confirm", limit: 12, windowMs: 15 * 60_000 }));
/*
 * Tighter than verify/send: this endpoint refuses an address that is already
 * registered, which makes it an existence oracle if it can be called freely.
 * Three attempts an hour is enough to fix a typo and useless for probing.
 */
authRouter.use("/email", rateLimit({ name: "auth:email:change", limit: 3, windowMs: 60 * 60_000 }));
authRouter.use("/kyc", rateLimit({ name: "auth:kyc", limit: 20, windowMs: 60 * 60_000 }));
authRouter.use("/kyc/documents", rateLimit({ name: "auth:kyc:docs", limit: 40, windowMs: 60 * 60_000 }));

/* --------------------------------------------------------------- HELPERS */

/** Columns the gate needs. Selected explicitly so a schema addition cannot leak. */
const ACCOUNT_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  accountType: true,
  status: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true,
  kycStatus: true,
  kycSubmittedAt: true,
  kycReviewedAt: true,
  kycRejectionReason: true,
  suspendedReason: true,
  twoFactorEnabledAt: true,
  createdAt: true,
} as const;

function fail(c: Context, status: 400 | 401 | 403 | 404 | 409 | 423 | 429, code: string, message: string) {
  return c.json({ error: { code, message } }, status);
}

/**
 * Authenticated-customer middleware.
 *
 * Re-reads the row on every request instead of trusting the cookie's contents.
 * WHY that cost is accepted: the cookie is signed but self-contained, so it
 * still asserts whatever was true when it was minted. If an administrator
 * suspends an account, the suspension must take effect on the customer's next
 * request — not when their 12-hour session happens to expire. The `sessionEpoch`
 * comparison is what makes "sign out everywhere" real for the same reason.
 */
export function requireUser(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const session = readSession(c);
    if (!session) return fail(c, 401, "UNAUTHENTICATED", "Sign in to continue.");

    const row = await prisma.user.findUnique({
      where: { id: session.sub },
      select: { ...ACCOUNT_SELECT, sessionEpoch: true },
    });

    if (!row) {
      // The account is gone but the cookie is valid: clear it rather than
      // leaving the browser to retry a session that can never work.
      clearSession(c);
      return fail(c, 401, "UNAUTHENTICATED", "Sign in to continue.");
    }

    /*
     * Fail CLOSED on a missing epoch.
     *
     * This previously read `typeof session.epoch === "number" && …`, so a token
     * carrying no epoch skipped the check entirely — and the epoch is the only
     * mechanism that can revoke a self-contained signed cookie. That made "sign
     * out everywhere", "your password changed" and "this account is suspended"
     * silently ineffective against exactly the tokens that lacked the field.
     * Every token minted by this router sets it, so a token without one is
     * either from an older build or malformed: both should end the session.
     */
    if (session.epoch !== row.sessionEpoch) {
      clearSession(c);
      return fail(c, 401, "SESSION_STALE", "Your session has ended. Please sign in again.");
    }

    if (row.status === "suspended" || row.status === "closed") {
      // NOT cleared: the SPA needs a live session to render the suspension
      // screen and the support message. Every other route still refuses.
      c.set("account", row);
      return fail(c, 403, "ACCOUNT_BLOCKED", GATE_MESSAGES[computeGate(row)]);
    }

    c.set("account", row);
    touchSession(c, session);
    await next();
  };
}

/**
 * Gate for regulated functionality. Apply to every route that serves or moves
 * money, earned income, savings or investment data.
 *
 * There is no parameter and no escape hatch: either the customer is approved or
 * the request is refused. Any future "read-only preview for pending users" must
 * be a new, separately reviewed middleware, not a flag on this one.
 */
export function requireFinancialAccess(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const row = c.get("account") as AccountRow | undefined;
    if (!row) return fail(c, 401, "UNAUTHENTICATED", "Sign in to continue.");
    const gate = computeGate(row);
    if (!hasFinancialAccess(gate)) {
      await record(c, {
        action: "user.login.failed",
        outcome: "denied",
        actorType: "user",
        actorId: row.id,
        actorLabel: row.email,
        targetType: "user",
        targetId: row.id,
        detail: { reason: "financial_access_denied", gate, path: c.req.path },
      });
      return fail(c, 403, "KYC_REQUIRED", GATE_MESSAGES[gate]);
    }
    await next();
  };
}

/**
 * Issue and deliver a verification code.
 *
 * Any earlier unconsumed code for the same channel is deleted first, so exactly
 * one code is live at a time. WHY: leaving old codes valid multiplies the
 * guessing surface by however many times the customer pressed "resend", and the
 * per-code attempt cap then protects nothing.
 */
async function issueVerification(
  c: Context,
  user: { id: string; fullName: string; email: string; phone: string | null },
  channel: "email" | "phone",
): Promise<{ destination: string; delivered: boolean; devCode?: string }> {
  const destination = channel === "email" ? user.email : (user.phone ?? "");
  if (!destination) throw new Error("No destination for verification channel");

  const code = generateOtp();

  await prisma.verificationCode.deleteMany({ where: { userId: user.id, channel, consumedAt: null } });
  await prisma.verificationCode.create({
    data: {
      userId: user.id,
      channel,
      destination,
      codeHash: hashOtp(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  let delivered = false;
  if (channel === "email") {
    const built = verificationCodeEmail({
      code,
      recipientName: user.fullName.split(" ")[0] ?? null,
      minutes: Math.round(OTP_TTL_MS / 60_000),
    });
    const outcome = await sendMail({
      to: destination,
      from: built.from,
      subject: built.subject,
      text: built.text,
      html: built.html,
    });
    delivered = outcome.delivered;
  } else {
    /*
     * No SMS provider is configured. The code is generated and stored so the
     * flow is complete and testable, and the operator sees it on stdout via the
     * mail transport's log mode equivalent.
     *
     * This is stated rather than hidden: phone verification is NOT deliverable
     * in this deployment. It is not required to pass the email gate, and the
     * KYC step does not depend on it.
     */
    console.log(
      JSON.stringify({
        type: "sms.not_configured",
        at: new Date().toISOString(),
        channel,
        destination: maskDestination(destination),
        note: "No SMS transport configured — code stored but not delivered.",
      }),
    );
  }

  await record(c, {
    action: "user.verification.sent",
    outcome: "success",
    actorType: "user",
    actorId: user.id,
    actorLabel: user.email,
    targetType: "user",
    targetId: user.id,
    detail: { channel, delivered },
  });

  return { destination, delivered, devCode: undeliverableCode(code) };
}

/**
 * The code itself, returned to the caller ONLY when it cannot be delivered.
 *
 * THE PROBLEM THIS SOLVES: with no mail transport configured, registration is a
 * dead end. The code is generated, hashed with sha256 and stored — and the hash
 * is one-way, so nobody, including an administrator, can recover it. The audit
 * log records `mail.not_configured` and (correctly) not the code. So every new
 * account in this environment gets permanently stuck on the verification screen.
 *
 * THE CONDITIONS, both required:
 *   1. NODE_ENV is not "production".
 *   2. No mail transport is configured (TRANSPORT_KIND === "log").
 *
 * Either one alone is not enough. Condition 2 means the value being returned is
 * one nobody could have received anyway, so nothing is leaked that a working
 * mailbox would not have shown. Condition 1 is the belt to that braces: even if
 * a production deployment were somehow started with mail misconfigured, the code
 * still never crosses the wire. Configuring SMTP_HOST or RESEND_API_KEY turns
 * this off everywhere, immediately.
 *
 * It is returned in the JSON body and NOT written to the log, on purpose: the
 * body reaches only the browser that just made the request, while the log is
 * shipped, aggregated and retained.
 */
function undeliverableCode(code: string): string | undefined {
  if (isProduction) return undefined;
  if (TRANSPORT_KIND !== "log") return undefined;
  return code;
}

/* ============================================================== REGISTER */

authRouter.post("/register", validate("json", registerAccountSchema), async (c) => {
  const input = c.req.valid("json");

  /*
   * Server-side policy check on top of the Zod rule. The Zod schema is shared
   * with the browser and checks shape; `checkPasswordPolicy` additionally
   * rejects a password that contains the customer's own name or email, which
   * needs the other fields and therefore cannot live in the field schema.
   */
  const verdict = checkPasswordPolicy(input.password, { email: input.email, name: input.fullName });
  if (!verdict.ok) return fail(c, 400, "WEAK_PASSWORD", verdict.message ?? "Choose a stronger password.");

  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) {
    /*
     * ACCOUNT ENUMERATION, and the deliberate decision made here.
     *
     * The privacy-preserving answer is to return success and email the existing
     * owner instead. We return a plain 409 anyway, because this is a payroll
     * product where an employer administrator registering a duplicate account
     * needs to know it already exists, and because the email address is
     * discoverable through the marketing registration form regardless — so the
     * silent version buys confidentiality we do not actually have while
     * guaranteeing a stuck user.
     *
     * The cost is accepted and mitigated: registration is rate-limited to 6 per
     * hour per address, so this is not a bulk enumeration oracle.
     */
    await record(c, {
      action: "user.registered",
      outcome: "failure",
      actorType: "anonymous",
      actorLabel: input.email,
      detail: { reason: "duplicate_email" },
    });
    return fail(c, 409, "EMAIL_IN_USE", "An account already exists for that email address. Try signing in.");
  }

  const user = await prisma.user.create({
    data: {
      email: input.email,
      phone: input.phone,
      fullName: input.fullName,
      passwordHash: await hashPassword(input.password),
      accountType: input.accountType,
    },
    select: { ...ACCOUNT_SELECT, sessionEpoch: true },
  });

  await record(c, {
    action: "user.registered",
    outcome: "success",
    actorType: "user",
    actorId: user.id,
    actorLabel: user.email,
    targetType: "user",
    targetId: user.id,
    newStatus: "active",
    detail: { accountType: user.accountType },
  });

  /*
   * A session is issued immediately, but it is a `verify_contact` session: the
   * gate computed from the row grants nothing until the email is confirmed. WHY
   * sign them in at all: the alternative is asking someone to type their new
   * password again before they have verified anything, which loses people at the
   * exact moment they have committed.
   */
  issueSession(c, { id: user.id, role: user.accountType, epoch: user.sessionEpoch });

  const sent = await issueVerification(c, user, "email");

  return c.json(
    {
      data: {
        ...serialiseSessionState(user),
        verification: {
          channel: "email",
          destination: maskDestination(sent.destination),
          delivered: sent.delivered,
          devCode: sent.devCode,
        },
      },
    },
    201,
  );
});

/* ================================================================= LOGIN */

authRouter.post("/login", validate("json", signInSchema), async (c) => {
  const input = c.req.valid("json");

  const row = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      ...ACCOUNT_SELECT,
      passwordHash: true,
      sessionEpoch: true,
      failedLoginCount: true,
      lockedUntil: true,
      twoFactorSecretEnc: true,
      twoFactorBackupCodes: true,
    },
  });

  /*
   * No such account. Spend the same time an argon2id verification costs before
   * answering, so "unknown email" and "wrong password" are indistinguishable by
   * timing. Without this the 400ms difference is trivially measurable and the
   * login endpoint becomes a fast account-existence oracle.
   */
  if (!row) {
    await burnPasswordTime(input.password);
    await record(c, {
      action: "user.login.failed",
      outcome: "failure",
      actorType: "anonymous",
      actorLabel: input.email,
      detail: { reason: "no_such_account" },
    });
    return fail(c, 401, "INVALID_CREDENTIALS", "That email address or password is not correct.");
  }

  /*
   * Lockout after repeated failures, on top of rate limiting.
   *
   * WHY both: the rate limiter is keyed on IP and resets when the window rolls,
   * so a patient attacker gets 6 attempts every 15 minutes indefinitely — about
   * 560 a day against one account. The per-account lockout makes that
   * unprofitable. It is time-boxed rather than permanent because a permanent
   * lock hands any stranger who knows your email address a denial-of-service
   * button on your payroll account.
   */
  if (row.lockedUntil && row.lockedUntil > new Date()) {
    const minutes = Math.max(1, Math.ceil((row.lockedUntil.getTime() - Date.now()) / 60_000));
    await record(c, {
      action: "user.login.locked",
      outcome: "denied",
      actorType: "user",
      actorId: row.id,
      actorLabel: row.email,
      targetType: "user",
      targetId: row.id,
      detail: { minutesRemaining: minutes },
    });
    return fail(
      c,
      423,
      "ACCOUNT_LOCKED",
      /*
       * Do not offer a password reset here: no reset endpoint exists yet, so
       * the old wording sent a locked-out customer looking for a door that is
       * not there. Support is the honest route until that flow is built.
       */
      `Too many incorrect attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}, or contact support@getpaybridge.com.`,
    );
  }

  if (!(await verifyPassword(input.password, row.passwordHash))) {
    const failures = row.failedLoginCount + 1;
    const lock = failures >= 8;
    await prisma.user.update({
      where: { id: row.id },
      data: {
        failedLoginCount: lock ? 0 : failures,
        lockedUntil: lock ? new Date(Date.now() + 15 * 60_000) : null,
      },
    });
    await record(c, {
      action: lock ? "user.login.locked" : "user.login.failed",
      outcome: "failure",
      actorType: "user",
      actorId: row.id,
      actorLabel: row.email,
      targetType: "user",
      targetId: row.id,
      detail: { failures, locked: lock },
    });
    // Identical message to the unknown-account branch. The lock is disclosed
    // only once it is already in force, which the attacker learns anyway.
    return fail(c, 401, "INVALID_CREDENTIALS", "That email address or password is not correct.");
  }

  /*
   * Suspension is checked AFTER the password, not before.
   *
   * WHY that order: answering "this account is suspended" to an unauthenticated
   * caller would confirm the address exists. Only someone who already proved
   * they hold the password is told why they cannot get in.
   */
  if (row.status === "suspended" || row.status === "closed") {
    await record(c, {
      action: "user.login.failed",
      outcome: "denied",
      actorType: "user",
      actorId: row.id,
      actorLabel: row.email,
      targetType: "user",
      targetId: row.id,
      previousStatus: row.status,
      detail: { reason: "account_blocked" },
    });
    return fail(c, 403, "ACCOUNT_BLOCKED", GATE_MESSAGES[computeGate(row)]);
  }

  /* ---------------------------------------------------------- Second factor */

  let mfaSatisfied = false;
  let remainingBackupCodes: string[] | null = null;

  if (row.twoFactorEnabledAt) {
    const totp = input.totp?.trim() ?? "";
    const recovery = input.recoveryCode?.trim() ?? "";

    if (!totp && !recovery) {
      // Password accepted, second factor still owed. No session is minted —
      // this response grants nothing, it only tells the client which field
      // to show next. Confirming the password was right is inherent to any
      // two-step sign-in and is not a leak worth breaking the flow over.
      return fail(c, 401, "MFA_REQUIRED", "Enter the 6-digit code from your authenticator app.");
    }

    if (totp) {
      mfaSatisfied = verifyTotp(decryptField(row.twoFactorSecretEnc), totp);
    } else {
      const stored: string[] = row.twoFactorBackupCodes ? (JSON.parse(row.twoFactorBackupCodes) as string[]) : [];
      const digest = createHash("sha256").update(normaliseRecoveryCode(recovery)).digest("hex");
      if (stored.includes(digest)) {
        mfaSatisfied = true;
        remainingBackupCodes = stored.filter((entry) => entry !== digest);
      }
    }

    if (!mfaSatisfied) {
      const failures = row.failedLoginCount + 1;
      const lock = failures >= 8;
      await prisma.user.update({
        where: { id: row.id },
        data: { failedLoginCount: lock ? 0 : failures, lockedUntil: lock ? new Date(Date.now() + 15 * 60_000) : null },
      });
      await record(c, {
        action: "user.mfa.failed",
        outcome: "failure",
        actorType: "user",
        actorId: row.id,
        actorLabel: row.email,
        targetType: "user",
        targetId: row.id,
        detail: { failures, locked: lock, method: totp ? "totp" : "recovery_code" },
      });
      return fail(c, 401, "MFA_INVALID", "That code is not correct. Try the current code from your app.");
    }

    if (remainingBackupCodes) {
      await record(c, {
        action: "user.mfa.recovery_used",
        outcome: "success",
        actorType: "user",
        actorId: row.id,
        actorLabel: row.email,
        targetType: "user",
        targetId: row.id,
        detail: { remaining: remainingBackupCodes.length },
      });
    }
  }

  await prisma.user.update({
    where: { id: row.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      ...(remainingBackupCodes ? { twoFactorBackupCodes: JSON.stringify(remainingBackupCodes) } : {}),
    },
  });

  // Fresh session id on every successful sign-in: an attacker who planted a
  // known session id before login holds a dead one after it.
  issueSession(c, { id: row.id, role: row.accountType, epoch: row.sessionEpoch, mfa: mfaSatisfied });

  await record(c, {
    action: "user.login",
    outcome: "success",
    actorType: "user",
    actorId: row.id,
    actorLabel: row.email,
    targetType: "user",
    targetId: row.id,
    detail: { gate: computeGate(row) },
  });

  return c.json({ data: serialiseSessionState(row) });
});

/* ================================================================ LOGOUT */

authRouter.post("/logout", async (c) => {
  const session = readSession(c);
  if (session) {
    await record(c, {
      action: "user.logout",
      outcome: "success",
      actorType: "user",
      actorId: session.sub,
      targetType: "user",
      targetId: session.sub,
    });
  }
  clearSession(c);
  return c.json({ data: { gate: "anonymous", user: null, financialAccess: false } });
});

/* =============================================================== SESSION */

/**
 * The SPA's source of truth on every page load.
 *
 * 200 with `gate: "anonymous"` rather than 401 for a missing session: this
 * endpoint answers "who am I", and "nobody" is a valid answer, not an error. A
 * 401 here makes the console noisy for every first-time visitor and tempts a
 * global error handler into redirect loops.
 */
authRouter.get("/session", async (c) => {
  const session = readSession(c);
  if (!session) return c.json({ data: { gate: "anonymous", user: null, financialAccess: false } });

  const row = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { ...ACCOUNT_SELECT, sessionEpoch: true },
  });
  if (!row) {
    clearSession(c);
    return c.json({ data: { gate: "anonymous", user: null, financialAccess: false } });
  }

  // Fail closed on a missing epoch, for the reason documented in `requireUser`.
  if (session.epoch !== row.sessionEpoch) {
    clearSession(c);
    return c.json({ data: { gate: "anonymous", user: null, financialAccess: false } });
  }

  touchSession(c, session);
  return c.json({ data: serialiseSessionState(row) });
});

/* =========================================================== TWO-FACTOR */

/**
 * Start TOTP enrolment. Same design as the admin portal's (routes/
 * admin-auth.ts): the secret is ENCRYPTED, not hashed — verification needs
 * the original value back — returned exactly once, and `twoFactorEnabledAt`
 * is cleared here (not confirmed), because from the moment a new secret
 * exists the old one no longer verifies.
 */
authRouter.post("/2fa/enrol", requireUser(), validate("json", enrolTwoFactorSchema), async (c) => {
  const account = c.get("account");
  const input = c.req.valid("json");

  if (account.twoFactorEnabledAt) {
    const withHash = await prisma.user.findUnique({ where: { id: account.id }, select: { passwordHash: true } });
    if (!input.currentPassword || !(await verifyPassword(input.currentPassword, withHash?.passwordHash ?? ""))) {
      return fail(c, 401, "BAD_CREDENTIALS", "Enter your current password to replace your authenticator.");
    }
  }

  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: account.id },
    data: { twoFactorSecretEnc: encryptField(secret), twoFactorEnabledAt: null, twoFactorBackupCodes: null },
  });

  await record(c, {
    action: "user.mfa.enrolled",
    outcome: "success",
    actorType: "user",
    actorId: account.id,
    actorLabel: account.email,
    targetType: "user",
    targetId: account.id,
    detail: { replacing: Boolean(account.twoFactorEnabledAt) },
  });

  const view: TwoFactorEnrolmentView = {
    secret,
    uri: totpEnrolmentUri({ secret, email: account.email }),
    issuer: "PayBridge",
  };
  return c.json({ data: view });
});

/**
 * Finish enrolment by proving a live code. MFA is marked enabled here, never
 * at `/2fa/enrol` — "we stored the secret" is not evidence anyone can
 * produce a code from it.
 */
authRouter.post("/2fa/enable", requireUser(), validate("json", confirmTwoFactorSchema), async (c) => {
  const account = c.get("account");
  const input = c.req.valid("json");

  const withSecret = await prisma.user.findUnique({ where: { id: account.id }, select: { twoFactorSecretEnc: true } });
  if (!withSecret?.twoFactorSecretEnc) {
    return fail(c, 409, "MFA_NOT_ENROLLED", "Start again: scan the QR code, then enter a code from your app.");
  }
  if (!verifyTotp(decryptField(withSecret.twoFactorSecretEnc), input.code)) {
    await record(c, {
      action: "user.mfa.failed",
      outcome: "failure",
      actorType: "user",
      actorId: account.id,
      actorLabel: account.email,
      targetType: "user",
      targetId: account.id,
      detail: { stage: "enable" },
    });
    return fail(c, 401, "MFA_INVALID", "That code is not correct. Check your app and enter the current code.");
  }

  const recoveryCodes = generateRecoveryCodes();
  await prisma.user.update({
    where: { id: account.id },
    data: {
      twoFactorEnabledAt: new Date(),
      twoFactorBackupCodes: JSON.stringify(
        recoveryCodes.map((code) => createHash("sha256").update(normaliseRecoveryCode(code)).digest("hex")),
      ),
    },
  });

  await record(c, {
    action: "user.mfa.enabled",
    outcome: "success",
    actorType: "user",
    actorId: account.id,
    actorLabel: account.email,
    targetType: "user",
    targetId: account.id,
    detail: { recoveryCodesIssued: recoveryCodes.length },
  });

  // The plaintext codes appear here and nowhere else, ever. Only digests are
  // stored, so a lost set cannot be recovered — only reissued by enrolling again.
  return c.json({ data: { recoveryCodes } });
});

/** Turn two-factor authentication off. Requires the password AND a live code — removing a security control needs the same proof as changing one. */
authRouter.post("/2fa/disable", requireUser(), validate("json", disableTwoFactorSchema), async (c) => {
  const account = c.get("account");
  const input = c.req.valid("json");

  const withSecrets = await prisma.user.findUnique({
    where: { id: account.id },
    select: { passwordHash: true, twoFactorSecretEnc: true },
  });
  if (!(await verifyPassword(input.password, withSecrets?.passwordHash ?? ""))) {
    return fail(c, 401, "BAD_CREDENTIALS", "That password is not correct.");
  }
  if (!verifyTotp(decryptField(withSecrets?.twoFactorSecretEnc), input.code)) {
    return fail(c, 401, "MFA_INVALID", "That code is not correct.");
  }

  await prisma.user.update({
    where: { id: account.id },
    data: { twoFactorSecretEnc: null, twoFactorEnabledAt: null, twoFactorBackupCodes: null },
  });

  await record(c, {
    action: "user.mfa.disabled",
    outcome: "success",
    actorType: "user",
    actorId: account.id,
    actorLabel: account.email,
    targetType: "user",
    targetId: account.id,
  });

  return c.json({ data: { disabled: true } });
});

/* ========================================================== VERIFICATION */

authRouter.post("/verify/send", requireUser(), validate("json", sendVerificationSchema), async (c) => {
  const account = c.get("account");
  const { channel } = c.req.valid("json");

  if (channel === "email" && account.emailVerifiedAt) {
    return fail(c, 409, "ALREADY_VERIFIED", "That email address is already confirmed.");
  }
  if (channel === "phone") {
    if (!account.phone) return fail(c, 400, "NO_PHONE", "Add a phone number to your account first.");
    if (account.phoneVerifiedAt) return fail(c, 409, "ALREADY_VERIFIED", "That phone number is already confirmed.");
  }

  const sent = await issueVerification(c, account, channel);
  return c.json({
    data: {
      channel,
      destination: maskDestination(sent.destination),
      delivered: sent.delivered,
      devCode: sent.devCode,
    },
  });
});

/* ======================================================== CORRECT ADDRESS */

/**
 * Change the email address of an account that has not yet verified it.
 *
 * The trap this removes: someone registers as `ade@gmial.com`, cannot read the
 * code, cannot verify, and cannot register again with the correct address
 * because... nothing stops that, actually — but their real address is now
 * unreachable from the stuck account and the mistyped row sits there forever.
 * Worse, if the typo happens to be someone else's real address, the code is sent
 * to a stranger.
 *
 * FOUR controls, because this endpoint moves where a security code is delivered:
 *   1. Only reachable at the `verify_contact` gate. Once an address is verified
 *      it is an identity anchor and changing it belongs behind a confirm-both-
 *      addresses flow, which is a different endpoint.
 *   2. The current password is required and verified. A stolen unverified
 *      session alone cannot redirect the account.
 *   3. Rate limited, tightly (see the middleware below): this is otherwise an
 *      account-existence oracle, since taken addresses are refused.
 *   4. Audited, with the old and new addresses as the previous/new status.
 */
authRouter.post("/email", requireUser(), validate("json", changeEmailSchema), async (c) => {
  const account = c.get("account");

  if (account.emailVerifiedAt) {
    return fail(
      c,
      409,
      "ALREADY_VERIFIED",
      "This address is already confirmed. Contact support to change it.",
    );
  }

  const row = await prisma.user.findUnique({
    where: { id: account.id },
    select: { passwordHash: true },
  });
  if (!row || !(await verifyPassword(c.req.valid("json").password, row.passwordHash))) {
    await record(c, {
      action: "user.verification.failed",
      outcome: "denied",
      actorType: "user",
      actorId: account.id,
      actorLabel: account.email,
      targetType: "user",
      targetId: account.id,
      detail: { reason: "email_change_bad_password" },
    });
    return fail(c, 401, "INVALID_CREDENTIALS", "That password is not correct.");
  }

  const next = c.req.valid("json").email;
  if (next === account.email) {
    return fail(c, 400, "SAME_EMAIL", "That is already the address on your account.");
  }

  const taken = await prisma.user.findUnique({ where: { email: next }, select: { id: true } });
  if (taken) {
    return fail(c, 409, "EMAIL_IN_USE", "An account already exists for that email address.");
  }

  /*
   * Delete the outstanding codes for the OLD address in the same breath as the
   * change. A code issued to the previous destination must not be usable to
   * verify the new one — otherwise whoever received the mistyped mail could
   * confirm an address they do not control.
   */
  const updated = await prisma.$transaction(async (tx) => {
    await tx.verificationCode.deleteMany({ where: { userId: account.id, channel: "email" } });
    return tx.user.update({
      where: { id: account.id },
      data: { email: next },
      select: { ...ACCOUNT_SELECT, sessionEpoch: true },
    });
  });

  await record(c, {
    action: "user.verification.sent",
    outcome: "success",
    actorType: "user",
    actorId: account.id,
    actorLabel: next,
    targetType: "user",
    targetId: account.id,
    previousStatus: account.email,
    newStatus: next,
    detail: { reason: "email_corrected" },
  });

  const sent = await issueVerification(c, updated, "email");

  return c.json({
    data: {
      ...serialiseSessionState(updated),
      verification: {
        channel: "email",
        destination: maskDestination(sent.destination),
        delivered: sent.delivered,
        devCode: sent.devCode,
      },
    },
  });
});

authRouter.post("/verify/confirm", requireUser(), validate("json", confirmVerificationSchema), async (c) => {
  const account = c.get("account");
  const { channel, code } = c.req.valid("json");

  const pending = await prisma.verificationCode.findFirst({
    where: { userId: account.id, channel, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!pending) {
    return fail(c, 400, "NO_CODE", "That code has expired. Request a new one.");
  }
  if (pending.expiresAt < new Date()) {
    await prisma.verificationCode.delete({ where: { id: pending.id } });
    return fail(c, 400, "CODE_EXPIRED", "That code has expired. Request a new one.");
  }
  if (pending.attempts >= OTP_MAX_ATTEMPTS) {
    // The code is burned, not merely refused. See OTP_MAX_ATTEMPTS for why the
    // per-code cap is the control that actually bounds a distributed attack.
    await prisma.verificationCode.delete({ where: { id: pending.id } });
    await record(c, {
      action: "user.verification.failed",
      outcome: "denied",
      actorType: "user",
      actorId: account.id,
      actorLabel: account.email,
      targetType: "user",
      targetId: account.id,
      detail: { channel, reason: "attempts_exhausted" },
    });
    return fail(c, 429, "TOO_MANY_ATTEMPTS", "Too many incorrect attempts. Request a new code.");
  }

  if (!otpMatches(code, pending.codeHash)) {
    await prisma.verificationCode.update({
      where: { id: pending.id },
      data: { attempts: { increment: 1 } },
    });
    const left = OTP_MAX_ATTEMPTS - (pending.attempts + 1);
    await record(c, {
      action: "user.verification.failed",
      outcome: "failure",
      actorType: "user",
      actorId: account.id,
      actorLabel: account.email,
      targetType: "user",
      targetId: account.id,
      detail: { channel, attemptsRemaining: left },
    });
    return fail(
      c,
      400,
      "CODE_INVALID",
      left > 0 ? `That code is not correct. ${left} attempt${left === 1 ? "" : "s"} left.` : "That code is not correct.",
    );
  }

  const now = new Date();
  await prisma.verificationCode.update({ where: { id: pending.id }, data: { consumedAt: now } });
  const updated = await prisma.user.update({
    where: { id: account.id },
    data: channel === "email" ? { emailVerifiedAt: now } : { phoneVerifiedAt: now },
    select: ACCOUNT_SELECT,
  });

  await record(c, {
    action: "user.verification.confirmed",
    outcome: "success",
    actorType: "user",
    actorId: account.id,
    actorLabel: account.email,
    targetType: "user",
    targetId: account.id,
    newStatus: computeGate(updated),
    detail: { channel },
  });

  return c.json({ data: serialiseSessionState(updated) });
});

/* =================================================================== KYC */

/**
 * Which document types a submission must include.
 *
 * `id_back` is absent: a passport has no informative back page, and demanding
 * one produces a photo of a blank page that a reviewer then has to reject.
 * `employment_letter` is absent because not every account type has an employer.
 */
const REQUIRED_DOCS: KycDocType[] = ["id_front", "selfie"];

async function buildKycStatus(userId: string): Promise<KycStatusView> {
  const [user, profile, docs] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        kycStatus: true,
        kycSubmittedAt: true,
        kycReviewedAt: true,
        kycRejectionReason: true,
      },
    }),
    prisma.kycProfile.findUnique({
      where: { userId },
      select: { idType: true, idNumberLast4: true },
    }),
    prisma.kycDocument.findMany({
      where: { userId },
      orderBy: { uploadedAt: "asc" },
      select: {
        id: true,
        docType: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        status: true,
        rejectionReason: true,
        uploadedAt: true,
      },
    }),
  ]);

  const present = new Set(docs.filter((d) => d.status !== "rejected").map((d) => d.docType));

  return {
    status: user.kycStatus as KycStatusView["status"],
    submittedAt: user.kycSubmittedAt?.toISOString() ?? null,
    reviewedAt: user.kycReviewedAt?.toISOString() ?? null,
    // Only in the rejected state, for the same reason as in serialiseSessionUser.
    rejectionReason: user.kycStatus === "rejected" ? user.kycRejectionReason : null,
    idType: (profile?.idType as KycStatusView["idType"]) ?? null,
    idNumberLast4: profile?.idNumberLast4 ?? null,
    documents: docs.map((d) => ({
      id: d.id,
      docType: d.docType as KycDocType,
      fileName: d.fileName,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      status: d.status,
      rejectionReason: d.rejectionReason,
      uploadedAt: d.uploadedAt.toISOString(),
    })),
    missingDocuments: REQUIRED_DOCS.filter((t) => !present.has(t)),
  };
}

authRouter.get("/kyc", requireUser(), async (c) => {
  const account = c.get("account");
  return c.json({ data: await buildKycStatus(account.id) });
});

/**
 * Submit or resubmit a KYC case.
 *
 * Identity fields are encrypted with AES-256-GCM before they touch the database
 * (see security/field-crypto.ts). Only `idNumberLast4` is stored in the clear,
 * so the customer can confirm which document they used without the full number
 * being readable by anyone with database access.
 */
authRouter.post("/kyc", requireUser(), validate("json", kycSubmissionSchema), async (c) => {
  const account = c.get("account");
  const input = c.req.valid("json");

  if (!account.emailVerifiedAt) {
    return fail(c, 403, "VERIFY_FIRST", "Confirm your email address before submitting verification.");
  }
  if (account.kycStatus === "approved") {
    return fail(c, 409, "ALREADY_APPROVED", "Your identity is already verified.");
  }
  if (account.kycStatus === "pending") {
    return fail(c, 409, "REVIEW_IN_PROGRESS", "Your verification is already being reviewed.");
  }

  const isResubmission = account.kycStatus === "rejected";

  const idNumber = input.idNumber.replace(/\s+/g, "").toUpperCase();
  const encrypted = {
    idNumberEnc: encryptField(idNumber),
    dateOfBirthEnc: encryptField(input.dateOfBirth),
    addressEnc: encryptField(input.address),
    bvnEnc: encryptOptional(input.bvn || null),
    idNumberLast4: last4(idNumber),
  };

  const clear = {
    idType: input.idType,
    city: input.city,
    state: input.state,
    country: input.country,
    employerName: input.employerName || null,
    occupation: input.occupation || null,
  };

  await prisma.kycProfile.upsert({
    where: { userId: account.id },
    create: { userId: account.id, ...clear, ...encrypted },
    update: { ...clear, ...encrypted },
  });

  const status = await buildKycStatus(account.id);
  if (status.missingDocuments.length > 0) {
    /*
     * The profile is saved but the case is NOT submitted. WHY save at all: the
     * customer typed a lot of data, and discarding it because a photo upload has
     * not happened yet means they type it again. The case only enters `pending`
     * when it is actually reviewable.
     */
    return c.json({
      data: {
        ...(await buildKycStatus(account.id)),
        submitted: false,
        message: "Your details are saved. Upload the remaining documents to submit your verification.",
      },
    });
  }

  const now = new Date();
  const updated = await prisma.user.update({
    where: { id: account.id },
    data: {
      kycStatus: "pending",
      kycSubmittedAt: now,
      // Cleared on resubmission: a stale reason attached to a pending case shows
      // the customer a rejection they have already answered.
      kycRejectionReason: null,
      kycReviewedAt: null,
      kycReviewedBy: null,
    },
    select: ACCOUNT_SELECT,
  });

  await record(c, {
    action: isResubmission ? "kyc.resubmitted" : "kyc.submitted",
    outcome: "success",
    actorType: "user",
    actorId: account.id,
    actorLabel: account.email,
    targetType: "kyc",
    targetId: account.id,
    previousStatus: account.kycStatus,
    newStatus: "pending",
    // Note what is NOT here: no id number, no date of birth, no address. The
    // audit record proves the submission happened; it is not a copy of it.
    detail: { idType: input.idType, documents: status.documents.length, resubmission: isResubmission },
  });

  return c.json({
    data: { ...(await buildKycStatus(account.id)), submitted: true, session: serialiseSessionState(updated) },
  });
});

/* --------------------------------------------------------- DOCUMENT UPLOAD */

/**
 * Accepted upload types and size cap.
 *
 * The allowlist is on MIME type AND the magic bytes are checked below. WHY both:
 * the browser sets the Content-Type, so a caller can claim `image/jpeg` for any
 * bytes at all. Checking the signature is what stops an HTML or SVG file being
 * stored and later served back — the stored-XSS route into the reviewer's
 * session, which is the highest-privilege browser in the building.
 *
 * SVG is deliberately NOT accepted. It is a script-bearing format.
 */
const ACCEPTED_UPLOADS: Record<string, { ext: string; magic: number[][] }> = {
  "image/jpeg": { ext: "jpg", magic: [[0xff, 0xd8, 0xff]] },
  "image/png": { ext: "png", magic: [[0x89, 0x50, 0x4e, 0x47]] },
  "image/webp": { ext: "webp", magic: [[0x52, 0x49, 0x46, 0x46]] },
  "application/pdf": { ext: "pdf", magic: [[0x25, 0x50, 0x44, 0x46]] },
};

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * Where document bytes live: an S3-compatible object storage bucket
 * (backend/src/storage/kyc.ts), NOT the database. WHY: identity documents in
 * table rows end up in every backup, every `SELECT *`, and every developer's
 * local copy of production data. Keeping them in a separate store means the
 * database dump that leaks is not also an identity-document leak, and a
 * multi-instance deployment (Render can run more than one instance) never
 * disagrees with itself about which instance holds a file.
 */

function matchesMagic(bytes: Uint8Array, magic: number[][]): boolean {
  return magic.some((signature) => signature.every((byte, i) => bytes[i] === byte));
}

/**
 * Delete document bytes for storage keys whose rows are going away.
 *
 * WHY this has to exist: deleting the `KycDocument` row removes the only
 * pointer to the object, so without this the bytes stay in the bucket
 * forever — an identity document that no query can find, that no retention
 * policy can see, and that no erasure request can reach. Every re-upload of
 * the same document type used to leave one behind.
 *
 * `storageKey` is validated on the way in (it is always
 * `<cuid>/<uuid>.<ext>`, generated here, never client-supplied) so there is
 * no traversal risk in passing it straight through as the object key.
 */
export async function deleteStoredDocuments(storageKeys: string[]): Promise<void> {
  const valid = storageKeys.filter((key) => {
    const ok = /^[A-Za-z0-9_-]+\/[A-Za-z0-9-]+\.[A-Za-z0-9]+$/.test(key);
    if (!ok) console.error(JSON.stringify({ type: "kyc.storage_key_rejected", at: new Date().toISOString() }));
    return ok;
  });
  await deleteKycObjects(valid);
}

authRouter.post("/kyc/documents", requireUser(), async (c) => {
  const account = c.get("account");

  if (!account.emailVerifiedAt) {
    return fail(c, 403, "VERIFY_FIRST", "Confirm your email address before uploading documents.");
  }
  if (account.kycStatus === "approved") {
    return fail(c, 409, "ALREADY_APPROVED", "Your identity is already verified.");
  }
  if (account.kycStatus === "pending") {
    return fail(c, 409, "REVIEW_IN_PROGRESS", "Your verification is being reviewed. Documents cannot be changed.");
  }

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return fail(c, 400, "BAD_UPLOAD", "That upload could not be read. Try again.");
  }

  const docTypeRaw = String(form.get("docType") ?? "");
  const parsedType = z.enum(KYC_DOC_TYPES).safeParse(docTypeRaw);
  if (!parsedType.success) return fail(c, 400, "BAD_DOC_TYPE", "Choose which document you are uploading.");
  const docType = parsedType.data;

  const file = form.get("file");
  if (!(file instanceof File)) return fail(c, 400, "NO_FILE", "Attach a file to upload.");
  if (file.size === 0) return fail(c, 400, "EMPTY_FILE", "That file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) {
    return fail(c, 400, "FILE_TOO_LARGE", "Files must be 8 MB or smaller. Try a photo at a lower resolution.");
  }

  const accepted = ACCEPTED_UPLOADS[file.type];
  if (!accepted) {
    return fail(c, 400, "UNSUPPORTED_TYPE", "Upload a JPG, PNG, WebP or PDF file.");
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  if (!matchesMagic(buffer, accepted.magic)) {
    // The declared type and the actual bytes disagree. Refused without saying
    // which, because the useful detail here only helps someone probing the check.
    await record(c, {
      action: "kyc.document.uploaded",
      outcome: "failure",
      actorType: "user",
      actorId: account.id,
      actorLabel: account.email,
      targetType: "kyc",
      targetId: account.id,
      detail: { docType, reason: "content_type_mismatch", declared: file.type },
    });
    return fail(c, 400, "UNSUPPORTED_TYPE", "That file does not look like a JPG, PNG, WebP or PDF.");
  }

  const contentHash = createHash("sha256").update(buffer).digest("hex");
  // Random key, not the filename: a predictable storage path is a directory
  // traversal and an enumeration risk, and the customer's filename may itself
  // contain their name.
  const storageKey = `${account.id}/${crypto.randomUUID()}.${accepted.ext}`;

  try {
    await putKycObject(storageKey, buffer, file.type);
  } catch (error) {
    console.error(
      JSON.stringify({
        type: "kyc.storage_failed",
        at: new Date().toISOString(),
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return fail(c, 400, "STORAGE_FAILED", "That file could not be saved. Please try again.");
  }

  /*
   * One document per type: re-uploading replaces the previous attempt rather
   * than stacking, so a reviewer never has to guess which of four selfies is
   * the current one.
   *
   * The superseded FILES are unlinked too, not just their rows. Read the keys
   * first — after the delete there is nothing left to tell us what to remove.
   */
  const superseded = await prisma.kycDocument.findMany({
    where: { userId: account.id, docType },
    select: { storageKey: true },
  });
  await prisma.kycDocument.deleteMany({ where: { userId: account.id, docType } });
  await deleteStoredDocuments(superseded.map((doc) => doc.storageKey));
  const created = await prisma.kycDocument.create({
    data: {
      userId: account.id,
      docType,
      // Sanitised: the original name is display-only metadata and is not used
      // for any path.
      fileName: file.name.replace(/[^\w.\- ]/g, "").slice(0, 120) || `${docType}.${accepted.ext}`,
      mimeType: file.type,
      sizeBytes: file.size,
      contentHash,
      storageKey,
    },
    select: { id: true },
  });

  await record(c, {
    action: "kyc.document.uploaded",
    outcome: "success",
    actorType: "user",
    actorId: account.id,
    actorLabel: account.email,
    targetType: "kyc",
    targetId: account.id,
    detail: { docType, sizeBytes: file.size, mimeType: file.type, documentId: created.id },
  });

  return c.json({ data: await buildKycStatus(account.id) }, 201);
});

export { authRouter };
