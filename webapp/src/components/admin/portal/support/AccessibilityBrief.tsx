import { Eye, HandHelping, Languages, MessageSquareOff, PhoneOff, Type, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LOCALE_ENGLISH_NAMES,
  SUPPORT_CHANNEL_LABELS,
  type SupportTicketAdminView,
} from "../../../../../../backend/src/types";

/**
 * How to talk to this person.
 *
 * WHAT THIS IS: functional preferences. "Send writing, not a phone call."
 * "Answer in Pidgin." "They asked for someone to walk them through the app."
 *
 * WHAT THIS IS NOT, and cannot be: a reason. PayBridge never asks why somebody
 * prefers writing to a call, stores no diagnosis and has no field for one, so
 * there is nothing here for a support agent to read as a medical note. The
 * employer cannot see this panel either — there is no employer endpoint that
 * returns it.
 *
 * Shown as instructions rather than attributes on purpose: an agent skimming this
 * needs to know what to DO, and "Do not phone" acts on that faster than
 * "textOnly: true".
 */
export function AccessibilityBrief({ ticket }: { ticket: SupportTicketAdminView }) {
  const a = ticket.accessibility;

  return (
    <section
      aria-labelledby="access-brief-heading"
      className="rounded-2xl border border-primary/25 bg-primary/[0.04] px-4 py-3.5"
    >
      <h4
        id="access-brief-heading"
        className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground"
      >
        How to help this person
      </h4>

      <ul className="mt-2.5 space-y-2">
        <Instruction icon={<Languages className="h-3.5 w-3.5" />} strong>
          Reply in {LOCALE_ENGLISH_NAMES[a.locale]}
        </Instruction>

        <Instruction icon={<MessageSquareOff className="h-3.5 w-3.5" />}>
          Preferred way to be reached: {SUPPORT_CHANNEL_LABELS[a.supportChannel]}
        </Instruction>

        {a.textOnly ? (
          <Instruction icon={<PhoneOff className="h-3.5 w-3.5" />} strong tone="attention">
            Written messages only — do not telephone this person
          </Instruction>
        ) : null}

        {a.assistedOnboarding ? (
          <Instruction icon={<HandHelping className="h-3.5 w-3.5" />} strong tone="attention">
            Asked for someone to help them set the app up
          </Instruction>
        ) : null}

        {a.readAloud ? (
          <Instruction icon={<Volume2 className="h-3.5 w-3.5" />}>
            Uses the read-aloud button — keep written replies short and in plain sentences
          </Instruction>
        ) : null}

        {a.largeText || a.highContrast ? (
          <Instruction icon={<Type className="h-3.5 w-3.5" />}>
            Uses {[a.largeText ? "bigger writing" : null, a.highContrast ? "high contrast" : null]
              .filter(Boolean)
              .join(" and ")}
          </Instruction>
        ) : null}

        {a.simpleView ? (
          <Instruction icon={<Eye className="h-3.5 w-3.5" />}>
            Uses Simple View — they see four choices, not the full dashboard. Describe screens accordingly.
          </Instruction>
        ) : null}
      </ul>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        These are settings this person chose for themselves. PayBridge does not ask anyone why, holds no health or
        disability information, and never shows any of this to their employer.
      </p>
    </section>
  );
}

function Instruction({
  children,
  icon,
  strong = false,
  tone = "neutral",
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  strong?: boolean;
  tone?: "neutral" | "attention";
}) {
  return (
    <li className="flex items-start gap-2 text-sm leading-snug">
      <span
        aria-hidden
        className={cn(
          "mt-0.5 shrink-0",
          tone === "attention" ? "text-gold" : "text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <span className={cn(strong ? "font-semibold text-foreground" : "text-foreground/85")}>{children}</span>
    </li>
  );
}
