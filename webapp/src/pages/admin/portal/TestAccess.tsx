import { useState } from "react";
import { Check, Copy, KeyRound, ShieldAlert } from "lucide-react";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, InfoNote } from "@/components/dashboard/Panel";
import { Button } from "@/components/ui/button";
import { LoadingRows } from "@/components/dashboard/states";
import { useProvisionTestAccess, useResetTestAccessPassword, useTestAccessStatus } from "@/lib/admin/test-access";

type Which = "employer" | "employee" | "investor";

const SLOT_INFO: Record<Which, { title: string; loginRoute: string; loginLabel: string; note: string }> = {
  employer: {
    title: "Employer",
    loginRoute: "/employer-portal/login",
    loginLabel: "/employer-portal/login",
    note: "A real Employer Portal admin seat for a dedicated internal QA company — already active, with a real payroll cycle and an active earned-wage-access facility, so payroll and Bridge activity are visible.",
  },
  employee: {
    title: "Employee",
    loginRoute: "/sign-in",
    loginLabel: "/sign-in",
    note: "A real customer account (accountType: employee), KYC-approved, linked to the QA company's payroll roster — eligible to actually request a Bridge draw.",
  },
  investor: {
    title: "Investor",
    loginRoute: "/sign-in",
    loginLabel: "/sign-in",
    note: "A real customer account (accountType: investor), KYC-approved — can actually commit capital on /account.",
  },
};

/** One-time password reveal — same pattern as PasswordReveal.tsx for staff invites: shown once, never stored, never re-shown. */
function PasswordBox({ email, password }: { email: string; password: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(password);
    setCopied(true);
  };
  return (
    <div className="mt-3 rounded-2xl border border-primary/30 bg-primary/[0.06] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">New password — shown once</p>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Sign in with <span className="font-semibold text-foreground">{email}</span>
      </p>
      <p className="mt-1 select-all break-all font-mono text-lg font-bold tracking-[0.06em] text-foreground">{password}</p>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={copy}>
        {copied ? <Check className="mr-2 h-3.5 w-3.5" /> : <Copy className="mr-2 h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy password"}
      </Button>
      <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
        Save this now — PayBridge only ever stores a one-way hash, so it cannot be shown again. Lost it? Reset it below.
      </p>
    </div>
  );
}

/**
 * Admin → Test accounts.
 *
 * Three standing, real, fully-eligible fixture accounts (one employer, one
 * employee, one investor) so Super Admin can check any real portal by
 * signing in normally at /sign-in or /employer-portal/login — instead of
 * registering a brand-new real account through the ordinary signup flow
 * every time. NOT impersonation: every credential here is a real password
 * for a real, dedicated internal account, entered through the same login
 * forms a genuine customer or employer uses.
 */
export default function TestAccess() {
  const status = useTestAccessStatus();
  const provision = useProvisionTestAccess();
  const resetPassword = useResetTestAccessPassword();

  const [revealed, setRevealed] = useState<Partial<Record<Which, string>>>({});
  const [resetting, setResetting] = useState<Which | null>(null);

  const handleProvision = async () => {
    const result = await provision.mutateAsync();
    const next: Partial<Record<Which, string>> = {};
    (["employer", "employee", "investor"] as Which[]).forEach((key) => {
      if (result[key].password) next[key] = result[key].password!;
    });
    setRevealed((prev) => ({ ...prev, ...next }));
  };

  const handleReset = async (which: Which) => {
    setResetting(which);
    try {
      const result = await resetPassword.mutateAsync({ which });
      setRevealed((prev) => ({ ...prev, [which]: result.password }));
    } finally {
      setResetting(null);
    }
  };

  return (
    <div className="space-y-7">
      <PageHeader
        title="Test accounts"
        description="Three standing real accounts to check any portal — provisioned once, reused indefinitely. Not impersonation: real accounts, real passwords, the ordinary login forms."
      />

      <InfoNote>
        These are real, permanent accounts, dedicated to a single internal QA company — separate from any real customer
        or employer. The employee account is genuinely eligible for a Bridge draw; the investor account can genuinely
        commit capital. Actions taken here write real rows, the same as any other real account would.
      </InfoNote>

      {status.isPending ? (
        <LoadingRows rows={3} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {(["employer", "employee", "investor"] as Which[]).map((which) => {
            const info = SLOT_INFO[which];
            const slot = status.data?.[which];
            return (
              <Panel key={which} title={info.title} description={info.note}>
                <div className="space-y-1 text-sm">
                  <p className="text-muted-foreground">
                    Status:{" "}
                    <span className={slot?.provisioned ? "font-semibold text-success" : "font-semibold text-muted-foreground"}>
                      {slot?.provisioned ? "Provisioned" : "Not yet provisioned"}
                    </span>
                  </p>
                  {slot?.provisioned ? (
                    <p className="text-muted-foreground">
                      Email: <span className="font-medium text-foreground">{slot.email}</span>
                    </p>
                  ) : null}
                </div>

                {slot?.provisioned ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <ActionButton size="sm" variant="secondary" to={info.loginRoute}>
                      Open {info.loginLabel}
                    </ActionButton>
                    <ActionButton
                      size="sm"
                      variant="ghost"
                      icon={<KeyRound className="h-3.5 w-3.5" />}
                      loading={resetting === which}
                      onClick={() => void handleReset(which)}
                    >
                      Reset password
                    </ActionButton>
                  </div>
                ) : null}

                {revealed[which] && slot ? <PasswordBox email={slot.email} password={revealed[which]!} /> : null}
              </Panel>
            );
          })}
        </div>
      )}

      <div>
        <ActionButton loading={provision.isPending} onClick={() => void handleProvision()}>
          {status.data?.employer.provisioned && status.data?.employee.provisioned && status.data?.investor.provisioned
            ? "Re-check test accounts"
            : "Provision test accounts"}
        </ActionButton>
        <p className="mt-2 text-xs text-muted-foreground">
          Safe to click any time — only creates whatever is missing. Never changes an existing account's password;
          use "Reset password" on a specific card for that.
        </p>
      </div>
    </div>
  );
}
