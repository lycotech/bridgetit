import { Link } from "react-router-dom";
import { ArrowRight, LifeBuoy, PiggyBank, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { naira, longDate } from "@/lib/platform/format";
import { usePreferences } from "@/lib/prefs/PreferencesProvider";
import { ListenButton } from "@/components/prefs/ListenButton";

/**
 * Simple View — the whole app as four things.
 *
 *   Money available · Bridge money · Save money · Get help
 *
 * WHO THIS IS FOR: somebody whose first ever smartphone is the one in their hand.
 * The standard dashboard is a good dashboard — charts, accrual breakdown, a
 * wellbeing score, seven navigation items — and every one of those is a decision
 * to make before you can do the one thing you opened the app for. For a first
 * time user, choice is not a feature; it is the obstacle.
 *
 * So: four destinations, each a rectangle you cannot miss, each labelled with a
 * verb, each with one line underneath saying what it does. No chart, no
 * percentage, no jargon, no abbreviation.
 *
 * THE NORMAL DASHBOARD IS NEVER TAKEN AWAY. "Show me everything" at the bottom
 * reveals it for this visit WITHOUT changing the saved setting — so somebody can
 * look at the full thing out of curiosity and still find the simple screen
 * waiting next time. Nobody is locked into the simple version, and nobody is
 * punished for peeking.
 */

function BigTile({
  to,
  icon: Icon,
  title,
  caption,
}: {
  to: string;
  icon: LucideIcon;
  title: string;
  caption: string;
}) {
  return (
    <Link
      to={to}
      className="group flex min-h-[112px] items-center gap-4 rounded-3xl border-2 border-border bg-card p-5 transition-colors hover:border-primary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]"
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
        <Icon className="h-7 w-7" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-xl font-extrabold tracking-tight text-foreground">{title}</span>
        <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{caption}</span>
      </span>
      <ArrowRight
        className="h-6 w-6 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}

export function SimpleHome({
  firstName,
  available,
  paydayIso,
  onShowEverything,
}: {
  firstName: string;
  available: number;
  paydayIso: string;
  onShowEverything: () => void;
}) {
  const { t } = usePreferences();

  const spoken = [
    t("simple.greeting", { name: firstName }),
    `${t("simple.money_available")}: ${naira(available)}.`,
    t("employee.available_amount_help"),
    `${t("employee.next_payday")}: ${longDate(paydayIso)}.`,
  ].join(" ");

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">
          {t("simple.greeting", { name: firstName })}
        </h1>
        <p className="mt-1 text-base text-muted-foreground">{t("simple.one_thing")}</p>
      </div>

      {/* Money available is a fact, not a destination, so it is a panel rather
          than a button — pressing it would go nowhere and teach that some
          rectangles lie. */}
      <section
        aria-labelledby="simple-available"
        className="rounded-3xl border-2 border-available/40 bg-available/[0.07] p-5 text-center"
      >
        <h2
          id="simple-available"
          className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground"
        >
          {t("simple.money_available")}
        </h2>
        <p className="mt-2 font-display text-[2.6rem] font-extrabold leading-none tracking-tight text-foreground tnum">
          {naira(available)}
        </p>
        <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
          {t("employee.available_amount_help")}
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t("employee.next_payday")}: {longDate(paydayIso)}
        </p>
        <div className="mt-3 flex justify-center">
          <ListenButton text={spoken} />
        </div>
      </section>

      <nav aria-label={t("simple.one_thing")} className="space-y-3">
        <BigTile
          to="/employee/bridge"
          icon={Wallet}
          title={t("simple.bridge_money")}
          caption={t("simple.bridge_money_caption")}
        />
        <BigTile
          to="/employee/savings"
          icon={PiggyBank}
          title={t("simple.save_money")}
          caption={t("simple.save_money_caption")}
        />
        <BigTile
          to="/employee/support"
          icon={LifeBuoy}
          title={t("simple.get_help")}
          caption={t("simple.get_help_caption")}
        />
      </nav>

      <button
        type="button"
        onClick={onShowEverything}
        className="min-h-[44px] w-full rounded-2xl border border-border bg-secondary/30 px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]"
      >
        {t("simple.full_view")}
      </button>
    </div>
  );
}
