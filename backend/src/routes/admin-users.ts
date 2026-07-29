import { Hono } from "hono";
import type { Context } from "hono";
import { prisma } from "../db";
import { rateLimit } from "../security/rate-limit";
import { requireAdmin, requireAdminPermission } from "../security/staff-session";
import { record } from "../security/audit-store";
import { generateStrongPassword, hashPassword } from "../security/passwords";
import { ADMIN_ROLE_LABELS, assignableRoles, type AdminRole } from "../security/admin-roles";
import { ADMIN_POLICY_VERSION } from "./admin-auth";
import { sendMail } from "../email/mailer";
import { adminAccessChangedEmail, adminAccountCreatedEmail } from "../email/templates";
import {
  createAdminSchema,
  updateAdminSchema,
  type AdminOnboardingStep,
  type AdminUserView,
} from "../types";

/**
 * Administrator management — Admin → Admin users.
 *
 * This is the most dangerous router in the application: it is the one that can
 * manufacture privilege. Five rules shape every route, and each exists because
 * of a specific way this kind of endpoint is normally broken:
 *
 *   1. ONLY A SUPER ADMIN. Every write is behind `admins.manage`, which only
 *      super_admin holds, and the assignable-role list is asked for on every
 *      create and every role change rather than assumed. Without that, any role
 *      that could reach this file could grant itself super_admin and make the
 *      whole permission system decorative.
 *
 *   2. NOBODY ACTS ON THEMSELVES. A Super Admin cannot change their own role or
 *      suspend their own account. Self-demotion is an own goal that needs another
 *      administrator to undo, and self-suspension is how a deployment ends up
 *      with nobody who can sign in.
 *
 *   3. THE LAST ACTIVE SUPER ADMIN IS PROTECTED. They cannot be suspended or
 *      demoted, by anyone, including themselves. A portal with no Super Admin
 *      cannot create one — the only way back is a shell on the server.
 *
 *   4. THE PASSWORD IS SHOWN ONCE. It is generated from the CSPRNG here, stored
 *      only as an argon2id hash, returned in exactly one response, and never
 *      emailed. There is no route that can show it again, which is why the
 *      portal's reveal dialog has to be dismissed deliberately.
 *
 *   5. A CHANGE TAKES EFFECT ON THE NEXT REQUEST. Suspension, role change and
 *      password reset all bump `sessionEpoch`, which invalidates every live
 *      session on that account. A suspension that waits for the next sign-in is
 *      not a suspension.
 */
const adminUsersRouter = new Hono();

/** Matches the seed script and AdminUser.tempPasswordExpiresAt semantics. */
const TEMP_PASSWORD_TTL_MS = 24 * 60 * 60 * 1000;

/*
 * Creating administrators is rare and expensive (argon2id plus an email). Twenty
 * an hour is far more than a real organisation needs in a day and low enough
 * that a stolen Super Admin session cannot quietly build a bench of backdoor
 * accounts before anyone reads the trail.
 */
adminUsersRouter.use("/", rateLimit({ name: "admin:admins:create", limit: 20, windowMs: 60 * 60_000 }));

adminUsersRouter.use("*", requireAdmin());

function fail(c: Context, status: 400 | 403 | 404 | 409, code: string, message: string) {
  return c.json({ error: { message, code } }, status);
}

const ADMIN_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  mfaEnabledAt: true,
  mustChangePassword: true,
  recoveryEmailVerifiedAt: true,
  policyAcceptedAt: true,
  policyVersion: true,
  lockedUntil: true,
  lastLoginAt: true,
  lastLoginIp: true,
  createdAt: true,
  createdBy: true,
} as const;

type AdminRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  mfaEnabledAt: Date | null;
  mustChangePassword: boolean;
  recoveryEmailVerifiedAt: Date | null;
  policyAcceptedAt: Date | null;
  policyVersion: string | null;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  createdAt: Date;
  createdBy: string | null;
};

/**
 * The first-run steps this account still owes.
 *
 * Duplicates `outstandingSteps()` in admin-auth.ts deliberately: that one is
 * computed from the session owner's row to decide what they are allowed to do,
 * this one is computed from someone else's row to display "setup incomplete" in
 * a list. Sharing it would mean exporting an authorisation primitive to a view
 * layer, and the day the display needs an exception is the day the gate gets one.
 */
function outstanding(row: AdminRow): AdminOnboardingStep[] {
  const steps: AdminOnboardingStep[] = [];
  if (row.mustChangePassword) steps.push("password");
  if (!row.mfaEnabledAt) steps.push("mfa");
  if (!row.recoveryEmailVerifiedAt) steps.push("recovery");
  if (!row.policyAcceptedAt || row.policyVersion !== ADMIN_POLICY_VERSION) steps.push("policy");
  return steps;
}

/**
 * The row as the portal sees it.
 *
 * Carries no credential material — no password hash, no MFA secret, no recovery
 * codes, not even the recovery address. `mfaEnabled` is a boolean derived from a
 * timestamp, which is all a list needs to answer "is this account properly set
 * up". A management screen that ships the secrets it manages is how an
 * over-broad SELECT becomes a breach.
 */
function adminView(row: AdminRow): AdminUserView {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as AdminUserView["role"],
    status: row.status,
    mfaEnabled: Boolean(row.mfaEnabledAt),
    mustChangePassword: row.mustChangePassword,
    lockedUntil: row.lockedUntil && row.lockedUntil > new Date() ? row.lockedUntil.toISOString() : null,
    outstanding: outstanding(row),
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    lastLoginIp: row.lastLoginIp ?? null,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy ?? null,
  };
}

/** How many Super Admins could sign in right now. Rule 3 depends on this. */
function activeSuperAdmins(): Promise<number> {
  return prisma.adminUser.count({ where: { role: "super_admin", status: "active" } });
}

/**
 * Confirm the caller may hand out this role.
 *
 * `assignableRoles()` is the single place that answers it, and it returns the
 * full list only for super_admin. Asked on every write rather than once at the
 * top of the file: a permission check that runs in one place is a permission
 * check that a new route forgets.
 */
function mayAssign(callerRole: string | null | undefined, role: string): boolean {
  return (assignableRoles(callerRole) as string[]).includes(role);
}

/**
 * The caller's role, with the break-glass account treated as Super Admin.
 *
 * The environment-credential session (no `uid`) proved the deployment's highest
 * secret, and it exists precisely so a locked-out or empty admin table is
 * recoverable — which requires being able to create an administrator.
 */
function callerRole(c: Context): string {
  const session = c.get("staff");
  return session?.role ?? (session?.uid ? "" : "super_admin");
}

function actor(c: Context): { id: string | null; label: string } {
  const session = c.get("staff");
  return { id: session?.uid ?? null, label: session?.sub ?? "unknown" };
}

/* ------------------------------------------------------------------- LIST */

adminUsersRouter.get("/", requireAdminPermission("admins.view"), async (c) => {
  const rows = await prisma.adminUser.findMany({
    select: ADMIN_SELECT,
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });

  const items = rows.map(adminView);

  return c.json({
    data: {
      items,
      /*
       * Sent so the portal can disable its own controls for the signed-in
       * administrator and for the last Super Admin. This is UI hygiene, not
       * access control — every rule is re-checked below on the request itself.
       */
      selfId: c.get("staff")?.uid ?? null,
      assignableRoles: assignableRoles(callerRole(c)),
      superAdminCount: items.filter((a) => a.role === "super_admin" && a.status === "active").length,
    },
  });
});

/* ----------------------------------------------------------------- CREATE */

adminUsersRouter.post("/", requireAdminPermission("admins.manage"), async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return fail(c, 400, "BAD_REQUEST", "Invalid request.");
  }

  const parsed = createAdminSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return c.json(
      {
        error: {
          message: issue?.message ?? "Check the administrator's details.",
          code: "VALIDATION_ERROR",
          fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? "body")))],
        },
      },
      400,
    );
  }
  const input = parsed.data;

  if (!mayAssign(callerRole(c), input.role)) {
    return fail(c, 403, "FORBIDDEN", "Your role cannot assign that role.");
  }

  const clash = await prisma.adminUser.findUnique({ where: { email: input.email }, select: { id: true } });
  if (clash) {
    /*
     * Told plainly. This is not an enumeration leak: the caller is already a
     * signed-in Super Admin who can list every administrator on the next line,
     * and a vague error here would just mean creating the account twice.
     */
    return fail(c, 409, "EMAIL_TAKEN", "An administrator with that email address already exists.");
  }

  const temporaryPassword = generateStrongPassword(20);
  const passwordHash = await hashPassword(temporaryPassword);
  const expiresAt = new Date(Date.now() + TEMP_PASSWORD_TTL_MS);
  const by = actor(c);

  const created = await prisma.adminUser.create({
    data: {
      name: input.name,
      email: input.email,
      role: input.role,
      status: "active",
      passwordHash,
      mustChangePassword: true,
      tempPasswordExpiresAt: expiresAt,
      createdBy: by.label,
    },
    select: ADMIN_SELECT,
  });

  await record(c, {
    action: "admin.created",
    outcome: "success",
    actorType: "admin",
    actorId: by.id,
    actorLabel: by.label,
    targetType: "admin",
    targetId: created.id,
    newStatus: "active",
    detail: { role: created.role, temporary: true, expiresAt: expiresAt.toISOString() },
  });

  /*
   * The notice carries no password (see adminAccountCreatedEmail). A failure to
   * send is reported to the caller and does NOT fail the creation: the account
   * and its one-time password already exist, and rolling them back because the
   * mail server was down would destroy a credential the Super Admin is looking
   * at on screen.
   */
  const mail = await sendMail({
    ...adminAccountCreatedEmail({
      name: created.name,
      roleLabel: ADMIN_ROLE_LABELS[created.role as AdminRole] ?? created.role,
      createdBy: by.label,
      signInPath: `${process.env.PUBLIC_SITE_URL ?? "https://getpaybridge.com"}/admin/login`,
    }),
    to: created.email,
  }).catch(() => ({ delivered: false, note: "send threw" }));

  return c.json({
    data: {
      admin: adminView(created),
      temporaryPassword,
      expiresAt: expiresAt.toISOString(),
      notified: mail.delivered,
    },
  });
});

/* --------------------------------------------------- ROLE AND SUSPENSION */

adminUsersRouter.patch("/:id", requireAdminPermission("admins.manage"), async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return fail(c, 400, "BAD_REQUEST", "Invalid request.");
  }

  const parsed = updateAdminSchema.safeParse(body);
  if (!parsed.success) {
    return fail(c, 400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Nothing to change.");
  }
  const input = parsed.data;
  const id = c.req.param("id");
  const by = actor(c);

  const target = await prisma.adminUser.findUnique({ where: { id }, select: ADMIN_SELECT });
  if (!target) return fail(c, 404, "NOT_FOUND", "That administrator does not exist.");

  // Rule 2. Applies to the signed-in database administrator; the break-glass
  // session has no row and therefore no self to act on.
  if (by.id && by.id === target.id) {
    return fail(
      c,
      403,
      "SELF_CHANGE",
      "You cannot change your own role or suspend your own account. Ask another Super Admin.",
    );
  }

  const roleChanged = input.role !== undefined && input.role !== target.role;
  const statusChanged = input.status !== undefined && input.status !== target.status;

  if (!roleChanged && !statusChanged) {
    return c.json({ data: { admin: adminView(target) } });
  }

  if (roleChanged && !mayAssign(callerRole(c), input.role!)) {
    return fail(c, 403, "FORBIDDEN", "Your role cannot assign that role.");
  }

  // Rule 3: the last Super Admin who can still sign in cannot be demoted or
  // suspended. Counted at the moment of the change, not cached.
  const losingSuperAdmin =
    target.role === "super_admin" &&
    target.status === "active" &&
    ((roleChanged && input.role !== "super_admin") || (statusChanged && input.status === "suspended"));

  if (losingSuperAdmin && (await activeSuperAdmins()) <= 1) {
    return fail(
      c,
      409,
      "LAST_SUPER_ADMIN",
      "This is the only active Super Admin. Appoint another one first — a portal with no Super Admin cannot create one.",
    );
  }

  const updated = await prisma.adminUser.update({
    where: { id: target.id },
    data: {
      ...(roleChanged ? { role: input.role } : {}),
      ...(statusChanged ? { status: input.status } : {}),
      /*
       * Rule 5. One bump covers both changes: it ends every live session on the
       * account, so a demoted administrator loses the old role's reach
       * immediately and a suspended one stops mid-request rather than at their
       * next sign-in.
       *
       * A reinstatement bumps it too. That is not strictly required, but it means
       * "reinstated" always starts from a clean sign-in rather than resurrecting
       * whatever session was open when the suspension landed.
       */
      sessionEpoch: { increment: 1 },
      // Reinstating clears the failed-attempt lockout: a Super Admin deliberately
      // re-enabling an account outranks the counter that locked it.
      ...(statusChanged && input.status === "active" ? { failedLoginCount: 0, lockedUntil: null } : {}),
    },
    select: ADMIN_SELECT,
  });

  if (roleChanged) {
    await record(c, {
      action: "admin.role.changed",
      outcome: "success",
      actorType: "admin",
      actorId: by.id,
      actorLabel: by.label,
      targetType: "admin",
      targetId: target.id,
      previousStatus: target.role,
      newStatus: updated.role,
      detail: { reason: input.reason || null, subject: target.email },
    });
  }

  if (statusChanged) {
    await record(c, {
      action: input.status === "suspended" ? "admin.suspended" : "admin.reinstated",
      outcome: "success",
      actorType: "admin",
      actorId: by.id,
      actorLabel: by.label,
      targetType: "admin",
      targetId: target.id,
      previousStatus: target.status,
      newStatus: updated.status,
      detail: { reason: input.reason || null, subject: target.email },
    });
  }

  // The account holder is told. The internal reason is not included — see
  // adminAccessChangedEmail. Mail failure never fails the change: the access
  // decision has already taken effect and must not be rolled back by an outage.
  await sendMail({
    ...adminAccessChangedEmail({
      name: updated.name,
      change: statusChanged ? (input.status === "suspended" ? "suspended" : "reinstated") : "role",
      roleLabel: ADMIN_ROLE_LABELS[updated.role as AdminRole] ?? updated.role,
      at: new Date(),
    }),
    to: updated.email,
  }).catch(() => undefined);

  return c.json({ data: { admin: adminView(updated) } });
});

/* -------------------------------------------------------- PASSWORD RESET */

/*
 * Same ceiling as creation, and for the same reason: each call mints a working
 * credential for a privileged account.
 */
adminUsersRouter.use("/:id/reset-password", rateLimit({ name: "admin:admins:reset", limit: 20, windowMs: 60 * 60_000 }));

adminUsersRouter.post("/:id/reset-password", requireAdminPermission("admins.manage"), async (c) => {
  const id = c.req.param("id");
  const by = actor(c);

  const target = await prisma.adminUser.findUnique({ where: { id }, select: ADMIN_SELECT });
  if (!target) return fail(c, 404, "NOT_FOUND", "That administrator does not exist.");

  /*
   * Resetting your OWN password this way is blocked. The portal has a change-
   * password flow that requires the current password; this route does not, so
   * allowing it on yourself would turn a hijacked Super Admin session into a
   * permanent credential without ever knowing the original password.
   */
  if (by.id && by.id === target.id) {
    return fail(c, 403, "SELF_CHANGE", "Change your own password in Security settings instead.");
  }

  const temporaryPassword = generateStrongPassword(20);
  const passwordHash = await hashPassword(temporaryPassword);
  const expiresAt = new Date(Date.now() + TEMP_PASSWORD_TTL_MS);

  const updated = await prisma.adminUser.update({
    where: { id: target.id },
    data: {
      passwordHash,
      mustChangePassword: true,
      tempPasswordExpiresAt: expiresAt,
      failedLoginCount: 0,
      lockedUntil: null,
      // Ends every live session: the usual reason to reset is that the old
      // credential may be in someone else's hands.
      sessionEpoch: { increment: 1 },
      /*
       * MFA IS DELIBERATELY NOT CLEARED. The second factor is what protects the
       * account while a freshly generated temporary password is being passed
       * from one person to another. Clearing it here would turn "reset a
       * password" into a complete authentication bypass available to anyone
       * holding a Super Admin session.
       */
    },
    select: ADMIN_SELECT,
  });

  await record(c, {
    action: "admin.password.reset_issued",
    outcome: "success",
    actorType: "admin",
    actorId: by.id,
    actorLabel: by.label,
    targetType: "admin",
    targetId: target.id,
    detail: { temporary: true, expiresAt: expiresAt.toISOString(), subject: target.email, mfaPreserved: true },
  });

  return c.json({
    data: {
      admin: adminView(updated),
      temporaryPassword,
      expiresAt: expiresAt.toISOString(),
      // No email is sent for a reset: the notice would say "expect a password
      // from someone", which is indistinguishable from the phishing mail an
      // attacker would send alongside a stolen credential.
      notified: false,
    },
  });
});

/* ------------------------------------------------------------- SIGN OUT */

adminUsersRouter.post("/:id/sign-out", requireAdminPermission("admins.manage"), async (c) => {
  const id = c.req.param("id");
  const by = actor(c);

  const target = await prisma.adminUser.findUnique({ where: { id }, select: ADMIN_SELECT });
  if (!target) return fail(c, 404, "NOT_FOUND", "That administrator does not exist.");

  /*
   * Allowed on yourself, unlike everything else here: signing your own sessions
   * out is a reduction in reach, not an increase, and it is the correct panic
   * button for "I left the portal open on a machine I no longer trust". The
   * caller's current session dies with it, which is the honest behaviour.
   */
  const updated = await prisma.adminUser.update({
    where: { id: target.id },
    data: { sessionEpoch: { increment: 1 } },
    select: ADMIN_SELECT,
  });

  await record(c, {
    action: "admin.sessions.invalidated",
    outcome: "success",
    actorType: "admin",
    actorId: by.id,
    actorLabel: by.label,
    targetType: "admin",
    targetId: target.id,
    detail: { subject: target.email, self: by.id === target.id },
  });

  return c.json({ data: { admin: adminView(updated), self: by.id === target.id } });
});

export { adminUsersRouter };
