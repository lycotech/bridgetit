import { Hono } from "hono";
import type { Context } from "hono";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { requireAdmin, requireAdminPermission } from "../security/staff-session";
import { record } from "../security/audit-store";
import { adminCan } from "../security/admin-roles";
import { validate } from "../security/validate";
import { rateLimit } from "../security/rate-limit";
import { decryptField } from "../security/field-crypto";
import { getKycObjectViewUrl } from "../storage/kyc";
import {
  KYC_REJECTION_LABELS,
  kycDecisionSchema,
  type KycCaseView,
  type KycDocumentSummary,
  type KycQueueItemView,
  type KycStatus,
} from "../types";

/**
 * KYC review — Admin → KYC review.
 *
 * The regulated decision in this product: whether a person's identity is who
 * they say it is, before they can touch anything financial. Two permissions
 * gate it, split on purpose (see security/admin-roles.ts): `kyc.view` lets
 * operations staff see where a case is stuck; only `kyc.decide` (kyc_reviewer,
 * super_admin) can actually approve or reject one. Nobody chasing a customer to
 * finish onboarding is also the person who clears them.
 *
 * Decrypted identity fields (id number, date of birth, address, BVN) appear on
 * exactly one route — GET /:userId, one case at a time — and every time that
 * route is hit it writes a `kyc.viewed` audit record. The queue list never
 * carries them, so listing a hundred pending cases never decrypts a hundred
 * people's identity data.
 */
const adminKycRouter = new Hono();

adminKycRouter.use("*", requireAdmin());
adminKycRouter.use("*", requireAdminPermission("kyc.view"));

// Document links leave the bucket briefly exposed to whoever holds the URL.
// Tight limits keep a compromised admin session from harvesting the whole queue.
adminKycRouter.use(
  "/:userId/documents/:documentId/view-url",
  rateLimit({ name: "admin:kyc:doc-url", limit: 60, windowMs: 60 * 60_000 }),
);

function actor(c: Context): { id: string; label: string; role: string } {
  const staff = c.get("staff");
  return {
    id: staff?.uid ?? staff?.sub ?? "unknown",
    label: staff?.sub ?? "unknown",
    role: staff?.role ?? (staff?.uid ? "unknown" : "super_admin"),
  };
}

const REQUIRED_DOCS = ["id_front", "selfie"] as const;

/**
 * GET /api/admin/kyc/queue — the review queue.
 *
 * Oldest submission first: a case that has waited longest should be looked at
 * first, not buried under whatever was submitted five minutes ago.
 */
adminKycRouter.get("/queue", async (c) => {
  const statusParam = c.req.query("status");
  const status: KycStatus =
    statusParam === "approved" || statusParam === "rejected" || statusParam === "not_started"
      ? statusParam
      : "pending";
  const take = Math.min(Math.max(Number(c.req.query("take")) || 30, 1), 100);
  const cursor = c.req.query("cursor") || undefined;
  const q = c.req.query("q")?.trim();

  const where: Prisma.UserWhereInput = {
    kycStatus: status,
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, pending, approved, rejected, notStarted] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ kycSubmittedAt: "asc" }, { id: "asc" }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        fullName: true,
        email: true,
        accountType: true,
        kycStatus: true,
        kycSubmittedAt: true,
        kycProfile: { select: { idType: true } },
        kycDocuments: { select: { docType: true, status: true } },
      },
    }),
    prisma.user.count({ where: { kycStatus: "pending" } }),
    prisma.user.count({ where: { kycStatus: "approved" } }),
    prisma.user.count({ where: { kycStatus: "rejected" } }),
    prisma.user.count({ where: { kycStatus: "not_started" } }),
  ]);

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;

  const items: KycQueueItemView[] = page.map((row) => {
    const present = new Set(row.kycDocuments.filter((d) => d.status !== "rejected").map((d) => d.docType));
    return {
      userId: row.id,
      fullName: row.fullName,
      email: row.email,
      accountType: row.accountType as KycQueueItemView["accountType"],
      status: row.kycStatus as KycStatus,
      submittedAt: row.kycSubmittedAt?.toISOString() ?? null,
      idType: (row.kycProfile?.idType as KycQueueItemView["idType"]) ?? null,
      documentCount: row.kycDocuments.length,
      missingDocuments: REQUIRED_DOCS.filter((t) => !present.has(t)) as KycQueueItemView["missingDocuments"],
    };
  });

  return c.json({
    data: {
      items,
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      counts: { pending, approved, rejected, notStarted },
    },
  });
});

/**
 * GET /api/admin/kyc/:userId — one case, decrypted.
 *
 * The only route in the product that returns a plaintext id number, date of
 * birth, address or BVN. Logged every time, unconditionally — reads matter as
 * much as decisions do for a field this sensitive.
 */
adminKycRouter.get("/:userId", async (c) => {
  const userId = c.req.param("userId");
  const who = actor(c);

  const [user, profile, docs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        accountType: true,
        kycStatus: true,
        kycSubmittedAt: true,
        kycReviewedAt: true,
        kycReviewedBy: true,
        kycRejectionReason: true,
        kycInternalNote: true,
      },
    }),
    prisma.kycProfile.findUnique({ where: { userId } }),
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

  if (!user) return c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404);

  const documents: KycDocumentSummary[] = docs.map((d) => ({
    id: d.id,
    docType: d.docType as KycDocumentSummary["docType"],
    fileName: d.fileName,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    status: d.status,
    rejectionReason: d.rejectionReason,
    uploadedAt: d.uploadedAt.toISOString(),
  }));

  const view: KycCaseView = {
    userId: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    accountType: user.accountType as KycCaseView["accountType"],
    status: user.kycStatus as KycStatus,
    submittedAt: user.kycSubmittedAt?.toISOString() ?? null,
    reviewedAt: user.kycReviewedAt?.toISOString() ?? null,
    reviewedBy: user.kycReviewedBy,
    rejectionReason: user.kycRejectionReason,
    internalNote: user.kycInternalNote,
    idType: (profile?.idType as KycCaseView["idType"]) ?? null,
    idNumber: decryptField(profile?.idNumberEnc),
    dateOfBirth: decryptField(profile?.dateOfBirthEnc),
    address: decryptField(profile?.addressEnc),
    bvn: decryptField(profile?.bvnEnc),
    city: profile?.city ?? null,
    state: profile?.state ?? null,
    country: profile?.country ?? null,
    employerName: profile?.employerName ?? null,
    occupation: profile?.occupation ?? null,
    documents,
  };

  await record(c, {
    action: "kyc.viewed",
    outcome: "success",
    actorType: "admin",
    actorId: who.id,
    actorLabel: who.label,
    targetType: "kyc",
    targetId: user.id,
  });

  return c.json({ data: view });
});

/**
 * GET /api/admin/kyc/:userId/documents/:documentId/view-url — a link good for
 * five minutes, scoped to exactly one document that must belong to this user.
 */
adminKycRouter.get("/:userId/documents/:documentId/view-url", async (c) => {
  const { userId, documentId } = c.req.param();
  const who = actor(c);

  const doc = await prisma.kycDocument.findFirst({
    where: { id: documentId, userId },
    select: { id: true, storageKey: true, docType: true },
  });
  if (!doc) return c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404);

  const url = await getKycObjectViewUrl(doc.storageKey);

  await record(c, {
    action: "kyc.viewed",
    outcome: "success",
    actorType: "admin",
    actorId: who.id,
    actorLabel: who.label,
    targetType: "kyc",
    targetId: userId,
    detail: { documentId: doc.id, docType: doc.docType, via: "document_view_url" },
  });

  return c.json({ data: { url, expiresInSeconds: 300 } });
});

/**
 * POST /api/admin/kyc/:userId/decision — approve or reject a pending case.
 *
 * Only ever acts on a case that is actually `pending`: approving a case nobody
 * submitted, or re-deciding one already settled, is not a real workflow state,
 * it is a race between two reviewers or a stale screen.
 */
adminKycRouter.post(
  "/:userId/decision",
  requireAdminPermission("kyc.decide"),
  validate("json", kycDecisionSchema),
  async (c) => {
    const userId = c.req.param("userId");
    const input = c.req.valid("json");
    const who = actor(c);

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, kycStatus: true, email: true },
    });
    if (!existing) return c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404);
    if (existing.kycStatus !== "pending") {
      return c.json(
        {
          error: {
            message: "This case is not awaiting review — it may already have been decided.",
            code: "NOT_PENDING",
          },
        },
        409,
      );
    }

    const now = new Date();
    const approved = input.decision === "approve";
    const reason = !approved
      ? [KYC_REJECTION_LABELS[input.reason!], input.reasonDetail || null].filter(Boolean).join(" ")
      : null;

    await prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: approved ? "approved" : "rejected",
        kycReviewedAt: now,
        kycReviewedBy: who.label,
        kycRejectionReason: reason,
        kycInternalNote: input.internalNote || null,
      },
    });

    await record(c, {
      action: approved ? "kyc.approved" : "kyc.rejected",
      outcome: "success",
      actorType: "admin",
      actorId: who.id,
      actorLabel: who.label,
      targetType: "kyc",
      targetId: userId,
      previousStatus: "pending",
      newStatus: approved ? "approved" : "rejected",
      // The customer-facing reason category only — never the internal note,
      // never the applicant's decrypted identity data.
      detail: { reason: approved ? null : input.reason, hadInternalNote: Boolean(input.internalNote) },
    });

    return c.json({
      data: {
        userId,
        status: approved ? "approved" : ("rejected" as const),
        reviewedAt: now.toISOString(),
        reviewedBy: who.label,
      },
    });
  },
);

export { adminKycRouter };
