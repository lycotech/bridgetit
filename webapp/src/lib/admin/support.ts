import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  LocaleCode,
  SupportChannel,
  SupportPriority,
  SupportTicketAdminView,
  SupportTicketStatus,
} from "../../../../backend/src/types";

/**
 * Client for the support desk.
 *
 * The shape returned by the server carries NO financial information — not
 * filtered here, absent there. So there is nothing in this module that could
 * accidentally render a balance next to a support conversation.
 *
 * Reads on this section are logged server-side. That means every call below is a
 * recorded act, which is why the ticket detail is fetched when a ticket is opened
 * rather than prefetched for the whole list: prefetching would write an access log
 * row for people nobody actually looked at, and a log full of noise protects no one.
 */
export interface SupportFilters {
  status?: SupportTicketStatus | "";
  priority?: SupportPriority | "";
  locale?: LocaleCode | "";
  assignee?: string;
  assisted?: boolean;
  q?: string;
}

export interface SupportPage {
  items: SupportTicketAdminView[];
  nextCursor: string | null;
  counts: {
    open: number;
    inProgress: number;
    waiting: number;
    resolved: number;
    assisted: number;
    vulnerable: number;
  };
}

export interface AssistedQueueEntry {
  reference: string;
  name: string;
  email: string;
  phone: string | null;
  locale: LocaleCode;
  textOnly: boolean;
  channel: SupportChannel;
  status: SupportTicketStatus;
  requestedAt: string;
  assignedToLabel: string | null;
}

export interface StandingRequest {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  locale: LocaleCode;
  textOnly: boolean;
  channel: SupportChannel;
  requestedAt: string | null;
}

export interface AssistedQueue {
  tickets: AssistedQueueEntry[];
  standingRequests: StandingRequest[];
}

export const PAGE_SIZE = 30;

export const supportKeys = {
  list: (filters: SupportFilters) => ["admin", "support", "list", filters] as const,
  ticket: (reference: string) => ["admin", "support", "ticket", reference] as const,
  assisted: () => ["admin", "support", "assisted"] as const,
};

function toQuery(filters: SupportFilters, extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.locale) params.set("locale", filters.locale);
  if (filters.assignee) params.set("assignee", filters.assignee);
  if (filters.assisted) params.set("assisted", "true");
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  for (const [key, value] of Object.entries(extra ?? {})) params.set(key, value);
  const search = params.toString();
  return search ? `?${search}` : "";
}

export function useSupportTickets(filters: SupportFilters) {
  return useInfiniteQuery({
    queryKey: supportKeys.list(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<SupportPage>(
        `/api/admin/support/tickets${toQuery(filters, {
          take: String(PAGE_SIZE),
          ...(pageParam ? { cursor: pageParam } : {}),
        })}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // Short: a queue two agents are working needs to show that one of them
    // already picked up the case.
    staleTime: 10_000,
  });
}

/**
 * One ticket, with the full conversation and internal notes.
 *
 * `enabled` is the caller's choice because opening a ticket is a logged read.
 */
export function useSupportTicket(reference: string | null) {
  return useQuery({
    queryKey: supportKeys.ticket(reference ?? ""),
    queryFn: () => api.get<SupportTicketAdminView>(`/api/admin/support/tickets/${reference}`),
    enabled: Boolean(reference),
    staleTime: 5_000,
  });
}

export function useAssistedQueue() {
  return useQuery({
    queryKey: supportKeys.assisted(),
    queryFn: () => api.get<AssistedQueue>("/api/admin/support/assisted"),
    staleTime: 30_000,
    // 403 for a role without `support.accessibility.view` is an answer, not a
    // fault: retrying it would just write three more denials into the trail.
    retry: false,
  });
}

export interface SupportAgentList {
  items: { id: string; name: string; role: string }[];
  /** Null for the break-glass environment session, which has no row to assign to. */
  selfId: string | null;
}

/**
 * Who a case can be handed to.
 *
 * Not `useAdminUsers()`: that endpoint is super-admin only, and an operations
 * administrator needs to assign a case without being able to read the
 * administrator directory. `retry: false` because a 403 here is a settled answer.
 */
export function useSupportAgents(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "support", "agents"] as const,
    queryFn: () => api.get<SupportAgentList>("/api/admin/support/agents"),
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export interface SupportUpdateInput {
  reference: string;
  status?: SupportTicketStatus;
  priority?: SupportPriority;
  assignedTo?: string;
  reply?: string;
  internalNote?: string;
  resolutionNote?: string;
  vulnerabilityFlag?: boolean;
  vulnerabilityNote?: string;
}

export function useUpdateSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reference, ...input }: SupportUpdateInput) =>
      api.patch<SupportTicketAdminView>(`/api/admin/support/tickets/${reference}`, input),
    onSuccess: (ticket) => {
      // The detail is written straight into the cache so the reply appears without
      // a second logged read of the same ticket.
      qc.setQueryData(supportKeys.ticket(ticket.reference), ticket);
      void qc.invalidateQueries({ queryKey: ["admin", "support", "list"], exact: false });
      void qc.invalidateQueries({ queryKey: supportKeys.assisted() });
    },
  });
}

/**
 * Tone per status. Always rendered beside the words, never as the only signal —
 * a support lead scanning a queue on a cheap screen in daylight cannot rely on
 * amber-versus-green, and neither can a colour-blind one.
 */
export const SUPPORT_STATUS_TONE: Record<SupportTicketStatus, string> = {
  open: "border-sky-500/40 bg-sky-500/10 text-sky-400",
  in_progress: "border-violet-500/40 bg-violet-500/10 text-violet-400",
  waiting_on_customer: "border-amber-500/40 bg-amber-500/10 text-amber-500",
  resolved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
};

export const SUPPORT_PRIORITY_TONE: Record<SupportPriority, string> = {
  normal: "border-border bg-muted/40 text-muted-foreground",
  high: "border-amber-500/40 bg-amber-500/10 text-amber-500",
  vulnerable: "border-destructive/40 bg-destructive/10 text-destructive",
};
