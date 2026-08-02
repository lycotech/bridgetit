import { useState } from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Panel } from "@/components/dashboard/Panel";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { OtpField, PasswordField } from "@/components/dashboard/forms";
import type {
  ConfirmTwoFactorInput,
  DisableTwoFactorInput,
  EnrolTwoFactorInput,
  TwoFactorEnrolmentView,
} from "../../../../backend/src/types";

/**
 * Real two-factor authentication — shared between the customer account page
 * and the employer portal, since both routers (routes/auth.ts and routes/
 * employer.ts) implement the identical TOTP design PayBridge staff already
 * use (security/totp.ts). Parameterised by mutation, not by which backend
 * router it talks to, so this component has no opinion about which session
 * it is protecting.
 */
export function TwoFactorPanel({
  enabled,
  enrol,
  enable,
  disable,
}: {
  enabled: boolean;
  enrol: UseMutationResult<TwoFactorEnrolmentView, Error, EnrolTwoFactorInput>;
  enable: UseMutationResult<{ recoveryCodes: string[] }, Error, ConfirmTwoFactorInput>;
  disable: UseMutationResult<{ disabled: boolean }, Error, DisableTwoFactorInput>;
}) {
  const [setup, setSetup] = useState(false);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [disabling, setDisabling] = useState(false);
  const [password, setPassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const startSetup = () => {
    setError(null);
    setSetup(true);
    enrol.mutate({}, { onError: (err) => setError(err instanceof Error ? err.message : "Could not start setup.") });
  };

  const confirmSetup = async (event: React.FormEvent) => {
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

  const submitDisable = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await disable.mutateAsync({ password, code: disableCode });
      setDisabling(false);
      setPassword("");
      setDisableCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That could not be confirmed.");
    }
  };

  if (recoveryCodes.length > 0) {
    return (
      <Panel tone="success" icon={<ShieldCheck className="h-5 w-5 text-primary" />} title="Two-factor authentication enabled">
        <p className="text-sm text-muted-foreground">
          Save these recovery codes now — each works once if you lose your device. We cannot show them again.
        </p>
        <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm">
          {recoveryCodes.map((entry) => (
            <li key={entry} className="rounded-lg border border-border bg-background/70 px-3 py-2 tracking-wider">
              {entry}
            </li>
          ))}
        </ul>
        <ActionButton size="sm" className="mt-4" onClick={() => setRecoveryCodes([])}>
          Done
        </ActionButton>
      </Panel>
    );
  }

  if (!enabled && setup) {
    return (
      <Panel tone="info" icon={<KeyRound className="h-5 w-5 text-primary" />} title="Set up two-factor authentication">
        {enrol.isPending || !enrol.data ? (
          <p className="text-sm text-muted-foreground">{error ?? "Preparing your authenticator setup…"}</p>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="shrink-0 rounded-2xl border border-border bg-white p-3">
                <QRCodeSVG value={enrol.data.uri} size={128} level="M" />
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Scan with Google Authenticator, 1Password, Authy or any TOTP app. Or enter this key manually:{" "}
                <span className="select-all break-all font-mono text-foreground">{enrol.data.secret}</span>
              </p>
            </div>
            <form onSubmit={confirmSetup} className="space-y-3">
              <OtpField label="Enter the 6-digit code from your app" value={code} onChange={setCode} />
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <ActionButton type="submit" size="sm" loading={enable.isPending} disabled={code.length < 6}>
                Confirm
              </ActionButton>
            </form>
          </div>
        )}
      </Panel>
    );
  }

  return (
    <Panel tone="info" icon={<KeyRound className="h-5 w-5 text-primary" />} title="Two-factor authentication">
      {enabled ? (
        <div className="space-y-3">
          <p className="text-sm text-success">Enabled — your account requires a code at sign-in.</p>
          {!disabling ? (
            <ActionButton size="sm" variant="ghost" onClick={() => setDisabling(true)}>
              Turn off
            </ActionButton>
          ) : (
            <form onSubmit={submitDisable} className="space-y-3 border-t border-border/70 pt-3">
              <PasswordField label="Current password" value={password} onChange={setPassword} autoComplete="current-password" />
              <OtpField label="Current 6-digit code" value={disableCode} onChange={setDisableCode} />
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <div className="flex gap-2">
                <ActionButton type="submit" size="sm" variant="danger" loading={disable.isPending}>
                  Confirm turn off
                </ActionButton>
                <ActionButton size="sm" variant="ghost" onClick={() => setDisabling(false)}>
                  Cancel
                </ActionButton>
              </div>
            </form>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Add an authenticator app for an extra layer of protection at sign-in.
          </p>
          <ActionButton size="sm" onClick={startSetup}>
            Set up two-factor authentication
          </ActionButton>
        </div>
      )}
    </Panel>
  );
}
