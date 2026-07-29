import { HandHelping, Languages, PhoneOff } from "lucide-react";
import { Panel, InfoNote } from "@/components/dashboard/Panel";
import { EmptyState } from "@/components/dashboard/states";
import { relativeTime } from "@/lib/platform/format";
import type { StandingRequest } from "@/lib/admin/support";
import {
  LOCALE_ENGLISH_NAMES,
  SUPPORT_CHANNEL_LABELS,
} from "../../../../../../backend/src/types";

/**
 * People who asked for a human to help them set the app up — by switching it on
 * in their own settings, without filing a support request.
 *
 * WHY THIS PANEL EXISTS AT ALL: they asked for help by moving a toggle. Nobody
 * would have been watching the toggle. Without this list the request lands in a
 * database column and stays there, which is the same as PayBridge asking a
 * question it had no intention of answering.
 *
 * Oldest first, deliberately. A newest-first queue quietly abandons whoever has
 * been waiting longest, and this is precisely the group least likely to chase.
 */
export function AssistedRequests({
  requests,
  denied,
}: {
  requests: StandingRequest[];
  denied: boolean;
}) {
  if (denied) {
    return (
      <Panel title="Asked for help setting up" description="Requires the accessibility-details permission.">
        <InfoNote tone="neutral">
          Your role can read support requests but not the settings behind them, so this queue is not shown. An
          operations administrator or Super Admin can work it.
        </InfoNote>
      </Panel>
    );
  }

  return (
    <Panel
      title="Asked for help setting up"
      description="These people turned on “I would like someone to help me” in their own settings. They have not filed a request — somebody has to reach out first."
      bodyClassName="space-y-3"
      action={
        requests.length > 0 ? (
          <span className="text-xs font-semibold text-muted-foreground tnum">
            {requests.length} waiting
          </span>
        ) : null
      }
    >
      {requests.length === 0 ? (
        <EmptyState
          icon={<HandHelping className="h-5 w-5" />}
          title="Nobody is waiting"
          body="When someone asks for help setting the app up, they appear here with the language to use and how they want to be contacted."
        />
      ) : (
        <ul className="space-y-2">
          {requests.map((request) => (
            <li key={request.userId} className="rounded-2xl border border-border bg-card/60 px-4 py-3">
              <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-sm font-semibold text-foreground">{request.name}</span>
                <span className="text-xs text-muted-foreground">
                  asked {request.requestedAt ? relativeTime(request.requestedAt) : "at an unknown time"}
                </span>
              </p>
              <p className="mt-1 break-words text-xs text-muted-foreground">
                {request.email}
                {request.phone ? ` · ${request.phone}` : ""}
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                  <Languages className="h-3 w-3" aria-hidden />
                  Speak {LOCALE_ENGLISH_NAMES[request.locale]}
                </span>
                <span className="text-muted-foreground">
                  Prefers {SUPPORT_CHANNEL_LABELS[request.channel]}
                </span>
                {request.textOnly ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-gold">
                    <PhoneOff className="h-3 w-3" aria-hidden />
                    Written only — do not phone
                  </span>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
