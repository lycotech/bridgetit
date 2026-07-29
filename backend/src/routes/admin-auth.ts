import { Hono } from "hono";
import type { Context } from "hono";
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "../db";
import { rateLimit } from "../security/rate-limit";
import { validate } from "../security/validate";
import { record, callerIp } from "../security/audit-store";
import {
  clearStaffSession,
  issueStaffSession,
  readStaffSession,
  requireAdmin,
  rotateStaffSession,
  type StaffSession,
} from "../security/staff-session";
import { burnPasswordTime, checkPasswordPolicy, hashPassword, verifyPassword } from "../security/passwords";
import {
  generateRecoveryCodes,
  generateTotpSecret,
  normaliseRecoveryCode,
  totpEnrolmentUri,
  verifyTotp,
} from "../security/totp";
import { issueTimedCode, maskDestination, TIMED_CODE_MINUTES, verifyTimedCode } from "../security/codes";
import { decryptField, encryptField } from "../security/field-crypto";
import { permissionsFor } from "../security/admin-roles";
import { isProduction } from "../security/config";
import { sendMail, TRANSPORT_KIND } from "../email/mailer";
import { adminPasswordChangedEmail, adminRecoveryCodeEmail } from "../email/templates";
import {
  adminAcceptPolicySchema,
  adminChangePasswordSchema,
  adminMfaVerifySchema,
  adminRecoverySchema,
  adminSignInSchema,
  type AdminOnboardingStep,
  type AdminSessionView,
} from "../types";

/**
 * Administrator authentication — the third and most privileged access route.
 *
 * Mounted at /api/admin/auth, deliberately separate from the customer router:
 * no code path here can be reached with a customer session, and no session
 * issued here is the same cookie family as a customer's. The portal itself is
 * unlisted (not in the public navigation or footer), but "unlisted" is not a
 * control — every route below assumes the URL is public knowledge.
 *
 * WHY this exists alongside the environment-variable login in admin.ts: that
 * one authenticates against a deployment secret and has no identity, no role,
 * no MFA and no audit subject. It survives as a documented break-glass account
 * for a deployment whose admin table is empty or locked out. Real administrators
 * are database rows with a role, a second factor and a name in the audit trail.
 *
 * The first-run obligations (change the temporary password, enrol MFA, confirm a
 * recovery address, accept the security policy) are enforced server-side. A
 * session that still owes any of them carries `onboarding: true` and
 * `requireAdmin()` refuses every route except the ones in this file.
 */
const adminAuthRouter = new Hono();

/**
 * The policy text version an administrator has accepted.
 *
 * Bump this string when the administrator security policy changes: every
 * existing acceptance immediately stops counting, the `policy` step reappears,
 * and each administrator has to accept the new text before doing anything else.
 * That is the point of storing a version rather than a boolean.
 */
export const ADMIN_POLICY_VERSION = "2026-07-v1";

/** Wrong passwords tolerated on one admin account before it locks. */
const MAX_FAILURES = 6;
const LOCK_MS = 15 * 60_000;

const ADMIN_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  mustChangePassword: true,
  tempPasswordExpiresAt: true,
  mfaEnabledAt: true,
  recoveryEmail: true,
  recoveryEmailVerifiedAt: true,
  policyAcceptedAt: true,
  policyVersion: true,
  sessionEpoch: true,
  lastLoginAt: true,
} as const;

type AdminRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  mustChangePassword: boolean;
  tempPasswordExpiresAt: Date | null;
  mfaEnabledAt: Date | null;
  recoveryEmail: string | null;
  recoveryEmailVerifiedAt: Date | null;
  policyAcceptedAt: Date | null;
  policyVersion: string | null;
  sessionEpoch: number;
  lastLoginAt: Date | null;
};

function fail(c: Context, status: 400 | 401 | 403 | 404 | 409 | 423 | 503, code: string, message: string) {
  return c.json({ error: { message, code } }, status);
}

/**
 * The first-run steps this administrator still owes, in the order the wizard
 * walks them.
 *
 * Computed from the row on every request rather than stored as a flag: a flag
 * and the columns it summarises drift, and the direction they drift in is
 * "onboarding looks finished when it is not".
 */
function outstandingSteps(row: AdminRow): AdminOnboardingStep[] {
  const steps: AdminOnboardingStep[] = [];
  if (row.mustChangePassword) steps.push("password");
  if (!row.mfaEnabledAt) steps.push("mfa");
  if (!row.recoveryEmailVerifiedAt) steps.push("recovery");
  if (!row.policyAcceptedAt || row.policyVersion !== ADMIN_POLICY_VERSION) steps.push("policy");
  return steps;
}

function sessionView(row: AdminRow): AdminSessionView {
  return {
    authenticated: true,
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as AdminSessionView["role"],
    permissions: permissionsFor(row.role),
    mfaEnabled: Boolean(row.mfaEnabledAt),
    outstanding: outstandingSteps(row),
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
  };
}

const ANONYMOUS_VIEW: AdminSessionView = {
  authenticated: false,
  id: null,
  name: null,
  email: null,
  role: null,
  permissions: [],
  mfaEnabled: false,
  outstanding: [],
  lastLoginAt: null,
};

/**
 * Load the administrator behind a session, or null.
 *
 * Every route re-reads the row. WHY, when `requireAdmin()` already validated the
 * session: the cookie is self-contained, so the only trustworthy answer to "is
 * this account still active, still this role, still on this password" comes from
 * the database on this request.
 */
async function loadAdmin(session: StaffSession | null): Promise<AdminRow | null> {
  if (!session?.uid) return null;
  const row = await prisma.adminUser
    .findUnique({ where: { id: session.uid }, select: ADMIN_SELECT })
    .catch(() => null);
  if (!row || row.status !== "active" || row.sessionEpoch !== session.epoch) return null;
  return row;
}

/** The signed-in administrator, for routes already behind `requireAdmin()`. */
async function currentAdmin(c: Context): Promise<{ session: StaffSession; row: AdminRow } | null> {
  const session = c.get("staff");
  if (!session) return null;
  const row = await loadAdmin(session);
  if (!row) return null;
  return { session, row };
}

/**
 * Re-stamp the session's onboarding claim after a step is completed.
 *
 * Rotating rather than patching: every one of these steps is a privilege
 * transition (the session gains reach it did not have a moment ago), and a
 * session id that survives a privilege change is the session-fixation bug.
 */
function refreshSession(c: Context, session: StaffSession, row: AdminRow, patch: Partial<StaffSession> = {}) {
  return rotateStaffSession(c, session, {
    ...patch,
    role: row.role,
    epoch: row.sessionEpoch,
    onboarding: outstandingSteps(row).length > 0,
  });
}

/* ============================================================== SIGN IN */

/*
 * 5 attempts per 15 minutes per IP, on top of the per-account lockout below.
 * The two are additive and neither replaces the other: the IP limit stops one
 * machine spraying many accounts, the account lockout stops many machines
 * spraying one account.
 */
adminAuthRouter.use("/login", rateLimit({ name: "admin:auth:login", limit: 5, windowMs: 15 * 60_000 }));

adminAuthRouter.post("/login", validate("json", adminSignInSchema), async (c) => {
  const input = c.req.valid("json");
  const email = input.email.trim().toLowerCase();

  const row = await prisma.adminUser.findUnique({
    where: { email },
    select: {
      ...ADMIN_SELECT,
      passwordHash: true,
      mfaSecretEnc: true,
      mfaBackupCodes: true,
      failedLoginCount: true,
      lockedUntil: true,
    },
  });

  /*
   * No such administrator. Spend an argon2id verification's worth of time before
   * answering so that "not an administrator" and "wrong password" cannot be told
   * apart by timing — otherwise this endpoint enumerates the staff list.
   */
  if (!row) {
    await burnPasswordTime(input.password);
    await record(c, {
      action: "admin.login.failed",
      outcome: "failure",
      actorType: "anonymous",
      actorLabel: email,
      detail: { reason: "no_such_admin" },
    });
    return fail(c, 401, "BAD_CREDENTIALS", "That email address or password is not correct.");
  }

  if (row.lockedUntil && row.lockedUntil > new Date()) {
    const minutes = Math.max(1, Math.ceil((row.lockedUntil.getTime() - Date.now()) / 60_000));
    await record(c, {
      action: "admin.login.locked",
      outcome: "denied",
      actorType: "admin",
      actorId: row.id,
      actorLabel: row.email,
      targetType: "admin",
      targetId: row.id,
      detail: { minutesRemaining: minutes },
    });
    return fail(
      c,
      423,
      "ACCOUNT_LOCKED",
      `Too many incorrect attempts. This account is locked for ${minutes} more minute${minutes === 1 ? "" : "s"}.`,
    );
  }

  if (row.status !== "active") {
    await burnPasswordTime(input.password);
    await record(c, {
      action: "admin.login.failed",
      outcome: "denied",
      actorType: "admin",
      actorId: row.id,
      actorLabel: row.email,
      targetType: "admin",
      targetId: row.id,
      detail: { reason: "not_active", status: row.status },
    });
    // Deliberately the same sentence as a wrong password. A suspended
    // administrator's own status is not information a guesser should be handed.
    return fail(c, 401, "BAD_CREDENTIALS", "That email address or password is not correct.");
  }

  if (!(await verifyPassword(input.password, row.passwordHash))) {
    const failures = row.failedLoginCount + 1;
    const lock = failures >= MAX_FAILURES;
    await prisma.adminUser.update({
      where: { id: row.id },
      data: {
        failedLoginCount: lock ? 0 : failures,
        lockedUntil: lock ? new Date(Date.now() + LOCK_MS) : null,
      },
    });
    await record(c, {
      action: lock ? "admin.login.locked" : "admin.login.failed",
      outcome: "failure",
      actorType: "admin",
      actorId: row.id,
      actorLabel: row.email,
      targetType: "admin",
      targetId: row.id,
      detail: { failures, locked: lock, reason: "bad_password" },
    });
    return fail(c, 401, "BAD_CREDENTIALS", "That email address or password is not correct.");
  }

  /*
   * A temporary password is a bearer token sitting in whoever ran the deployment
   * seed's terminal scrollback. It dies 24 hours after it was issued or the
   * moment it is used, whichever comes first — see the update below, which moves
   * the expiry to now so no second sign-in can use it.
   */
  const temporary = row.mustChangePassword && row.tempPasswordExpiresAt !== null;
  if (temporary && row.tempPasswordExpiresAt! <= new Date()) {
    await record(c, {
      action: "admin.password.temp_expired",
      outcome: "denied",
      actorType: "admin",
      actorId: row.id,
      actorLabel: row.email,
      targetType: "admin",
      targetId: row.id,
    });
    return fail(
      c,
      401,
      "TEMP_PASSWORD_EXPIRED",
      "That temporary password has expired. Ask a Super Admin to issue a new one.",
    );
  }

  /* ---------------------------------------------------------- Second factor */

  let mfaSatisfied = false;
  let recoveryUsed = false;
  let remainingBackupCodes: string[] | null = null;

  if (row.mfaEnabledAt) {
    const totp = input.totp?.trim() ?? "";
    const recovery = input.recoveryCode?.trim() ?? "";

    if (!totp && !recovery) {
      /*
       * Password accepted, second factor still owed. No session is minted, so
       * this response grants nothing — it only tells the client which field to
       * show next. That it confirms the password was right is inherent to any
       * two-step sign-in and is not a leak worth breaking the flow over.
       */
      return fail(c, 401, "MFA_REQUIRED", "Enter the 6-digit code from your authenticator app.");
    }

    if (totp) {
      mfaSatisfied = verifyTotp(decryptField(row.mfaSecretEnc), totp);
    } else if (recovery) {
      /*
       * Recovery codes are stored as sha256 digests and consumed on use. A code
       * that bypasses the second factor IS a second factor, so it gets the same
       * treatment as the secret: never readable back, never reusable.
       */
      const stored: string[] = row.mfaBackupCodes ? (JSON.parse(row.mfaBackupCodes) as string[]) : [];
      const digest = createHash("sha256").update(normaliseRecoveryCode(recovery)).digest("hex");
      if (stored.includes(digest)) {
        mfaSatisfied = true;
        recoveryUsed = true;
        remainingBackupCodes = stored.filter((entry) => entry !== digest);
      }
    }

    if (!mfaSatisfied) {
      const failures = row.failedLoginCount + 1;
      const lock = failures >= MAX_FAILURES;
      await prisma.adminUser.update({
        where: { id: row.id },
        data: {
          failedLoginCount: lock ? 0 : failures,
          lockedUntil: lock ? new Date(Date.now() + LOCK_MS) : null,
        },
      });
      await record(c, {
        action: "admin.mfa.failed",
        outcome: "failure",
        actorType: "admin",
        actorId: row.id,
        actorLabel: row.email,
        targetType: "admin",
        targetId: row.id,
        detail: { failures, locked: lock, method: totp ? "totp" : "recovery_code" },
      });
      return fail(c, 401, "MFA_INVALID", "That code is not correct. Try the current code from your app.");
    }
  }

  const updated = await prisma.adminUser.update({
    where: { id: row.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: callerIp(c),
      // Burn the temporary password on first use.
      tempPasswordExpiresAt: temporary ? new Date(Date.now() - 1000) : row.tempPasswordExpiresAt,
      ...(remainingBackupCodes ? { mfaBackupCodes: JSON.stringify(remainingBackupCodes) } : {}),
    },
    select: ADMIN_SELECT,
  });

  const steps = outstandingSteps(updated);
  issueStaffSession(c, {
    aud: "admin",
    sub: updated.email,
    uid: updated.id,
    role: updated.role,
    epoch: updated.sessionEpoch,
    mfa: mfaSatisfied,
    onboarding: steps.length > 0,
  });

  if (recoveryUsed) {
    await record(c, {
      action: "admin.mfa.recovery_used",
      outcome: "success",
      actorType: "admin",
      actorId: updated.id,
      actorLabel: updated.email,
      targetType: "admin",
      targetId: updated.id,
      detail: { remaining: remainingBackupCodes?.length ?? 0 },
    });
  }

  await record(c, {
    action: "admin.login",
    outcome: "success",
    actorType: "admin",
    actorId: updated.id,
    actorLabel: updated.email,
    targetType: "admin",
    targetId: updated.id,
    detail: { role: updated.role, mfa: mfaSatisfied, onboarding: steps },
  });

  return c.json({ data: sessionView(updated) });
});

adminAuthRouter.post("/logout", async (c) => {
  const session = readStaffSession(c, "admin");
  clearStaffSession(c, "admin");
  if (session) {
    await record(c, {
      action: "admin.logout",
      outcome: "success",
      actorType: "admin",
      actorId: session.uid ?? null,
      actorLabel: session.sub,
      targetType: "session",
      targetId: session.sid,
    });
  }
  return c.json({ data: ANONYMOUS_VIEW });
});

/**
 * The portal's own view of who is signed in.
 *
 * Never 401s: the login screen calls this on load, and an error response there
 * is indistinguishable from a broken API. `authenticated: false` is the answer,
 * not a failure. Read the row rather than the cookie's claims — a suspended or
 * demoted administrator must be told on their next poll, not their next login.
 */
adminAuthRouter.get("/session", async (c) => {
  const session = readStaffSession(c, "admin");
  const row = await loadAdmin(session);
  if (!session || !row) {
    if (session) clearStaffSession(c, "admin");
    return c.json({ data: ANONYMOUS_VIEW });
  }
  return c.json({ data: sessionView(row) });
});

/* =================================================== PASSWORD (STEP ONE) */

adminAuthRouter.use("/password", rateLimit({ name: "admin:auth:password", limit: 10, windowMs: 60 * 60_000 }));

/**
 * Change password. Required on first sign-in, available from Security Settings
 * afterwards. Both cases run this one code path so the rules cannot diverge.
 *
 * Two things happen beyond writing a new hash, and both are required by the
 * security spec: every OTHER session on the account is invalidated (by bumping
 * the epoch, which is the only revocation mechanism a self-contained cookie
 * has), and the administrator is emailed. The email is what makes a silent
 * takeover impossible to miss.
 */
adminAuthRouter.post(
  "/password",
  requireAdmin({ allowOnboarding: true }),
  validate("json", adminChangePasswordSchema),
  async (c) => {
    const input = c.req.valid("json");
    const me = await currentAdmin(c);
    if (!me) return fail(c, 401, "UNAUTHENTICATED", "Sign in again to continue.");

    const withHash = await prisma.adminUser.findUnique({
      where: { id: me.row.id },
      select: { passwordHash: true },
    });

    if (!(await verifyPassword(input.currentPassword, withHash?.passwordHash))) {
      await record(c, {
        action: "admin.login.failed",
        outcome: "failure",
        actorType: "admin",
        actorId: me.row.id,
        actorLabel: me.row.email,
        targetType: "admin",
        targetId: me.row.id,
        detail: { reason: "password_change_bad_current" },
      });
      return fail(c, 401, "BAD_CREDENTIALS", "Your current password is not correct.");
    }

    /*
     * The schema already enforces length and character classes. This adds the
     * checks a regex cannot express: the blocklist, and the administrator's own
     * name and email — "adeniran2026!" satisfies every composition rule and is
     * the first thing a targeted attacker tries.
     */
    const verdict = checkPasswordPolicy(input.newPassword, { email: me.row.email, name: me.row.name });
    if (!verdict.ok) return fail(c, 400, "WEAK_PASSWORD", verdict.message ?? "Choose a stronger password.");

    const updated = await prisma.adminUser.update({
      where: { id: me.row.id },
      data: {
        passwordHash: await hashPassword(input.newPassword),
        mustChangePassword: false,
        tempPasswordExpiresAt: null,
        passwordChangedAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
        sessionEpoch: { increment: 1 },
      },
      select: ADMIN_SELECT,
    });

    // This session survives, re-signed with the new epoch; every other one is
    // now stale and will be rejected on its next request.
    refreshSession(c, me.session, updated);

    await record(c, {
      action: "admin.password.changed",
      outcome: "success",
      actorType: "admin",
      actorId: updated.id,
      actorLabel: updated.email,
      targetType: "admin",
      targetId: updated.id,
      detail: { wasTemporary: me.row.mustChangePassword },
    });
    await record(c, {
      action: "admin.sessions.invalidated",
      outcome: "success",
      actorType: "admin",
      actorId: updated.id,
      actorLabel: updated.email,
      targetType: "admin",
      targetId: updated.id,
      previousStatus: `epoch:${me.row.sessionEpoch}`,
      newStatus: `epoch:${updated.sessionEpoch}`,
      detail: { reason: "password_changed" },
    });

    const mail = adminPasswordChangedEmail({
      name: updated.name,
      at: new Date(),
      ip: callerIp(c),
      otherSessionsEnded: true,
    });
    // Notify the account's own address AND the confirmed recovery address: if an
    // attacker changed the password, the inbox they control is the primary one.
    await sendMail({ to: updated.email, subject: mail.subject, text: mail.text, html: mail.html, from: mail.from });
    if (updated.recoveryEmailVerifiedAt && updated.recoveryEmail) {
      await sendMail({
        to: updated.recoveryEmail,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        from: mail.from,
      });
    }

    return c.json({ data: sessionView(updated) });
  },
);

/* ======================================================== MFA (STEP TWO) */

adminAuthRouter.use("/mfa/*", rateLimit({ name: "admin:auth:mfa", limit: 15, windowMs: 15 * 60_000 }));

const enrolSchema = z.object({
  /** Required only when replacing a working authenticator. */
  currentPassword: z.string().max(200).optional(),
});

/**
 * Start TOTP enrolment: mint a secret, store it encrypted, hand back the
 * `otpauth://` URI for the authenticator app.
 *
 * The secret is ENCRYPTED, not hashed — verification needs the original value,
 * which makes it the one credential in the system we must be able to read back.
 * It is returned exactly once, in this authenticated response, and never logged
 * or written to an audit record.
 *
 * `mfaEnabledAt` is cleared here, not at confirmation: from the moment a new
 * secret exists the old one no longer verifies, so claiming MFA is still enabled
 * would leave an account with a second factor nobody holds.
 */
adminAuthRouter.post("/mfa/enrol", requireAdmin({ allowOnboarding: true }), validate("json", enrolSchema), async (c) => {
  const input = c.req.valid("json");
  const me = await currentAdmin(c);
  if (!me) return fail(c, 401, "UNAUTHENTICATED", "Sign in again to continue.");

  /*
   * Replacing a working authenticator requires the password. WHY only then:
   * during first-run there is no second factor to protect, and demanding the
   * temporary password again adds nothing. Afterwards, this endpoint is a
   * complete MFA reset, so it needs proof of the first factor.
   */
  if (me.row.mfaEnabledAt) {
    const withHash = await prisma.adminUser.findUnique({
      where: { id: me.row.id },
      select: { passwordHash: true },
    });
    if (!input.currentPassword || !(await verifyPassword(input.currentPassword, withHash?.passwordHash))) {
      return fail(c, 401, "BAD_CREDENTIALS", "Enter your current password to replace your authenticator.");
    }
  }

  const secret = generateTotpSecret();
  await prisma.adminUser.update({
    where: { id: me.row.id },
    data: { mfaSecretEnc: encryptField(secret), mfaEnabledAt: null, mfaBackupCodes: null },
  });

  await record(c, {
    action: "admin.mfa.enrolled",
    outcome: "success",
    actorType: "admin",
    actorId: me.row.id,
    actorLabel: me.row.email,
    targetType: "admin",
    targetId: me.row.id,
    detail: { replacing: Boolean(me.row.mfaEnabledAt) },
  });

  return c.json({
    data: {
      secret,
      uri: totpEnrolmentUri({ secret, email: me.row.email }),
      issuer: "PayBridge",
    },
  });
});

/**
 * Finish enrolment by proving a live code, then hand back single-use recovery
 * codes — once.
 *
 * MFA is marked enabled here and never at `/mfa/enrol`. An administrator who
 * scans a QR code they cannot read from is locked out of a privileged account,
 * and "we stored the secret" is not evidence that anyone can produce a code
 * from it. A live code is.
 */
adminAuthRouter.post(
  "/mfa/enable",
  requireAdmin({ allowOnboarding: true }),
  validate("json", adminMfaVerifySchema),
  async (c) => {
    const input = c.req.valid("json");
    const me = await currentAdmin(c);
    if (!me) return fail(c, 401, "UNAUTHENTICATED", "Sign in again to continue.");

    const withSecret = await prisma.adminUser.findUnique({
      where: { id: me.row.id },
      select: { mfaSecretEnc: true },
    });
    if (!withSecret?.mfaSecretEnc) {
      return fail(c, 409, "MFA_NOT_ENROLLED", "Start again: scan the QR code, then enter a code from your app.");
    }

    if (!verifyTotp(decryptField(withSecret.mfaSecretEnc), input.code)) {
      await record(c, {
        action: "admin.mfa.failed",
        outcome: "failure",
        actorType: "admin",
        actorId: me.row.id,
        actorLabel: me.row.email,
        targetType: "admin",
        targetId: me.row.id,
        detail: { stage: "enable" },
      });
      return fail(c, 401, "MFA_INVALID", "That code is not correct. Check your app and enter the current code.");
    }

    const recoveryCodes = generateRecoveryCodes();
    const updated = await prisma.adminUser.update({
      where: { id: me.row.id },
      data: {
        mfaEnabledAt: new Date(),
        mfaBackupCodes: JSON.stringify(
          recoveryCodes.map((code) => createHash("sha256").update(normaliseRecoveryCode(code)).digest("hex")),
        ),
      },
      select: ADMIN_SELECT,
    });

    // The second factor is satisfied for this session by definition: a live code
    // was just proven on it.
    refreshSession(c, me.session, updated, { mfa: true });

    await record(c, {
      action: "admin.mfa.enabled",
      outcome: "success",
      actorType: "admin",
      actorId: updated.id,
      actorLabel: updated.email,
      targetType: "admin",
      targetId: updated.id,
      detail: { recoveryCodesIssued: recoveryCodes.length },
    });

    /*
     * The plaintext recovery codes appear here and nowhere else, ever. Only
     * digests are stored, so a lost set cannot be recovered — it can only be
     * replaced by re-enrolling.
     */
    return c.json({ data: { session: sessionView(updated), recoveryCodes } });
  },
);

/* ================================================== RECOVERY (STEP THREE) */

adminAuthRouter.use("/recovery/*", rateLimit({ name: "admin:auth:recovery", limit: 8, windowMs: 60 * 60_000 }));
adminAuthRouter.use("/recovery", rateLimit({ name: "admin:auth:recovery", limit: 8, windowMs: 60 * 60_000 }));

/** Dev-only escape hatch, on exactly the same terms as the customer flow. */
function undeliverableCode(code: string): string | undefined {
  if (isProduction) return undefined;
  if (TRANSPORT_KIND !== "log") return undefined;
  return code;
}

/**
 * Nominate a recovery address and send a code to it.
 *
 * The address is stored immediately but UNVERIFIED, and only the confirmation
 * below sets `recoveryEmailVerifiedAt`. WHY it has to be proven: a recovery
 * address is a route back into a privileged account. Unproven, it is either a
 * typo that locks the administrator out of their own recovery, or an attacker's
 * inbox that quietly becomes one.
 */
adminAuthRouter.post(
  "/recovery",
  requireAdmin({ allowOnboarding: true }),
  validate("json", adminRecoverySchema),
  async (c) => {
    const input = c.req.valid("json");
    const me = await currentAdmin(c);
    if (!me) return fail(c, 401, "UNAUTHENTICATED", "Sign in again to continue.");

    if (input.recoveryEmail === me.row.email) {
      return fail(
        c,
        400,
        "SAME_ADDRESS",
        "Use a different address from your sign-in email — a recovery address on the same inbox recovers nothing.",
      );
    }

    const updated = await prisma.adminUser.update({
      where: { id: me.row.id },
      data: { recoveryEmail: input.recoveryEmail, recoveryEmailVerifiedAt: null },
      select: ADMIN_SELECT,
    });

    const code = issueTimedCode("admin.recovery", `${updated.id}:${input.recoveryEmail}`);
    const mail = adminRecoveryCodeEmail({ code, name: updated.name, minutes: TIMED_CODE_MINUTES });
    const outcome = await sendMail({
      to: input.recoveryEmail,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      from: mail.from,
    });

    return c.json({
      data: {
        destination: maskDestination(input.recoveryEmail),
        delivered: outcome.delivered,
        devCode: undeliverableCode(code),
      },
    });
  },
);

adminAuthRouter.post(
  "/recovery/confirm",
  requireAdmin({ allowOnboarding: true }),
  validate("json", adminMfaVerifySchema),
  async (c) => {
    const input = c.req.valid("json");
    const me = await currentAdmin(c);
    if (!me) return fail(c, 401, "UNAUTHENTICATED", "Sign in again to continue.");
    if (!me.row.recoveryEmail) {
      return fail(c, 409, "NO_RECOVERY_ADDRESS", "Enter a recovery address first.");
    }

    if (!verifyTimedCode("admin.recovery", `${me.row.id}:${me.row.recoveryEmail}`, input.code)) {
      return fail(c, 401, "CODE_INVALID", "That code is not correct or has expired. Send a new one.");
    }

    const updated = await prisma.adminUser.update({
      where: { id: me.row.id },
      data: { recoveryEmailVerifiedAt: new Date() },
      select: ADMIN_SELECT,
    });
    refreshSession(c, me.session, updated);

    await record(c, {
      action: "admin.recovery.set",
      outcome: "success",
      actorType: "admin",
      actorId: updated.id,
      actorLabel: updated.email,
      targetType: "admin",
      targetId: updated.id,
      // The address itself is not written to the audit detail: this table is
      // read by every auditor role, and a personal recovery inbox is not
      // something the trail needs in order to attribute the action.
      detail: { domain: updated.recoveryEmail?.split("@")[1] ?? null },
    });

    return c.json({ data: sessionView(updated) });
  },
);

/* ==================================================== POLICY (STEP FOUR) */

adminAuthRouter.post(
  "/policy",
  requireAdmin({ allowOnboarding: true }),
  validate("json", adminAcceptPolicySchema),
  async (c) => {
    const me = await currentAdmin(c);
    if (!me) return fail(c, 401, "UNAUTHENTICATED", "Sign in again to continue.");

    const updated = await prisma.adminUser.update({
      where: { id: me.row.id },
      data: { policyAcceptedAt: new Date(), policyVersion: ADMIN_POLICY_VERSION },
      select: ADMIN_SELECT,
    });
    refreshSession(c, me.session, updated);

    await record(c, {
      action: "admin.policy.accepted",
      outcome: "success",
      actorType: "admin",
      actorId: updated.id,
      actorLabel: updated.email,
      targetType: "admin",
      targetId: updated.id,
      newStatus: ADMIN_POLICY_VERSION,
    });

    return c.json({ data: sessionView(updated) });
  },
);

export { adminAuthRouter };
