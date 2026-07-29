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
});
export type SignInInput = z.infer<typeof signInSchema>;

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
