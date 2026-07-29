import { Hono } from "hono";
import { prisma } from "../db";
import { waitlistInputSchema } from "../types";
import { rateLimit } from "../security/rate-limit";
import { audit, pseudonymise } from "../security/audit";

const waitlistRouter = new Hono();

/*
 * Rate limit on a public, unauthenticated, PII-writing endpoint.
 *
 * WHY: without it this endpoint is a free database-fill primitive and an
 * email-bombing relay. 5 submissions per IP per 10 minutes is far above any
 * honest use (a human fills this form once) and far below the volume needed to
 * make abuse worthwhile.
 */
waitlistRouter.use("/", rateLimit({ name: "waitlist:ip", limit: 5, windowMs: 10 * 60_000 }));

waitlistRouter.post("/", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { message: "Invalid request.", code: "BAD_REQUEST" } }, 400);
  }

  const parsed = waitlistInputSchema.safeParse(body);
  if (!parsed.success) {
    /*
     * WHY we no longer return `parsed.error.issues`:
     *
     * Zod issue objects echo the schema back to the caller — every field name,
     * every constraint, every unrecognised-key list, and the offending input
     * value itself. That hands an attacker a free map of the data model and, in
     * the `received` field, reflects their own input back into our response (an
     * XSS vector the moment any client renders an error as HTML).
     *
     * The browser client validates with the SAME schema before submitting, so a
     * legitimate user never reaches this branch. Direct API callers get the
     * field NAMES that failed and nothing else: enough to fix an integration,
     * not enough to enumerate the schema or reflect content.
     */
    const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? "body")))].slice(0, 10);
    audit({
      action: "waitlist.validation.failed",
      actor: "anonymous",
      outcome: "failure",
      requestId: c.get("requestId"),
      detail: { fields },
    });
    return c.json(
      { error: { message: "Please check your details and try again.", code: "VALIDATION_ERROR", fields } },
      400,
    );
  }

  const input = parsed.data;
  const clean = (v?: string) => (v && v.trim().length > 0 ? v.trim() : null);

  try {
    /*
     * WHY the response is now identical whether or not the email already exists:
     *
     * The previous version returned `status: "already_registered"`, which is a
     * user-enumeration oracle. Anyone could feed a list of addresses to this
     * endpoint and learn which are PayBridge users — directly useful for
     * targeted phishing ("PayBridge here, confirm your payroll details"), for
     * credential stuffing, and for a competitor sizing the customer base.
     *
     * Both branches now return `status: "received"`, with the same HTTP status
     * code (a 201-vs-200 difference is the same oracle wearing a different hat).
     * Behaviour stays idempotent — a returning applicant's details are still
     * refreshed — only the observable difference is removed.
     *
     * Note also: every query here is a Prisma parameterised call. There is no
     * string concatenation into SQL anywhere in this codebase, which is why SQL
     * injection is not a live finding. Stating it explicitly so nobody
     * "optimises" this into $queryRawUnsafe later.
     */
    const existing = await prisma.waitlistEntry.findUnique({ where: { email: input.email } });

    const record = existing
      ? await prisma.waitlistEntry.update({
          where: { email: input.email },
          data: {
            fullName: input.fullName,
            phone: input.phone,
            organisation: clean(input.organisation),
            role: input.role,
            goal: clean(input.goal),
            consent: input.consent,
          },
        })
      : await prisma.waitlistEntry.create({
          data: {
            fullName: input.fullName,
            email: input.email,
            phone: input.phone,
            organisation: clean(input.organisation),
            role: input.role,
            goal: clean(input.goal),
            consent: input.consent,
            source: clean(input.source),
            utmSource: clean(input.utmSource),
            utmMedium: clean(input.utmMedium),
            utmCampaign: clean(input.utmCampaign),
            utmTerm: clean(input.utmTerm),
            utmContent: clean(input.utmContent),
            referrer: clean(input.referrer),
          },
        });

    // Audit with a pseudonymised subject: we can still answer "how many attempts
    // from this address?" without writing the address into log storage.
    audit({
      action: "waitlist.join",
      actor: pseudonymise(input.email),
      outcome: "success",
      target: record.id,
      requestId: c.get("requestId"),
      detail: { returning: Boolean(existing), role: input.role },
    });

    return c.json({
      data: {
        id: record.id,
        status: "received" as const,
        createdAt: record.createdAt.toISOString(),
      },
    });
  } catch (err) {
    /*
     * WHY the raw error is neither returned nor logged verbatim: a Prisma error
     * can carry the failing field values (this applicant's email and phone) and
     * the database schema. Neither belongs in an HTTP response or a plaintext
     * log line.
     */
    console.error(
      JSON.stringify({
        type: "error",
        at: new Date().toISOString(),
        scope: "waitlist.save",
        requestId: c.get("requestId"),
        message: err instanceof Error ? err.message : "unknown",
      }),
    );
    audit({
      action: "waitlist.join",
      actor: pseudonymise(input.email),
      outcome: "failure",
      requestId: c.get("requestId"),
    });
    return c.json(
      { error: { message: "We could not complete this yet. Please try again.", code: "WAITLIST_SAVE_FAILED" } },
      500,
    );
  }
});

export { waitlistRouter };
