import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { prisma } from "../db";
import type { DemoInvitation } from "@prisma/client";
import { pseudonymise } from "../security/audit";
import { record } from "../security/audit-store";
import { requireAdmin, requireAdminPermission } from "../security/staff-session";
import { rateLimit } from "../security/rate-limit";
import {
  generateInvitationCode,
  hashInvitationCode,
  invitationCodeHint,
} from "../security/codes";
import { recordEvent } from "../registration-events";
import { sendMail } from "../email/mailer";
import { demoInvitationCode, formatExpiry } from "../email/templates";
import { PARTNERSHIPS } from "../email/identities";
import {
  DEMO_TYPE_LABELS,
  DEMO_TYPE_PORTAL,
  createInvitationSchema,
  extendInvitationSchema,
  revokeInvitationSchema,
  type DemoType,
  type InvitationStatus,
  type InvitationView,
} from "../types";

/**
 * Demonstration invitations — the manager behind Admin → Demo invitations.
 *
 * The rules that shape every route in this file:
 *
 *   1. The plaintext code is generated here, sent by email, returned ONCE in the
 *      response that created it, and then exists nowhere. Only a sha256 of the
 *      canonical form is stored. A database dump therefore contains no working
 *      demonstration credential.
 *
 *   2. Because of (1), "resend" cannot mean "send the same code again" — we do
 *      not have it. Resend issues a NEW code and retires the old one. That is
 *      strictly better than the alternative it replaces: an admin who can read
 *      out an existing code is an admin whose account compromise hands over
 *      every outstanding invitation.
 *
 *   3. The code never travels in a URL. Not in a link we send, not in a query
 *      string, not in a redirect. The invitee types it into a form.
 *
 *   4. Nothing here is destructive. Revoking sets a timestamp; extending records
 *      that it was extended. The list is the audit trail's twin, and an
 *      invitation that vanished is an invitation nobody can answer questions
 *      about.
 */
const invitationsRouter = new Hono();

/** Ninety days. An invitation that outlives a quarter is not an invitation. */
const MAX_EXPIRY_MS = 90 * 24 * 60 * 60 * 1000;

/*
 * Creation and resending both send mail to an address an administrator typed.
 * The cap is generous for real work and low enough that a compromised admin
 * session cannot turn this endpoint into a mail cannon carrying our domain's
 * reputation.
 */
invitationsRouter.use("/", rateLimit({ name: "admin:invite:create", limit: 40, windowMs: 60 * 60_000 }));
invitationsRouter.use("/:id/resend", rateLimit({ name: "admin:invite:resend", limit: 40, windowMs: 60 * 60_000 }));

invitationsRouter.use("*", requireAdmin());

function fail(c: Context, status: 400 | 404 | 409, code: string, message: string) {
  return c.json({ error: { message, code } }, status);
}

/**
 * Lifecycle status, derived on every read rather than stored.
 *
 * WHY derived: "expired" is a fact about the clock, and a stored status column
 * would be wrong from the moment the expiry passed until some job noticed. The
 * order of these checks is the precedence: a revoked invitation is revoked even
 * if it was also used, because that is the answer to "why can't they get in?".
 */
export function invitationStatus(row: DemoInvitation, now = new Date()): InvitationStatus {
  if (row.revokedAt) return "revoked";
  if (row.useCount >= row.maxUses) return "used";
  if (row.expiresAt <= now) return "expired";
  if (row.openedAt) return "opened";
  return "pending";
}

/** The row as the portal sees it. Contains no secret — by construction. */
export function invitationView(row: DemoInvitation): InvitationView {
  return {
    id: row.id,
    inviteeName: row.inviteeName ?? row.label ?? null,
    email: row.email,
    organisation: row.organisation ?? null,
    demoType: (row.demoType as DemoType) ?? "full_platform",
    portal: row.portal,
    codeHint: row.tokenHint,
    status: invitationStatus(row),
    expiresAt: row.expiresAt.toISOString(),
    maxUses: row.maxUses,
    useCount: row.useCount,
    redeemedAt: row.redeemedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    revokedBy: row.revokedBy ?? null,
    openedAt: row.openedAt?.toISOString() ?? null,
    lastSentAt: row.lastSentAt?.toISOString() ?? null,
    sendCount: row.sendCount,
    extendedAt: row.extendedAt?.toISOString() ?? null,
    internalNote: row.internalNote ?? null,
    issuedBy: row.issuedBy,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Where the invitee is told to go.
 *
 * Only the human-readable host is used, and only in the message body — there is
 * no link to click and therefore nothing to point at an attacker's host. This is
 * why no client-supplied base URL is accepted here: the previous link-based
 * design needed one, and needing one is what made a PayBridge-branded phishing
 * mail a configuration mistake away.
 */
function siteUrl(): string {
  return process.env.PUBLIC_SITE_URL ?? process.env.DEMO_BASE_URL ?? "https://getpaybridge.com";
}

/** Parse an admin-supplied expiry, rejecting the past and capping the future. */
function parseExpiry(value: string): { at: Date } | { error: string } {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return { error: "That expiry is not a valid date and time." };
  if (at.getTime() <= Date.now() + 60_000) return { error: "The expiry must be at least a minute in the future." };
  if (at.getTime() > Date.now() + MAX_EXPIRY_MS) return { error: "Invitations cannot last longer than 90 days." };
  return { at };
}

/* ------------------------------------------------------------------- LIST */

const listSchema = z.object({
  status: z.string().trim().optional(),
  q: z.string().trim().max(160).optional(),
  take: z.coerce.number().int().min(1).max(200).default(100),
});

invitationsRouter.get("/", requireAdminPermission("invitations.view"), async (c) => {
  const parsed = listSchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  const filters = parsed.success ? parsed.data : { take: 100, status: undefined, q: undefined };

  /*
   * The status filter is applied in memory because status is derived, not a
   * column. The list is capped at 200 rows, so this is a trivial pass over a
   * small array — not a table scan pretending to be a filter.
   */
  const rows = await prisma.demoInvitation.findMany({
    where: filters.q
      ? {
          OR: [
            { email: { contains: filters.q, mode: "insensitive" } },
            { inviteeName: { contains: filters.q, mode: "insensitive" } },
            { organisation: { contains: filters.q, mode: "insensitive" } },
            { tokenHint: { contains: filters.q.toUpperCase(), mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: filters.take,
  });

  const views = rows.map(invitationView);
  const filtered = filters.status ? views.filter((view) => view.status === filters.status) : views;

  return c.json({
    data: {
      items: filtered,
      counts: {
        total: views.length,
        pending: views.filter((v) => v.status === "pending").length,
        opened: views.filter((v) => v.status === "opened").length,
        used: views.filter((v) => v.status === "used").length,
        expired: views.filter((v) => v.status === "expired").length,
        revoked: views.filter((v) => v.status === "revoked").length,
      },
    },
  });
});

/* ----------------------------------------------------------------- CREATE */

invitationsRouter.post("/", requireAdminPermission("invitations.manage"), async (c) => {
  const session = c.get("staff");

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return fail(c, 400, "BAD_REQUEST", "Invalid request.");
  }

  const parsed = createInvitationSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return c.json(
      {
        error: {
          message: issue?.message ?? "Check the invitation details.",
          code: "VALIDATION_ERROR",
          fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? "body")))],
        },
      },
      400,
    );
  }
  const input = parsed.data;

  const expiry = parseExpiry(input.expiresAt);
  if ("error" in expiry) return fail(c, 400, "VALIDATION_ERROR", expiry.error);

  const code = generateInvitationCode();
  const portal = DEMO_TYPE_PORTAL[input.demoType];

  const invitation = await prisma.demoInvitation.create({
    data: {
      tokenHash: hashInvitationCode(code),
      tokenHint: invitationCodeHint(code),
      email: input.email,
      inviteeName: input.inviteeName,
      organisation: input.organisation || null,
      label: input.inviteeName,
      demoType: input.demoType,
      portal,
      internalNote: input.internalNote || null,
      issuedBy: session?.sub ?? "unknown",
      issuedByAdminId: session?.uid ?? null,
      registrationId: input.registrationId || null,
      expiresAt: expiry.at,
      maxUses: input.maxUses,
    },
  });

  let delivered = false;
  let note = "Not sent — the code was generated for you to pass on yourself.";

  if (input.sendEmail) {
    const email = demoInvitationCode({
      code,
      expiresAt: expiry.at,
      inviteeName: input.inviteeName,
      demoTypeLabel: DEMO_TYPE_LABELS[input.demoType],
      siteUrl: siteUrl(),
    });
    const outcome = await sendMail({
      to: input.email,
      from: PARTNERSHIPS,
      replyTo: PARTNERSHIPS.inbox,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    delivered = outcome.delivered;
    note = outcome.note;

    await prisma.demoInvitation.update({
      where: { id: invitation.id },
      data: { lastSentAt: new Date(), sendCount: { increment: 1 } },
    });
  }

  if (input.registrationId) {
    /*
     * The timeline records the HINT, never the code. More people read a
     * registration timeline than are authorised to open the demonstration.
     */
    await recordEvent({
      registrationId: input.registrationId,
      kind: "invitation_issued",
      actor: session?.sub ?? "unknown",
      message:
        `Private demonstration invitation ${invitation.tokenHint} issued ` +
        `(${DEMO_TYPE_LABELS[input.demoType]}), expiring ${formatExpiry(expiry.at)}. ` +
        (input.sendEmail ? (delivered ? `Emailed successfully.` : `EMAIL NOT DELIVERED: ${note}`) : "Not emailed."),
    }).catch(() => null);

    await prisma.registration
      .update({
        where: { id: input.registrationId },
        data: {
          demoInvitationStatus: delivered ? "Invited" : "Invitation created (not emailed)",
          status: "Demo Invited",
        },
      })
      .catch(() => null);
  }

  await record(c, {
    action: "invitation.created",
    outcome: "success",
    actorType: "admin",
    actorId: session?.uid ?? null,
    actorLabel: session?.sub ?? "unknown",
    targetType: "invitation",
    targetId: invitation.id,
    newStatus: "pending",
    detail: {
      to: pseudonymise(input.email),
      codeHint: invitation.tokenHint,
      demoType: input.demoType,
      maxUses: input.maxUses,
      expiresAt: expiry.at.toISOString(),
      emailed: delivered,
      actorRole: session?.role,
    },
  });

  return c.json({
    data: {
      invitation: invitationView({ ...invitation, sendCount: input.sendEmail ? 1 : 0 }),
      /*
       * The one and only time the plaintext code leaves this server towards an
       * administrator. It is not written to the audit trail, not logged, and
       * cannot be re-read from any endpoint afterwards.
       */
      code,
      emailed: delivered,
      note,
    },
  });
});

/* ----------------------------------------------------------------- RESEND */

invitationsRouter.post("/:id/resend", requireAdminPermission("invitations.manage"), async (c) => {
  const session = c.get("staff");
  const row = await prisma.demoInvitation.findUnique({ where: { id: c.req.param("id") } });
  if (!row) return fail(c, 404, "NOT_FOUND", "That invitation no longer exists.");

  const previous = invitationStatus(row);
  if (previous === "revoked") {
    return fail(c, 409, "INVITATION_REVOKED", "This invitation was revoked. Create a new one instead.");
  }
  if (previous === "used") {
    return fail(c, 409, "INVITATION_USED", "This invitation has been fully used. Create a new one instead.");
  }

  /*
   * A new code, because the old one is unreadable to us by design. The old hash
   * is overwritten in the same write, so exactly one code is live per invitation
   * at any moment — resending twice does not leave two working codes behind.
   */
  const code = generateInvitationCode();

  /* An expired invitation being resent is pushed 72 hours out; resending a dead
   * code would just produce another support email. */
  const expiresAt = previous === "expired" ? new Date(Date.now() + 72 * 60 * 60 * 1000) : row.expiresAt;

  const email = demoInvitationCode({
    code,
    expiresAt,
    inviteeName: row.inviteeName ?? row.label,
    demoTypeLabel: DEMO_TYPE_LABELS[(row.demoType as DemoType) ?? "full_platform"],
    siteUrl: siteUrl(),
  });
  const outcome = await sendMail({
    to: row.email,
    from: PARTNERSHIPS,
    replyTo: PARTNERSHIPS.inbox,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });

  const updated = await prisma.demoInvitation.update({
    where: { id: row.id },
    data: {
      tokenHash: hashInvitationCode(code),
      tokenHint: invitationCodeHint(code),
      expiresAt,
      extendedAt: previous === "expired" ? new Date() : row.extendedAt,
      lastSentAt: new Date(),
      sendCount: { increment: 1 },
      // The new code has not been seen yet, whatever happened to the old one.
      openedAt: null,
    },
  });

  await record(c, {
    action: "invitation.resent",
    outcome: "success",
    actorType: "admin",
    actorId: session?.uid ?? null,
    actorLabel: session?.sub ?? "unknown",
    targetType: "invitation",
    targetId: row.id,
    previousStatus: previous,
    newStatus: invitationStatus(updated),
    detail: {
      to: pseudonymise(row.email),
      newCodeHint: updated.tokenHint,
      reissued: true,
      emailed: outcome.delivered,
      actorRole: session?.role,
    },
  });

  return c.json({
    data: { invitation: invitationView(updated), code, emailed: outcome.delivered, note: outcome.note },
  });
});

/* ----------------------------------------------------------------- EXTEND */

invitationsRouter.post("/:id/extend", requireAdminPermission("invitations.manage"), async (c) => {
  const session = c.get("staff");

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return fail(c, 400, "BAD_REQUEST", "Invalid request.");
  }
  const parsed = extendInvitationSchema.safeParse(body);
  if (!parsed.success) return fail(c, 400, "VALIDATION_ERROR", "Choose a new expiry.");

  const expiry = parseExpiry(parsed.data.expiresAt);
  if ("error" in expiry) return fail(c, 400, "VALIDATION_ERROR", expiry.error);

  const row = await prisma.demoInvitation.findUnique({ where: { id: c.req.param("id") } });
  if (!row) return fail(c, 404, "NOT_FOUND", "That invitation no longer exists.");

  const previous = invitationStatus(row);
  if (previous === "revoked") {
    return fail(c, 409, "INVITATION_REVOKED", "This invitation was revoked. Extending it would not restore access.");
  }

  const updated = await prisma.demoInvitation.update({
    where: { id: row.id },
    data: { expiresAt: expiry.at, extendedAt: new Date() },
  });

  await record(c, {
    action: "invitation.extended",
    outcome: "success",
    actorType: "admin",
    actorId: session?.uid ?? null,
    actorLabel: session?.sub ?? "unknown",
    targetType: "invitation",
    targetId: row.id,
    previousStatus: previous,
    newStatus: invitationStatus(updated),
    detail: {
      previousExpiry: row.expiresAt.toISOString(),
      newExpiry: expiry.at.toISOString(),
      actorRole: session?.role,
    },
  });

  return c.json({ data: { invitation: invitationView(updated) } });
});

/* ----------------------------------------------------------------- REVOKE */

invitationsRouter.post("/:id/revoke", requireAdminPermission("invitations.manage"), async (c) => {
  const session = c.get("staff");

  const body = await c.req.json().catch(() => ({}));
  const parsed = revokeInvitationSchema.safeParse(body ?? {});
  const reason = parsed.success ? (parsed.data.reason || null) : null;

  const row = await prisma.demoInvitation.findUnique({ where: { id: c.req.param("id") } });
  if (!row) return fail(c, 404, "NOT_FOUND", "That invitation no longer exists.");
  if (row.revokedAt) return c.json({ data: { invitation: invitationView(row) } });

  const previous = invitationStatus(row);
  const updated = await prisma.demoInvitation.update({
    where: { id: row.id },
    data: {
      revokedAt: new Date(),
      revokedBy: session?.sub ?? "unknown",
      /*
       * The reason is appended to the internal note rather than replacing it.
       * Why an invitation was withdrawn is exactly the context the next person
       * to look at this row needs, and overwriting the original note to record
       * it would trade one answer for another.
       */
      internalNote: reason
        ? `${row.internalNote ? `${row.internalNote}\n\n` : ""}Revoked by ${session?.sub ?? "unknown"}: ${reason}`
        : row.internalNote,
    },
  });

  if (row.registrationId) {
    await recordEvent({
      registrationId: row.registrationId,
      kind: "invitation_revoked",
      actor: session?.sub ?? "unknown",
      message:
        `Private demonstration invitation ${row.tokenHint} revoked. The code no longer opens the demonstration.` +
        (reason ? ` Reason: ${reason}` : ""),
    }).catch(() => null);
  }

  await record(c, {
    action: "invitation.revoked",
    outcome: "success",
    actorType: "admin",
    actorId: session?.uid ?? null,
    actorLabel: session?.sub ?? "unknown",
    targetType: "invitation",
    targetId: row.id,
    previousStatus: previous,
    newStatus: "revoked",
    detail: {
      to: pseudonymise(row.email),
      codeHint: row.tokenHint,
      reason,
      actorRole: session?.role,
    },
  });

  return c.json({ data: { invitation: invitationView(updated) } });
});

export { invitationsRouter };
