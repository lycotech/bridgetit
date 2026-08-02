import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { useLinkEmployer, useSession } from "@/lib/account/session";

/** Where a customer lands after clicking the "you've been added to payroll" email link. */
export default function LinkEmployer() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const { data: session } = useSession();
  const link = useLinkEmployer();

  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const accept = async () => {
    setError(null);
    try {
      await link.mutateAsync({ token });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That invitation link could not be accepted.");
    }
  };

  if (!token) {
    return (
      <AuthLayout title="Link incomplete" subtitle="This invitation link is missing its token.">
        <p className="text-sm text-muted-foreground">Ask your employer to send the invitation again.</p>
      </AuthLayout>
    );
  }

  if (session?.gate === "anonymous") {
    return (
      <AuthLayout title="Sign in to continue" subtitle="Sign in with the same email address your employer invited.">
        <ActionButton to={`/sign-in`} fullWidth size="lg">
          Sign in
        </ActionButton>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          No account yet?{" "}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            Create one
          </Link>{" "}
          with the same email address, then open this link again.
        </p>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title="You're connected" subtitle="Your account is now linked to your employer's payroll.">
        <div className="flex items-start gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-3 text-sm font-medium text-foreground">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          Your eligibility will now reflect your real payroll status.
        </div>
        <ActionButton to="/account" fullWidth size="lg" className="mt-4">
          Go to your account
        </ActionButton>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Connect your payroll" subtitle="Link your PayBridge account to your employer's payroll record.">
      {error ? (
        <p className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}
      <ActionButton fullWidth size="lg" loading={link.isPending} onClick={() => void accept()}>
        Connect my account
      </ActionButton>
    </AuthLayout>
  );
}
