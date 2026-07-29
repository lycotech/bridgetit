import { Hono } from "hono";
import type { Context } from "hono";
import type { ZodType } from "zod";
import { prisma } from "../db";
import {
  COMMUNITY_NAME,
  SEGMENT_INITIAL_STATUS,
  SEGMENT_STAGE,
  capitalRegistrationSchema,
  contactEnquirySchema,
  employeeRegistrationSchema,
  employerRegistrationSchema,
  type Segment,
} from "../types";
import { rateLimit } from "../security/rate-limit";
import { audit, pseudonymise } from "../security/audit";
import { recordEvent } from "../registration-events";
import { sendMail } from "../email/mailer";
import { confirmationFor, internalNotification } from "../email/templates";
import { IDENTITY_BY_SEGMENT, additionalInboxesForEnquiry } from "../email/identities";

const registrationsRouter = new Hono();

/*
 * PUBLIC, UNAUTHENTICATED, PII-WRITING ENDPOINTS.
 *
 * Four defences, because a public form endpoint is simultaneously a database
 * -fill primitive, an email-bombing relay and a source of junk in the sales
 * pipeline:
 *
 *   1. Rate limit per IP (below) — a coarse ceiling. 5 per 10 minutes is far
 *      above honest use (a human fills a form once) and far below the volume
 *      that makes abuse worthwhile.
 *   2. Rate limit per email address — stops one actor rotating IPs to bomb a
 *      single inbox with confirmation mails.
 *   3. Honeypot field — a hidden input no human sees. Non-empty means bot.
 *   4. Time-to-complete floor — nobody reads and fills an eleven-field employer
 *      form in under two seconds.
 *
 * Bot rejections return 200 with a normal-looking body (see `pretendSuccess`).
 * A 403 tells the author of a bot exactly which submission tripped which check,
 * which is all they need to tune it out.
 */
registrationsRouter.use("/*", rateLimit({ name: "registration:ip", limit: 5, windowMs: 10 * 60_000 }));

declare module "hono" {
  interface ContextVariableMap {
    submittedEmail?: string;
  }
}

/**
 * Derive the submitted address BEFORE the per-address limiter runs.
 *
 * The limiter's `keyExtra` is synchronous, so the email has to be in the
 * context by the time it executes — reading it inside the handler would be too
 * late and the limit would silently degrade to per-IP only. Hono caches the
 * parsed body on the request, so the handler's own `c.req.json()` is free.
 *
 * The key is pseudonymised: a rate-limit bucket keyed on a plaintext address
 * would be an in-memory copy of the mailing list.
 */
registrationsRouter.use("/*", async (c, next) => {
  try {
    const body = (await c.req.json()) as { email?: unknown };
    if (typeof body?.email === "string" && body.email.trim().length > 0) {
      c.set("submittedEmail", pseudonymise(body.email.trim().toLowerCase()));
    }
  } catch {
    // Malformed JSON — the handler returns the 400. Nothing to key on here.
  }
  await next();
});

registrationsRouter.use(
  "/*",
  rateLimit({
    name: "registration:email",
    limit: 3,
    windowMs: 60 * 60_000,
    keyExtra: (c) => c.get("submittedEmail"),
  }),
);

/** Minimum plausible time-on-form, milliseconds. */
const MIN_FORM_MS = 2000;

function clean(v?: string | null): string | null {
  return v && v.trim().length > 0 ? v.trim() : null;
}

/**
 * One-way hash of the client IP.
 *
 * WHY hashed and not stored raw: the IP is needed to answer "is this the same
 * actor?" during an abuse investigation, and for nothing else. Storing it in
 * the clear turns a marketing table into a location dataset about people who
 * have disclosed their employer and salary band — a far more sensitive record
 * than the sum of its parts, and one nobody asked to create.
 */
function hashedIp(c: Context): string | null {
  const xff = c.req.header("x-forwarded-for");
  const ip =
    xff?.split(",")[0]?.trim() ??
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-real-ip") ??
    null;
  return ip ? pseudonymise(ip) : null;
}

/**
 * A response indistinguishable from a real success.
 *
 * Used for bot rejections. The id is random and no row is written.
 */
function pretendSuccess(c: Context, segment: Segment) {
  return c.json({
    data: {
      id: `rq_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`,
      status: "received" as const,
      segment,
      communityName: COMMUNITY_NAME[segment],
      createdAt: new Date().toISOString(),
    },
  });
}

interface HandlerConfig<T> {
  segment: Segment;
  schema: ZodType<T>;
  /** Map validated input onto the flat columns every segment shares. */
  core: (input: T) => {
    fullName: string;
    email: string;
    phone?: string | null;
    organisation?: string | null;
    jobTitle?: string | null;
    location?: string | null;
  };
  /** Human-readable label/value pairs for the internal notification email. */
  fields: (input: T) => Array<[string, string]>;
  /** Segment-specific answers persisted as JSON. */
  details: (input: T) => Record<string, unknown>;
  /** Exact consent wording the person agreed to. */
  consentText: string;
}

function handler<T extends Record<string, unknown>>(config: HandlerConfig<T>) {
  return async (c: Context) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { message: "Invalid request.", code: "BAD_REQUEST" } }, 400);
    }

    const parsed = config.schema.safeParse(body);
    if (!parsed.success) {
      /*
       * Field NAMES only — never `parsed.error.issues`. Issue objects echo the
       * schema back (every constraint, every unrecognised key) and reflect the
       * caller's own input into our response, which is an XSS vector the moment
       * a client renders an error as HTML. The browser validates with the same
       * rules, so a legitimate user never lands here.
       */
      const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? "body")))].slice(0, 12);
      audit({
        action: `registration.${config.segment}.validation.failed`,
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

    const input = parsed.data as T & {
      website?: string;
      elapsedMs?: number;
      privacyAccepted: boolean;
      marketingConsent?: boolean;
      sourcePage?: string;
      source?: string;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
      utmTerm?: string;
      utmContent?: string;
      referrer?: string;
    };

    // Defence 3 + 4 — bots, answered with a plausible success.
    if (input.website && input.website.trim().length > 0) {
      audit({
        action: `registration.${config.segment}.bot.honeypot`,
        actor: "anonymous",
        outcome: "denied",
        requestId: c.get("requestId"),
      });
      return pretendSuccess(c, config.segment);
    }
    if (typeof input.elapsedMs === "number" && input.elapsedMs < MIN_FORM_MS) {
      audit({
        action: `registration.${config.segment}.bot.too_fast`,
        actor: "anonymous",
        outcome: "denied",
        requestId: c.get("requestId"),
        detail: { elapsedMs: input.elapsedMs },
      });
      return pretendSuccess(c, config.segment);
    }

    const core = config.core(input);
    const now = new Date();
    const marketingConsent = input.marketingConsent === true;

    let record: { id: string; createdAt: Date };
    let returning = false;

    try {
      /*
       * Deduplication is on (segment, email), not email alone: one person can
       * legitimately register as an employee today and as an employer next
       * month, and collapsing those would lose a lead and mis-tag a segment.
       *
       * A repeat submission REFRESHES the answers but deliberately does not
       * reset the internal pipeline fields (status, notes, assignment, pilot
       * priority). Someone re-submitting a form must not be able to wipe the
       * sales team's working state — that would be a public write into an
       * internal record.
       *
       * Every query here is a parameterised Prisma call. There is no string
       * concatenation into SQL anywhere in this codebase; stating it so nobody
       * "optimises" it into $queryRawUnsafe later.
       */
      const existing = await prisma.registration.findUnique({
        where: { segment_email: { segment: config.segment, email: core.email } },
        select: { id: true },
      });
      returning = Boolean(existing);

      const shared = {
        fullName: core.fullName,
        phone: clean(core.phone),
        organisation: clean(core.organisation),
        jobTitle: clean(core.jobTitle),
        location: clean(core.location),
        details: JSON.stringify(config.details(input)),
        privacyAccepted: true,
        privacyAcceptedAt: now,
        marketingConsent,
        marketingConsentAt: marketingConsent ? now : null,
        consentText: config.consentText,
      };

      record = existing
        ? await prisma.registration.update({
            where: { id: existing.id },
            data: shared,
            select: { id: true, createdAt: true },
          })
        : await prisma.registration.create({
            data: {
              ...shared,
              email: core.email,
              segment: config.segment,
              communityName: COMMUNITY_NAME[config.segment],
              stage: SEGMENT_STAGE[config.segment],
              status: SEGMENT_INITIAL_STATUS[config.segment],
              pipelineStage: "Interest Registered",
              sourcePage: clean(input.sourcePage),
              formType: config.segment,
              source: clean(input.source),
              utmSource: clean(input.utmSource),
              utmMedium: clean(input.utmMedium),
              utmCampaign: clean(input.utmCampaign),
              utmTerm: clean(input.utmTerm),
              utmContent: clean(input.utmContent),
              referrer: clean(input.referrer),
              ipHash: hashedIp(c),
              userAgent: c.req.header("user-agent")?.slice(0, 300) ?? null,
            },
            select: { id: true, createdAt: true },
          });
    } catch (err) {
      /*
       * A Prisma error can carry the failing field values (this applicant's
       * email and phone) and the schema. Neither belongs in an HTTP response
       * or a plaintext log line.
       */
      console.error(
        JSON.stringify({
          type: "error",
          at: new Date().toISOString(),
          scope: `registration.${config.segment}.save`,
          requestId: c.get("requestId"),
          message: err instanceof Error ? err.message : "unknown",
        }),
      );
      audit({
        action: `registration.${config.segment}`,
        actor: pseudonymise(core.email),
        outcome: "failure",
        requestId: c.get("requestId"),
      });
      return c.json(
        { error: { message: "We could not complete this yet. Please try again.", code: "REGISTRATION_SAVE_FAILED" } },
        500,
      );
    }

    /*
     * Open the timeline with the submission itself, so the first entry an
     * internal reader sees is where the lead actually came from rather than
     * whatever the first staff member happened to click.
     */
    await recordEvent({
      registrationId: record.id,
      kind: returning ? "resubmitted" : "registered",
      actor: "public form",
      message: returning
        ? `Submitted the ${config.segment} form again from ${clean(input.sourcePage) ?? "the website"}. Existing record refreshed; internal pipeline state left untouched.`
        : `Registered through the ${config.segment} form on ${clean(input.sourcePage) ?? "the website"}.`,
    });

    /*
     * Mail is dispatched AFTER the row is committed and is deliberately not
     * awaited into the response path beyond what is needed to record the
     * outcome. A dead SMTP server must never turn a captured lead into a 500
     * that the visitor retries — the data is already safe.
     */
    const identity = IDENTITY_BY_SEGMENT[config.segment];
    const enquiryType = typeof input.enquiryType === "string" ? input.enquiryType : "General enquiry";

    const confirmation = confirmationFor(config.segment, enquiryType);
    const notification = internalNotification({
      segment: config.segment,
      from: identity,
      fields: config.fields(input),
      submittedAt: now,
      sourcePage: clean(input.sourcePage),
      marketingConsent,
      registrationId: record.id,
      returning,
    });

    const cc =
      config.segment === "general" ? additionalInboxesForEnquiry(enquiryType) : [];

    const [confirmationOutcome, notificationOutcome] = await Promise.all([
      sendMail({
        to: core.email,
        from: confirmation.from,
        subject: confirmation.subject,
        text: confirmation.text,
        html: confirmation.html,
      }),
      sendMail({
        to: identity.inbox,
        cc: cc.length > 0 ? cc : undefined,
        from: identity,
        // Reply-To is the submitter: hitting Reply in any mail client answers
        // the person, not the shared mailbox.
        replyTo: core.email,
        subject: notification.subject,
        text: notification.text,
        html: notification.html,
      }),
    ]);

    await prisma.registration
      .update({
        where: { id: record.id },
        data: {
          confirmationSentAt: confirmationOutcome.delivered ? new Date() : null,
          notificationSentAt: notificationOutcome.delivered ? new Date() : null,
          emailDeliveryNote: `confirmation: ${confirmationOutcome.note} | notification: ${notificationOutcome.note}`,
        },
      })
      .catch(() => {
        /* Delivery bookkeeping is best-effort; the lead is already saved. */
      });

    /*
     * Record the delivery attempt on the timeline, including failures. "Did
     * they ever actually get the welcome email?" is the first question asked
     * when a registrant says they heard nothing, and a silent SMTP failure is
     * otherwise invisible to the person working the lead.
     */
    await recordEvent({
      registrationId: record.id,
      kind: "email_sent",
      actor: "system",
      message: confirmationOutcome.delivered
        ? `Confirmation email sent to the registrant (${confirmationOutcome.note}).`
        : `Confirmation email FAILED — the registrant has not been acknowledged (${confirmationOutcome.note}).`,
    });

    audit({
      action: `registration.${config.segment}`,
      actor: pseudonymise(core.email),
      outcome: "success",
      target: record.id,
      requestId: c.get("requestId"),
      detail: {
        returning,
        marketingConsent,
        confirmationDelivered: confirmationOutcome.delivered,
        notificationDelivered: notificationOutcome.delivered,
      },
    });

    return c.json({
      data: {
        id: record.id,
        status: "received" as const,
        segment: config.segment,
        communityName: COMMUNITY_NAME[config.segment],
        createdAt: record.createdAt.toISOString(),
      },
    });
  };
}

/* -------------------------------------------------------------- EMPLOYEE */

registrationsRouter.post(
  "/employee",
  handler({
    segment: "employee",
    schema: employeeRegistrationSchema,
    consentText:
      "I agree to receive PayBridge product updates. I acknowledge the PayBridge Privacy Policy. " +
      "I understand that registering is an expression of interest and does not mean I have been " +
      "approved, verified or granted access to any financial product.",
    core: (i) => ({
      fullName: i.fullName,
      email: i.email,
      phone: i.phone,
      organisation: i.employerName,
      location: i.location,
    }),
    details: (i) => ({
      employerName: i.employerName,
      employmentType: i.employmentType,
      salaryBand: i.salaryBand ?? null,
      wants: i.wants || null,
    }),
    fields: (i) => [
      ["Full name", i.fullName],
      ["Email", i.email],
      ["Phone", i.phone],
      ["State or city", i.location],
      ["Employer", i.employerName],
      ["Employment type", i.employmentType],
      ["Salary band", i.salaryBand ?? "Not provided"],
      ["Wants from PayBridge", i.wants || "Not provided"],
      ["Segment tag", "segment: employee · community_name: Bridger · stage: waitlist · status: registered_interest"],
    ],
  }),
);

/* -------------------------------------------------------------- EMPLOYER */

registrationsRouter.post(
  "/employer",
  handler({
    segment: "employer",
    schema: employerRegistrationSchema,
    consentText:
      "I consent to be contacted by PayBridge about this registration. I acknowledge the PayBridge " +
      "Privacy Policy. I understand that registering is an expression of interest and does not " +
      "constitute approval, a credit facility or a binding partnership.",
    core: (i) => ({
      fullName: i.fullName,
      email: i.email,
      phone: i.phone,
      organisation: i.companyName,
      jobTitle: i.jobTitle,
      location: i.location,
    }),
    details: (i) => ({
      companyName: i.companyName,
      industry: i.industry,
      employeeCount: i.employeeCount,
      payrollBand: i.payrollBand,
      payrollProvider: i.payrollProvider,
      payrollFrequency: i.payrollFrequency,
      wellbeingChallenge: i.wellbeingChallenge,
      salaryConsistency: i.salaryConsistency,
      pilotTimeline: i.pilotTimeline,
    }),
    fields: (i) => [
      ["Company name", i.companyName],
      ["Contact person", i.fullName],
      ["Job title", i.jobTitle],
      ["Work email", i.email],
      ["Phone", i.phone],
      ["Industry", i.industry],
      ["Number of employees", i.employeeCount],
      ["Monthly payroll band", i.payrollBand],
      ["Payroll bank or provider", i.payrollProvider],
      ["Payroll frequency", i.payrollFrequency],
      ["Primary wellbeing challenge", i.wellbeingChallenge],
      ["Salaries paid consistently", i.salaryConsistency],
      ["Preferred pilot timeline", i.pilotTimeline],
      ["City or operating location", i.location],
      [
        "Segment tag",
        "segment: employer · community_name: Bridge Partner · stage: employer_interest · status: pilot_prospect",
      ],
      ["Pipeline stage", "Interest Registered (public website completes this stage only)"],
    ],
  }),
);

/* --------------------------------------------------------- CAPITAL PARTNER */

registrationsRouter.post(
  "/capital",
  handler({
    segment: "capital_partner",
    schema: capitalRegistrationSchema,
    consentText:
      "I consent to receive information from PayBridge about this registration. I acknowledge the " +
      "PayBridge Privacy Policy. I understand that registration is an expression of interest only " +
      "and is not an offer, solicitation, investment application, acceptance of capital or " +
      "guarantee of participation.",
    core: (i) => ({
      fullName: i.fullName,
      email: i.email,
      phone: i.phone,
      organisation: i.companyName || null,
      jobTitle: i.jobTitle || null,
      location: i.country,
    }),
    details: (i) => ({
      partyType: i.partyType,
      companyName: i.companyName || null,
      country: i.country,
      capitalRange: i.capitalRange,
      participationStructure: i.participationStructure,
      investmentHorizon: i.investmentHorizon,
      regulatedStatus: i.regulatedStatus,
      mandate: i.mandate,
    }),
    fields: (i) => [
      ["Full name", i.fullName],
      ["Individual or institution", i.partyType],
      ["Company name", i.companyName || "Not provided"],
      ["Job title", i.jobTitle || "Not provided"],
      ["Work email", i.email],
      ["Phone", i.phone],
      ["Country of residence or incorporation", i.country],
      ["Indicative capital range", i.capitalRange],
      ["Preferred participation structure", i.participationStructure],
      ["Expected investment horizon", i.investmentHorizon],
      ["Regulated or institutional", i.regulatedStatus],
      ["Investment mandate", i.mandate],
      [
        "Segment tag",
        "segment: capital_partner · community_name: Bridge Capital Partner · stage: capital_interest · status: pending_review",
      ],
      [
        "Notice",
        "Expression of interest only. Not an offer, solicitation, investment application, acceptance of capital or guarantee of participation.",
      ],
    ],
  }),
);

/* ------------------------------------------------------------- GENERAL */

registrationsRouter.post(
  "/contact",
  handler({
    segment: "general",
    schema: contactEnquirySchema,
    consentText:
      "I consent to PayBridge contacting me about this enquiry. I acknowledge the PayBridge Privacy Policy.",
    core: (i) => ({
      fullName: i.fullName,
      email: i.email,
      phone: i.phone || null,
    }),
    details: (i) => ({
      enquiryType: i.enquiryType,
      message: i.message,
    }),
    fields: (i) => [
      ["Name", i.fullName],
      ["Email", i.email],
      ["Phone", i.phone || "Not provided"],
      ["Enquiry type", i.enquiryType],
      ["Message", i.message],
      ["Segment tag", "segment: general · stage: enquiry"],
    ],
  }),
);

export { registrationsRouter };
