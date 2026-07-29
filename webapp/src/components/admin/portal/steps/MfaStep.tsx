import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { AlertCircle, Copy, Loader2, ShieldCheck } from "lucide-react";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { OtpField, PasswordField } from "@/components/dashboard/forms";
import { Button } from "@/components/ui/button";
import { useAdminMfaEnable, useAdminMfaEnrol } from "@/lib/admin/portal-session";

/**
 * Step two: enrol an authenticator, then prove a live code.
 *
 * The QR code is rendered in the browser from the otpauth URI. WHY that matters
 * enough to be a design constraint: the usual shortcut is an image URL like
 * `api.qrserver.com/...?data=<uri>`, which sends the TOTP secret — the whole
 * second factor for a Super Admin account — to a third party in a query string
 * that lands in their access logs. This never leaves the page.
 *
 * The recovery codes are shown once, after enrolment succeeds. The server keeps
 * only sha256 digests, so "show them again later" is not a feature that can
 * exist, which is stated plainly rather than discovered.
 */
export function MfaStep({ requirePassword = false }: { requirePassword?: boolean }) {
  const enrol = useAdminMfaEnrol();
  const enable = useAdminMfaEnable();

  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);

  const begin = (currentPassword?: string) =>
    enrol.mutate(
      { currentPassword },
      { onError: (err) => setError(err instanceof Error ? err.message : "We could not start enrolment.") },
    );

  /*
   * Enrol once on mount — unless a password is needed first. A fresh secret per
   * visit is deliberate: an abandoned enrolment leaves a secret nobody scanned,
   * and reusing it would mean a QR code screenshotted from a shoulder-surfed
   * session stays valid.
   *
   * `requirePassword` is set when REPLACING a working authenticator, because
   * that is a complete MFA reset and the server demands the first factor for it.
   * During first-run there is no second factor to protect, so there is nothing
   * for a password prompt to defend.
   */
  useEffect(() => {
    if (!requirePassword) begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const result = await enable.mutateAsync({ code });
      setRecoveryCodes(result.recoveryCodes);
    } catch (err) {
      setCode("");
      setError(err instanceof Error ? err.message : "That code was not accepted.");
    }
  };

  /* --------------------------------------------------- Recovery codes view */

  if (recoveryCodes.length > 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Authenticator confirmed. Save these recovery codes now.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Each code signs you in once if you lose your phone. They are stored only as one-way hashes, so this is the
            only time they can be shown — we cannot retrieve them for you later.
          </p>

          <ul className="mt-4 grid grid-cols-2 gap-2 font-mono text-sm">
            {recoveryCodes.map((entry) => (
              <li key={entry} className="rounded-lg border border-border bg-background/70 px-3 py-2 tracking-wider">
                {entry}
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(recoveryCodes.join("\n"));
                setCopied(true);
              }}
            >
              <Copy className="mr-2 h-3.5 w-3.5" />
              {copied ? "Copied" : "Copy all"}
            </Button>
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
          />
          I have saved these codes somewhere only I can reach.
        </label>

        {/*
          Advancing is client-side because the server already recorded MFA as
          enabled the moment the live code was proven — this checkbox gates the
          screen, not the security state. The next step loads from the session's
          `outstanding` list either way.
        */}
        <ActionButton size="lg" disabled={!acknowledged} onClick={() => setRecoveryCodes([])}>
          Continue
        </ActionButton>
      </div>
    );
  }

  /* ------------------------------------------------- Password gate (replace) */

  if (requirePassword && !enrol.data) {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          begin(password);
        }}
        className="space-y-4"
        noValidate
      >
        <PasswordField
          label="Your current password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          hint="Replacing an authenticator removes your existing second factor, so we confirm it is you first."
        />

        {error ? (
          <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : null}

        <ActionButton type="submit" loading={enrol.isPending} disabled={password.length === 0}>
          Continue
        </ActionButton>
      </form>
    );
  }

  /* --------------------------------------------------------- Enrolment view */

  if (enrol.isPending || !enrol.data) {
    return (
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        {error ? (
          <span className="flex items-start gap-2 text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </span>
        ) : (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Preparing your authenticator setup…
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="shrink-0 rounded-2xl border border-border bg-white p-4">
          <QRCodeSVG value={enrol.data.uri} size={148} level="M" />
        </div>

        <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">Scan this with your authenticator app</p>
          <p>
            Google Authenticator, 1Password, Authy, Microsoft Authenticator — any app that supports time-based codes
            will work.
          </p>
          <button
            type="button"
            onClick={() => setShowSecret((prev) => !prev)}
            className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
          >
            {showSecret ? "Hide the setup key" : "Cannot scan? Enter the key manually"}
          </button>
          {showSecret ? (
            <p className="select-all break-all rounded-xl border border-border bg-muted/40 px-3 py-2.5 font-mono text-xs tracking-wider text-foreground">
              {enrol.data.secret}
            </p>
          ) : null}
        </div>
      </div>

      <form onSubmit={submit} className="space-y-5" noValidate>
        <OtpField
          label="Enter the 6-digit code from your app"
          value={code}
          onChange={setCode}
          hint="Codes change every 30 seconds. If one is rejected, wait for the next."
        />

        {error ? (
          <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : null}

        <ActionButton type="submit" size="lg" loading={enable.isPending} disabled={code.trim().length < 6}>
          Confirm authenticator
        </ActionButton>
      </form>
    </div>
  );
}
