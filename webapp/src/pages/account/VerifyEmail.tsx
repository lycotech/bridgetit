import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, KeyRound, MailCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { OtpField, PasswordField, TextField } from "@/components/dashboard/forms";
import {
  GATE_ROUTE,
  useChangeEmail,
  useConfirmVerification,
  useSendVerification,
  useSession,
} from "@/lib/account/session";
import type { VerificationDispatch } from "../../../../backend/src/types";

/**
 * Contact verification. The only screen a `verify_contact` session can reach —
 * enforced by the server, which refuses every other endpoint at this gate.
 */
export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session } = useSession();
  const send = useSendVerification();
  const confirm = useConfirmVerification();
  const changeEmail = useChangeEmail();

  /** The dispatch note handed over by registration, or by the last resend. */
  const [dispatch, setDispatch] = useState<VerificationDispatch | null>(
    (location.state as { verification?: VerificationDispatch } | null)?.verification ?? null,
  );
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  /** Guards against the auto-submit firing twice for the same six digits. */
  const attempted = useRef<string>("");

  const submit = useCallback(
    async (value: string) => {
      if (value.length !== 6 || confirm.isPending) return;
      attempted.current = value;
      setError(null);
      try {
        const state = await confirm.mutateAsync({ channel: "email", code: value });
        navigate(GATE_ROUTE[state.gate], { replace: true });
      } catch (err) {
        setCode("");
        setError(err instanceof Error ? err.message : "That code was not accepted.");
      }
    },
    [confirm, navigate],
  );

  // A six-digit code does not need a button press — pasting it from the email
  // should just work.
  useEffect(() => {
    if (code.length === 6 && attempted.current !== code) void submit(code);
  }, [code, submit]);

  const resend = async () => {
    setError(null);
    setNotice(null);
    try {
      const result = await send.mutateAsync("email");
      setDispatch(result);
      setNotice(
        result.delivered
          ? `A new code is on its way to ${result.destination}.`
          : `A new code was generated for ${result.destination}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not send another code just yet.");
    }
  };

  const correctAddress = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const result = await changeEmail.mutateAsync({ email: newEmail, password });
      setDispatch(result.verification);
      setEditing(false);
      setPassword("");
      setCode("");
      attempted.current = "";
      setNotice(`Your address is now ${result.user?.email ?? newEmail}. A fresh code has been issued.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not change that address.");
    }
  };

  return (
    <AuthLayout
      title="Confirm your email address"
      subtitle={
        session?.user
          ? `We sent a 6-digit code to ${session.user.email}. Enter it below to continue.`
          : "Enter the 6-digit code we sent you."
      }
      footer={
        <div className="space-y-3 text-center text-sm">
          <button
            type="button"
            onClick={resend}
            disabled={send.isPending}
            className="font-semibold text-primary transition-colors hover:underline disabled:opacity-60"
          >
            {send.isPending ? "Sending…" : "Send a new code"}
          </button>
          <p className="text-muted-foreground">
            Typed the wrong address?{" "}
            <button
              type="button"
              onClick={() => {
                setEditing((open) => !open);
                setNewEmail(session?.user?.email ?? "");
              }}
              className="font-semibold text-primary transition-colors hover:underline"
            >
              {editing ? "Keep this address" : "Change it"}
            </button>
          </p>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(code);
        }}
      >
        <OtpField
          value={code}
          onChange={(value) => {
            setError(null);
            setCode(value);
          }}
          label="Verification code"
          hint="The code expires 15 minutes after it is sent."
        />

        {/*
          Shown only when the server says the message could not be delivered AND
          hands back the code, which it does exclusively in a non-production
          environment with no mail provider configured. With SMTP or Resend set
          up, `devCode` is absent and this block never renders.
        */}
        {dispatch?.devCode ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <KeyRound className="h-4 w-4 shrink-0 text-amber-600" />
              Email delivery is not switched on yet
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              So you can continue, here is your code. Add a mail provider key and codes will be emailed instead of
              shown here.
            </p>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setCode(dispatch.devCode ?? "");
              }}
              className="mt-2.5 font-mono text-2xl font-bold tracking-[0.3em] text-foreground transition-opacity hover:opacity-70"
              title="Tap to fill in the code"
            >
              {dispatch.devCode}
            </button>
          </div>
        ) : null}

        {error ? (
          <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : null}

        {notice ? (
          <p className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-3 text-sm font-medium text-foreground">
            <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            {notice}
          </p>
        ) : null}

        <ActionButton type="submit" fullWidth size="lg" loading={confirm.isPending} disabled={code.length !== 6}>
          Continue
        </ActionButton>
      </form>

      {/*
        The correction form. Nested outside the code form so pressing Enter in
        either one submits the right thing. The password is required by the
        server — a half-verified session alone must not be able to move an
        account to a different inbox.
      */}
      {editing ? (
        <form onSubmit={correctAddress} className="mt-6 space-y-4 border-t border-border/70 pt-6" noValidate>
          <TextField
            label="Correct email address"
            type="email"
            value={newEmail}
            onChange={setNewEmail}
            placeholder="you@company.com"
            autoComplete="email"
            inputMode="email"
          />
          <PasswordField
            label="Confirm your password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            hint="For your security, we ask for your password before changing where codes are sent."
          />
          <ActionButton type="submit" fullWidth loading={changeEmail.isPending}>
            Update address and resend code
          </ActionButton>
        </form>
      ) : null}
    </AuthLayout>
  );
}
