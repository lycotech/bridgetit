import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  CalendarX,
  Ban,
  CheckCheck,
  KeyRound,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_SESSION_KEY, redeemInvitationCode, useDemoSession } from "@/lib/demo-access";
import { useNoIndex } from "@/lib/use-noindex";
import { ApiError } from "@/lib/api";

/**
 * The private demonstration gate.
 *
 * One way in: the email address an invitation was issued to, plus that
 * invitation's code. Two facts, both entered by hand, neither ever present in a
 * URL — a code in a link is burned by mail scanners and link previews before the
 * invited person clicks it, and it survives afterwards in history, referrers and
 * logs where it still works.
 *
 * On the error messages: the server is the one that decides how specific to be.
 * Quote a real code with its matching address and it will tell you plainly that
 * the invitation expired, was withdrawn or has been used, because at that point
 * you have proved you are the invitee and you need to know which favour to ask
 * for. Get the pair wrong and every outcome collapses into one message, so this
 * form cannot be used to discover which codes exist. This page just renders
 * whichever answer comes back, with an icon that matches it.
 */

/** Icon and heading per refusal code from POST /api/demo/redeem. */
const REFUSALS: Record<string, { title: string; icon: typeof Ban }> = {
  CODE_EXPIRED: { title: "This invitation has expired", icon: CalendarX },
  CODE_REVOKED: { title: "This invitation has been withdrawn", icon: Ban },
  CODE_USED: { title: "This invitation has already been used", icon: CheckCheck },
  INVALID_CODE: { title: "We could not match those details", icon: AlertCircle },
  VALIDATION_ERROR: { title: "Check what you entered", icon: AlertCircle },
  RATE_LIMITED: { title: "Too many attempts", icon: Lock },
};

/**
 * Where an invitation drops you. The portal comes from the demonstration type
 * chosen when the invitation was created; each portal's own guard then asks for
 * the demonstration sign-in, which is sample data, not a real account.
 */
function landingFor(portal: string | null): string {
  switch (portal) {
    case "employee":
      return "/employee";
    case "employer":
      return "/employer";
    case "investor":
      return "/investor";
    default:
      return "/operations";
  }
}

const PrivateDemo = () => {
  useNoIndex();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = useDemoSession();

  const nextParam = params.get("next");
  // Only ever an in-app path. An absolute URL here would make this an open
  // redirect that launders a PayBridge link into somewhere else.
  const next = nextParam && /^\/(?!\/)/.test(nextParam) ? nextParam : null;

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  const enter = useMutation({
    mutationFn: () => redeemInvitationCode({ email: email.trim(), code: code.trim() }),
    onSuccess: async (grant) => {
      await queryClient.invalidateQueries({ queryKey: DEMO_SESSION_KEY });
      // A deep link that bounced them here wins; otherwise the invitation's own
      // demonstration type decides where they land, so an invitee shown the
      // employee experience does not arrive in the operations console.
      navigate(next ?? landingFor(grant.portal), { replace: true });
    },
  });

  // Already inside — do not make an authorised viewer re-enter anything.
  useEffect(() => {
    if (session?.access === "granted") navigate(next ?? landingFor(session.portal), { replace: true });
  }, [session?.access, session?.portal, next, navigate]);

  const failure = enter.error;
  const failureCode =
    failure instanceof ApiError && failure.data && typeof failure.data === "object"
      ? ((failure.data as { code?: string }).code ?? "")
      : "";
  const refusal = REFUSALS[failureCode] ?? REFUSALS.INVALID_CODE;
  const RefusalIcon = refusal.icon;
  const failureMessage =
    failure instanceof ApiError
      ? failure.message
      : failure
        ? "We could not verify that. Please try again in a moment."
        : null;

  const ready = /.+@.+\..+/.test(email.trim()) && code.trim().length >= 6;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-20 max-w-5xl items-center justify-between px-5 md:px-8">
          <Link to="/" aria-label="PayBridge home">
            <Logo className="h-9" />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to paybridge
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-border bg-card/70 p-7 shadow-2xl sm:p-9">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <Lock className="h-5 w-5" />
            </span>

            <h1 className="mt-6 font-display text-2xl font-extrabold leading-tight text-foreground">
              Private demonstration
            </h1>
            {/* Wording fixed by the specification — do not paraphrase. */}
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              PayBridge demonstrations are available by invitation only. Enter the email address and access code
              included in your invitation.
            </p>

            <form
              className="mt-8 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (ready && !enter.isPending) enter.mutate();
              }}
              noValidate
            >
              <div>
                <Label htmlFor="demo-email" className="text-sm text-foreground">
                  Email address
                </Label>
                <div className="relative mt-2">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="demo-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    inputMode="email"
                    spellCheck={false}
                    placeholder="The address your invitation was sent to"
                    className="h-12 rounded-xl border-border bg-secondary/40 pl-9 text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-primary"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="demo-code" className="text-sm text-foreground">
                  Invitation code
                </Label>
                <div className="relative mt-2">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="demo-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    autoComplete="one-time-code"
                    spellCheck={false}
                    placeholder="PB-XXXX-XXXX"
                    // Upper case and letter-spaced so a code read off a phone
                    // screen is easy to check character by character. The server
                    // normalises case and spacing anyway.
                    className="h-12 rounded-xl border-border bg-secondary/40 pl-9 font-mono uppercase tracking-[0.14em] text-foreground placeholder:font-mono placeholder:tracking-[0.14em] placeholder:text-muted-foreground/60 focus-visible:ring-primary"
                  />
                </div>
              </div>

              {failureMessage ? (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3.5"
                >
                  <RefusalIcon className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <span className="text-sm leading-relaxed">
                    <strong className="block font-semibold text-destructive">{refusal.title}</strong>
                    <span className="mt-0.5 block text-muted-foreground">{failureMessage}</span>
                  </span>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={!ready || enter.isPending}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-full btn-brand px-6 py-3.5 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {enter.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking your invitation…
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-7 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
              No invitation? Registering interest does not include demonstration access. If you are working with a
              member of the PayBridge team, ask them to issue you one — or{" "}
              <Link to="/contact" className="font-medium text-primary hover:underline">
                contact us
              </Link>
              .
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            All data shown inside the demonstration is fictional sample data. Every visit is recorded.
          </p>
        </div>
      </main>
    </div>
  );
};

export default PrivateDemo;
