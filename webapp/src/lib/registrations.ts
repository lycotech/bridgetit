import { z } from "zod";
import { api } from "@/lib/api";
import { captureAttribution } from "@/lib/analytics";

/**
 * Client-side mirror of the segmented registration contract in
 * ../../backend/src/types.ts.
 *
 * WHY a mirror rather than an import: the backend is on Zod 4 and this app is
 * on Zod 3. The two packages are not wire-compatible at the schema-object
 * level, so importing the backend schemas here breaks at build time. The
 * option lists below MUST stay byte-identical to the backend enums — a
 * mismatch shows up as a validation failure the visitor cannot fix.
 *
 * WHY validating here at all when the server validates anyway: this is a UX
 * layer, not a security layer. The server is the authority; every rule here is
 * repeated there. Nothing may be relaxed on the server because it is checked
 * here.
 *
 * NOTE what is deliberately ABSENT from every schema in this file: BVN, NIN,
 * bank statements, identity documents, payroll files, incorporation documents,
 * bank login details. Registration is an expression of interest. Those are
 * collected later, through a secure verification portal, at activation — never
 * through a public web form and never by email.
 */

/* ------------------------------------------------------------------ SHARED */

export const SEGMENTS = ["employee", "employer", "capital_partner", "general"] as const;
export type Segment = (typeof SEGMENTS)[number];

const fullName = z.string().trim().min(2, "Please enter your full name").max(120);
const email = z.string().trim().email("Please enter a valid email address").max(200);
const phone = z
  .string()
  .trim()
  .min(6, "Please enter a valid phone number")
  .max(40)
  .regex(/^[+()\-.\s0-9]+$/, "Please enter a valid phone number");

/**
 * Consent is two separate checkboxes, never one.
 *
 * WHY: bundling "I accept the privacy policy" with "send me marketing" makes
 * the marketing consent invalid — consent has to be freely given and specific.
 * The privacy acknowledgement is required; the updates opt-in is genuinely
 * optional and submitting without it works fine.
 */
const consent = {
  privacyAccepted: z.literal(true, {
    errorMap: () => ({ message: "Please acknowledge the privacy policy to continue" }),
  }),
  marketingConsent: z.boolean().default(false),
};

/**
 * Honeypot. Rendered off-screen and hidden from assistive technology, so a
 * human never sees it and a screen reader never announces it. Automated
 * submitters fill every input they find.
 */
const botTraps = {
  website: z.string().max(200).optional(),
};

export interface RegistrationResult {
  id: string;
  status: "received";
  segment: Segment;
  communityName: string;
  createdAt: string;
}

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

export const employeeFormSchema = z.object({
  fullName,
  email,
  phone,
  location: z.string().trim().min(2, "Please enter your state or city").max(120),
  employerName: z.string().trim().min(2, "Please enter your employer's name").max(160),
  employmentType: z.enum(EMPLOYMENT_TYPES, {
    required_error: "Please choose your employment type",
  }),
  salaryBand: z.enum(SALARY_BANDS).optional(),
  wants: z.string().trim().max(1000).optional(),
  ...consent,
  ...botTraps,
});

export type EmployeeForm = z.infer<typeof employeeFormSchema>;

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

export const employerFormSchema = z.object({
  companyName: z.string().trim().min(2, "Please enter your company name").max(200),
  fullName: z.string().trim().min(2, "Please enter the contact person's name").max(120),
  jobTitle: z.string().trim().min(2, "Please enter your job title").max(120),
  email,
  phone,
  industry: z.string().trim().min(2, "Please enter your industry").max(120),
  employeeCount: z.enum(EMPLOYEE_COUNT_BANDS, {
    required_error: "Please choose your number of employees",
  }),
  payrollBand: z.enum(PAYROLL_BANDS, { required_error: "Please choose your monthly payroll band" }),
  payrollProvider: z.string().trim().min(2, "Please tell us your payroll bank or provider").max(160),
  payrollFrequency: z.enum(PAYROLL_FREQUENCIES, {
    required_error: "Please choose your payroll frequency",
  }),
  wellbeingChallenge: z.string().trim().min(2, "Please describe the primary challenge").max(1000),
  salaryConsistency: z.enum(SALARY_CONSISTENCY, {
    required_error: "Please tell us how consistently salaries are paid",
  }),
  pilotTimeline: z.enum(PILOT_TIMELINES, { required_error: "Please choose a preferred timeline" }),
  location: z.string().trim().min(2, "Please enter your city or operating location").max(120),
  ...consent,
  ...botTraps,
});

export type EmployerForm = z.infer<typeof employerFormSchema>;

/* --------------------------------------------------------- CAPITAL PARTNER */

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

export const capitalFormSchema = z.object({
  fullName,
  partyType: z.enum(CAPITAL_PARTY_TYPES, { required_error: "Please choose one" }),
  companyName: z.string().trim().max(200).optional(),
  jobTitle: z.string().trim().max(120).optional(),
  email,
  phone,
  country: z.string().trim().min(2, "Please enter your country").max(120),
  capitalRange: z.enum(CAPITAL_RANGES, { required_error: "Please choose an indicative range" }),
  participationStructure: z.enum(PARTICIPATION_STRUCTURES, {
    required_error: "Please choose a preferred structure",
  }),
  investmentHorizon: z.enum(INVESTMENT_HORIZONS, { required_error: "Please choose a horizon" }),
  regulatedStatus: z.enum(REGULATED_STATUS, { required_error: "Please choose one" }),
  mandate: z.string().trim().min(10, "Please describe your investment mandate").max(2000),
  ...consent,
  ...botTraps,
});

export type CapitalForm = z.infer<typeof capitalFormSchema>;

/* ----------------------------------------------------------------- GENERAL */

export const ENQUIRY_TYPES = [
  "General enquiry",
  "Media enquiry",
  "Technology partnership",
  "Banking partnership",
  "Compliance enquiry",
  "Other",
] as const;

export const contactFormSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your name").max(120),
  email,
  phone: z
    .string()
    .trim()
    .max(40)
    .regex(/^[+()\-.\s0-9]*$/, "Please enter a valid phone number")
    .optional(),
  enquiryType: z.enum(ENQUIRY_TYPES, { required_error: "Please choose an enquiry type" }),
  message: z.string().trim().min(10, "Please tell us a little more").max(3000),
  ...consent,
  ...botTraps,
});

export type ContactForm = z.infer<typeof contactFormSchema>;

/* ------------------------------------------------------------- SUBMISSION */

const ENDPOINTS: Record<Segment, string> = {
  employee: "/api/registrations/employee",
  employer: "/api/registrations/employer",
  capital_partner: "/api/registrations/capital",
  general: "/api/registrations/contact",
};

/**
 * Post a registration.
 *
 * `elapsedMs` is how long the form was on screen. The server treats an
 * implausibly fast completion as automated. It is sent from here because only
 * the browser knows it; the server cannot infer it from a single request.
 *
 * Empty optional strings are dropped rather than sent as "", so an untouched
 * optional field does not fail a min-length rule on the server.
 */
export async function submitRegistration<T extends Record<string, unknown>>(
  segment: Segment,
  values: T,
  elapsedMs: number,
): Promise<RegistrationResult> {
  const attribution = captureAttribution();
  const payload: Record<string, unknown> = { ...values, ...attribution, elapsedMs };

  for (const key of Object.keys(payload)) {
    if (payload[key] === "" || payload[key] === undefined) delete payload[key];
  }
  // privacyAccepted is a literal(true); never let the cleanup above drop it.
  payload.privacyAccepted = values.privacyAccepted === true;
  payload.marketingConsent = values.marketingConsent === true;
  payload.sourcePage = typeof window === "undefined" ? undefined : window.location.pathname;

  return api.post<RegistrationResult>(ENDPOINTS[segment], payload);
}
