import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, PartyPopper } from "lucide-react";

/**
 * Post-submission screen.
 *
 * The `caveat` line is not decoration and must not be softened: it is the
 * sentence that stops "I registered" from being read as "I was approved".
 */
export function SuccessPanel({
  heading,
  body,
  caveat,
  inbox,
}: {
  heading: string;
  body: ReactNode;
  caveat: string;
  inbox: string;
}) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success ring-1 ring-success/30">
        <PartyPopper className="h-7 w-7" />
      </span>

      <h2 className="mt-6 font-display text-3xl font-extrabold leading-tight text-foreground">
        {heading}
      </h2>

      <div className="mt-4 max-w-lg space-y-4 text-base leading-relaxed text-muted-foreground">
        {body}
      </div>

      <p className="mt-6 max-w-lg rounded-2xl border border-gold/30 bg-gold/5 p-4 text-sm leading-relaxed text-foreground/80">
        {caveat}
      </p>

      <p className="mt-6 text-sm text-muted-foreground">
        A confirmation is on its way from{" "}
        <span className="font-medium text-foreground">{inbox}</span>. If it does not arrive, check
        your spam folder before writing to us.
      </p>

      <Link
        to="/"
        className="group mt-8 inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/60 hover:text-primary"
      >
        Back to PayBridge
        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
      </Link>
    </div>
  );
}

/** Uniform error block shown when a submission cannot be completed. */
export function SubmitError({ fields }: { fields?: string[] }) {
  return (
    <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4">
      <p className="font-display text-sm font-bold text-destructive">
        We could not complete this yet.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {fields?.length
          ? "Please check the highlighted details and try again."
          : "Please check your details and try again. If it keeps happening, email hello@getpaybridge.com."}
      </p>
    </div>
  );
}
