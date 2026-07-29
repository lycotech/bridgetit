import { api } from "@/lib/api";

/**
 * Client for the internal admin dashboard API.
 *
 * Nothing here is public. Every call below /api/admin (except the login and the
 * session probe) is refused without an admin session cookie, so this module can
 * be honest about what it wants and let the server say no.
 *
 * The vocabulary lists — statuses, follow-up states, pipeline stages,
 * priorities — are FETCHED rather than duplicated. If they were copied here,
 * the day someone adds a status to the backend is the day the dashboard starts
 * writing values the server rejects.
 */

export interface AdminRegistration {
  id: string;
  segment: "employee" | "employer" | "capital_partner" | "general";
  communityName: string;
  stage: string;
  status: string;
  fullName: string;
  email: string;
  phone: string | null;
  organisation: string | null;
  jobTitle: string | null;
  location: string | null;
  details: Record<string, unknown>;
  privacyAccepted: boolean;
  privacyAcceptedAt: string | null;
  marketingConsent: boolean;
  marketingConsentAt: string | null;
  consentText: string | null;
  sourcePage: string | null;
  formType: string | null;
  source: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  referrer: string | null;
  followUpStatus: string | null;
  assignedTeam: string | null;
  assignedTo: string | null;
  pilotPriority: string | null;
  pipelineStage: string | null;
  internalNotes: string | null;
  qualified: boolean | null;
  lastContactAt: string | null;
  confirmationSentAt: string | null;
  notificationSentAt: string | null;
  emailDeliveryNote: string | null;
  demoInvitationStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * One entry in a registration's activity timeline.
 *
 * The timeline is append-only on the server: a status change, a note, an email
 * attempt and an invitation each add a row and nothing ever rewrites one. That
 * is what makes "why is this employer still in Discovery?" answerable.
 */
export interface RegistrationEvent {
  id: string;
  kind:
    | "registered"
    | "resubmitted"
    | "field_changed"
    | "note"
    | "contacted"
    | "email_sent"
    | "invitation_issued"
    | "invitation_revoked";
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  message: string | null;
  actor: string;
  createdAt: string;
}

export interface AdminRegistrationDetail extends AdminRegistration {
  invitations: InvitationRow[];
  events: RegistrationEvent[];
}

export interface AdminStats {
  total: number;
  lastSevenDays: number;
  employee: number;
  employer: number;
  capitalPartner: number;
  general: number;
  demoInvitations: number;
  byStatus: Record<string, number>;
}

export interface Vocabulary {
  segments: readonly string[];
  statuses: readonly string[];
  followUpStatuses: readonly string[];
  pilotPriorities: readonly string[];
  pipelineStages: readonly string[];
}

export interface InvitationRow {
  id: string;
  tokenHint: string;
  email: string;
  label?: string | null;
  portal: string;
  issuedBy: string;
  registrationId?: string | null;
  expiresAt: string;
  redeemedAt: string | null;
  revokedAt: string | null;
  useCount: number;
  maxUses: number;
  expired?: boolean;
  createdAt: string;
}

export interface DemoAccessRow {
  id: string;
  invitationId: string | null;
  email: string | null;
  method: string;
  outcome: string;
  path: string | null;
  createdAt: string;
}

export interface RegistrationFilters {
  segment?: string;
  status?: string;
  q?: string;
  take?: number;
  skip?: number;
}

function queryString(filters: RegistrationFilters): string {
  const params = new URLSearchParams();
  if (filters.segment) params.set("segment", filters.segment);
  if (filters.status) params.set("status", filters.status);
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.take) params.set("take", String(filters.take));
  if (filters.skip) params.set("skip", String(filters.skip));
  const s = params.toString();
  return s ? `?${s}` : "";
}

export const adminApi = {
  session: () =>
    api.get<{ authenticated: boolean; username: string | null }>("/api/admin/session"),

  login: (username: string, password: string) =>
    api.post<{ username: string }>("/api/admin/login", { username, password }),

  logout: () => api.post<{ ok: boolean }>("/api/admin/logout"),

  stats: () => api.get<AdminStats>("/api/admin/stats"),

  vocabulary: () => api.get<Vocabulary>("/api/admin/vocabulary"),

  registrations: (filters: RegistrationFilters) =>
    api.get<{ items: AdminRegistration[]; total: number }>(
      `/api/admin/registrations${queryString(filters)}`,
    ),

  registration: (id: string) =>
    api.get<AdminRegistrationDetail>(`/api/admin/registrations/${id}`),

  update: (id: string, patch: Record<string, unknown>) =>
    api.patch<AdminRegistration>(`/api/admin/registrations/${id}`, patch),

  /**
   * Append a note. Deliberately NOT a PATCH of `internalNotes` — that field is
   * one string and two people working the same lead would overwrite each other.
   */
  addNote: (id: string, message: string, markContacted?: boolean) =>
    api.post<{ events: RegistrationEvent[] }>(`/api/admin/registrations/${id}/notes`, {
      message,
      markContacted,
    }),

  resendWelcome: (id: string) =>
    api.post<{ delivered: boolean; note: string }>(
      `/api/admin/registrations/${id}/resend-welcome`,
    ),

  /*
   * Invitations are NOT served from here. The demonstration-invitation manager
   * owns them — see lib/admin/invitations.ts and useInvitations(). Codes are
   * shown exactly once, at creation, so a generic "fetch invitations" helper on
   * this client would only ever be able to return hints and would invite the
   * wrong assumption. The link-based create/revoke helpers that used to sit here
   * have been removed along with their endpoints.
   */

  demoAccess: () => api.get<DemoAccessRow[]>("/api/admin/demo-access"),
};

/**
 * Download the CSV export.
 *
 * Uses `api.raw` rather than a plain anchor href: the export needs the session
 * cookie AND the CSRF-aware fetch wrapper, and a bare link would also let the
 * browser cache a file full of personal data. The blob URL is revoked
 * immediately after the click.
 */
export async function downloadRegistrationsCsv(filters: RegistrationFilters): Promise<void> {
  const response = await api.raw(`/api/admin/export${queryString(filters)}`);
  if (!response.ok) throw new Error("Export failed");

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `paybridge-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export const adminKeys = {
  session: ["admin", "session"] as const,
  stats: ["admin", "stats"] as const,
  vocabulary: ["admin", "vocabulary"] as const,
  registrations: (filters: RegistrationFilters) => ["admin", "registrations", filters] as const,
  registration: (id: string) => ["admin", "registration", id] as const,
  invitations: ["admin", "invitations"] as const,
  demoAccess: ["admin", "demo-access"] as const,
};

export const SEGMENT_LABELS: Record<string, string> = {
  employee: "Employee · Bridger",
  employer: "Employer · Bridge Partner",
  capital_partner: "Capital · Bridge Capital Partner",
  general: "General enquiry",
};

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}
