import { Hono } from "hono";
import type { Context, MiddlewareHandler, Next } from "hono";
import { prisma } from "../db";
import { rateLimit } from "../security/rate-limit";
import { validate } from "../security/validate";
import { record } from "../security/audit-store";
import {
  clearEmployerSession,
  issueEmployerSession,
  readEmployerSession,
  signEmployerInvite,
  touchEmployerSession,
  verifyEmployerInvite,
  type EmployerSessionPayload,
} from "../security/employer-session";
import { burnPasswordTime, checkPasswordPolicy, hashPassword, verifyPassword } from "../security/passwords";
import { sendMail } from "../email/mailer";
import { PARTNERSHIPS } from "../email/identities";
import {
  acceptEmployerInviteSchema,
  EMPLOYER_TEAM_ROLE_LABELS,
  inviteEmployerTeamMemberSchema,
  registerEmployerSchema,
  employerSignInSchema,
  updateEmployerProfileSchema,
  type EmployerProfileView,
  type EmployerSessionView,
  type EmployerTeamMemberView,
  type EmployerTeamRole,
} from "../types";

/**
 * Employer accounts — a company's own multi-seat login.
 *
 * Deliberately separate from customer accounts (routes/auth.ts) and from
 * PayBridge staff (routes/admin-auth.ts): an employer is a company with a
 * team, not one person. The first person to register a company becomes its
 * `employer_admin`, who can invite colleagues — each with their own email and
 * password, each scoped to one company by `EmployerUser.employerId`.
 *
 * "An employer exists for real" is the precondition every downstream service
 * in AGENTS.md's punch list depends on: payroll ingestion, eligibility,
 * inviting employees, Bridge requests. This router is that precondition.
 */
declare module "hono" {
  interface ContextVariableMap {
    employerUser?: { id: string; employerId: string; fullName: string; email: string; role: EmployerTeamRole };
  }
}

const employerRouter = new Hono();

employerRouter.use("/register", rateLimit({ name: "employer:register", limit: 6, windowMs: 60 * 60_000 }));
employerRouter.use("/login", rateLimit({ name: "employer:login:ip", limit: 12, windowMs: 15 * 60_000 }));
employerRouter.use(
  "/login",
  async (c, next) => {
    try {
      const body = (await c.req.json()) as { email?: unknown };
      if (typeof body?.email === "string") c.set("loginEmail", body.email.trim().toLowerCase().slice(0, 200));
    } catch {
      /* validator reports the shape error */
    }
    await next();
  },
);
employerRouter.use(
  "/login",
  rateLimit({ name: "employer:login:email", limit: 6, windowMs: 15 * 60_000, keyExtra: (c) => c.get("loginEmail") }),
);
employerRouter.use("/team/invite", rateLimit({ name: "employer:team:invite", limit: 20, windowMs: 60 * 60_000 }));
employerRouter.use(
  "/team/accept-invite",
  rateLimit({ name: "employer:team:accept", limit: 10, windowMs: 60 * 60_000 }),
);

function fail(c: Context, status: 400 | 401 | 403 | 404 | 409 | 423 | 429, code: string, message: string) {
  return c.json({ error: { code, message } }, status);
}

/** Re-reads the row on every request — see requireUser() in auth.ts for why. */
function requireEmployerUser(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const session = readEmployerSession(c);
    if (!session) return fail(c, 401, "UNAUTHENTICATED", "Sign in to continue.");

    const row = await prisma.employerUser.findUnique({
      where: { id: session.sub },
      select: {
        id: true,
        employerId: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        sessionEpoch: true,
      },
    });

    if (!row) {
      clearEmployerSession(c);
      return fail(c, 401, "UNAUTHENTICATED", "Sign in to continue.");
    }
    if (session.epoch !== row.sessionEpoch) {
      clearEmployerSession(c);
      return fail(c, 401, "SESSION_STALE", "Your session has ended. Please sign in again.");
    }
    if (row.status === "suspended") {
      clearEmployerSession(c);
      return fail(c, 403, "ACCOUNT_SUSPENDED", "Your access has been suspended. Contact your company admin.");
    }

    c.set("employerUser", {
      id: row.id,
      employerId: row.employerId,
      fullName: row.fullName,
      email: row.email,
      role: row.role as EmployerTeamRole,
    });
    touchEmployerSession(c, session);
    await next();
  };
}

function requireEmployerAdmin(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const employerUser = c.get("employerUser");
    if (employerUser?.role !== "employer_admin") {
      return fail(c, 403, "FORBIDDEN", "Only a company admin can do this.");
    }
    await next();
  };
}

async function sessionViewFor(payload: EmployerSessionPayload | null): Promise<EmployerSessionView> {
  const ANONYMOUS: EmployerSessionView = {
    authenticated: false,
    id: null,
    fullName: null,
    email: null,
    role: null,
    employerId: null,
    employerName: null,
    employerStatus: null,
  };
  if (!payload) return ANONYMOUS;

  const row = await prisma.employerUser.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      status: true,
      sessionEpoch: true,
      employer: { select: { registeredName: true, status: true } },
    },
  });
  if (!row || row.status === "suspended" || payload.epoch !== row.sessionEpoch) return ANONYMOUS;

  return {
    authenticated: true,
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    role: row.role as EmployerTeamRole,
    employerId: payload.employerId,
    employerName: row.employer.registeredName,
    employerStatus: row.employer.status as EmployerSessionView["employerStatus"],
  };
}

/* ============================================================== REGISTER */

employerRouter.post("/register", validate("json", registerEmployerSchema), async (c) => {
  const input = c.req.valid("json");

  const verdict = checkPasswordPolicy(input.password, { email: input.email, name: input.fullName });
  if (!verdict.ok) return fail(c, 400, "WEAK_PASSWORD", verdict.message ?? "Choose a stronger password.");

  const existing = await prisma.employerUser.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) {
    await record(c, {
      action: "employer.registered",
      outcome: "failure",
      actorType: "anonymous",
      actorLabel: input.email,
      detail: { reason: "duplicate_email" },
    });
    return fail(c, 409, "EMAIL_IN_USE", "An account already exists for that email address. Try signing in.");
  }

  const { employer, employerUser } = await prisma.$transaction(async (tx) => {
    const employer = await tx.employer.create({
      data: { registeredName: input.companyName, status: "onboarding", createdBy: input.email },
    });
    const employerUser = await tx.employerUser.create({
      data: {
        employerId: employer.id,
        email: input.email,
        fullName: input.fullName,
        passwordHash: await hashPassword(input.password),
        role: "employer_admin",
        status: "active",
        acceptedAt: new Date(),
      },
    });
    await tx.employerContact.create({
      data: {
        employerId: employer.id,
        contactType: "primary",
        fullName: input.fullName,
        email: input.email,
        phone: input.phone || null,
      },
    });
    return { employer, employerUser };
  });

  issueEmployerSession(c, {
    id: employerUser.id,
    employerId: employer.id,
    role: employerUser.role,
    epoch: employerUser.sessionEpoch,
  });

  await record(c, {
    action: "employer.registered",
    outcome: "success",
    actorType: "user",
    actorId: employerUser.id,
    actorLabel: employerUser.email,
    targetType: "employer",
    targetId: employer.id,
    newStatus: "onboarding",
    detail: { companyName: employer.registeredName },
  });

  await sendMail({
    to: employerUser.email,
    from: PARTNERSHIPS,
    subject: `Welcome to PayBridge, ${employer.registeredName}`,
    text: `Hello ${input.fullName},\n\nYour PayBridge company account for ${employer.registeredName} has been created. You are the admin for this account and can invite colleagues from Team settings once your company profile is complete.\n\nPayBridge`,
    html: `<p>Hello ${input.fullName},</p><p>Your PayBridge company account for <strong>${employer.registeredName}</strong> has been created. You are the admin for this account and can invite colleagues from Team settings once your company profile is complete.</p><p>PayBridge</p>`,
  }).catch(() => ({ delivered: false, note: "send threw" }));

  return c.json({ data: await sessionViewFor(readEmployerSession(c)) }, 201);
});

/* ================================================================= LOGIN */

employerRouter.post("/login", validate("json", employerSignInSchema), async (c) => {
  const input = c.req.valid("json");

  const row = await prisma.employerUser.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      employerId: true,
      fullName: true,
      email: true,
      passwordHash: true,
      role: true,
      status: true,
      sessionEpoch: true,
      failedLoginCount: true,
      lockedUntil: true,
    },
  });

  if (!row || !row.passwordHash) {
    await burnPasswordTime(input.password);
    await record(c, {
      action: "employer.login.failed",
      outcome: "failure",
      actorType: "anonymous",
      actorLabel: input.email,
      detail: { reason: row ? "invite_not_accepted" : "no_such_account" },
    });
    return fail(c, 401, "INVALID_CREDENTIALS", "That email address or password is not correct.");
  }

  if (row.lockedUntil && row.lockedUntil > new Date()) {
    const minutes = Math.max(1, Math.ceil((row.lockedUntil.getTime() - Date.now()) / 60_000));
    await record(c, {
      action: "employer.login.locked",
      outcome: "denied",
      actorType: "user",
      actorId: row.id,
      actorLabel: row.email,
      targetType: "employer_user",
      targetId: row.id,
      detail: { minutesRemaining: minutes },
    });
    return fail(
      c,
      423,
      "ACCOUNT_LOCKED",
      `Too many incorrect attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}, or contact support@getpaybridge.com.`,
    );
  }

  if (!(await verifyPassword(input.password, row.passwordHash))) {
    const failures = row.failedLoginCount + 1;
    const lock = failures >= 8;
    await prisma.employerUser.update({
      where: { id: row.id },
      data: { failedLoginCount: lock ? 0 : failures, lockedUntil: lock ? new Date(Date.now() + 15 * 60_000) : null },
    });
    await record(c, {
      action: lock ? "employer.login.locked" : "employer.login.failed",
      outcome: "failure",
      actorType: "user",
      actorId: row.id,
      actorLabel: row.email,
      targetType: "employer_user",
      targetId: row.id,
      detail: { failures, locked: lock },
    });
    return fail(c, 401, "INVALID_CREDENTIALS", "That email address or password is not correct.");
  }

  if (row.status === "suspended") {
    await record(c, {
      action: "employer.login.failed",
      outcome: "denied",
      actorType: "user",
      actorId: row.id,
      actorLabel: row.email,
      targetType: "employer_user",
      targetId: row.id,
      detail: { reason: "suspended" },
    });
    return fail(c, 403, "ACCOUNT_SUSPENDED", "Your access has been suspended. Contact your company admin.");
  }

  await prisma.employerUser.update({
    where: { id: row.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  issueEmployerSession(c, { id: row.id, employerId: row.employerId, role: row.role, epoch: row.sessionEpoch });

  await record(c, {
    action: "employer.login",
    outcome: "success",
    actorType: "user",
    actorId: row.id,
    actorLabel: row.email,
    targetType: "employer_user",
    targetId: row.id,
  });

  return c.json({ data: await sessionViewFor(readEmployerSession(c)) });
});

/* ================================================================ LOGOUT */

employerRouter.post("/logout", async (c) => {
  const session = readEmployerSession(c);
  if (session) {
    await record(c, {
      action: "employer.logout",
      outcome: "success",
      actorType: "user",
      actorId: session.sub,
      targetType: "employer_user",
      targetId: session.sub,
    });
  }
  clearEmployerSession(c);
  return c.json({ data: await sessionViewFor(null) });
});

/* =============================================================== SESSION */

employerRouter.get("/session", async (c) => {
  return c.json({ data: await sessionViewFor(readEmployerSession(c)) });
});

/* ============================================================== PROFILE */

employerRouter.get("/profile", requireEmployerUser(), async (c) => {
  const { employerId } = c.get("employerUser")!;
  const row = await prisma.employer.findUniqueOrThrow({ where: { id: employerId } });
  const view: EmployerProfileView = {
    id: row.id,
    registeredName: row.registeredName,
    tradingName: row.tradingName,
    cacNumber: row.cacNumber,
    companyType: row.companyType,
    tin: row.tin,
    registeredAddress: row.registeredAddress,
    operationalAddress: row.operationalAddress,
    website: row.website,
    industry: row.industry,
    employeeCount: row.employeeCount,
    status: row.status as EmployerProfileView["status"],
    createdAt: row.createdAt.toISOString(),
  };
  return c.json({ data: view });
});

employerRouter.patch(
  "/profile",
  requireEmployerUser(),
  requireEmployerAdmin(),
  validate("json", updateEmployerProfileSchema),
  async (c) => {
    const { employerId, id, email } = c.get("employerUser")!;
    const input = c.req.valid("json");

    const data: Record<string, string | number | null> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;
      data[key] = value === "" ? null : value;
    }

    const updated = await prisma.employer.update({ where: { id: employerId }, data });

    await record(c, {
      action: "employer.profile.updated",
      outcome: "success",
      actorType: "user",
      actorId: id,
      actorLabel: email,
      targetType: "employer",
      targetId: employerId,
      detail: { fields: Object.keys(data) },
    });

    const view: EmployerProfileView = {
      id: updated.id,
      registeredName: updated.registeredName,
      tradingName: updated.tradingName,
      cacNumber: updated.cacNumber,
      companyType: updated.companyType,
      tin: updated.tin,
      registeredAddress: updated.registeredAddress,
      operationalAddress: updated.operationalAddress,
      website: updated.website,
      industry: updated.industry,
      employeeCount: updated.employeeCount,
      status: updated.status as EmployerProfileView["status"],
      createdAt: updated.createdAt.toISOString(),
    };
    return c.json({ data: view });
  },
);

/* ================================================================= TEAM */

employerRouter.get("/team", requireEmployerUser(), requireEmployerAdmin(), async (c) => {
  const { employerId } = c.get("employerUser")!;
  const rows = await prisma.employerUser.findMany({
    where: { employerId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      status: true,
      invitedAt: true,
      acceptedAt: true,
      lastLoginAt: true,
    },
  });
  const items: EmployerTeamMemberView[] = rows.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    email: r.email,
    role: r.role as EmployerTeamRole,
    status: r.status as EmployerTeamMemberView["status"],
    invitedAt: r.invitedAt.toISOString(),
    acceptedAt: r.acceptedAt?.toISOString() ?? null,
    lastLoginAt: r.lastLoginAt?.toISOString() ?? null,
  }));
  return c.json({ data: { items } });
});

employerRouter.post(
  "/team/invite",
  requireEmployerUser(),
  requireEmployerAdmin(),
  validate("json", inviteEmployerTeamMemberSchema),
  async (c) => {
    const actor = c.get("employerUser")!;
    const input = c.req.valid("json");

    const existing = await prisma.employerUser.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) return fail(c, 409, "EMAIL_IN_USE", "That email address already has an account.");

    const employer = await prisma.employer.findUniqueOrThrow({
      where: { id: actor.employerId },
      select: { registeredName: true },
    });

    const invited = await prisma.employerUser.create({
      data: {
        employerId: actor.employerId,
        email: input.email,
        fullName: input.fullName,
        role: input.role,
        status: "invited",
        invitedBy: actor.id,
      },
    });

    const link = `${process.env.PUBLIC_SITE_URL ?? "https://getpaybridge.com"}/employer-portal/accept-invite?token=${signEmployerInvite(invited.id)}`;

    await record(c, {
      action: "employer.team.invited",
      outcome: "success",
      actorType: "user",
      actorId: actor.id,
      actorLabel: actor.email,
      targetType: "employer_user",
      targetId: invited.id,
      detail: { role: input.role },
    });

    await sendMail({
      to: input.email,
      from: PARTNERSHIPS,
      subject: `You've been invited to ${employer.registeredName}'s PayBridge account`,
      text: `Hello ${input.fullName},\n\n${actor.fullName} has invited you to join ${employer.registeredName}'s PayBridge account as a ${EMPLOYER_TEAM_ROLE_LABELS[input.role as EmployerTeamRole]}.\n\nAccept the invitation and set your password here:\n${link}\n\nThis link expires in 7 days.\n\nPayBridge`,
      html: `<p>Hello ${input.fullName},</p><p>${actor.fullName} has invited you to join <strong>${employer.registeredName}</strong>'s PayBridge account as a ${EMPLOYER_TEAM_ROLE_LABELS[input.role as EmployerTeamRole]}.</p><p><a href="${link}">Accept the invitation and set your password</a></p><p>This link expires in 7 days.</p><p>PayBridge</p>`,
    }).catch(() => ({ delivered: false, note: "send threw" }));

    return c.json(
      {
        data: {
          id: invited.id,
          email: invited.email,
          fullName: invited.fullName,
          role: invited.role,
          status: invited.status,
        },
      },
      201,
    );
  },
);

employerRouter.post("/team/accept-invite", validate("json", acceptEmployerInviteSchema), async (c) => {
  const input = c.req.valid("json");

  const verified = verifyEmployerInvite(input.token);
  if (!verified) return fail(c, 400, "INVALID_TOKEN", "This invitation link is invalid or has expired.");

  const invited = await prisma.employerUser.findUnique({ where: { id: verified.employerUserId } });
  if (!invited || invited.status !== "invited" || invited.passwordHash) {
    return fail(c, 409, "ALREADY_ACCEPTED", "This invitation has already been used or is no longer valid.");
  }

  const verdict = checkPasswordPolicy(input.password, { email: invited.email, name: invited.fullName });
  if (!verdict.ok) return fail(c, 400, "WEAK_PASSWORD", verdict.message ?? "Choose a stronger password.");

  const updated = await prisma.employerUser.update({
    where: { id: invited.id },
    data: { passwordHash: await hashPassword(input.password), status: "active", acceptedAt: new Date() },
  });

  issueEmployerSession(c, {
    id: updated.id,
    employerId: updated.employerId,
    role: updated.role,
    epoch: updated.sessionEpoch,
  });

  await record(c, {
    action: "employer.team.invite_accepted",
    outcome: "success",
    actorType: "user",
    actorId: updated.id,
    actorLabel: updated.email,
    targetType: "employer_user",
    targetId: updated.id,
  });

  return c.json({ data: await sessionViewFor(readEmployerSession(c)) });
});

employerRouter.post("/team/:id/suspend", requireEmployerUser(), requireEmployerAdmin(), async (c) => {
  const actor = c.get("employerUser")!;
  const targetId = c.req.param("id");
  if (targetId === actor.id) return fail(c, 400, "CANNOT_SUSPEND_SELF", "You cannot suspend your own access.");

  const target = await prisma.employerUser.findFirst({ where: { id: targetId, employerId: actor.employerId } });
  if (!target) return c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404);

  await prisma.employerUser.update({
    where: { id: target.id },
    data: { status: "suspended", sessionEpoch: { increment: 1 } },
  });

  await record(c, {
    action: "employer.team.suspended",
    outcome: "success",
    actorType: "user",
    actorId: actor.id,
    actorLabel: actor.email,
    targetType: "employer_user",
    targetId: target.id,
  });

  return c.json({ data: { ok: true } });
});

employerRouter.post("/team/:id/reinstate", requireEmployerUser(), requireEmployerAdmin(), async (c) => {
  const actor = c.get("employerUser")!;
  const targetId = c.req.param("id");

  const target = await prisma.employerUser.findFirst({ where: { id: targetId, employerId: actor.employerId } });
  if (!target) return c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404);

  await prisma.employerUser.update({ where: { id: target.id }, data: { status: "active" } });

  await record(c, {
    action: "employer.team.reinstated",
    outcome: "success",
    actorType: "user",
    actorId: actor.id,
    actorLabel: actor.email,
    targetType: "employer_user",
    targetId: target.id,
  });

  return c.json({ data: { ok: true } });
});

export { employerRouter, requireEmployerUser, requireEmployerAdmin };
