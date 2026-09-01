import { useState } from "react";
import { Mail, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel, InfoNote } from "@/components/dashboard/Panel";
import { EmptyState, LoadingPanel } from "@/components/dashboard/states";
import { GetHelpForm } from "@/components/support/GetHelpForm";
import { TicketCreated } from "@/components/support/TicketCreated";
import { MyConversations } from "@/components/support/MyConversations";
import { useMyTickets } from "@/lib/support/customer";
import { SUPPORT_EMAIL, mailtoLink } from "@/lib/support/contact";
import { useSession } from "@/lib/account/session";
import type { SupportTicketView } from "../../../../../backend/src/types";

/**
 * Real employee Support — `/account/employee/support`. Same real ticket
 * system the mock demo's own Support.tsx already used (it was the one demo
 * page already on real data) — this is that same real system's home inside
 * the rebuilt real dashboard, reading the real session instead of the demo
 * one (`useSession`, not `useAuth`/`auth-context`).
 */
export default function EmployeeSupport() {
  const { data: session } = useSession();
  const tickets = useMyTickets();
  const [created, setCreated] = useState<SupportTicketView | null>(null);

  const rows = tickets.data ?? [];
  const history = created && !rows.some((row) => row.reference === created.reference) ? [created, ...rows] : rows;

  return (
    <div className="space-y-6">
      <PageHeader title="Support" description="Get help from the PayBridge team." />

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <Panel title={created ? "Request sent" : "Choose how to reach us"}>
          {created ? (
            <TicketCreated ticket={created} onAskAgain={() => setCreated(null)} />
          ) : (
            <GetHelpForm
              defaultName={session?.user?.fullName ?? ""}
              defaultEmail={session?.user?.email ?? ""}
              defaultPhone=""
              onCreated={setCreated}
            />
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Your requests">
            {tickets.isLoading ? (
              <LoadingPanel />
            ) : history.length === 0 ? (
              <EmptyState title="No requests yet" body="Anything you send us shows up here." icon={<MessageSquare className="h-5 w-5" />} />
            ) : (
              <MyConversations tickets={history} />
            )}
          </Panel>

          <Panel title="Other ways to reach us">
            <div className="space-y-3 text-sm">
              <p className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <a
                  href={mailtoLink("Support", "")}
                  className="min-h-[44px] py-2.5 font-semibold text-foreground underline decoration-primary/40 underline-offset-4 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]"
                >
                  {SUPPORT_EMAIL}
                </a>
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">We usually reply within one working day.</p>
            </div>
            <InfoNote tone="attention" className="mt-4">
              PayBridge staff will never ask for your password or a one-time code over email or phone.
            </InfoNote>
          </Panel>
        </div>
      </div>
    </div>
  );
}
