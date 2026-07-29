import { Hono } from "hono";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { requireAdmin, requireAdminPermission } from "../security/staff-session";
import { record } from "../security/audit-store";
import { clientIp } from "../security/client-ip";
import { validate } from "../security/validate";
import { adminCan } from "../security/admin-roles";
import { sendMail } from "../email/mailer";
import { supportReplyEmail } from "../email/templates";
import {
  DEFAULT_PREFERENCES,
  supportQuerySchema,
  updateSupportTicketSchema,
  type LocaleCode,
  type SupportChannel,
  type SupportMessageView,
  type SupportPriority,
  type SupportTicketAdminView,
  type SupportTicketStatus,
} from "../types";
import type { Context } from "hono";

/**
 * The support desk — Admin → Support requests.
 *
 * THE ONE THING TO UNDERSTAND ABOUT THIS FILE: it can read a person's language,
 * their "do not phone me" flag and whether they asked for help using the app. It
 * CANNOT read their money. There is no balance here, no bridge amount, no savings
 * figure, no repayment schedule — not filtered out, not permission-gated, simply
 * never selected. A support agent resetting someone's PIN has no business knowing
 * what they earn, and the only version of that rule which cannot be misconfigured
 * is a query that never asks.
 *
 * Everything else follows from two more rules:
 *
 *   READS ARE LOGGED. Not just changes. Support tooling does not usually go wrong
 *   by someone editing a stranger's file; it goes wrong by someone reading one.
 *   Every ticket opened, every accessibility panel viewed and every list page
 *   writes a SupportAccessLog row naming the staff member, their role and the
 *   basis on which they were entitled to look.
 *
 *   PERMISSIONS ARE PER-FIELD WHERE IT MATTERS. `support.view` opens a ticket;
 *   `support.accessibility.view` is needed to see how to reach the person well;
 *   `support.escalate` is needed to flag someone as vulnerable. An auditor holds
 *   the first and neither of the others, which is why the accessibility block is
 *   emptied at serialisation rather than hidden in the UI.
 */
const supportAdminRouter = new Hono();

supportAdminRouter.use("*", requireAdmin());
supportAdminRouter.use("*", requireAdminPermission("support.view"));

/** Who is acting, for both the audit trail and the access log. */
function actor(c: Context): { id: string; label: string; role: string } {
  const staff = c.get("staff");
  return {
    // The break-glass environment administrator has no AdminUser row, so its id
    // is its subject. Logging "env-admin" beats logging nothing.
    id: staff?.uid ?? staff?.sub ?? "unknown",
    label: staff?.sub ?? "unknown",
    role: staff?.role ?? (staff?.uid ? "unknown" : "super_admin"),
  };
}

/**
 * Record that a member of staff looked at something.
 *
 * Never throws, for the same reason `record()` never throws: if writing the log
 * can fail the request, then whoever can break the log can also block support
 * work — or, worse, someone wraps this call in a way that quietly drops it.
 */
async function logAccess(
  c: Context,
  input: {
    resource: "ticket" | "ticket_list" | "preferences" | "assisted_queue";
    resourceId?: string | null;
    subjectUserId?: string | null;
    action?: "read" | "write" | "export";
    basis?: string;
  },
): Promise<void> {
  const who = actor(c);
  try {
    await prisma.supportAccessLog.create({
      data: {
        adminId: who.id,
        adminLabel: who.label,
        adminRole: who.role,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        subjectUserId: input.subjectUserId ?? null,
        action: input.action ?? "read",
        basis: input.basis ?? null,
        ip: clientIp(c),
        requestId: (c.get("requestId") as string | undefined) ?? null,
      },
    });
  } catch {
    // Swallowed deliberately. The stdout audit stream is the fallback record.
  }
}

const TICKET_INCLUDE = {
  messages: { orderBy: { createdAt: "asc" } },
  user: { select: { id: true, preferences: true } },
} as const;

type TicketWithRelations = Prisma.SupportTicketGetPayload<{ include: typeof TICKET_INCLUDE }>;

function toMessage(message: {
  id: string;
  authorType: string;
  authorLabel: string;
  body: string;
  createdAt: Date;
}): SupportMessageView {
  return {
    id: message.id,
    authorType: message.authorType as SupportMessageView["authorType"],
    authorLabel: message.authorLabel,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
  };
}

/**
 * The staff view of a ticket.
 *
 * `canSeeAccessibility` is passed in rather than read from the context so the
 * decision is visible at every call site. When it is false the accessibility
 * block collapses to the defaults — an auditor sees a shape, not a person's
 * needs. Note what is NOT in this function: any financial field. There is
 * nowhere to put one.
 */
function serialiseForStaff(row: TicketWithRelations, canSeeAccessibility: boolean): SupportTicketAdminView {
  const prefs = row.user?.preferences;
  const accessibility = canSeeAccessibility
    ? {
        locale: (prefs?.locale ?? row.locale) as LocaleCode,
        supportChannel: (prefs?.supportChannel ?? row.channel) as SupportChannel,
        textOnly: prefs?.textOnly ?? row.textOnly,
        assistedOnboarding: prefs?.assistedOnboarding ?? row.assistedOnboarding,
        readAloud: prefs?.readAloud ?? false,
        largeText: prefs?.largeText ?? false,
        highContrast: prefs?.highContrast ?? false,
        simpleView: prefs?.simpleView ?? false,
      }
    : {
        locale: row.locale as LocaleCode,
        supportChannel: row.channel as SupportChannel,
        textOnly: row.textOnly,
        assistedOnboarding: row.assistedOnboarding,
        readAloud: DEFAULT_PREFERENCES.readAloud,
        largeText: DEFAULT_PREFERENCES.largeText,
        highContrast: DEFAULT_PREFERENCES.highContrast,
        simpleView: DEFAULT_PREFERENCES.simpleView,
      };

  return {
    id: row.id,
    reference: row.reference,
    channel: row.channel as SupportChannel,
    locale: row.locale as LocaleCode,
    subject: row.subject,
    body: row.body,
    status: row.status as SupportTicketStatus,
    assistedOnboarding: row.assistedOnboarding,
    textOnly: row.textOnly,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    messages: row.messages.filter((m) => !m.internal).map(toMessage),
    name: row.name,
    email: row.email,
    phone: row.phone,
    userId: row.userId,
    priority: row.priority as SupportPriority,
    vulnerabilityFlag: row.vulnerabilityFlag,
    vulnerabilityNote: row.vulnerabilityNote,
    assignedTo: row.assignedTo,
    assignedToLabel: row.assignedToLabel,
    assignedAt: row.assignedAt ? row.assignedAt.toISOString() : null,
    resolvedBy: row.resolvedBy,
    resolutionNote: row.resolutionNote,
    callbackWindow: row.callbackWindow,
    internalNotes: row.messages.filter((m) => m.internal).map(toMessage),
    accessibility,
  };
}

function buildWhere(filters: {
  status?: SupportTicketStatus;
  priority?: SupportPriority;
  assisted?: boolean;
  locale?: LocaleCode;
  assignee?: string;
  q?: string;
}, selfId: string): Prisma.SupportTicketWhereInput {
  const and: Prisma.SupportTicketWhereInput[] = [];
  if (filters.status) and.push({ status: filters.status });
  if (filters.priority) and.push({ priority: filters.priority });
  if (filters.assisted) and.push({ assistedOnboarding: true });
  if (filters.locale) and.push({ locale: filters.locale });
  if (filters.assignee === "mine") and.push({ assignedTo: selfId });
  else if (filters.assignee === "unassigned") and.push({ assignedTo: null });
  else if (filters.assignee) and.push({ assignedTo: filters.assignee });

  if (filters.q) {
    const q = filters.q;
    /*
     * Searches the reference, the person's name and their contact details — and
     * the SUBJECT, but never the message body. A body search would turn the
     * support desk into a full-text index over everything customers have ever
     * confided, which is a much wider power than "find this person's ticket".
     */
    and.push({
      OR: [
        { reference: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { subject: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  return and.length ? { AND: and } : {};
}

/**
 * GET /api/admin/support/tickets — the queue.
 *
 * Keyset paging on createdAt+id, not offset: the table is appended to constantly,
 * and an offset page over a growing table shows one row twice and skips another.
 */
supportAdminRouter.get("/tickets", validate("query", supportQuerySchema), async (c) => {
  const filters = c.req.valid("query");
  const who = actor(c);
  const canSeeAccessibility = adminCan(who.role, "support.accessibility.view");

  const where = buildWhere(filters, who.id);

  const [rows, open, inProgress, waiting, resolved, assisted, vulnerable] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: filters.take + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
      include: TICKET_INCLUDE,
    }),
    prisma.supportTicket.count({ where: { status: "open" } }),
    prisma.supportTicket.count({ where: { status: "in_progress" } }),
    prisma.supportTicket.count({ where: { status: "waiting_on_customer" } }),
    prisma.supportTicket.count({ where: { status: "resolved" } }),
    prisma.supportTicket.count({ where: { assistedOnboarding: true, status: { not: "resolved" } } }),
    prisma.supportTicket.count({ where: { vulnerabilityFlag: true, status: { not: "resolved" } } }),
  ]);

  const hasMore = rows.length > filters.take;
  const page = hasMore ? rows.slice(0, filters.take) : rows;

  await logAccess(c, {
    resource: "ticket_list",
    action: "read",
    basis: "support.view",
  });

  return c.json({
    data: {
      items: page.map((row) => serialiseForStaff(row, canSeeAccessibility)),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      counts: { open, inProgress, waiting, resolved, assisted, vulnerable },
    },
  });
});

/**
 * GET /api/admin/support/assisted — people who asked for a human to help them.
 *
 * Deliberately its own endpoint rather than a filter, because it answers from TWO
 * sources: tickets that carry the assisted flag, and preference rows where
 * somebody ticked "I would like someone to help me set this up" without ever
 * filing a request. The second group is the one that would otherwise be invisible
 * — they asked for help by toggling a switch, and nobody was watching the switch.
 */
supportAdminRouter.get("/assisted", async (c) => {
  const who = actor(c);
  if (!adminCan(who.role, "support.accessibility.view")) {
    return c.json(
      { error: { message: "Your role cannot see this queue.", code: "FORBIDDEN" } },
      403,
    );
  }

  const [tickets, standing] = await Promise.all([
    prisma.supportTicket.findMany({
      where: { assistedOnboarding: true, status: { not: "resolved" } },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: {
        reference: true,
        name: true,
        email: true,
        phone: true,
        locale: true,
        textOnly: true,
        channel: true,
        status: true,
        createdAt: true,
        assignedToLabel: true,
      },
    }),
    prisma.userPreference.findMany({
      where: { assistedOnboarding: true },
      orderBy: { assistedRequestedAt: "asc" },
      take: 100,
      select: {
        userId: true,
        locale: true,
        textOnly: true,
        supportChannel: true,
        assistedRequestedAt: true,
        user: { select: { fullName: true, email: true, phone: true } },
      },
    }),
  ]);

  await logAccess(c, {
    resource: "assisted_queue",
    action: "read",
    basis: "support.accessibility.view",
  });

  return c.json({
    data: {
      tickets: tickets.map((t) => ({
        reference: t.reference,
        name: t.name,
        email: t.email,
        phone: t.phone,
        locale: t.locale,
        textOnly: t.textOnly,
        channel: t.channel,
        status: t.status,
        requestedAt: t.createdAt.toISOString(),
        assignedToLabel: t.assignedToLabel,
      })),
      standingRequests: standing.map((p) => ({
        userId: p.userId,
        name: p.user.fullName,
        email: p.user.email,
        phone: p.user.phone,
        locale: p.locale,
        textOnly: p.textOnly,
        channel: p.supportChannel,
        requestedAt: p.assistedRequestedAt ? p.assistedRequestedAt.toISOString() : null,
      })),
    },
  });
});

/**
 * GET /api/admin/support/agents — who a case can be handed to.
 *
 * Its own small endpoint rather than reusing /api/admin/admins, which is
 * super-admin only. An operations administrator needs to hand a case to a
 * colleague without being able to read the administrator directory, so this
 * returns the minimum that makes a picker work — id, name, role — filtered to
 * people who can actually open a ticket.
 */
supportAdminRouter.get("/agents", async (c) => {
  const who = actor(c);
  if (!adminCan(who.role, "support.manage")) {
    return c.json({ error: { message: "Your role cannot assign support requests.", code: "FORBIDDEN" } }, 403);
  }

  const rows = await prisma.adminUser.findMany({
    where: { status: "active" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true },
  });

  return c.json({
    data: {
      items: rows.filter((row) => adminCan(row.role, "support.view")),
      // Null for the break-glass environment session, which has no row to assign
      // to. The UI hides "assign to me" rather than offering a button that fails.
      selfId: c.get("staff")?.uid ?? null,
    },
  });
});

/** GET /api/admin/support/tickets/:id — one ticket. Logged as a read. */
supportAdminRouter.get("/tickets/:id", async (c) => {
  const who = actor(c);
  const canSeeAccessibility = adminCan(who.role, "support.accessibility.view");

  const row = await prisma.supportTicket.findFirst({
    // Accepts either the cuid or the readable reference, because a customer on
    // the phone quotes the reference and nobody should have to translate it.
    where: { OR: [{ id: c.req.param("id") }, { reference: c.req.param("id") }] },
    include: TICKET_INCLUDE,
  });
  if (!row) return c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404);

  await logAccess(c, {
    resource: "ticket",
    resourceId: row.reference,
    subjectUserId: row.userId,
    action: "read",
    basis: "support.view",
  });

  if (canSeeAccessibility && row.userId) {
    await logAccess(c, {
      resource: "preferences",
      resourceId: row.userId,
      subjectUserId: row.userId,
      action: "read",
      basis: "support.accessibility.view",
    });
    await record(c, {
      action: "preferences.viewed_by_staff",
      outcome: "success",
      actorType: "admin",
      actorId: who.id,
      actorLabel: who.label,
      targetType: "preferences",
      targetId: row.userId,
      // Field names, never values — see the preferences router.
      detail: { via: "support_ticket", ticket: row.reference },
    });
  }

  await record(c, {
    action: "support.ticket.viewed",
    outcome: "success",
    actorType: "admin",
    actorId: who.id,
    actorLabel: who.label,
    targetType: "ticket",
    targetId: row.reference,
  });

  return c.json({ data: serialiseForStaff(row, canSeeAccessibility) });
});

/**
 * PATCH /api/admin/support/tickets/:id — work the ticket.
 *
 * One endpoint covers reply, assign, status, resolve and escalate because they
 * arrive together in real use ("answer it and mark it waiting on the customer"),
 * and splitting them would mean three round trips and three chances for the state
 * to end up half-changed.
 *
 * The permission split is enforced HERE, per field, not by the route as a whole:
 * `support.manage` for the working fields, `support.escalate` for the
 * vulnerability flag. An operations administrator can answer anything and cannot
 * label anyone.
 */
supportAdminRouter.patch("/tickets/:id", validate("json", updateSupportTicketSchema), async (c) => {
  const who = actor(c);
  const input = c.req.valid("json");

  const touchesWorkflow =
    input.status !== undefined ||
    input.priority !== undefined ||
    input.assignedTo !== undefined ||
    input.reply !== undefined ||
    input.internalNote !== undefined ||
    input.resolutionNote !== undefined;

  if (touchesWorkflow && !adminCan(who.role, "support.manage")) {
    return c.json({ error: { message: "Your role cannot change support requests.", code: "FORBIDDEN" } }, 403);
  }

  const touchesVulnerability = input.vulnerabilityFlag !== undefined || input.vulnerabilityNote !== undefined;
  if (touchesVulnerability && !adminCan(who.role, "support.escalate")) {
    return c.json(
      {
        error: {
          message: "Only a Super Admin can flag a vulnerable customer. Ask one to review this case.",
          code: "FORBIDDEN",
        },
      },
      403,
    );
  }

  const existing = await prisma.supportTicket.findFirst({
    where: { OR: [{ id: c.req.param("id") }, { reference: c.req.param("id") }] },
    select: {
      id: true,
      reference: true,
      status: true,
      priority: true,
      assignedTo: true,
      vulnerabilityFlag: true,
      name: true,
      email: true,
      locale: true,
      textOnly: true,
      userId: true,
    },
  });
  if (!existing) return c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404);

  const now = new Date();
  const data: Prisma.SupportTicketUpdateInput = {};
  const messages: Prisma.SupportTicketMessageCreateWithoutTicketInput[] = [];

  if (input.status !== undefined) {
    data.status = input.status;
    if (input.status === "resolved") {
      data.resolvedAt = now;
      data.resolvedBy = who.label;
    } else {
      // Reopening clears the resolution stamp; leaving it would show a ticket
      // that is both open and resolved, and staff would trust the wrong one.
      data.resolvedAt = null;
      data.resolvedBy = null;
    }
  }
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.resolutionNote !== undefined) data.resolutionNote = input.resolutionNote || null;

  if (input.assignedTo !== undefined) {
    if (input.assignedTo === "") {
      data.assignedTo = null;
      data.assignedToLabel = null;
      data.assignedAt = null;
    } else {
      const assignee = await prisma.adminUser.findUnique({
        where: { id: input.assignedTo },
        select: { id: true, name: true, email: true, status: true, role: true },
      });
      if (!assignee) {
        return c.json({ error: { message: "That administrator does not exist.", code: "NOT_FOUND" } }, 404);
      }
      if (assignee.status !== "active") {
        return c.json(
          { error: { message: "That administrator is suspended.", code: "ASSIGNEE_INACTIVE" } },
          409,
        );
      }
      if (!adminCan(assignee.role, "support.view")) {
        // Assigning a case to somebody who cannot open it is a silent dead end:
        // the queue shows it owned, and the owner sees nothing.
        return c.json(
          {
            error: {
              message: `${assignee.name} cannot see support requests, so the case would sit unread.`,
              code: "ASSIGNEE_NO_ACCESS",
            },
          },
          409,
        );
      }
      data.assignedTo = assignee.id;
      data.assignedToLabel = `${assignee.name} (${assignee.email})`;
      data.assignedAt = now;
      // Picking up a case moves it out of the untouched queue automatically. A
      // status that has to be set by hand alongside every assignment is a status
      // that will be wrong.
      if (input.status === undefined && existing.status === "open") data.status = "in_progress";
    }
  }

  if (input.reply) {
    messages.push({
      authorType: "staff",
      authorId: who.id,
      authorLabel: who.label,
      body: input.reply,
      internal: false,
    });
    // A reply with no explicit status means the ball is now with the customer.
    if (input.status === undefined) data.status = "waiting_on_customer";
  }

  if (input.internalNote) {
    messages.push({
      authorType: "staff",
      authorId: who.id,
      authorLabel: who.label,
      body: input.internalNote,
      internal: true,
    });
  }

  if (input.vulnerabilityFlag !== undefined) {
    data.vulnerabilityFlag = input.vulnerabilityFlag;
    if (input.vulnerabilityFlag) {
      data.priority = "vulnerable";
    } else if (input.priority === undefined) {
      data.priority = "high";
    }
  }
  if (input.vulnerabilityNote !== undefined) data.vulnerabilityNote = input.vulnerabilityNote || null;

  const updated = await prisma.supportTicket.update({
    where: { id: existing.id },
    data: { ...data, ...(messages.length ? { messages: { create: messages } } : {}) },
    include: TICKET_INCLUDE,
  });

  /* ---- The trail. One record per thing that actually happened. ---- */

  if (input.assignedTo !== undefined) {
    await record(c, {
      action: "support.ticket.assigned",
      outcome: "success",
      actorType: "admin",
      actorId: who.id,
      actorLabel: who.label,
      targetType: "ticket",
      targetId: existing.reference,
      detail: { to: updated.assignedToLabel ?? "unassigned" },
    });
  }
  if (input.reply) {
    await record(c, {
      action: "support.ticket.replied",
      outcome: "success",
      actorType: "admin",
      actorId: who.id,
      actorLabel: who.label,
      targetType: "ticket",
      targetId: existing.reference,
      detail: { by: "staff", locale: existing.locale },
    });
  }
  if (input.status !== undefined && input.status !== existing.status) {
    await record(c, {
      action: input.status === "resolved" ? "support.ticket.resolved" : "support.ticket.status_changed",
      outcome: "success",
      actorType: "admin",
      actorId: who.id,
      actorLabel: who.label,
      targetType: "ticket",
      targetId: existing.reference,
      previousStatus: existing.status,
      newStatus: input.status,
    });
  }
  if (input.vulnerabilityFlag !== undefined && input.vulnerabilityFlag !== existing.vulnerabilityFlag) {
    await record(c, {
      action: "support.ticket.escalated",
      outcome: "success",
      actorType: "admin",
      actorId: who.id,
      actorLabel: who.label,
      targetType: "ticket",
      targetId: existing.reference,
      previousStatus: existing.vulnerabilityFlag ? "flagged" : "not_flagged",
      newStatus: input.vulnerabilityFlag ? "flagged" : "not_flagged",
    });
  }

  await logAccess(c, {
    resource: "ticket",
    resourceId: existing.reference,
    subjectUserId: existing.userId,
    action: "write",
    basis: touchesVulnerability ? "support.escalate" : "support.manage",
  });

  /*
   * Email the reply, in the LANGUAGE STORED ON THE TICKET — and only when the
   * channel is one the person agreed to. Someone who asked for WhatsApp gets a
   * WhatsApp message from an agent; sending an email as well would be PayBridge
   * deciding it knows better.
   */
  if (input.reply && (updated.channel === "email" || updated.channel === "written")) {
    await sendMail({
      ...supportReplyEmail({
        name: existing.name,
        reference: existing.reference,
        reply: input.reply,
        locale: existing.locale as LocaleCode,
        agentLabel: who.label,
      }),
      to: existing.email,
    }).catch(() => ({ delivered: false, note: "send threw" }));
  }

  return c.json({ data: serialiseForStaff(updated, adminCan(who.role, "support.accessibility.view")) });
});

export { supportAdminRouter };
