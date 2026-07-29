import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CreateSupportTicketInput, SupportTicketView } from "../../../../backend/src/types";

/**
 * Asking PayBridge for help, from the customer's side.
 *
 * Creating a ticket needs NO session — see the header of
 * backend/src/routes/support.ts. The people most likely to need a human are the
 * ones who cannot sign in, so the form works while locked out.
 *
 * Reading the list DOES need one, and a 401 here is an ordinary answer rather
 * than an error: it means "not signed in", which the page renders as an empty
 * history, not as a failure. Hence `retry: false` and a caller that tolerates
 * `undefined`.
 */

export const supportCustomerKeys = {
  mine: ["support", "mine"] as const,
  one: (reference: string) => ["support", "mine", reference] as const,
};

export function useMyTickets() {
  return useQuery({
    queryKey: supportCustomerKeys.mine,
    queryFn: async () => {
      const page = await api.get<{ items: SupportTicketView[] }>("/api/support/tickets/mine");
      return page.items;
    },
    retry: false,
    staleTime: 30_000,
  });
}

/**
 * `acknowledged` is whether the confirmation EMAIL went out — not whether the
 * ticket was saved. The ticket is saved either way, which is why it travels as a
 * separate flag: the screen can promise the request is recorded without also
 * promising an email that may have bounced.
 */
type TicketCreated = { ticket: SupportTicketView; acknowledged: boolean };

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSupportTicketInput) => api.post<TicketCreated>("/api/support/tickets", input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: supportCustomerKeys.mine });
    },
  });
}

export function useReplyToTicket(reference: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      api.post<SupportTicketView>(`/api/support/tickets/mine/${encodeURIComponent(reference)}/messages`, {
        body,
      }),
    onSuccess: (ticket) => {
      // Write the returned conversation straight into the list so the reply
      // appears without a refetch — on a slow connection the alternative is a
      // person pressing Send twice because nothing visibly happened.
      qc.setQueryData<SupportTicketView[]>(supportCustomerKeys.mine, (current) =>
        current ? current.map((row) => (row.reference === ticket.reference ? ticket : row)) : [ticket],
      );
    },
  });
}
