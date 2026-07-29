import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  AuditAction,
  AuditActionGroupKey,
  AuditEventView,
  AuditOutcome,
  AuditPageView,
} from "../../../../backend/src/types";

/**
 * Client for the audit-trail reader.
 *
 * READ-ONLY: there are no mutations in this module and there is no endpoint for
 * one. Everything here is a query, which is the whole point of the section.
 *
 * Paging is `useInfiniteQuery` over the server's cursor rather than page numbers.
 * WHY: the trail is appended to while it is being read, so page 2 of an offset
 * query would repeat a row and skip another every time something happens
 * mid-review. A cursor pins the position to a row, not to a count.
 */
export interface AuditFilters {
  group?: AuditActionGroupKey | "";
  action?: AuditAction | "";
  outcome?: AuditOutcome | "";
  q?: string;
  from?: string;
  to?: string;
}

export const PAGE_SIZE = 50;

export const auditKeys = {
  list: (filters: AuditFilters) => ["admin", "audit", filters] as const,
};

/**
 * Filters → query string. Empty values are omitted rather than sent blank,
 * so the server's optional-field validation stays the strict one.
 *
 * `action` wins over `group`: if a specific action is chosen, the coarse group
 * is redundant, and sending both invites the two to contradict each other.
 */
export function auditQuery(filters: AuditFilters, extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  if (filters.action) params.set("action", filters.action);
  else if (filters.group) params.set("group", filters.group);
  if (filters.outcome) params.set("outcome", filters.outcome);
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  for (const [key, value] of Object.entries(extra ?? {})) params.set(key, value);
  const search = params.toString();
  return search ? `?${search}` : "";
}

export function useAuditTrail(filters: AuditFilters) {
  return useInfiniteQuery({
    queryKey: auditKeys.list(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<AuditPageView>(
        `/api/admin/audit${auditQuery(filters, {
          take: String(PAGE_SIZE),
          ...(pageParam ? { cursor: pageParam } : {}),
        })}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // Short but non-zero: an investigator switching filters wants fresh rows,
    // and nobody needs a refetch for every re-render of the same view.
    staleTime: 10_000,
  });
}

/**
 * Trigger the CSV download.
 *
 * Goes through `api.raw` and an object URL rather than pointing `window.open` at
 * the endpoint. WHY: the export needs the session cookie AND lives behind the
 * same origin checks as every other call, and a plain navigation would drop the
 * client's `X-Requested-With`/credentials handling and open a blank tab on a
 * 403. This way a failure surfaces as an error we can show.
 */
export async function downloadAuditCsv(filters: AuditFilters): Promise<void> {
  const response = await api.raw(`/api/admin/audit/export${auditQuery(filters)}`);
  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error?.message ?? "The export could not be prepared.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `paybridge-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked immediately: the blob holds audit rows in memory, and an object URL
  // that outlives the click is a copy of the trail sitting in the tab.
  URL.revokeObjectURL(url);
}

/** Tailwind classes per outcome. Denied and failed are visually distinct. */
export const AUDIT_OUTCOME_TONE: Record<string, string> = {
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  failure: "border-amber-500/40 bg-amber-500/10 text-amber-500",
  denied: "border-destructive/40 bg-destructive/10 text-destructive",
};

/** Who the actor was, in one short phrase. */
export const ACTOR_TYPE_LABELS: Record<string, string> = {
  admin: "Administrator",
  user: "Customer",
  invitee: "Invitee",
  system: "System",
  anonymous: "Not signed in",
};

/**
 * `detail` arrives as a JSON string, already scrubbed of credentials by the
 * server. Parsed here for display and returned as entries; anything unparseable
 * is shown as-is rather than hidden, because a malformed detail is itself
 * information about the event that wrote it.
 */
export function detailEntries(event: AuditEventView): { key: string; value: string }[] | string | null {
  if (!event.detail) return null;
  try {
    const parsed = JSON.parse(event.detail) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return event.detail;
    const entries = Object.entries(parsed)
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([key, value]) => ({
        key: key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (ch) => ch.toUpperCase()),
        value: typeof value === "object" ? JSON.stringify(value) : String(value),
      }));
    return entries.length ? entries : null;
  } catch {
    return event.detail;
  }
}
