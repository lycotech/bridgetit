import { useState } from "react";
import { Mail, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel, InfoNote } from "@/components/dashboard/Panel";
import { EmptyState, LoadingPanel } from "@/components/dashboard/states";
import { ListenButton } from "@/components/prefs/ListenButton";
import { GetHelpForm } from "@/components/support/GetHelpForm";
import { TicketCreated } from "@/components/support/TicketCreated";
import { MyConversations } from "@/components/support/MyConversations";
import { usePreferences } from "@/lib/prefs/PreferencesProvider";
import { useMyTickets } from "@/lib/support/customer";
import { SUPPORT_EMAIL, mailtoLink } from "@/lib/support/contact";
import { useAuth } from "@/lib/auth/auth-context";
import type { SupportTicketView } from "../../../../backend/src/types";
import type { TranslationKey } from "@/i18n/translate";

/**
 * Get Help.
 *
 * FIVE WAYS IN, ONE TICKET OUT. WhatsApp, a written form, a phone call, a
 * call-back and email all pass through the same form and all leave a record with
 * a reference. Nothing here depends on being able to speak, and nothing here
 * depends on being able to type quickly.
 *
 * WHY THE FORM IS NOT BEHIND A "NEW MESSAGE" BUTTON any more: the person who
 * needs this page most has arrived because something has gone wrong with their
 * money, possibly on a screen they cannot read. Making them find and press a
 * button before they can say anything adds a step for everybody to save space
 * for nobody. The form is the page.
 *
 * The questions below are answers, not decoration — a good half of support
 * volume is "when is it taken from my salary", and reading it here at 2am beats
 * waiting until Monday for a reply.
 */

const FAQS: { q: TranslationKey; a: TranslationKey }[] = [
  { q: "support.faq_deduction_q", a: "support.faq_deduction_a" },
  { q: "support.faq_partial_q", a: "support.faq_partial_a" },
  { q: "support.faq_privacy_q", a: "support.faq_privacy_a" },
  { q: "support.faq_speed_q", a: "support.faq_speed_a" },
];

export default function EmployeeSupportPage() {
  const { t } = usePreferences();
  const { user } = useAuth();
  const tickets = useMyTickets();
  const [created, setCreated] = useState<SupportTicketView | null>(null);

  /*
   * The just-created ticket is shown at the top of the history even if the list
   * itself could not be loaded (someone who is not signed in gets a 401 here).
   * Losing sight of a reference you were given ten seconds ago is the exact
   * moment people give up on a support channel.
   */
  const rows = tickets.data ?? [];
  const history = created && !rows.some((row) => row.reference === created.reference) ? [created, ...rows] : rows;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t("employee.nav.support")} title={t("support.title")} description={t("support.subtitle")} />

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <Panel
          title={created ? t("support.sent_title") : t("support.choose_channel")}
          description={created ? undefined : t("support.subtitle")}
        >
          {created ? (
            <TicketCreated ticket={created} onAskAgain={() => setCreated(null)} />
          ) : (
            <GetHelpForm
              defaultName={user?.fullName ?? ""}
              defaultEmail={user?.email ?? ""}
              /* Left blank on purpose. The account only holds a MASKED number,
                 and prefilling "*******4821" would send support a phone number
                 they cannot dial. Better an empty field than a wrong one. */
              defaultPhone=""
              onCreated={setCreated}
            />
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title={t("support.ticket_list")}>
            {tickets.isLoading ? (
              <LoadingPanel />
            ) : history.length === 0 ? (
              <EmptyState
                title={t("support.no_tickets")}
                body={t("support.subtitle")}
                icon={<MessageSquare className="h-5 w-5" />}
              />
            ) : (
              <MyConversations tickets={history} />
            )}
          </Panel>

          <Panel title={t("support.faq_title")}>
            <ul className="space-y-5">
              {FAQS.map((faq) => (
                <li key={faq.q}>
                  <p className="text-sm font-semibold text-foreground">{t(faq.q)}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t(faq.a)}</p>
                  <div className="mt-2">
                    <ListenButton text={`${t(faq.q)} ${t(faq.a)}`} size="sm" />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title={t("support.other_ways")}>
            <div className="space-y-3 text-sm">
              <p className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                {/* A real mailto with the subject already filled in, so the mail
                    app opens ready to type rather than ready to be configured. */}
                <a
                  href={mailtoLink(t("support.title"), "")}
                  className="min-h-[44px] py-2.5 font-semibold text-foreground underline decoration-primary/40 underline-offset-4 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]"
                >
                  {SUPPORT_EMAIL}
                </a>
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">{t("support.email_reply_time")}</p>
            </div>
            <InfoNote tone="attention" className="mt-4">
              {t("support.never_asks")}
            </InfoNote>
          </Panel>
        </div>
      </div>
    </div>
  );
}
