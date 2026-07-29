import { CheckCircle2, MessageCircle, Phone } from "lucide-react";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { InfoNote } from "@/components/dashboard/Panel";
import { ListenButton } from "@/components/prefs/ListenButton";
import { usePreferences } from "@/lib/prefs/PreferencesProvider";
import { LOCALES } from "@/i18n/locales";
import { telLink, whatsappLink } from "@/lib/support/contact";
import type { SupportTicketView } from "../../../../backend/src/types";

/**
 * What somebody sees the moment their request is recorded.
 *
 * THE REFERENCE COMES FIRST, big enough to read out loud over a phone, because it
 * is the only thing that makes the request checkable later by anybody other than
 * the person who took it.
 *
 * Only THEN does the channel's next step appear — the WhatsApp link with the
 * reference already typed into the message, or the phone number. If neither is
 * configured yet the screen says a person will make contact rather than showing
 * a number nobody answers.
 */
/** Matches the primary button, at 52px so it is a comfortable thumb target. */
const EXTERNAL_LINK_CLASS =
  "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-base font-bold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]";

export function TicketCreated({
  ticket,
  onAskAgain,
}: {
  ticket: SupportTicketView;
  onAskAgain: () => void;
}) {
  const { t } = usePreferences();

  const language = LOCALES[ticket.locale].endonym;
  const sentBody = t("support.sent_body", { reference: ticket.reference, language });
  const whatsapp = whatsappLink(`PayBridge ${ticket.reference}: ${ticket.subject}`);
  const phone = telLink();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-success/40 bg-success/[0.07] p-5 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs font-bold text-success">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          {t("support.sent_title")}
        </span>
        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("support.your_reference")}
        </p>
        {/* Selectable, spaced and monospaced-by-numerals so it can be copied,
            read out, or written on paper. */}
        <p className="mt-1 select-all font-display text-3xl font-extrabold tracking-[0.08em] text-foreground tnum">
          {ticket.reference}
        </p>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">{sentBody}</p>
        <div className="mt-3 flex justify-center">
          <ListenButton text={`${t("support.sent_title")}. ${sentBody}`} />
        </div>
      </div>

      {/* Real anchors, not buttons: these leave the app for WhatsApp or the
          dialler, so they must be openable, long-pressable and copyable the way
          every other link on the phone is. */}
      {ticket.channel === "whatsapp" && whatsapp ? (
        <a href={whatsapp} className={EXTERNAL_LINK_CLASS}>
          <MessageCircle className="h-4 w-4" aria-hidden />
          {t("support.next_whatsapp")}
        </a>
      ) : null}

      {ticket.channel === "phone" && phone ? (
        <a href={phone} className={EXTERNAL_LINK_CLASS}>
          <Phone className="h-4 w-4" aria-hidden />
          {t("support.next_call")}
        </a>
      ) : null}

      {(ticket.channel === "whatsapp" && !whatsapp) ||
      (ticket.channel === "phone" && !phone) ||
      ticket.channel === "callback" ? (
        <InfoNote tone="primary">{t("support.next_pending")}</InfoNote>
      ) : null}

      {ticket.textOnly ? <InfoNote>{t("support.text_only")}</InfoNote> : null}
      {ticket.assistedOnboarding ? <InfoNote tone="success">{t("prefs.assisted_requested")}</InfoNote> : null}

      <ActionButton variant="secondary" fullWidth onClick={onAskAgain}>
        {t("support.another")}
      </ActionButton>
    </div>
  );
}
