import { Hono } from "hono";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { rateLimit } from "../security/rate-limit";
import { requireAdmin, requireAdminPermission } from "../security/staff-session";
import { record, serialiseAuditEvent } from "../security/audit-store";
import { AUDIT_ACTION_GROUPS, auditQuerySchema, type AuditQueryInput } from "../types";

/**
 * The audit trail reader — Admin → Audit logs.
 *
 * READ-ONLY BY CONSTRUCTION. There is no POST, PATCH or DELETE in this file, and
 * `prisma.auditEvent` is only ever reached through `findMany`, `count` and the
 * `record()` helper (which appends). An audit log with an edit path is not
 * evidence, and the person most likely to want to edit it is the one whose
 * actions it records — so the absence of a write route here is the control, not
 * a permission check that a later refactor could soften.
 *
 * Two other things shape this file:
 *
 *   1. Filtering and paging happen in the database. The table grows forever, so
 *      "fetch it all and filter in the browser" is a memory leak with a search
 *      box on top. Paging is keyset (cursor on id, stable secondary sort), not
 *      offset — an offset page over a table that is being appended to shows the
 *      same row twice and skips another.
 *
 *   2. Reading is not recorded; exporting is. Recording every page view would
 *      write a row per scroll and drown the signal in noise about people looking
 *      at the log. An export is different: it is bulk evidence, including full IP
 *      addresses, leaving the building in a file we no longer control.
 */
const auditRouter = new Hono();

/** Every route here needs a live staff session before anything else runs. */
auditRouter.use("*", requireAdmin());

/*
 * Export is the expensive, sensitive one: up to 5,000 rows of attributable
 * activity with IP addresses. Ten an hour is far above real investigative use
 * and far below "quietly siphon the whole trail from a stolen session".
 */
auditRouter.use("/export", rateLimit({ name: "admin:audit:export", limit: 10, windowMs: 60 * 60_000 }));

/** Counting stops here. Past this, the portal shows "5,000+" rather than hang. */
const COUNT_CEILING = 5_000;

/** Hard cap on an export, matching the registrations export. */
const EXPORT_MAX = 5_000;

/**
 * Turn the query into a Prisma filter.
 *
 * `q` is matched against attribution columns only — actor, target, IP, request
 * id. It deliberately does NOT search the `detail` column: that column holds
 * free-form JSON, so a substring search over it would let an administrator use
 * the audit log as a general-purpose text index over everything any subsystem
 * ever attached to an event, which is a different and much wider power than
 * "find what this person did".
 */
function buildWhere(filters: AuditQueryInput): Prisma.AuditEventWhereInput {
  const and: Prisma.AuditEventWhereInput[] = [];

  if (filters.action) {
    and.push({ action: filters.action });
  } else if (filters.group) {
    const group = AUDIT_ACTION_GROUPS.find((g) => g.key === filters.group);
    if (group) and.push({ action: { startsWith: group.prefix } });
  }

  if (filters.outcome) and.push({ outcome: filters.outcome });

  if (filters.q) {
    const q = filters.q;
    and.push({
      OR: [
        { actorLabel: { contains: q, mode: "insensitive" } },
        { actorId: { contains: q, mode: "insensitive" } },
        { targetId: { contains: q, mode: "insensitive" } },
        { ip: { contains: q, mode: "insensitive" } },
        { requestId: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const from = parseDay(filters.from, "start");
  const to = parseDay(filters.to, "end");
  if (from || to) {
    and.push({ createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } });
  }

  return and.length ? { AND: and } : {};
}

/**
 * Accept both a plain date (2026-07-28) and a full timestamp.
 *
 * A bare date as the upper bound is widened to the end of that day. WHY: an
 * administrator who types the same date in both boxes means "that day", and the
 * literal reading — midnight to midnight — returns nothing, which reads as "no
 * activity" rather than "wrong filter".
 */
function parseDay(value: string | undefined, edge: "start" | "end"): Date | undefined {
  if (!value) return undefined;
  const bare = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const at = new Date(bare ? `${value}T${edge === "start" ? "00:00:00.000" : "23:59:59.999"}Z` : value);
  return Number.isNaN(at.getTime()) ? undefined : at;
}

/**
 * Stable ordering for keyset paging.
 *
 * `createdAt` alone is not enough: several rows written inside the same
 * millisecond (a login that also invalidates sessions, say) would have no
 * defined order between them, so a cursor could land in the middle of the group
 * and drop the rest. `id` breaks the tie — cuid is monotonic enough within a
 * process and unique everywhere, so the sort is total.
 */
const ORDER: Prisma.AuditEventOrderByWithRelationInput[] = [{ createdAt: "desc" }, { id: "desc" }];

/* ------------------------------------------------------------------- LIST */

auditRouter.get("/", requireAdminPermission("audit.view"), async (c) => {
  const parsed = auditQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json(
      { error: { message: "That filter is not valid.", code: "VALIDATION_ERROR" } },
      400,
    );
  }
  const filters = parsed.data;
  const where = buildWhere(filters);

  /*
   * Ask for one more row than the page size. If it arrives, there is a next
   * page; it is then dropped rather than shown. This is how the client learns
   * "there is more" without a second count query per page.
   */
  const rows = await prisma.auditEvent.findMany({
    where,
    orderBy: ORDER,
    take: filters.take + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > filters.take;
  const page = hasMore ? rows.slice(0, filters.take) : rows;

  /*
   * The count is capped. An exact count over a table with millions of rows is a
   * full scan on every keystroke of the search box, and "5,000+" answers the
   * only question the number is actually asked: is this a handful or a haystack.
   */
  const total = await prisma.auditEvent.count({ where, take: COUNT_CEILING });

  return c.json({
    data: {
      items: page.map(serialiseAuditEvent),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      total,
      totalIsFloor: total >= COUNT_CEILING,
    },
  });
});

/* ----------------------------------------------------------------- EXPORT */

/**
 * RFC 4180 quoting plus formula-injection neutralisation.
 *
 * The leading apostrophe on =, +, -, @, tab and CR matters more here than
 * anywhere else in the app: this export contains strings that untrusted people
 * typed (a user agent, an email in an actor label), and a spreadsheet opens
 * `=HYPERLINK(...)` as a live formula on the machine of the compliance officer
 * reading the trail. The cell stays readable; it stops being executable.
 */
function csvCell(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const neutralised = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${neutralised.replace(/"/g, '""')}"`;
}

const EXPORT_HEADERS = [
  "id",
  "occurred_at",
  "action",
  "outcome",
  "actor_type",
  "actor_label",
  "actor_id",
  "target_type",
  "target_id",
  "previous_status",
  "new_status",
  "ip",
  "user_agent",
  "request_id",
  "detail_json",
];

auditRouter.get("/export", requireAdminPermission("audit.view"), async (c) => {
  const session = c.get("staff");
  const parsed = auditQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: { message: "That filter is not valid.", code: "VALIDATION_ERROR" } }, 400);
  }
  const filters = parsed.data;
  const where = buildWhere(filters);

  const rows = await prisma.auditEvent.findMany({ where, orderBy: ORDER, take: EXPORT_MAX });

  const lines = [EXPORT_HEADERS.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.createdAt.toISOString(),
        row.action,
        row.outcome,
        row.actorType,
        row.actorLabel,
        row.actorId,
        row.targetType,
        row.targetId,
        row.previousStatus,
        row.newStatus,
        row.ip,
        row.userAgent,
        row.requestId,
        row.detail,
      ]
        .map(csvCell)
        .join(","),
    );
  }

  /*
   * The export is itself an audited action, and it is recorded BEFORE the file
   * is handed over. The filter is recorded with it: "who took what" is a
   * different question from "who took a copy", and only the first is answerable
   * later if the filter is lost. Recorded via `record()` so it lands in the
   * table the export just read — the trail contains its own extraction.
   */
  await record(c, {
    action: "audit.exported",
    outcome: "success",
    actorType: "admin",
    actorId: session?.uid ?? null,
    actorLabel: session?.sub ?? "unknown",
    detail: {
      rows: rows.length,
      truncated: rows.length >= EXPORT_MAX,
      filterAction: filters.action ?? null,
      filterGroup: filters.group ?? null,
      filterOutcome: filters.outcome ?? null,
      filterFrom: filters.from ?? null,
      filterTo: filters.to ?? null,
      searched: Boolean(filters.q),
    },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  // The BOM makes Excel read the file as UTF-8 rather than the local codepage.
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="paybridge-audit-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});

export { auditRouter };
