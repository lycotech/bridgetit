import type {
  AccountStatus,
  AccountType,
  KycStatus,
  SessionGate,
  SessionState,
  SessionUser,
} from "../types";
import { maskDestination } from "./codes";

/**
 * The single place that answers "what is this customer allowed to see?"
 *
 * WHY this is one function in one file rather than a set of checks spread across
 * routes and components: the requirement is that an unverified or unapproved
 * customer cannot reach transactions, earned-income features, savings or
 * investments. A rule enforced in eight places is a rule enforced in seven
 * places as soon as someone adds the ninth. Every route that serves regulated
 * data calls `requireFinancialAccess`, and every screen the SPA renders is
 * chosen by the `gate` this file computed on the server.
 *
 * The client receives the VERDICT, not the inputs to the verdict. It can still
 * see the flags (they are in `SessionUser` for display: "verify your email"),
 * but the decision about what may render was already made here.
 */

export interface AccountRow {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  accountType: string;
  status: string;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  kycStatus: string;
  kycSubmittedAt: Date | null;
  kycReviewedAt: Date | null;
  kycRejectionReason: string | null;
  suspendedReason: string | null;
  twoFactorEnabledAt: Date | null;
  createdAt: Date;
}

/**
 * Order of evaluation is the security property.
 *
 * Suspension and closure are checked FIRST, before any KYC state, because a
 * suspended account with approved KYC must not fall through to "active". Then
 * contact verification, then KYC. Each branch returns; there is no fallthrough
 * to a permissive default — the final line is the approved case and it is only
 * reached when every prior condition has been ruled out.
 */
export function computeGate(row: AccountRow): SessionGate {
  if (row.status === "closed") return "closed";
  if (row.status === "suspended") return "suspended";

  // Email is the mandatory channel: it is the account's identifier and the
  // recovery path. Phone verification is required before KYC but is prompted
  // inside the same verification step, so it does not get its own gate.
  if (!row.emailVerifiedAt) return "verify_contact";

  switch (row.kycStatus as KycStatus) {
    case "approved":
      return "active";
    case "pending":
      return "kyc_pending";
    case "rejected":
      return "kyc_rejected";
    case "not_started":
    default:
      // `default` deliberately lands on the most restrictive branch: an
      // unrecognised status (a bad migration, a manual database edit) must deny,
      // not permit.
      return "kyc_required";
  }
}

/**
 * Regulated functionality is available in exactly one state.
 *
 * Written as an equality against the allowed value rather than a list of
 * disallowed ones. A denylist has to be updated every time a new state is
 * added; this does not.
 */
export function hasFinancialAccess(gate: SessionGate): boolean {
  return gate === "active";
}

/**
 * Serialise a customer for their own eyes.
 *
 * Absent by construction: `passwordHash`, `sessionEpoch`, `failedLoginCount`,
 * `lockedUntil`, `kycInternalNote`, and the full phone number. The internal note
 * is the important one — it lives in a separate column from
 * `kycRejectionReason` precisely so that "show the customer the reason" cannot
 * accidentally show them the reviewer's private assessment.
 */
export function serialiseSessionUser(row: AccountRow): SessionUser {
  const gate = computeGate(row);
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    phoneMasked: row.phone ? maskDestination(row.phone) : null,
    accountType: row.accountType as AccountType,
    status: row.status as AccountStatus,
    emailVerified: Boolean(row.emailVerifiedAt),
    phoneVerified: Boolean(row.phoneVerifiedAt),
    kycStatus: row.kycStatus as KycStatus,
    kycSubmittedAt: row.kycSubmittedAt?.toISOString() ?? null,
    kycReviewedAt: row.kycReviewedAt?.toISOString() ?? null,
    // Only surfaced in the state where it is meant to be read. Carrying a stale
    // rejection reason into an approved session would tell a verified customer
    // they had been refused.
    kycRejectionReason: gate === "kyc_rejected" ? row.kycRejectionReason : null,
    suspendedReason: gate === "suspended" ? row.suspendedReason : null,
    twoFactorEnabled: Boolean(row.twoFactorEnabledAt),
    createdAt: row.createdAt.toISOString(),
  };
}

export function serialiseSessionState(row: AccountRow | null): SessionState {
  if (!row) return { gate: "anonymous", user: null, financialAccess: false };
  const gate = computeGate(row);
  return { gate, user: serialiseSessionUser(row), financialAccess: hasFinancialAccess(gate) };
}

/**
 * Human-readable explanation for a blocked request. Safe to return to the
 * caller: it says what to do next and nothing about anyone else.
 */
export const GATE_MESSAGES: Record<SessionGate, string> = {
  anonymous: "Sign in to continue.",
  verify_contact: "Confirm your email address to continue.",
  kyc_required: "Complete identity verification to use this feature.",
  kyc_pending: "Your verification is still being reviewed. This feature unlocks once it is approved.",
  kyc_rejected: "Your verification needs attention before this feature can be used.",
  active: "",
  suspended: "This account is currently suspended. Contact support@getpaybridge.com.",
  closed: "This account has been closed.",
};
