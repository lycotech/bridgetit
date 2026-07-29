import type { Segment } from "../types";

/**
 * PayBridge sender identities.
 *
 * One identity per audience. WHY separate mailboxes rather than one
 * `info@`: the reply lands with the team that can actually answer it, the
 * recipient can tell at a glance whether the mail is about their job, their
 * workforce or their capital, and each stream can be filtered, delegated and
 * (later) given its own signing key without touching the others.
 *
 * NOTE the plural on `partners@`. `partner@` is NOT an alias and must never be
 * used — mail sent to it will bounce.
 *
 * Every address is overridable by environment variable so a staging deployment
 * can point all four at a test inbox without a code change.
 */
export interface EmailIdentity {
  /** Display name shown in the recipient's client. */
  name: string;
  /** Envelope + From address. */
  address: string;
  /** Internal inbox that receives the notification for this segment. */
  inbox: string;
}

const env = process.env as Record<string, string | undefined>;

/** General enquiries, contact form, media, anything unsegmented. */
export const TEAM: EmailIdentity = {
  name: "PayBridge Team",
  address: env.MAIL_FROM_GENERAL ?? "hello@getpaybridge.com",
  inbox: env.MAIL_INBOX_GENERAL ?? "hello@getpaybridge.com",
};

/** Employees — the Bridger community. */
export const BRIDGERS: EmailIdentity = {
  name: "PayBridge Bridgers",
  address: env.MAIL_FROM_EMPLOYEE ?? "bridgers@getpaybridge.com",
  inbox: env.MAIL_INBOX_EMPLOYEE ?? "bridgers@getpaybridge.com",
};

/** Employers — HR, payroll, partnership enquiries. Plural: partners@. */
export const PARTNERSHIPS: EmailIdentity = {
  name: "PayBridge Partnerships",
  address: env.MAIL_FROM_EMPLOYER ?? "partners@getpaybridge.com",
  inbox: env.MAIL_INBOX_EMPLOYER ?? "partners@getpaybridge.com",
};

/** Capital providers — institutional funding, lenders, liquidity partners. */
export const CAPITAL: EmailIdentity = {
  name: "PayBridge Capital",
  address: env.MAIL_FROM_CAPITAL ?? "capital@getpaybridge.com",
  inbox: env.MAIL_INBOX_CAPITAL ?? "capital@getpaybridge.com",
};

export const IDENTITY_BY_SEGMENT: Record<Segment, EmailIdentity> = {
  employee: BRIDGERS,
  employer: PARTNERSHIPS,
  capital_partner: CAPITAL,
  general: TEAM,
};

/**
 * Route a general enquiry to the team that owns it.
 *
 * Section 8: "Where an enquiry clearly relates to employers, employees or
 * capital, automatically copy or route it to the appropriate segment email."
 * The acknowledgement still comes from PayBridge Team — the person wrote to
 * hello@, so hello@ answers — but the internal copy also reaches the
 * specialists, so nothing sits unread in a shared inbox.
 */
export function additionalInboxesForEnquiry(enquiryType: string): string[] {
  switch (enquiryType) {
    case "Banking partnership":
      return [CAPITAL.inbox];
    case "Technology partnership":
      return [PARTNERSHIPS.inbox];
    case "Compliance enquiry":
      return [PARTNERSHIPS.inbox, CAPITAL.inbox];
    default:
      return [];
  }
}

/** Where a data deletion or breach report should be sent. */
export const PRIVACY_CONTACT = env.MAIL_PRIVACY_CONTACT ?? "hello@getpaybridge.com";

export function formatSender(identity: EmailIdentity): string {
  return `${identity.name} <${identity.address}>`;
}
