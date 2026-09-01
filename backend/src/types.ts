import { z } from "zod";

/**
 * Shared API contracts for PayBridge.
 * Single source of truth for request/response shapes.
 *
 * SECURITY NOTE — why validation lives here and not in the route handler:
 * the frontend imports these same schemas, so client and server agree by
 * construction. That matters because client-side validation is a UX feature
 * (fast feedback) and server-side validation is the control. Sharing one
 * definition removes the classic drift where the server quietly accepts
 * something the form would have rejected.
 *
 * Zod's default object behaviour STRIPS unknown keys rather than passing them
 * through. That is deliberate mass-assignment protection: a caller cannot smuggle
 * `{ "isAdmin": true }` or `{ "createdAt": "1970-01-01" }` into a create call,
 * because the parsed object only ever contains declared fields — and the route
 * additionally maps fields one by one rather than spreading the payload.
 */

export const WAITLIST_ROLES = [
  "Employee",
  "Employer or Business Leader",
  "HR or Payroll Professional",
  "Capital Provider or Investor",
  "Financial Institution",
  "Technology or Distribution Partner",
  "Media or Ecosystem Partner",
  "Other",
] as const;

export const waitlistRoleSchema = z.enum(WAITLIST_ROLES);

/**
 * Reject control characters (including NUL, CR and LF) in free-text fields.
 *
 * WHY: embedded newlines are the log-injection primitive — a "full name" of
 * `Ada\n{"type":"audit","action":"payroll.approved"...}` forges an audit entry
 * in any line-oriented log. NUL bytes truncate strings in some downstream C
 * libraries. Neither ever appears in a real name, phone number or free-text
 * answer, so denying them costs nothing.
 */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;
const noControlChars = (v: string) => !CONTROL_CHARS.test(v);
const safeText = (max: number, min = 0, minMessage?: string) =>
  z
    .string()
    .trim()
    .min(min, minMessage)
    .max(max)
    .refine(noControlChars, "contains invalid characters");

export const waitlistInputSchema = z.object({
  fullName: safeText(120, 2, "Please enter your full name"),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address").max(200),
  /**
   * Phone: allow digits, spaces and the usual separators only.
   * WHY a positive character allowlist rather than a length check: it keeps
   * script payloads and delimiter characters out of a field that gets exported
   * to CSV and pasted into other systems.
   */
  phone: z
    .string()
    .trim()
    .min(6, "Please enter a valid phone number")
    .max(40)
    .regex(/^[+()\-.\s0-9]+$/, "Please enter a valid phone number"),
  organisation: safeText(160).optional().or(z.literal("")),
  role: waitlistRoleSchema,
  goal: safeText(1000).optional().or(z.literal("")),
  consent: z.boolean().refine((v) => v === true, {
    message: "Please agree to receive PayBridge updates",
  }),

  // Attribution (optional, client-supplied — therefore untrusted and bounded).
  source: safeText(200).optional(),
  utmSource: safeText(200).optional(),
  utmMedium: safeText(200).optional(),
  utmCampaign: safeText(200).optional(),
  utmTerm: safeText(200).optional(),
  utmContent: safeText(200).optional(),
  referrer: safeText(500).optional(),
});

export type WaitlistInput = z.infer<typeof waitlistInputSchema>;

/**
 * WHY a single "received" status: the previous `created | already_registered`
 * pair let anyone test whether an email address is already on the list, which
 * is a user-enumeration oracle. See routes/waitlist.ts.
 */
export const waitlistResultSchema = z.object({
  id: z.string(),
  status: z.literal("received"),
  createdAt: z.string(),
});

export type WaitlistResult = z.infer<typeof waitlistResultSchema>;

/* ============================================================================
 * SEGMENTED REGISTRATION — Bridgers, Bridge Partners, Bridge Capital Partners
 *
 * The public site collects EXPRESSIONS OF INTEREST ONLY. Nothing in this file
 * may accept a BVN, NIN, bank statement, identity document, payroll file,
 * incorporation document, source-of-funds record or bank login. Those are
 * collected later, through a secure verification portal, once activation
 * begins. The schemas below are the enforcement point for that rule: a field
 * that does not exist here cannot be stored, however the client is modified.
 * ==========================================================================*/

export const SEGMENTS = ["employee", "employer", "capital_partner", "general"] as const;
export type Segment = (typeof SEGMENTS)[number];

/** Community name attached to each segment, per the brand language. */
export const COMMUNITY_NAME: Record<Segment, string> = {
  employee: "Bridger",
  employer: "Bridge Partner",
  capital_partner: "Bridge Capital Partner",
  general: "Enquirer",
};

/** Funnel stage assigned at registration. */
export const SEGMENT_STAGE: Record<Segment, string> = {
  employee: "waitlist",
  employer: "employer_interest",
  capital_partner: "capital_interest",
  general: "enquiry",
};

/** Initial status assigned at registration. */
export const SEGMENT_INITIAL_STATUS: Record<Segment, string> = {
  employee: "registered_interest",
  employer: "pilot_prospect",
  capital_partner: "pending_review",
  general: "New",
};

/** The full workflow status vocabulary used by the admin dashboard. */
export const REGISTRATION_STATUSES = [
  "New",
  "Acknowledged",
  "Under Review",
  "Contacted",
  "Qualified",
  "Pilot Candidate",
  "Demo Invited",
  "Due Diligence",
  "Approved",
  "Not Yet Suitable",
  "Closed",
  // Segment-initial statuses, kept in the vocabulary so a freshly created row
  // is always a valid value rather than an unlisted special case.
  "registered_interest",
  "pilot_prospect",
  "pending_review",
] as const;

/**
 * Employer pilot pipeline. The PUBLIC website only ever produces the first
 * stage. Everything after it is moved by hand, internally, after real
 * qualification work — a registered employer is not approved, onboarded or
 * live until an internal human says so.
 */
export const EMPLOYER_PIPELINE_STAGES = [
  "Interest Registered",
  "Initial Qualification",
  "Discovery Meeting",
  "Payroll Assessment",
  "Risk Review",
  "Pilot Design",
  "Agreement and Data Processing",
  "Technical Setup",
  "Employee Communication",
  "Controlled Pilot",
  "Review and Scale",
] as const;

export const FOLLOW_UP_STATUSES = [
  "Not started",
  "In progress",
  "Awaiting reply",
  "Done",
] as const;

export const PILOT_PRIORITIES = ["Unset", "Low", "Medium", "High", "Design partner"] as const;

/* ------------------------------------------------- REGISTRATION TIMELINE */

/**
 * The kinds of thing that can happen to a registration.
 *
 * Closed vocabulary rather than free text so the timeline can be filtered and
 * iconised without string-matching, and so a typo cannot invent a new category
 * that then hides events from a filtered view.
 */
export const REGISTRATION_EVENT_KINDS = [
  /** The person submitted the form for the first time. */
  "registered",
  /** The same person submitted the same form again; the row was refreshed. */
  "resubmitted",
  /** A pipeline field moved. `field`, `oldValue` and `newValue` are set. */
  "field_changed",
  /** A human wrote a note. `message` is the body. */
  "note",
  /** Someone recorded that contact was made. */
  "contacted",
  /** Transactional mail was attempted. `message` carries the delivery note. */
  "email_sent",
  /** A private-demo invitation link was issued. */
  "invitation_issued",
  /** An invitation was revoked before use. */
  "invitation_revoked",
] as const;
export type RegistrationEventKind = (typeof REGISTRATION_EVENT_KINDS)[number];

/** One timeline entry, as returned by GET /api/admin/registrations/:id. */
export const registrationEventSchema = z.object({
  id: z.string(),
  kind: z.enum(REGISTRATION_EVENT_KINDS),
  field: z.string().nullable(),
  oldValue: z.string().nullable(),
  newValue: z.string().nullable(),
  message: z.string().nullable(),
  actor: z.string(),
  createdAt: z.string(),
});
export type RegistrationEvent = z.infer<typeof registrationEventSchema>;

/**
 * Body of POST /api/admin/registrations/:id/notes.
 *
 * A note is APPENDED to the timeline, never written over the previous one. The
 * 4000-character ceiling is a storage guard, not a policy: anything longer than
 * that belongs in the deal file, not the CRM field.
 */
export const registrationNoteSchema = z.object({
  message: z.string().trim().min(1, "Write something first.").max(4000),
  /** Also stamp lastContactAt — "I noted this because I just spoke to them". */
  markContacted: z.boolean().optional(),
});
export type RegistrationNoteInput = z.infer<typeof registrationNoteSchema>;

/**
 * Shared consent + provenance block.
 *
 * WHY privacy and marketing are two separate booleans and not one "I agree":
 * bundling them makes the marketing consent invalid — consent must be freely
 * given and specific. They are also timestamped separately at the point of
 * storage so we can prove what was agreed and when.
 */
const consentBlock = {
  privacyAccepted: z.boolean().refine((v) => v === true, {
    message: "Please acknowledge the privacy policy",
  }),
  marketingConsent: z.boolean().default(false),
};

const provenanceBlock = {
  sourcePage: safeText(200).optional(),
  source: safeText(200).optional(),
  utmSource: safeText(200).optional(),
  utmMedium: safeText(200).optional(),
  utmCampaign: safeText(200).optional(),
  utmTerm: safeText(200).optional(),
  utmContent: safeText(200).optional(),
  referrer: safeText(500).optional(),
  /**
   * Honeypot. A field no human ever sees, hidden from assistive technology and
   * off-screen in CSS. Bots fill every input they find; a non-empty value here
   * is a bot with near-zero false positives, and costs nothing to check.
   */
  website: z.string().max(200).optional(),
  /**
   * Milliseconds the form was on screen before submit. A genuine person cannot
   * read and complete an eleven-field employer form in under two seconds.
   */
  elapsedMs: z.number().int().nonnegative().max(86_400_000).optional(),
};

const emailField = z.string().trim().toLowerCase().email("Please enter a valid email address").max(200);
const phoneField = z
  .string()
  .trim()
  .min(6, "Please enter a valid phone number")
  .max(40)
  .regex(/^[+()\-.\s0-9]+$/, "Please enter a valid phone number");

/* ---------------------------------------------------------------- EMPLOYEE */

export const EMPLOYMENT_TYPES = [
  "Full-time permanent",
  "Full-time contract",
  "Part-time",
  "Shift or hourly",
  "Public sector",
  "Other",
] as const;

export const SALARY_BANDS = [
  "Below ₦150,000",
  "₦150,000 – ₦300,000",
  "₦300,000 – ₦500,000",
  "₦500,000 – ₦1,000,000",
  "Above ₦1,000,000",
  "Prefer not to say",
] as const;

export const employeeRegistrationSchema = z.object({
  fullName: safeText(120, 2, "Please enter your full name"),
  email: emailField,
  phone: phoneField,
  location: safeText(120, 2, "Please enter your state or city"),
  employerName: safeText(160, 2, "Please enter your employer's name"),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  salaryBand: z.enum(SALARY_BANDS).optional(),
  wants: safeText(1000).optional().or(z.literal("")),
  ...consentBlock,
  ...provenanceBlock,
});

export type EmployeeRegistrationInput = z.infer<typeof employeeRegistrationSchema>;

/* ---------------------------------------------------------------- EMPLOYER */

export const EMPLOYEE_COUNT_BANDS = [
  "1 – 25",
  "26 – 100",
  "101 – 250",
  "251 – 500",
  "501 – 1,000",
  "Over 1,000",
] as const;

export const PAYROLL_BANDS = [
  "Below ₦10m",
  "₦10m – ₦50m",
  "₦50m – ₦150m",
  "₦150m – ₦500m",
  "Above ₦500m",
] as const;

export const PAYROLL_FREQUENCIES = ["Monthly", "Bi-weekly", "Weekly", "Mixed"] as const;

export const SALARY_CONSISTENCY = [
  "Always on the same date",
  "Usually on time, occasional delays",
  "Frequently delayed",
] as const;

export const PILOT_TIMELINES = [
  "Immediately",
  "Within 1 month",
  "Within 3 months",
  "Within 6 months",
  "Exploring only",
] as const;

export const employerRegistrationSchema = z.object({
  companyName: safeText(200, 2, "Please enter your company name"),
  fullName: safeText(120, 2, "Please enter the contact person's name"),
  jobTitle: safeText(120, 2, "Please enter your job title"),
  email: emailField,
  phone: phoneField,
  industry: safeText(120, 2, "Please enter your industry"),
  employeeCount: z.enum(EMPLOYEE_COUNT_BANDS),
  payrollBand: z.enum(PAYROLL_BANDS),
  payrollProvider: safeText(160, 2, "Please tell us your payroll bank or provider"),
  payrollFrequency: z.enum(PAYROLL_FREQUENCIES),
  wellbeingChallenge: safeText(1000, 2, "Please describe the primary challenge"),
  salaryConsistency: z.enum(SALARY_CONSISTENCY),
  pilotTimeline: z.enum(PILOT_TIMELINES),
  location: safeText(120, 2, "Please enter your city or operating location"),
  ...consentBlock,
  ...provenanceBlock,
});

export type EmployerRegistrationInput = z.infer<typeof employerRegistrationSchema>;

/* ------------------------------------------------------------- CAPITAL */

export const CAPITAL_PARTY_TYPES = ["Individual", "Institution"] as const;

export const CAPITAL_RANGES = [
  "Under $50,000",
  "$50,000 – $250,000",
  "$250,000 – $1m",
  "$1m – $5m",
  "Above $5m",
  "Prefer to discuss",
] as const;

export const PARTICIPATION_STRUCTURES = [
  "Debt or credit facility",
  "Receivables or note purchase",
  "Special purpose vehicle",
  "Equity",
  "Undecided — open to discussion",
] as const;

export const INVESTMENT_HORIZONS = [
  "Under 12 months",
  "1 – 3 years",
  "3 – 5 years",
  "Over 5 years",
  "Flexible",
] as const;

export const REGULATED_STATUS = [
  "Regulated institution",
  "Institutional, not regulated",
  "Private individual",
  "Prefer not to say",
] as const;

export const capitalRegistrationSchema = z.object({
  fullName: safeText(120, 2, "Please enter your full name"),
  partyType: z.enum(CAPITAL_PARTY_TYPES),
  companyName: safeText(200).optional().or(z.literal("")),
  jobTitle: safeText(120).optional().or(z.literal("")),
  email: emailField,
  phone: phoneField,
  country: safeText(120, 2, "Please enter your country"),
  capitalRange: z.enum(CAPITAL_RANGES),
  participationStructure: z.enum(PARTICIPATION_STRUCTURES),
  investmentHorizon: z.enum(INVESTMENT_HORIZONS),
  regulatedStatus: z.enum(REGULATED_STATUS),
  mandate: safeText(2000, 10, "Please describe your investment mandate"),
  ...consentBlock,
  ...provenanceBlock,
});

export type CapitalRegistrationInput = z.infer<typeof capitalRegistrationSchema>;

/* --------------------------------------------------------------- GENERAL */

export const ENQUIRY_TYPES = [
  "General enquiry",
  "Media enquiry",
  "Technology partnership",
  "Banking partnership",
  "Compliance enquiry",
  "Other",
] as const;

export const contactEnquirySchema = z.object({
  fullName: safeText(120, 2, "Please enter your name"),
  email: emailField,
  phone: phoneField.optional().or(z.literal("")),
  enquiryType: z.enum(ENQUIRY_TYPES),
  message: safeText(3000, 10, "Please tell us a little more"),
  ...consentBlock,
  ...provenanceBlock,
});

export type ContactEnquiryInput = z.infer<typeof contactEnquirySchema>;

/**
 * Uniform result for every form.
 *
 * WHY the response is identical for a first-time and a repeat submission (and
 * why it never says "you are already registered"): the difference is a
 * user-enumeration oracle. Anyone could feed a list of addresses to a public
 * endpoint and learn which belong to PayBridge registrants — directly useful
 * for targeted phishing. Same body, same status code, both paths.
 */
export const registrationResultSchema = z.object({
  id: z.string(),
  status: z.literal("received"),
  segment: z.enum(SEGMENTS),
  communityName: z.string(),
  createdAt: z.string(),
});

export type RegistrationResult = z.infer<typeof registrationResultSchema>;

/* ==========================================================================
 *  CUSTOMER ACCOUNTS — registration, sign-in, verification
 * ==========================================================================
 *
 * These contracts belong to the AUTHENTICATED product, not to the public
 * marketing forms above. A `Registration` is an expression of interest with no
 * credential; a `User` can sign in. Keeping the schemas in one file is the point
 * of the file, but the two groups must not be confused: nothing in this section
 * should ever be reachable from an unauthenticated form.
 */

/** Which product a customer signed up for. Decides the dashboard, not the rights. */
export const ACCOUNT_TYPES = ["employee", "employer", "investor"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  employee: "Employee",
  employer: "Employer",
  investor: "Capital partner",
};

/** Account lifecycle. `suspended` blocks sign-in with a support message. */
export const ACCOUNT_STATUSES = ["active", "suspended", "closed"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/**
 * The KYC state machine. This single value gates every regulated feature.
 *
 *   not_started → pending → approved
 *                         ↘ rejected → (resubmit) → pending
 */
export const KYC_STATUSES = ["not_started", "pending", "approved", "rejected"] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

export const KYC_STATUS_LABELS: Record<KycStatus, string> = {
  not_started: "Not started",
  pending: "Verification in progress",
  approved: "Verified",
  rejected: "Needs attention",
};

/**
 * Minimum password rule, mirrored from security/passwords.ts.
 *
 * WHY duplicated as a Zod rule rather than only checked in the route: this
 * schema is imported by the frontend, so the browser can show the requirement
 * before a round trip. The server-side `checkPasswordPolicy` is the control;
 * this is the courtesy. Order matters — never the other way round.
 */
export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(200, "That password is too long — 200 characters maximum.")
  .regex(/[a-z]/, "Include a lower-case letter.")
  .regex(/[A-Z]/, "Include an upper-case letter.")
  .regex(/[0-9]/, "Include a number.")
  .regex(/[^A-Za-z0-9]/, "Include a special character, such as ! ? or #.");

/**
 * Phone numbers are stored as typed, with a permissive shape check only.
 *
 * WHY not strict E.164: this is a Nigerian product where people write
 * 0801 234 5678, +234 801 234 5678 and 234-801-234-5678 interchangeably.
 * Rejecting any of those loses a real customer to satisfy a format we then
 * normalise anyway.
 */
export const phoneSchema = z
  .string()
  .trim()
  .min(7, "Enter a valid phone number.")
  .max(20, "Enter a valid phone number.")
  .regex(/^[0-9+()\s-]+$/, "Enter a valid phone number.");

export const registerAccountSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  phone: phoneSchema,
  password: passwordSchema,
  accountType: z.enum(ACCOUNT_TYPES),
  /** Privacy policy acknowledgement. Refused without it. */
  privacyAccepted: z.literal(true, { message: "You must accept the privacy policy." }),
  /** Optional referral code — see routes/referrals.ts and auth.ts's register handler. */
  referralCode: z.string().trim().max(20).optional(),
});
export type RegisterAccountInput = z.infer<typeof registerAccountSchema>;

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  /**
   * NOT `passwordSchema`. An existing password must be accepted as typed and
   * judged only by whether it matches — applying the creation policy here would
   * reject a legacy password with a validation message that tells an attacker
   * the account exists and what its password does not contain.
   */
  password: z.string().min(1, "Enter your password.").max(200),
  /**
   * TOTP code, when the account has two-factor authentication enabled.
   * Optional because the first step of a two-step sign-in legitimately
   * arrives without it — the route decides whether it was required.
   */
  totp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator.")
    .optional()
    .or(z.literal("")),
  /** Single-use recovery code, as an alternative to `totp`. */
  recoveryCode: z.string().trim().max(40).optional().or(z.literal("")),
});
export type SignInInput = z.infer<typeof signInSchema>;

/* -------------------------------------------------------- TWO-FACTOR AUTH */

/**
 * Shared by customer accounts (routes/auth.ts) and employer team accounts
 * (routes/employer.ts) — the same TOTP design PayBridge staff already use
 * (security/totp.ts, routes/admin-auth.ts), extended to the two account
 * types that didn't have it. See AGENTS.md, "Customer-facing 2FA".
 */
export const enrolTwoFactorSchema = z.object({
  /** Required only when replacing an already-enabled authenticator. */
  currentPassword: z.string().min(1).max(200).optional(),
});
export type EnrolTwoFactorInput = z.infer<typeof enrolTwoFactorSchema>;

export const twoFactorEnrolmentSchema = z.object({
  /** Base32 secret, for typing into an app that cannot scan. */
  secret: z.string(),
  /** otpauth:// URI, rendered as a QR code. */
  uri: z.string(),
  issuer: z.string(),
});
export type TwoFactorEnrolmentView = z.infer<typeof twoFactorEnrolmentSchema>;

export const confirmTwoFactorSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator."),
});
export type ConfirmTwoFactorInput = z.infer<typeof confirmTwoFactorSchema>;

export const disableTwoFactorSchema = z.object({
  password: z.string().min(1, "Enter your password.").max(200),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator."),
});
export type DisableTwoFactorInput = z.infer<typeof disableTwoFactorSchema>;

export const VERIFICATION_CHANNELS = ["email", "phone"] as const;
export type VerificationChannel = (typeof VERIFICATION_CHANNELS)[number];

export const sendVerificationSchema = z.object({
  channel: z.enum(VERIFICATION_CHANNELS),
});

/**
 * What the server tells the client about a code it just issued.
 *
 * `devCode` is the deliberate, narrow exception to "never return a secret".
 * It is populated ONLY when both are true: the process is not production AND no
 * mail transport is configured, i.e. the code is provably undeliverable and the
 * journey would otherwise be impossible to finish. Configure SMTP_HOST or
 * RESEND_API_KEY and the field disappears, in every environment.
 */
export const verificationDispatchSchema = z.object({
  channel: z.enum(VERIFICATION_CHANNELS),
  /** Masked — `a••••e@example.com`. Never the full address. */
  destination: z.string(),
  delivered: z.boolean(),
  devCode: z.string().optional(),
});
export type VerificationDispatch = z.infer<typeof verificationDispatchSchema>;

/**
 * Correcting a mistyped registration address, before it is verified.
 *
 * WHY this exists: without it a typo is a permanent trap. The code goes to an
 * address the customer cannot read, they cannot verify, and they cannot register
 * again because the typo now occupies their real address's place in the unique
 * index. The password is required so a stolen half-verified session cannot move
 * the account to an attacker's inbox.
 */
export const changeEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password.").max(200),
});
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;

export const confirmVerificationSchema = z.object({
  channel: z.enum(VERIFICATION_CHANNELS),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code."),
});
export type ConfirmVerificationInput = z.infer<typeof confirmVerificationSchema>;

/**
 * What the client is told about its own session.
 *
 * `gate` is computed SERVER-SIDE and is the single value the SPA switches on. WHY
 * a computed verdict instead of shipping the raw flags and letting the client
 * decide: the rules ("unverified sees only verification", "pending sees no
 * financial features") would then live in the browser, where they are a
 * suggestion. The client renders what the server says it may.
 */
export const SESSION_GATES = [
  /** No session. */
  "anonymous",
  /** Registered, email not yet confirmed. Verification screens only. */
  "verify_contact",
  /** Verified, no KYC submitted. The KYC form only. */
  "kyc_required",
  /** KYC submitted, awaiting review. Status dashboard, no financial features. */
  "kyc_pending",
  /** Rejected. Reason shown where lawful, resubmission allowed. */
  "kyc_rejected",
  /** Approved. Full customer dashboard. */
  "active",
  /** Suspended. Blocked with a support message. */
  "suspended",
  /** Closed. */
  "closed",
] as const;
export type SessionGate = (typeof SESSION_GATES)[number];

export const sessionUserSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  email: z.string(),
  /** Masked — never the full number. */
  phoneMasked: z.string().nullable(),
  accountType: z.enum(ACCOUNT_TYPES),
  status: z.enum(ACCOUNT_STATUSES),
  emailVerified: z.boolean(),
  phoneVerified: z.boolean(),
  kycStatus: z.enum(KYC_STATUSES),
  kycSubmittedAt: z.string().nullable(),
  kycReviewedAt: z.string().nullable(),
  /** Safe to display by construction. Null unless status is rejected. */
  kycRejectionReason: z.string().nullable(),
  /** Safe to display. Null unless the account is suspended. */
  suspendedReason: z.string().nullable(),
  twoFactorEnabled: z.boolean(),
  createdAt: z.string(),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export const sessionStateSchema = z.object({
  gate: z.enum(SESSION_GATES),
  user: sessionUserSchema.nullable(),
  /**
   * Whether regulated functionality may be rendered at all. Redundant with
   * `gate === "active"` on purpose: a single boolean is harder to get wrong in a
   * conditional than a string comparison against one of eight values.
   */
  financialAccess: z.boolean(),
});
export type SessionState = z.infer<typeof sessionStateSchema>;

/* -------------------------------------------------------------------- KYC */

export const ID_TYPES = ["nin", "bvn", "passport", "drivers_licence", "voters_card"] as const;
export type IdType = (typeof ID_TYPES)[number];

export const ID_TYPE_LABELS: Record<IdType, string> = {
  nin: "National Identification Number (NIN)",
  bvn: "Bank Verification Number (BVN)",
  passport: "International passport",
  drivers_licence: "Driver's licence",
  voters_card: "Voter's card",
};

export const KYC_DOC_TYPES = [
  "id_front",
  "id_back",
  "selfie",
  "proof_of_address",
  "employment_letter",
] as const;
export type KycDocType = (typeof KYC_DOC_TYPES)[number];

export const KYC_DOC_LABELS: Record<KycDocType, string> = {
  id_front: "Photo ID — front",
  id_back: "Photo ID — back",
  selfie: "Selfie holding your ID",
  proof_of_address: "Proof of address",
  employment_letter: "Employment letter or payslip",
};

/**
 * A KYC submission.
 *
 * Every field here is encrypted at rest except `country`, `state`, `city`,
 * `idType`, `employerName` and `occupation` — see the KycProfile model for why
 * those five are deliberately left searchable.
 */
export const kycSubmissionSchema = z.object({
  idType: z.enum(ID_TYPES),
  idNumber: z
    .string()
    .trim()
    .min(5, "Enter the number on your document.")
    .max(40)
    .regex(/^[A-Za-z0-9\s-]+$/, "Enter the number as it appears on your document."),
  /**
   * ISO date. The 18-year floor is enforced here rather than only in the UI
   * because offering a regulated financial product to a minor is a licensing
   * problem, not a validation nicety.
   */
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your date of birth.")
    .refine((value) => {
      const dob = new Date(`${value}T00:00:00Z`);
      if (Number.isNaN(dob.getTime())) return false;
      const eighteen = new Date();
      eighteen.setUTCFullYear(eighteen.getUTCFullYear() - 18);
      return dob <= eighteen;
    }, "You must be at least 18 years old to use PayBridge."),
  address: z.string().trim().min(8, "Enter your residential address.").max(300),
  city: z.string().trim().min(2, "Enter your city.").max(80),
  state: z.string().trim().min(2, "Enter your state.").max(80),
  country: z.string().trim().length(2, "Select your country.").default("NG"),
  /** Optional second identifier, e.g. a BVN alongside a NIN. */
  bvn: z
    .string()
    .trim()
    .regex(/^\d{11}$/, "A BVN is 11 digits.")
    .optional()
    .or(z.literal("")),
  employerName: z.string().trim().max(160).optional().or(z.literal("")),
  occupation: z.string().trim().max(120).optional().or(z.literal("")),
  /** Explicit confirmation that the details are true. Refused without it. */
  declarationAccepted: z.literal(true, { message: "You must confirm your details are accurate." }),
});
export type KycSubmissionInput = z.infer<typeof kycSubmissionSchema>;

export const kycDocumentSchema = z.object({
  id: z.string(),
  docType: z.enum(KYC_DOC_TYPES),
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  status: z.string(),
  rejectionReason: z.string().nullable(),
  uploadedAt: z.string(),
});
export type KycDocumentSummary = z.infer<typeof kycDocumentSchema>;

/**
 * The customer's own view of their KYC case.
 *
 * Note what is absent: no decrypted id number, no reviewer notes, no internal
 * status vocabulary. `idNumberLast4` is the only fragment of the identifier that
 * comes back, so the customer can confirm which document they submitted.
 */
export const kycStatusSchema = z.object({
  status: z.enum(KYC_STATUSES),
  submittedAt: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  idType: z.enum(ID_TYPES).nullable(),
  idNumberLast4: z.string().nullable(),
  documents: z.array(kycDocumentSchema),
  /** Which document types are still missing before the case can be submitted. */
  missingDocuments: z.array(z.enum(KYC_DOC_TYPES)),
});
export type KycStatusView = z.infer<typeof kycStatusSchema>;

/* ==========================================================================
 *  EMPLOYER ACCOUNTS — a company's own multi-seat login
 *
 *  Separate from the customer `User` table on purpose: an employer is a
 *  company with a team (HR, finance, a founder), not one person. The first
 *  person to register becomes `employer_admin` and can invite colleagues,
 *  each with their own login. See backend/src/security/employer-session.ts.
 * ========================================================================== */

export const EMPLOYER_TEAM_ROLES = ["employer_admin", "employer_contributor", "employer_viewer"] as const;
export type EmployerTeamRole = (typeof EMPLOYER_TEAM_ROLES)[number];

export const EMPLOYER_TEAM_ROLE_LABELS: Record<EmployerTeamRole, string> = {
  employer_admin: "Admin",
  employer_contributor: "Contributor",
  employer_viewer: "Viewer",
};

export const EMPLOYER_STATUSES = [
  "onboarding",
  "submitted",
  "under_review",
  "approved",
  "conditionally_approved",
  "declined",
  "active",
  "restricted",
  "suspended",
  "closed",
] as const;
export type EmployerStatus = (typeof EMPLOYER_STATUSES)[number];

export const registerEmployerSchema = z.object({
  companyName: z.string().trim().min(2, "Enter your company's name.").max(200),
  fullName: z.string().trim().min(2, "Enter your full name.").max(200),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number.")
    .max(20)
    .optional()
    .or(z.literal("")),
  password: z.string().min(12, "Use at least 12 characters."),
});
export type RegisterEmployerInput = z.infer<typeof registerEmployerSchema>;

export const employerSignInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
  totp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator.")
    .optional()
    .or(z.literal("")),
  recoveryCode: z.string().trim().max(40).optional().or(z.literal("")),
});
export type EmployerSignInInput = z.infer<typeof employerSignInSchema>;

/** The employer portal's source of truth on load — who is signed in, at which company. */
export const employerSessionSchema = z.object({
  authenticated: z.boolean(),
  id: z.string().nullable(),
  fullName: z.string().nullable(),
  email: z.string().nullable(),
  role: z.enum(EMPLOYER_TEAM_ROLES).nullable(),
  employerId: z.string().nullable(),
  employerName: z.string().nullable(),
  employerStatus: z.enum(EMPLOYER_STATUSES).nullable(),
  twoFactorEnabled: z.boolean(),
});
export type EmployerSessionView = z.infer<typeof employerSessionSchema>;

export const employerProfileSchema = z.object({
  id: z.string(),
  registeredName: z.string(),
  tradingName: z.string().nullable(),
  cacNumber: z.string().nullable(),
  companyType: z.string().nullable(),
  tin: z.string().nullable(),
  registeredAddress: z.string().nullable(),
  operationalAddress: z.string().nullable(),
  website: z.string().nullable(),
  industry: z.string().nullable(),
  employeeCount: z.number().nullable(),
  status: z.enum(EMPLOYER_STATUSES),
  createdAt: z.string(),
});
export type EmployerProfileView = z.infer<typeof employerProfileSchema>;

/** Every field optional: a company fills this in over more than one visit. */
export const updateEmployerProfileSchema = z.object({
  tradingName: z.string().trim().max(200).optional().or(z.literal("")),
  cacNumber: z.string().trim().max(50).optional().or(z.literal("")),
  companyType: z.string().trim().max(100).optional().or(z.literal("")),
  tin: z.string().trim().max(50).optional().or(z.literal("")),
  registeredAddress: z.string().trim().max(500).optional().or(z.literal("")),
  operationalAddress: z.string().trim().max(500).optional().or(z.literal("")),
  website: z.string().trim().max(300).optional().or(z.literal("")),
  industry: z.string().trim().max(100).optional().or(z.literal("")),
  employeeCount: z.number().int().min(0).max(1_000_000).optional(),
});
export type UpdateEmployerProfileInput = z.infer<typeof updateEmployerProfileSchema>;

export const employerTeamMemberSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  email: z.string(),
  role: z.enum(EMPLOYER_TEAM_ROLES),
  status: z.enum(["invited", "active", "suspended"]),
  invitedAt: z.string(),
  acceptedAt: z.string().nullable(),
  lastLoginAt: z.string().nullable(),
});
export type EmployerTeamMemberView = z.infer<typeof employerTeamMemberSchema>;

export const inviteEmployerTeamMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  fullName: z.string().trim().min(2, "Enter their full name.").max(200),
  role: z.enum(["employer_contributor", "employer_viewer"]),
});
export type InviteEmployerTeamMemberInput = z.infer<typeof inviteEmployerTeamMemberSchema>;

export const acceptEmployerInviteSchema = z.object({
  token: z.string().min(1, "This invitation link is incomplete."),
  password: z.string().min(12, "Use at least 12 characters."),
});
export type AcceptEmployerInviteInput = z.infer<typeof acceptEmployerInviteSchema>;

/* ==========================================================================
 *  PAYROLL — manual/CSV ingestion against PayrollCycle / PayrollRecord
 *
 *  Deliberately NOT computing `timeliness`, delay days or anything else the
 *  risk engine derives (see eir/risk/payroll.ts) — that is a separate,
 *  already-built, already-tested module. This is only the ingestion path: get
 *  real payroll data into the tables that module reads.
 * ========================================================================== */

export const createPayrollCycleSchema = z.object({
  /** First day of the pay period, e.g. "2026-07-01". */
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD."),
  expectedPayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD."),
});
export type CreatePayrollCycleInput = z.infer<typeof createPayrollCycleSchema>;

export const payrollRecordSchema = z.object({
  id: z.string(),
  staffRef: z.string().nullable(),
  fullName: z.string().nullable(),
  grossPay: z.number(),
  netPay: z.number().nullable(),
  deductions: z.number().nullable(),
  allowances: z.number().nullable(),
  bonus: z.number().nullable(),
  paymentStatus: z.string(),
  paidAt: z.string().nullable(),
});
export type PayrollRecordView = z.infer<typeof payrollRecordSchema>;

export const payrollCycleSchema = z.object({
  id: z.string(),
  periodStart: z.string(),
  expectedPayDate: z.string(),
  actualPayDate: z.string().nullable(),
  totalAmount: z.number().nullable(),
  employeeCount: z.number().nullable(),
  timeliness: z.string(),
  source: z.string(),
  createdAt: z.string(),
});
export type PayrollCycleView = z.infer<typeof payrollCycleSchema>;

export const payrollCycleDetailSchema = payrollCycleSchema.extend({
  records: z.array(payrollRecordSchema),
});
export type PayrollCycleDetailView = z.infer<typeof payrollCycleDetailSchema>;

export const employeeRecordSchema = z.object({
  id: z.string(),
  staffRef: z.string(),
  fullName: z.string().nullable(),
  department: z.string().nullable(),
  jobTitle: z.string().nullable(),
  status: z.string(),
  ewaEnrolled: z.boolean(),
  /** Whether a real customer account has claimed this payroll row. */
  linked: z.boolean(),
  /** Null until linked — KYC lives on the User, not the payroll row. */
  kycApproved: z.boolean().nullable(),
  /** Same gate as GET /api/auth/eligibility, employer-safe subset: no
   *  earned-wage amount, just whether this person can use PayBridge Access
   *  today. Null until linked. */
  eligible: z.boolean().nullable(),
});
export type EmployeeRecordView = z.infer<typeof employeeRecordSchema>;

export const inviteEmployeeLinkSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});
export type InviteEmployeeLinkInput = z.infer<typeof inviteEmployeeLinkSchema>;

export const acceptEmployeeLinkSchema = z.object({
  token: z.string().min(1, "This invitation link is incomplete."),
});
export type AcceptEmployeeLinkInput = z.infer<typeof acceptEmployeeLinkSchema>;

/* ==========================================================================
 *  ELIGIBILITY — the precondition checklist from PRD.md's Business Rules
 *
 *  Deliberately does NOT decide whether a requested Bridge amount is
 *  approved — that needs a Bridge/draw model that does not exist yet (see
 *  AGENTS.md, "Bridge Engine"). This is the checklist that engine will call
 *  before it does anything else, plus an honest earned-to-date estimate.
 * ========================================================================== */

export const eligibilitySchema = z.object({
  eligible: z.boolean(),
  employmentVerified: z.boolean(),
  employerActive: z.boolean(),
  employerStatus: z.string().nullable(),
  employerName: z.string().nullable(),
  payrollVerified: z.boolean(),
  kycApproved: z.boolean(),
  /** Best-effort proration of the most recent linked pay record. Null until payroll is verified. */
  earnedWageEstimate: z.number().nullable(),
  currentPeriodStart: z.string().nullable(),
  /** Human-readable blockers, empty when `eligible` is true. */
  reasons: z.array(z.string()),
});
export type EligibilityView = z.infer<typeof eligibilitySchema>;

/* ==========================================================================
 *  BRIDGE — the earned-wage-access draw-request engine
 *
 *  "Treasury approves funding" from PRD.md's business flow is, in this
 *  system, a deterministic real-time check against the `ewa` CreditLimit a
 *  human already approved in the credit-risk decision (see routes/
 *  admin-risk.ts) — not a second manual review per draw. See routes/
 *  bridge.ts for the full reasoning.
 * ========================================================================== */

export const requestBridgeDrawSchema = z.object({
  amount: z.number().positive("Enter an amount greater than zero."),
});
export type RequestBridgeDrawInput = z.infer<typeof requestBridgeDrawSchema>;

export const bridgeDrawSchema = z.object({
  id: z.string(),
  reference: z.string(),
  requestedAmount: z.number(),
  approvedAmount: z.number().nullable(),
  status: z.enum(["requested", "approved", "rejected"]),
  rejectionReason: z.string().nullable(),
  requestedAt: z.string(),
  decidedAt: z.string().nullable(),
});
export type BridgeDrawView = z.infer<typeof bridgeDrawSchema>;

/* ==========================================================================
 *  SALARY ACCOUNT — real counterpart of the demo-only mock feature described
 *  in AGENTS.md §9. An employee requests their payroll destination be moved
 *  to a PayBridge-managed account; employer HR/admin reviews and decides.
 *  Approval only updates EmployeeRecord.payrollAccount* — no money moves
 *  anywhere in this codebase yet (see BridgeDraw's own comment above).
 * ========================================================================== */

export const PARTNER_BANK_NAME_DEFAULT = "PayBridge Partner Bank";

export const PAYROLL_MODELS = ["existing_payroll", "paybridge_payroll"] as const;
export type PayrollModel = (typeof PAYROLL_MODELS)[number];

export const SALARY_ACCOUNT_STATUSES = ["pending_review", "active", "rejected", "suspended"] as const;
export type SalaryAccountStatus = (typeof SALARY_ACCOUNT_STATUSES)[number];

export const updatePayrollModelSchema = z.object({
  payrollModel: z.enum(PAYROLL_MODELS),
});
export type UpdatePayrollModelInput = z.infer<typeof updatePayrollModelSchema>;

export const payrollModelSchema = z.object({
  payrollModel: z.enum(PAYROLL_MODELS),
  salaryAccountsActive: z.number(),
});
export type PayrollModelView = z.infer<typeof payrollModelSchema>;

export const requestSalaryAccountSchema = z.object({
  accountName: z.string().trim().min(2, "Enter the account name.").max(200),
  accountNumber: z.string().trim().regex(/^\d{10}$/, "Enter a valid 10-digit account number."),
  /** Consent checkbox — refused without it, same pattern as privacyAccepted on registration. */
  confirmedConsent: z.literal(true, { message: "You must confirm this authorization to continue." }),
});
export type RequestSalaryAccountInput = z.infer<typeof requestSalaryAccountSchema>;

/** An employee's own view of one of their requests. */
export const salaryAccountRequestSchema = z.object({
  id: z.string(),
  reference: z.string(),
  status: z.enum(SALARY_ACCOUNT_STATUSES),
  newBankName: z.string(),
  newAccountMasked: z.string(),
  requestedAt: z.string(),
  decidedAt: z.string().nullable(),
  rejectionReason: z.string().nullable(),
});
export type SalaryAccountRequestView = z.infer<typeof salaryAccountRequestSchema>;

/** The employer-side review view — includes the employee's consent record and current account. */
export const salaryAccountRequestDetailSchema = z.object({
  id: z.string(),
  reference: z.string(),
  status: z.enum(SALARY_ACCOUNT_STATUSES),
  employeeName: z.string().nullable(),
  staffRef: z.string(),
  currentBankName: z.string().nullable(),
  currentAccountMasked: z.string().nullable(),
  newBankName: z.string(),
  /** Shown in full, not masked — the employer needs this to verify the account
   *  holder name plausibly matches the employee, the actual anti-fraud check
   *  in this flow. Only the account number is masked. */
  newAccountName: z.string(),
  newAccountMasked: z.string(),
  requestedAt: z.string(),
  decidedAt: z.string().nullable(),
  decidedByLabel: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  consent: z.object({
    signedAt: z.string(),
    deviceRef: z.string().nullable(),
    consentReferenceId: z.string(),
  }),
});
export type SalaryAccountRequestDetailView = z.infer<typeof salaryAccountRequestDetailSchema>;

export const decideSalaryAccountRequestSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  rejectionReason: z.string().trim().max(500).optional(),
  /** The reviewer's "I confirm I am authorised..." checkbox — enforced server-side, not just UI. */
  confirmedAuthorised: z.literal(true, { message: "You must confirm you are authorised to make this change." }),
});
export type DecideSalaryAccountRequestInput = z.infer<typeof decideSalaryAccountRequestSchema>;

/* ==========================================================================
 *  PAYBRIDGE ACCOUNT — a general-purpose PayBridge-managed account for the
 *  employee, distinct from SalaryAccountRequest (specifically payroll
 *  routing). No real bank-issuing partner exists yet, so this is always
 *  "pending" today — see routes/paybridge-account.ts.
 * ========================================================================== */

export const payBridgeAccountSchema = z.object({
  id: z.string(),
  status: z.enum(["pending", "active", "suspended", "closed"]),
  bankName: z.string().nullable(),
  accountName: z.string().nullable(),
  accountNumberMasked: z.string().nullable(),
  createdAt: z.string(),
});
export type PayBridgeAccountView = z.infer<typeof payBridgeAccountSchema>;

/* ==========================================================================
 *  PAYBRIDGE SCORE — real counterpart of the demo-only mock "credit score"
 *  (random 300-850, no computation). See scoring/paybridge-score.ts for the
 *  formula and why it is honestly bounded below the top band.
 * ========================================================================== */

export const payBridgeScoreSchema = z.object({
  score: z.number(),
  band: z.enum(["Excellent", "Good", "Fair", "Building"]),
  label: z.literal("PayBridge Score"),
  disclaimer: z.string(),
  signals: z.array(z.object({ key: z.string(), label: z.string(), points: z.number(), detail: z.string() })),
  computedAt: z.string(),
});
export type PayBridgeScoreView = z.infer<typeof payBridgeScoreSchema>;

/* ==========================================================================
 *  SAVINGS BRIDGE — a draw against 50% of a savings goal held 30+ days.
 *  Real counterpart of the demo-only mock "bridge from savings". Fee-free,
 *  status stops at approved/rejected — never "disbursed". See routes/
 *  savings-bridge.ts.
 * ========================================================================== */

export const requestSavingsBridgeSchema = z.object({
  goalId: z.string().min(1),
  amount: z.number().positive("Enter an amount greater than zero."),
});
export type RequestSavingsBridgeInput = z.infer<typeof requestSavingsBridgeSchema>;

export const savingsBridgeDrawSchema = z.object({
  id: z.string(),
  reference: z.string(),
  goalId: z.string(),
  requestedAmount: z.number(),
  approvedAmount: z.number().nullable(),
  status: z.enum(["requested", "approved", "rejected"]),
  rejectionReason: z.string().nullable(),
  requestedAt: z.string(),
  decidedAt: z.string().nullable(),
});
export type SavingsBridgeDrawView = z.infer<typeof savingsBridgeDrawSchema>;

/* ==========================================================================
 *  REFERRALS — real counterpart of the demo-only mock referral system. The
 *  reward is a real SavingsTransaction deposit once joined, not an
 *  unexplained number. See routes/referrals.ts and auth.ts's register
 *  handler (the only writer of the "joined" fields).
 * ========================================================================== */

export const sendReferralSchema = z.object({
  name: z.string().trim().min(2, "Enter their name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});
export type SendReferralInput = z.infer<typeof sendReferralSchema>;

export const referralSchema = z.object({
  id: z.string(),
  referredName: z.string(),
  referredEmail: z.string(),
  status: z.enum(["invited", "joined"]),
  rewardAmount: z.number(),
  invitedAt: z.string(),
  joinedAt: z.string().nullable(),
});
export type ReferralView = z.infer<typeof referralSchema>;

export const referralSummarySchema = z.object({
  code: z.string(),
  invited: z.number(),
  joined: z.number(),
  totalEarned: z.number(),
  items: z.array(referralSchema),
});
export type ReferralSummaryView = z.infer<typeof referralSummarySchema>;

/* ==========================================================================
 *  SAVINGS — a self-service ledger (backend/prisma/schema.prisma's
 *  SavingsGoal/SavingsTransaction). No bank rail exists yet — a deposit or
 *  withdrawal here is a self-reported bookkeeping entry, not money PayBridge
 *  actually moved. Same honesty limitation as an unfinalised Bridge draw.
 * ========================================================================== */

export const createSavingsGoalSchema = z.object({
  label: z.string().trim().min(2, "Give this goal a name.").max(120),
  targetAmount: z.number().positive().optional(),
  targetDate: z.string().optional(),
});
export type CreateSavingsGoalInput = z.infer<typeof createSavingsGoalSchema>;

export const savingsTransactionInputSchema = z.object({
  amount: z.number().positive("Enter an amount greater than zero."),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});
export type SavingsTransactionInput = z.infer<typeof savingsTransactionInputSchema>;

export const savingsTransactionSchema = z.object({
  id: z.string(),
  type: z.enum(["deposit", "withdrawal"]),
  amount: z.number(),
  note: z.string().nullable(),
  balanceAfter: z.number(),
  createdAt: z.string(),
});
export type SavingsTransactionView = z.infer<typeof savingsTransactionSchema>;

export const savingsGoalSchema = z.object({
  id: z.string(),
  label: z.string(),
  targetAmount: z.number().nullable(),
  targetDate: z.string().nullable(),
  balance: z.number(),
  status: z.enum(["active", "closed"]),
  createdAt: z.string(),
});
export type SavingsGoalView = z.infer<typeof savingsGoalSchema>;

/* ==========================================================================
 *  INVESTMENTS — a capital-commitment ledger for capital-partner accounts.
 *  Same honesty limitation as Savings: a commitment is recorded, not
 *  transferred. `PortfolioSnapshotView` reports REAL portfolio statistics —
 *  never a fabricated return figure; there is no yield model in this
 *  codebase to report from. See backend/src/routes/investments.ts.
 * ========================================================================== */

export const createInvestmentCommitmentSchema = z.object({
  amount: z.number().positive("Enter an amount greater than zero."),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});
export type CreateInvestmentCommitmentInput = z.infer<typeof createInvestmentCommitmentSchema>;

export const investmentCommitmentSchema = z.object({
  id: z.string(),
  amount: z.number(),
  status: z.enum(["committed", "withdrawn"]),
  note: z.string().nullable(),
  committedAt: z.string(),
  withdrawnAt: z.string().nullable(),
});
export type InvestmentCommitmentView = z.infer<typeof investmentCommitmentSchema>;

export const portfolioSnapshotSchema = z.object({
  totalEmployers: z.number(),
  activeEmployers: z.number(),
  tierDistribution: z.array(z.object({ tier: z.string(), count: z.number() })),
  totalApprovedExposure: z.number(),
  totalAvailableExposure: z.number(),
  bridgeDrawsApprovedCount: z.number(),
  bridgeDrawsApprovedVolume: z.number(),
  totalPayrollProcessed: z.number(),
  totalCommittedCapital: z.number(),
  yourCommittedCapital: z.number(),
  asOf: z.string(),
});
export type PortfolioSnapshotView = z.infer<typeof portfolioSnapshotSchema>;

/* ==========================================================================
 *  CREDIT RISK — the eir/risk engine, wired for the first time
 *
 *  A trimmed, JSON-safe view over eir/risk/score.ts's ScoreResult (the full
 *  internal shape is much larger — per-check/per-signal detail arrays with
 *  no dedicated storage; see eir/persist-score.ts). This is what the admin
 *  portal actually renders.
 * ========================================================================== */

export const riskEmployerListItemSchema = z.object({
  id: z.string(),
  registeredName: z.string(),
  status: z.string(),
  industry: z.string().nullable(),
  employeeCount: z.number().nullable(),
  currentScore: z.number().nullable(),
  currentTier: z.string().nullable(),
  earlyWarningLevel: z.string(),
  /** Real count of Employer Portal team seats (EmployerUser rows) — not the self-reported employeeCount band. */
  teamMemberCount: z.number(),
  /** Real count of uploaded payroll roster rows (EmployeeRecord) — how many employees this employer has actually onboarded. */
  rosterCount: z.number(),
  createdAt: z.string(),
});
export type RiskEmployerListItem = z.infer<typeof riskEmployerListItemSchema>;

/**
 * Admin → Investors directory (backend/src/routes/admin-investors.ts).
 * `accountType === "investor"` real customers, with their real committed
 * capital — the per-investor detail that `/admin/reports`'s aggregate
 * deliberately does not show. No yield/return figure — same honesty
 * limitation as the customer-facing Investments panel, because none exists.
 */
export const adminInvestorListItemSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  email: z.string(),
  kycStatus: z.string(),
  status: z.string(),
  committedCapital: z.number(),
  withdrawnCapital: z.number(),
  activeCommitmentCount: z.number(),
  joinedAt: z.string(),
});
export type AdminInvestorListItem = z.infer<typeof adminInvestorListItemSchema>;

export const riskComponentSchema = z.object({
  component: z.string(),
  label: z.string(),
  rawScore: z.number(),
  weight: z.number(),
  weightedScore: z.number(),
  classification: z.string(),
  dataInsufficient: z.boolean(),
  explanation: z.string(),
});
export type RiskComponentView = z.infer<typeof riskComponentSchema>;

export const riskKnockoutSchema = z.object({
  ruleKey: z.string(),
  label: z.string(),
  triggered: z.boolean(),
  consequence: z.string().nullable(),
  overridable: z.boolean(),
  description: z.string(),
  evidence: z.string(),
});
export type RiskKnockoutView = z.infer<typeof riskKnockoutSchema>;

export const riskLimitProductSchema = z.object({
  product: z.string(),
  offered: z.boolean(),
  recommendedLimit: z.number().nullable(),
  displayLimit: z.string(),
  reason: z.string(),
});
export type RiskLimitProductView = z.infer<typeof riskLimitProductSchema>;

export const riskScoreSchema = z.object({
  scoreId: z.string(),
  employerId: z.string(),
  policyVersion: z.string(),
  totalScore: z.number(),
  tier: z.string(),
  tierLabel: z.string(),
  classification: z.string(),
  components: z.array(riskComponentSchema),
  knockouts: z.object({
    evaluations: z.array(riskKnockoutSchema),
    triggeredCount: z.number(),
    blocked: z.boolean(),
    declineMandated: z.boolean(),
    committeeReferralRequired: z.boolean(),
    enhancedDueDiligenceRequired: z.boolean(),
    worstConsequence: z.string().nullable(),
    reasons: z.array(z.string()),
  }),
  limits: z.object({
    totalRecommendedExposure: z.number().nullable(),
    displayTotal: z.string(),
    products: z.array(riskLimitProductSchema),
    noLimitReason: z.string().nullable(),
    conditions: z.array(z.string()),
  }),
  decisionPermitted: z.boolean(),
  recommendedRoute: z.string(),
  dataCompleteness: z.object({
    payrollMonths: z.number(),
    financialMonths: z.number(),
    percent: z.number(),
    sufficientForDecision: z.boolean(),
  }),
  keyStrengths: z.array(z.string()),
  keyConcerns: z.array(z.string()),
  outstandingItems: z.array(z.string()),
  explanation: z.string(),
  calculatedAt: z.string(),
});
export type RiskScoreView = z.infer<typeof riskScoreSchema>;

export const recordCreditDecisionSchema = z.object({
  decision: z.enum(["approve", "decline"]),
  reason: z.string().trim().min(4, "Give a reason.").max(1000),
});
export type RecordCreditDecisionInput = z.infer<typeof recordCreditDecisionSchema>;

export const creditDecisionSchema = z.object({
  id: z.string(),
  employerId: z.string(),
  decision: z.string(),
  reason: z.string(),
  decidedByLabel: z.string(),
  authorityLevel: z.string(),
  secondedByLabel: z.string().nullable(),
  recommendedTier: z.string().nullable(),
  recommendedLimit: z.number().nullable(),
  approvedLimit: z.number().nullable(),
  decidedAt: z.string(),
  /** True once every authority requirement (incl. a second approver) is met and the decision has taken effect. */
  finalised: z.boolean(),
});
export type CreditDecisionView = z.infer<typeof creditDecisionSchema>;

export const authorityDecisionSchema = z.object({
  requiredLevel: z.string().nullable(),
  requiredLevelLabel: z.string(),
  dualApprovalRequired: z.boolean(),
  dualApprovalReasons: z.array(z.string()),
  exceedsAllAuthorities: z.boolean(),
  explanation: z.string(),
});
export type AuthorityDecisionView = z.infer<typeof authorityDecisionSchema>;

/* ==========================================================================
 *  REPORTING — real aggregates over data the product now actually has
 * ========================================================================== */

export const adminReportsOverviewSchema = z.object({
  employersByStatus: z.array(z.object({ status: z.string(), count: z.number() })),
  employersByTier: z.array(z.object({ tier: z.string(), count: z.number() })),
  kycFunnel: z.array(z.object({ status: z.string(), count: z.number() })),
  totalApprovedExposure: z.number(),
  totalAvailableExposure: z.number(),
  payrollCyclesProcessed: z.number(),
  totalPayrollProcessed: z.number(),
  bridgeDraws: z.object({
    requested: z.number(),
    approved: z.number(),
    rejected: z.number(),
    approvedVolume: z.number(),
  }),
  savingsTotalBalance: z.number(),
  investmentsTotalCommitted: z.number(),
  asOf: z.string(),
});
export type AdminReportsOverviewView = z.infer<typeof adminReportsOverviewSchema>;

/* ==========================================================================
 *  PRIVATE DEMONSTRATION — invitation codes
 * ========================================================================== */

export const DEMO_TYPES = [
  "employee_experience",
  "employer_dashboard",
  "capital_provider",
  "partner",
  "full_platform",
] as const;
export type DemoType = (typeof DEMO_TYPES)[number];

export const DEMO_TYPE_LABELS: Record<DemoType, string> = {
  employee_experience: "Employee experience",
  employer_dashboard: "Employer dashboard",
  capital_provider: "Capital-provider experience",
  partner: "Partner demonstration",
  full_platform: "Full platform demonstration",
};

/**
 * Which portal each demonstration type opens on.
 *
 * A partner demonstration lands on operations because that is what a partner
 * is shown — how PayBridge is run — and a full demonstration does the same,
 * with the portal switcher available from there.
 */
export const DEMO_TYPE_PORTAL: Record<DemoType, string> = {
  employee_experience: "employee",
  employer_dashboard: "employer",
  capital_provider: "investor",
  partner: "operations",
  full_platform: "operations",
};

/**
 * Redeeming an invitation: BOTH the email and the code.
 *
 * WHY the email is required and not just the code: the code travels by email
 * and email gets forwarded. Requiring the address the invitation was issued to
 * means a forwarded code does not work for the person it was forwarded to,
 * which is the entire point of "by invitation only".
 */
export const demoAccessSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter the email address your invitation was sent to."),
  code: z
    .string()
    .trim()
    .min(6, "Enter the access code from your invitation.")
    .max(40, "Enter the access code from your invitation."),
});
export type DemoAccessInput = z.infer<typeof demoAccessSchema>;

/** Invitation lifecycle as shown in the admin list. Derived, never stored. */
export const INVITATION_STATUSES = ["pending", "opened", "used", "expired", "revoked"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  pending: "Pending",
  opened: "Opened",
  used: "Used",
  expired: "Expired",
  revoked: "Revoked",
};

export const createInvitationSchema = z.object({
  inviteeName: z.string().trim().min(2, "Enter the invitee's name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  organisation: z.string().trim().max(160).optional().or(z.literal("")),
  demoType: z.enum(DEMO_TYPES),
  /** ISO timestamp. Must be in the future; capped server-side at 90 days. */
  expiresAt: z.string().min(4, "Choose when the invitation expires."),
  maxUses: z.coerce.number().int().min(1, "At least one use.").max(25, "25 uses maximum."),
  internalNote: z.string().trim().max(2000).optional().or(z.literal("")),
  /** Link the invitation to an existing registration, when there is one. */
  registrationId: z.string().optional().or(z.literal("")),
  /** Attempt delivery now. False = generate the code and copy it by hand. */
  sendEmail: z.boolean().optional().default(true),
});
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const extendInvitationSchema = z.object({
  expiresAt: z.string().min(4, "Choose a new expiry."),
});

export const revokeInvitationSchema = z.object({
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

/**
 * An invitation as the admin portal sees it.
 *
 * `code` is present exactly once — in the response that CREATES the invitation.
 * Every subsequent read returns `codeHint` only, because the plaintext is not
 * stored and therefore cannot be returned. That is the design, not a limitation.
 */
export const invitationSchema = z.object({
  id: z.string(),
  inviteeName: z.string().nullable(),
  email: z.string(),
  organisation: z.string().nullable(),
  demoType: z.enum(DEMO_TYPES),
  portal: z.string(),
  codeHint: z.string(),
  status: z.enum(INVITATION_STATUSES),
  expiresAt: z.string(),
  maxUses: z.number(),
  useCount: z.number(),
  redeemedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  revokedBy: z.string().nullable(),
  openedAt: z.string().nullable(),
  lastSentAt: z.string().nullable(),
  sendCount: z.number(),
  extendedAt: z.string().nullable(),
  internalNote: z.string().nullable(),
  issuedBy: z.string(),
  createdAt: z.string(),
});
export type InvitationView = z.infer<typeof invitationSchema>;

/* ==========================================================================
 *  ADMIN PORTAL
 * ========================================================================== */

export const ADMIN_ROLE_NAMES = [
  "super_admin",
  "kyc_reviewer",
  "operations_admin",
  "demo_manager",
  "auditor",
] as const;
export type AdminRoleName = (typeof ADMIN_ROLE_NAMES)[number];

export const ADMIN_ROLE_LABELS: Record<AdminRoleName, string> = {
  super_admin: "Super Admin",
  kyc_reviewer: "KYC Reviewer",
  operations_admin: "Operations Admin",
  demo_manager: "Demo Manager",
  auditor: "Read-only Auditor",
};

export const adminSignInSchema = z.object({
  email: z.string().trim().toLowerCase().min(3, "Enter your administrator email."),
  password: z.string().min(1, "Enter your password.").max(200),
  /**
   * TOTP code, when the account has MFA enabled. Optional in the schema because
   * the first step of a two-step sign-in legitimately arrives without it; the
   * route decides whether it was required.
   */
  totp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator.")
    .optional()
    .or(z.literal("")),
  /** Single-use recovery code, as an alternative to `totp`. */
  recoveryCode: z.string().trim().max(20).optional().or(z.literal("")),
});
export type AdminSignInInput = z.infer<typeof adminSignInSchema>;

export const adminChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "The two passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "Choose a password you have not used before.",
    path: ["newPassword"],
  });
export type AdminChangePasswordInput = z.infer<typeof adminChangePasswordSchema>;

export const adminMfaVerifySchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator."),
});

export const adminRecoverySchema = z.object({
  recoveryEmail: z.string().trim().toLowerCase().email("Enter a valid recovery email address."),
});

export const adminAcceptPolicySchema = z.object({
  accepted: z.literal(true, { message: "You must accept the administrator security policy." }),
});

/**
 * What the portal knows about the signed-in administrator.
 *
 * `outstanding` drives the first-run wizard. It is computed server-side for the
 * same reason `SessionState.gate` is: the obligations are a security control, so
 * whether they are satisfied is not the client's opinion.
 */
export const ADMIN_ONBOARDING_STEPS = ["password", "mfa", "recovery", "policy"] as const;
export type AdminOnboardingStep = (typeof ADMIN_ONBOARDING_STEPS)[number];

export const adminSessionSchema = z.object({
  authenticated: z.boolean(),
  id: z.string().nullable(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  role: z.enum(ADMIN_ROLE_NAMES).nullable(),
  permissions: z.array(z.string()),
  mfaEnabled: z.boolean(),
  /** Steps still owed. Empty means the portal is fully usable. */
  outstanding: z.array(z.enum(ADMIN_ONBOARDING_STEPS)),
  lastLoginAt: z.string().nullable(),
});
export type AdminSessionView = z.infer<typeof adminSessionSchema>;

export const createAdminSchema = z.object({
  name: z.string().trim().min(2, "Enter the administrator's name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  role: z.enum(ADMIN_ROLE_NAMES),
});
export type CreateAdminInput = z.infer<typeof createAdminSchema>;

export const updateAdminSchema = z
  .object({
    role: z.enum(ADMIN_ROLE_NAMES).optional(),
    status: z.enum(["active", "suspended"]).optional(),
    /**
     * Why the change was made. Optional, kept with the audit record, never shown
     * to the administrator being changed — "who suspended whom" is answerable
     * from the trail without it, but "why" is the question asked six months
     * later, and nobody remembers.
     */
    reason: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .refine((v) => v.role !== undefined || v.status !== undefined, {
    message: "Nothing to change.",
  });
export type UpdateAdminInput = z.infer<typeof updateAdminSchema>;

export const adminUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(ADMIN_ROLE_NAMES),
  status: z.string(),
  mfaEnabled: z.boolean(),
  mustChangePassword: z.boolean(),
  /** Non-null while a failed-attempt lockout is in force. */
  lockedUntil: z.string().nullable(),
  /** First-run steps still owed. Empty means the account is fully set up. */
  outstanding: z.array(z.enum(ADMIN_ONBOARDING_STEPS)),
  lastLoginAt: z.string().nullable(),
  lastLoginIp: z.string().nullable(),
  createdAt: z.string(),
  createdBy: z.string().nullable(),
});
export type AdminUserView = z.infer<typeof adminUserSchema>;

/**
 * A newly created administrator, or one whose password was reissued.
 *
 * `temporaryPassword` is present exactly once, in the response to the call that
 * generated it. It is stored only as an argon2id hash, so there is no route that
 * can return it again — same rule as a demonstration invitation code, for the
 * same reason.
 */
export const issuedAdminSchema = z.object({
  admin: adminUserSchema,
  temporaryPassword: z.string(),
  expiresAt: z.string(),
  /** Whether the "your account exists" notice reached them. Carries no password. */
  notified: z.boolean(),
});
export type IssuedAdminView = z.infer<typeof issuedAdminSchema>;

/* ------------------------------------------------------------- KYC REVIEW */

/**
 * Rejection reasons, as a controlled vocabulary.
 *
 * WHY a vocabulary rather than free text: the reason is shown to the customer,
 * so every value has to be safe to display and legally reviewed. Free text
 * alone invites a reviewer to paste an internal note — which is how an adverse-
 * media hit or a fraud suspicion ends up in a customer's inbox. Reviewers get an
 * additional `internalNote` field that the customer never sees.
 */
export const KYC_REJECTION_REASONS = [
  "document_unreadable",
  "document_expired",
  "details_mismatch",
  "selfie_mismatch",
  "address_unverified",
  "duplicate_account",
  "incomplete_submission",
  "other",
] as const;
export type KycRejectionReason = (typeof KYC_REJECTION_REASONS)[number];

export const KYC_REJECTION_LABELS: Record<KycRejectionReason, string> = {
  document_unreadable: "The document image was not readable.",
  document_expired: "The document has expired.",
  details_mismatch: "The details did not match the document provided.",
  selfie_mismatch: "The selfie did not match the photo on the document.",
  address_unverified: "The proof of address could not be verified.",
  duplicate_account: "An existing verified account was found for these details.",
  incomplete_submission: "Some required documents were missing.",
  other: "Additional information is required.",
};

export const kycDecisionSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    reason: z.enum(KYC_REJECTION_REASONS).optional(),
    /** Appended to the customer-facing reason. Must stay safe to display. */
    reasonDetail: z.string().trim().max(500).optional().or(z.literal("")),
    /** Reviewer-only. Never returned on any customer-facing route. */
    internalNote: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .refine((v) => v.decision === "approve" || Boolean(v.reason), {
    message: "Choose a rejection reason.",
    path: ["reason"],
  });
export type KycDecisionInput = z.infer<typeof kycDecisionSchema>;

export const suspendUserSchema = z.object({
  /** Shown to the suspended customer, so it must be safe to display. */
  reason: z.string().trim().min(4, "Give a reason the customer can be shown.").max(500),
});

/**
 * A KYC case as the reviewer sees it.
 *
 * The decrypted identity fields are present here and ONLY here — one case at a
 * time, behind `kyc.view`, on a route that writes a `kyc.viewed` audit record.
 * There is deliberately no endpoint that returns decrypted identity data for
 * more than one person.
 */
export const kycCaseSchema = z.object({
  userId: z.string(),
  fullName: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  accountType: z.enum(ACCOUNT_TYPES),
  status: z.enum(KYC_STATUSES),
  submittedAt: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  reviewedBy: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  internalNote: z.string().nullable(),
  idType: z.enum(ID_TYPES).nullable(),
  idNumber: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  address: z.string().nullable(),
  bvn: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string().nullable(),
  employerName: z.string().nullable(),
  occupation: z.string().nullable(),
  documents: z.array(kycDocumentSchema),
});
export type KycCaseView = z.infer<typeof kycCaseSchema>;

/**
 * One row in the reviewer's queue. Deliberately thinner than `kycCaseSchema` —
 * no decrypted identity fields here, because listing a hundred cases must not
 * mean decrypting a hundred people's identity data just to render a queue.
 * Decryption happens once, on `kycCaseSchema`, when a reviewer opens ONE case.
 */
export const kycQueueItemSchema = z.object({
  userId: z.string(),
  fullName: z.string(),
  email: z.string(),
  accountType: z.enum(ACCOUNT_TYPES),
  status: z.enum(KYC_STATUSES),
  submittedAt: z.string().nullable(),
  idType: z.enum(ID_TYPES).nullable(),
  documentCount: z.number(),
  missingDocuments: z.array(z.enum(KYC_DOC_TYPES)),
});
export type KycQueueItemView = z.infer<typeof kycQueueItemSchema>;

export const adminUserListItemSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  email: z.string(),
  phoneMasked: z.string().nullable(),
  accountType: z.enum(ACCOUNT_TYPES),
  status: z.enum(ACCOUNT_STATUSES),
  kycStatus: z.enum(KYC_STATUSES),
  emailVerified: z.boolean(),
  phoneVerified: z.boolean(),
  kycSubmittedAt: z.string().nullable(),
  suspendedReason: z.string().nullable(),
  lastLoginAt: z.string().nullable(),
  createdAt: z.string(),
});
export type AdminUserListItem = z.infer<typeof adminUserListItemSchema>;

export const auditEventSchema = z.object({
  id: z.string(),
  action: z.string(),
  outcome: z.string(),
  actorType: z.string(),
  actorLabel: z.string().nullable(),
  actorId: z.string().nullable(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  previousStatus: z.string().nullable(),
  newStatus: z.string().nullable(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  requestId: z.string().nullable(),
  detail: z.string().nullable(),
  createdAt: z.string(),
});
export type AuditEventView = z.infer<typeof auditEventSchema>;

/* ------------------------------------------------------------- AUDIT TRAIL */

/**
 * Every action the durable audit trail is allowed to persist.
 *
 * WHY the list lives in this file and not in security/audit-store.ts, where it
 * is enforced: the admin portal renders a filter over these values, and
 * audit-store.ts imports Prisma — so the browser cannot import it. Two hand-kept
 * copies of an allowlist is how a filter ends up quietly missing the one action
 * an investigator is looking for. audit-store.ts re-exports this array as
 * AUDITED_ACTIONS, so there is exactly one list and the enforcement point and
 * the filter cannot disagree.
 */
export const AUDIT_ACTIONS = [
  // Administrator authentication and credentials
  "admin.login",
  "admin.login.failed",
  "admin.login.locked",
  "admin.logout",
  "admin.password.changed",
  "admin.password.temp_expired",
  "admin.mfa.enrolled",
  "admin.mfa.enabled",
  "admin.mfa.failed",
  "admin.mfa.recovery_used",
  "admin.recovery.set",
  "admin.policy.accepted",
  "admin.sessions.invalidated",

  // Administrator management
  "admin.created",
  "admin.role.changed",
  "admin.suspended",
  "admin.reinstated",
  "admin.password.reset_issued",

  // Customer accounts
  "user.registered",
  "user.login",
  "user.login.failed",
  "user.login.locked",
  "user.logout",
  "user.verification.sent",
  "user.verification.confirmed",
  "user.verification.failed",
  "user.password.changed",
  "user.suspended",
  "user.reinstated",
  "user.mfa.enrolled",
  "user.mfa.enabled",
  "user.mfa.disabled",
  "user.mfa.failed",
  "user.mfa.recovery_used",

  // Employer accounts — company onboarding and the team that manages it
  "employer.registered",
  "employer.login",
  "employer.login.failed",
  "employer.login.locked",
  "employer.logout",
  "employer.profile.updated",
  "employer.team.invited",
  "employer.team.invite_accepted",
  "employer.team.role_changed",
  "employer.team.suspended",
  "employer.team.reinstated",
  "employer.mfa.enrolled",
  "employer.mfa.enabled",
  "employer.mfa.disabled",
  "employer.mfa.failed",
  "employer.mfa.recovery_used",
  "employer.payroll.cycle_created",
  "employer.payroll.uploaded",
  "employer.payroll_model.updated",
  "employee.link.invited",
  "employee.link.accepted",
  "salary_account.requested",
  "salary_account.approved",
  "salary_account.rejected",
  "savings_bridge.approved",
  "savings_bridge.rejected",
  "referral.invited",
  "referral.joined",
  "referral.join_failed",
  "risk.score.calculated",
  "risk.decision.recorded",
  "risk.decision.seconded",
  "bridge.draw.requested",
  "bridge.draw.approved",
  "bridge.draw.rejected",
  "savings.goal.created",
  "savings.deposit.recorded",
  "savings.withdrawal.recorded",
  "investment.commitment.recorded",
  "investment.commitment.withdrawn",
  "reports.viewed",
  "ai_assistant.chat.replied",
  "ai_assistant.chat.error",

  // KYC
  "kyc.submitted",
  "kyc.resubmitted",
  "kyc.approved",
  "kyc.rejected",
  "kyc.document.uploaded",
  "kyc.viewed",

  // Demonstration invitations
  "invitation.created",
  "invitation.sent",
  "invitation.resent",
  "invitation.extended",
  "invitation.revoked",
  "invitation.validation.attempt",
  "invitation.validation.failed",
  "invitation.used",

  // Accessibility, language and support.
  //
  // Preference changes are audited but their VALUES are not written to the trail
  // — knowing that someone turned on bigger writing is operationally useful;
  // building a searchable log of who needs what is not, and the trail is read by
  // more people than the preference itself ever should be.
  "preferences.updated",
  "preferences.viewed_by_staff",
  "support.ticket.created",
  "support.ticket.viewed",
  "support.ticket.assigned",
  "support.ticket.replied",
  "support.ticket.status_changed",
  "support.ticket.resolved",
  "support.ticket.escalated",
  "support.assisted.requested",
  "consent.accepted",
  "consent.withdrawn",

  // The trail reading itself. An export is bulk evidence leaving the building.
  "audit.exported",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_OUTCOMES = ["success", "failure", "denied"] as const;
export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];

export const AUDIT_OUTCOME_LABELS: Record<AuditOutcome, string> = {
  success: "Succeeded",
  failure: "Failed",
  denied: "Denied",
};

/** Coarse filter for the portal: the first dotted segment of the action. */
export const AUDIT_ACTION_GROUPS = [
  { key: "admin", label: "Administrators", prefix: "admin." },
  { key: "user", label: "Customer accounts", prefix: "user." },
  { key: "employer", label: "Employer accounts", prefix: "employer." },
  { key: "kyc", label: "KYC", prefix: "kyc." },
  { key: "invitation", label: "Demo invitations", prefix: "invitation." },
  { key: "support", label: "Support", prefix: "support." },
  { key: "preferences", label: "Accessibility settings", prefix: "preferences." },
  { key: "consent", label: "Consent", prefix: "consent." },
  { key: "audit", label: "Audit trail", prefix: "audit." },
] as const;
export type AuditActionGroupKey = (typeof AUDIT_ACTION_GROUPS)[number]["key"];

/**
 * Plain-English names for the log view.
 *
 * Deliberately `Partial`: an action added to AUDIT_ACTIONS without a label here
 * must not break the build, because the alternative is a developer who needs to
 * record a new event being tempted to reuse a wrong existing one.
 * `auditActionLabel()` falls back to a readable form of the dotted name.
 */
export const AUDIT_ACTION_LABELS: Partial<Record<AuditAction, string>> = {
  "admin.login": "Administrator signed in",
  "admin.login.failed": "Administrator sign-in failed",
  "admin.login.locked": "Administrator account locked",
  "admin.logout": "Administrator signed out",
  "admin.password.changed": "Administrator changed password",
  "admin.password.temp_expired": "Temporary password expired",
  "admin.mfa.enrolled": "Authenticator enrolled",
  "admin.mfa.enabled": "Two-factor turned on",
  "admin.mfa.failed": "Two-factor code rejected",
  "admin.mfa.recovery_used": "Recovery code used",
  "admin.recovery.set": "Recovery codes issued",
  "admin.policy.accepted": "Staff policy accepted",
  "admin.sessions.invalidated": "All sessions signed out",
  "admin.created": "Administrator created",
  "admin.role.changed": "Administrator role changed",
  "admin.suspended": "Administrator suspended",
  "admin.reinstated": "Administrator reinstated",
  "admin.password.reset_issued": "Temporary password issued",
  "user.registered": "Customer registered",
  "user.login": "Customer signed in",
  "user.login.failed": "Customer sign-in failed",
  "user.login.locked": "Customer account locked",
  "user.logout": "Customer signed out",
  "user.verification.sent": "Verification code sent",
  "user.verification.confirmed": "Contact details verified",
  "user.verification.failed": "Verification code rejected",
  "user.password.changed": "Customer changed password",
  "user.suspended": "Customer account suspended",
  "user.reinstated": "Customer account reinstated",
  "kyc.submitted": "KYC submitted",
  "kyc.resubmitted": "KYC resubmitted",
  "kyc.approved": "KYC approved",
  "kyc.rejected": "KYC rejected",
  "kyc.document.uploaded": "KYC document uploaded",
  "kyc.viewed": "KYC case opened",
  "invitation.created": "Invitation created",
  "invitation.sent": "Invitation emailed",
  "invitation.resent": "Invitation reissued",
  "invitation.extended": "Invitation extended",
  "invitation.revoked": "Invitation revoked",
  "invitation.validation.attempt": "Access code entered",
  "invitation.validation.failed": "Access code rejected",
  "invitation.used": "Demo access granted",
  "preferences.updated": "Accessibility settings changed",
  "preferences.viewed_by_staff": "Accessibility settings opened by staff",
  "support.ticket.created": "Help request received",
  "support.ticket.viewed": "Help request opened",
  "support.ticket.assigned": "Help request assigned",
  "support.ticket.replied": "Reply sent to customer",
  "support.ticket.status_changed": "Help request status changed",
  "support.ticket.resolved": "Help request resolved",
  "support.ticket.escalated": "Escalated as a vulnerable customer",
  "support.assisted.requested": "Assisted setup requested",
  "consent.accepted": "Consent accepted",
  "consent.withdrawn": "Consent withdrawn",
  "audit.exported": "Audit trail exported",
  "ai_assistant.chat.replied": "AI Assistant replied",
  "ai_assistant.chat.error": "AI Assistant request failed",
};

export function auditActionLabel(action: string): string {
  const known = AUDIT_ACTION_LABELS[action as AuditAction];
  if (known) return known;
  const words = action.replace(/[._]/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Audit list query. Filtering is server-side by design — the table grows without
 * bound, so "fetch everything and filter in the browser" is a memory leak with a
 * search box on top.
 */
export const auditQuerySchema = z.object({
  group: z.enum(AUDIT_ACTION_GROUPS.map((g) => g.key) as [AuditActionGroupKey, ...AuditActionGroupKey[]]).optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  outcome: z.enum(AUDIT_OUTCOMES).optional(),
  /** Matches actor label, actor id, target id, IP address or request id. */
  q: z.string().trim().max(200).optional(),
  from: z.string().trim().max(40).optional(),
  to: z.string().trim().max(40).optional(),
  /** Id of the last row already shown. Keyset pagination, not offset. */
  cursor: z.string().trim().max(60).optional(),
  take: z.coerce.number().int().min(1).max(200).default(50),
});
export type AuditQueryInput = z.infer<typeof auditQuerySchema>;

export const auditPageSchema = z.object({
  items: z.array(auditEventSchema),
  /** Pass back as `cursor` for the next page. Null when the end is reached. */
  nextCursor: z.string().nullable(),
  /** Rows matching the filter, not rows returned. */
  total: z.number(),
  /** True when `total` hit the counting ceiling and is a floor, not an exact. */
  totalIsFloor: z.boolean(),
});
export type AuditPageView = z.infer<typeof auditPageSchema>;

// ===========================================================================
// Accessibility, language and support contracts
//
// Read the header of the matching Prisma section before changing anything here.
// The short version: these types describe what a person needs the INTERFACE to
// do. There is no field for a diagnosis, a disability or a medical note, and
// none may be added — the absence is the guarantee.
// ===========================================================================

/**
 * Languages. `en` and `pcm` are live; `yo`, `ha` and `ig` exist so the plumbing
 * is finished and a translator has somewhere to put the words. The webapp holds
 * the display metadata (endonym, release state) and imports these codes, so the
 * two cannot drift.
 */
export const LOCALE_CODES = ["en", "pcm", "yo", "ha", "ig"] as const;
export type LocaleCode = (typeof LOCALE_CODES)[number];

/** English names, for staff screens and support tickets. */
export const LOCALE_ENGLISH_NAMES: Record<LocaleCode, string> = {
  en: "English",
  pcm: "Nigerian Pidgin",
  yo: "Yoruba",
  ha: "Hausa",
  ig: "Igbo",
};

export const LOCALE_SOURCES = ["default", "onboarding", "profile"] as const;
export type LocaleSource = (typeof LOCALE_SOURCES)[number];

/**
 * How a person wants to be answered.
 *
 * `written` and `email` are both text; they are separate because "reply in the
 * app" and "send me an email" are different requests from someone sharing a
 * phone. `callback` is a request, not a booking.
 */
export const SUPPORT_CHANNELS = ["whatsapp", "written", "phone", "callback", "email"] as const;
export type SupportChannel = (typeof SUPPORT_CHANNELS)[number];

export const SUPPORT_CHANNEL_LABELS: Record<SupportChannel, string> = {
  whatsapp: "WhatsApp message",
  written: "Written message in the app",
  phone: "Phone call",
  callback: "We call them back",
  email: "Email",
};

/** The preference row as the OWNER sees it. Never sent to an employer. */
export const preferencesSchema = z.object({
  locale: z.enum(LOCALE_CODES),
  localeSource: z.enum(LOCALE_SOURCES),
  largeText: z.boolean(),
  highContrast: z.boolean(),
  simpleView: z.boolean(),
  readAloud: z.boolean(),
  reduceMotion: z.boolean(),
  supportChannel: z.enum(SUPPORT_CHANNELS),
  textOnly: z.boolean(),
  assistedOnboarding: z.boolean(),
  /** True once the six setup questions were answered OR skipped. */
  onboardingSettled: z.boolean(),
  updatedAt: z.string(),
});
export type PreferencesView = z.infer<typeof preferencesSchema>;

/**
 * A partial update: send only what changed.
 *
 * `.refine()` rejects an empty body. An empty PATCH is always a bug — a toggle
 * that sends nothing looks like it worked and silently does not.
 */
export const updatePreferencesSchema = z
  .object({
    locale: z.enum(LOCALE_CODES).optional(),
    localeSource: z.enum(LOCALE_SOURCES).optional(),
    largeText: z.boolean().optional(),
    highContrast: z.boolean().optional(),
    simpleView: z.boolean().optional(),
    readAloud: z.boolean().optional(),
    reduceMotion: z.boolean().optional(),
    supportChannel: z.enum(SUPPORT_CHANNELS).optional(),
    textOnly: z.boolean().optional(),
    assistedOnboarding: z.boolean().optional(),
    /** Marks the first-use questions as done. Sent with the last answer. */
    onboardingCompleted: z.boolean().optional(),
    /** Marks them as skipped. Same effect on whether they reappear. */
    onboardingSkipped: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Nothing to change.",
  });
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;

/** Defaults for a person who has never chosen anything. */
export const DEFAULT_PREFERENCES: PreferencesView = {
  locale: "en",
  localeSource: "default",
  largeText: false,
  highContrast: false,
  simpleView: false,
  readAloud: false,
  reduceMotion: false,
  supportChannel: "whatsapp",
  textOnly: false,
  assistedOnboarding: false,
  onboardingSettled: false,
  updatedAt: "",
};

// ---------------------------------------------------------------- support ---

export const SUPPORT_TICKET_STATUSES = ["open", "in_progress", "waiting_on_customer", "resolved"] as const;
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];

/** Plain language, because the customer sees these words too. */
export const SUPPORT_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: "Waiting for us",
  in_progress: "We are working on it",
  waiting_on_customer: "Waiting for you",
  resolved: "Finished",
};

export const SUPPORT_PRIORITIES = ["normal", "high", "vulnerable"] as const;
export type SupportPriority = (typeof SUPPORT_PRIORITIES)[number];

export const SUPPORT_PRIORITY_LABELS: Record<SupportPriority, string> = {
  normal: "Normal",
  high: "Urgent",
  vulnerable: "Vulnerable customer",
};

/**
 * A new help request.
 *
 * `name`, `email` and `phone` are accepted even from a signed-in person, because
 * the commonest reason to contact support is that something about the account is
 * wrong — including the address on it.
 */
export const createSupportTicketSchema = z.object({
  name: z.string().trim().min(2, "Tell us your name.").max(120),
  email: z.string().trim().toLowerCase().email("Check the email address."),
  phone: z.string().trim().max(40).optional().default(""),
  channel: z.enum(SUPPORT_CHANNELS),
  /*
   * Optional with NO default, deliberately. A default here would mean every form
   * that forgets the field silently says "answer me in English", overriding a
   * person who already told PayBridge they read Pidgin. Left undefined, the route
   * falls back to their stored preference and only then to English.
   */
  locale: z.enum(LOCALE_CODES).optional(),
  textOnly: z.boolean().default(false),
  assistedOnboarding: z.boolean().default(false),
  callbackWindow: z.string().trim().max(120).optional().default(""),
  subject: z.string().trim().min(3, "Give this a short title.").max(160),
  body: z.string().trim().min(5, "Tell us what is happening.").max(4000),
});
export type CreateSupportTicketInput = z.infer<typeof createSupportTicketSchema>;

/** One message in the conversation, as the CUSTOMER sees it. */
export const supportMessageSchema = z.object({
  id: z.string(),
  authorType: z.enum(["customer", "staff", "system"]),
  authorLabel: z.string(),
  body: z.string(),
  createdAt: z.string(),
});
export type SupportMessageView = z.infer<typeof supportMessageSchema>;

/**
 * A ticket as the CUSTOMER sees it.
 *
 * No `assignedTo`, no internal notes, no vulnerability flag. Those are staff
 * working notes; a person reading "flagged as vulnerable" about themselves,
 * without the conversation that produced it, is being handed a judgement rather
 * than help.
 */
export const supportTicketSchema = z.object({
  id: z.string(),
  reference: z.string(),
  channel: z.enum(SUPPORT_CHANNELS),
  locale: z.enum(LOCALE_CODES),
  subject: z.string(),
  body: z.string(),
  status: z.enum(SUPPORT_TICKET_STATUSES),
  assistedOnboarding: z.boolean(),
  textOnly: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  resolvedAt: z.string().nullable(),
  messages: z.array(supportMessageSchema),
});
export type SupportTicketView = z.infer<typeof supportTicketSchema>;

/**
 * A ticket as AUTHORISED STAFF see it.
 *
 * Extends the customer view with assignment, priority and internal notes — and
 * with the accessibility preferences that change how the reply should be made
 * (language, "do not phone me", assisted setup). It carries NO financial
 * information: not a balance, not a bridge amount, not a savings figure. A
 * support agent helping someone reset a PIN has no business knowing what they
 * earn, and the way to guarantee that is for the shape to have nowhere to put it.
 */
export const supportTicketAdminSchema = supportTicketSchema.extend({
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  /** Null when the request came from someone not signed in. */
  userId: z.string().nullable(),
  priority: z.enum(SUPPORT_PRIORITIES),
  vulnerabilityFlag: z.boolean(),
  vulnerabilityNote: z.string().nullable(),
  assignedTo: z.string().nullable(),
  assignedToLabel: z.string().nullable(),
  assignedAt: z.string().nullable(),
  resolvedBy: z.string().nullable(),
  resolutionNote: z.string().nullable(),
  callbackWindow: z.string().nullable(),
  /** Staff-only notes, interleaved by time with the visible messages. */
  internalNotes: z.array(supportMessageSchema),
  /** How to reach them well. Functional preferences only — never a diagnosis. */
  accessibility: z.object({
    locale: z.enum(LOCALE_CODES),
    supportChannel: z.enum(SUPPORT_CHANNELS),
    textOnly: z.boolean(),
    assistedOnboarding: z.boolean(),
    readAloud: z.boolean(),
    largeText: z.boolean(),
    highContrast: z.boolean(),
    simpleView: z.boolean(),
  }),
});
export type SupportTicketAdminView = z.infer<typeof supportTicketAdminSchema>;

/** Staff actions on a ticket. Every field optional; an empty body is rejected. */
export const updateSupportTicketSchema = z
  .object({
    status: z.enum(SUPPORT_TICKET_STATUSES).optional(),
    priority: z.enum(SUPPORT_PRIORITIES).optional(),
    /** AdminUser id, or "" to unassign. */
    assignedTo: z.string().trim().max(60).optional(),
    /** Sent to the customer, in their language. Visible to them forever. */
    reply: z.string().trim().max(4000).optional(),
    /** Staff-only. Never returned by a customer endpoint. */
    internalNote: z.string().trim().max(4000).optional(),
    resolutionNote: z.string().trim().max(2000).optional(),
    /** Raise or clear the vulnerable-customer flag. */
    vulnerabilityFlag: z.boolean().optional(),
    vulnerabilityNote: z.string().trim().max(2000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to change." });
export type UpdateSupportTicketInput = z.infer<typeof updateSupportTicketSchema>;

export const supportQuerySchema = z.object({
  status: z.enum(SUPPORT_TICKET_STATUSES).optional(),
  priority: z.enum(SUPPORT_PRIORITIES).optional(),
  /** Only requests for assisted setup — the queue a support lead works from. */
  assisted: z.coerce.boolean().optional(),
  locale: z.enum(LOCALE_CODES).optional(),
  /** "mine" filters to the caller's assigned tickets. */
  assignee: z.string().trim().max(60).optional(),
  q: z.string().trim().max(200).optional(),
  cursor: z.string().trim().max(60).optional(),
  take: z.coerce.number().int().min(1).max(100).default(30),
});
export type SupportQueryInput = z.infer<typeof supportQuerySchema>;

export const supportPageSchema = z.object({
  items: z.array(supportTicketAdminSchema),
  nextCursor: z.string().nullable(),
  counts: z.object({
    open: z.number(),
    inProgress: z.number(),
    waiting: z.number(),
    resolved: z.number(),
    assisted: z.number(),
    vulnerable: z.number(),
  }),
});
export type SupportPageView = z.infer<typeof supportPageSchema>;

// ---------------------------------------------------------------- consent ---

export const consentVersionSchema = z.object({
  id: z.string(),
  slug: z.string(),
  version: z.string(),
  locale: z.enum(LOCALE_CODES),
  title: z.string(),
  summary: z.string(),
  bodyUrl: z.string().nullable(),
  effectiveFrom: z.string(),
  /** Whether the signed-in person has already accepted this one. */
  accepted: z.boolean(),
  acceptedAt: z.string().nullable(),
});
export type ConsentVersionView = z.infer<typeof consentVersionSchema>;

export const acceptConsentSchema = z.object({
  consentVersionId: z.string().trim().min(1),
  /** The language the person was actually reading when they accepted. */
  readLocale: z.enum(LOCALE_CODES).default("en"),
});
export type AcceptConsentInput = z.infer<typeof acceptConsentSchema>;

// ---------------------------------------------------------- ai assistant ---

/**
 * The real AI Assistant chat (backend/src/routes/ai-assistant.ts,
 * webapp/src/components/account/AIAssistantChat.tsx) on the customer
 * `/account` page. A live Claude call, grounded only in the signed-in
 * customer's own real numbers — distinct from AIAssistWidget.tsx, which
 * stays a separate, explicitly rules-based savings suggestion with no live
 * AI call. See AGENTS.md §6 item 12.
 */
export const aiAssistantMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});
export type AiAssistantMessage = z.infer<typeof aiAssistantMessageSchema>;

export const aiAssistantChatInputSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  /** Prior turns of this conversation, oldest first — the client replays it, the API is stateless. */
  history: z.array(aiAssistantMessageSchema).max(20).default([]),
});
export type AiAssistantChatInput = z.infer<typeof aiAssistantChatInputSchema>;

export const aiAssistantChatResponseSchema = z.object({
  reply: z.string(),
});
export type AiAssistantChatResponseView = z.infer<typeof aiAssistantChatResponseSchema>;
