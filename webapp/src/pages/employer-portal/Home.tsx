import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, LogOut, UserPlus, Wallet } from "lucide-react";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow } from "@/components/dashboard/Panel";
import { useEmployerSession, useEmployerLogout } from "@/lib/employer/session";
import {
  useEmployerProfile,
  useEmployerTeam,
  useInviteEmployerTeamMember,
  useUpdateEmployerProfile,
} from "@/lib/employer/company";
import {
  EMPLOYER_TEAM_ROLE_LABELS,
  type EmployerTeamRole,
  type UpdateEmployerProfileInput,
} from "../../../../backend/src/types";

/**
 * Real employer home — company profile and team, backed by the actual
 * `/api/employer/*` service. This is intentionally NOT the polished demo
 * dashboard at `/employer/*` (which is still mock data behind the private
 * demo gate — see AGENTS.md). This page is smaller and plainer because
 * everything on it is real.
 */
export default function EmployerPortalHome() {
  const session = useEmployerSession();
  const logout = useEmployerLogout();
  const isAdmin = session.data?.role === "employer_admin";

  const profile = useEmployerProfile(session.data?.authenticated ?? false);
  const team = useEmployerTeam(isAdmin);
  const updateProfile = useUpdateEmployerProfile();
  const invite = useInviteEmployerTeamMember();

  const [form, setForm] = useState<UpdateEmployerProfileInput>({});
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (profile.data) {
      setForm({
        tradingName: profile.data.tradingName ?? "",
        industry: profile.data.industry ?? "",
        website: profile.data.website ?? "",
        registeredAddress: profile.data.registeredAddress ?? "",
        employeeCount: profile.data.employeeCount ?? undefined,
      });
    }
  }, [profile.data]);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<EmployerTeamRole>("employer_contributor");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);

  if (session.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!session.data?.authenticated) return <Navigate to="/employer-portal/login" replace />;

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSaved(false);
    await updateProfile.mutateAsync({
      ...form,
      employeeCount: form.employeeCount ? Number(form.employeeCount) : undefined,
    });
    setSaved(true);
  }

  async function sendInvite(event: React.FormEvent) {
    event.preventDefault();
    setInviteError(null);
    setInviteSent(false);
    try {
      await invite.mutateAsync({ email: inviteEmail, fullName: inviteName, role: inviteRole });
      setInviteEmail("");
      setInviteName("");
      setInviteSent(true);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "That invitation could not be sent.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-7 px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow={session.data.employerStatus ?? undefined}
        title={session.data.employerName ?? "Your company"}
        description={`Signed in as ${session.data.fullName} (${EMPLOYER_TEAM_ROLE_LABELS[session.data.role!]})`}
        actions={
          <>
            <ActionButton variant="secondary" to="/employer-portal/payroll" icon={<Wallet className="h-4 w-4" />}>
              Payroll
            </ActionButton>
            <ActionButton
              variant="ghost"
              icon={<LogOut className="h-4 w-4" />}
              onClick={() => logout.mutate()}
              loading={logout.isPending}
            >
              Sign out
            </ActionButton>
          </>
        }
      />

      <Panel title="Company profile" description="Visible to your team. Used for underwriting once you apply.">
        {profile.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <form onSubmit={(e) => void saveProfile(e)} className="space-y-3">
            <SummaryRow label="Registered name" value={profile.data?.registeredName ?? "—"} />
            <Field label="Trading name" value={form.tradingName ?? ""} onChange={(v) => setForm((f) => ({ ...f, tradingName: v }))} />
            <Field label="Industry" value={form.industry ?? ""} onChange={(v) => setForm((f) => ({ ...f, industry: v }))} />
            <Field label="Website" value={form.website ?? ""} onChange={(v) => setForm((f) => ({ ...f, website: v }))} />
            <Field
              label="Registered address"
              value={form.registeredAddress ?? ""}
              onChange={(v) => setForm((f) => ({ ...f, registeredAddress: v }))}
            />
            <Field
              label="Employee count"
              type="number"
              value={form.employeeCount?.toString() ?? ""}
              onChange={(v) => setForm((f) => ({ ...f, employeeCount: v ? Number(v) : undefined }))}
            />
            {!isAdmin ? (
              <p className="text-xs text-muted-foreground">Only a company admin can edit this profile.</p>
            ) : (
              <div className="flex items-center gap-3 pt-1">
                <ActionButton type="submit" size="sm" loading={updateProfile.isPending}>
                  Save
                </ActionButton>
                {saved ? <span className="text-xs font-semibold text-success">Saved</span> : null}
              </div>
            )}
          </form>
        )}
      </Panel>

      {isAdmin ? (
        <Panel title="Team" description="Everyone with access to this company's PayBridge account.">
          <div className="space-y-2">
            {team.data?.items.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{member.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                </div>
                <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {EMPLOYER_TEAM_ROLE_LABELS[member.role]} · {member.status}
                </span>
              </div>
            ))}
          </div>

          <form onSubmit={(e) => void sendInvite(e)} className="mt-5 space-y-3 border-t border-border/70 pt-5">
            <p className="text-sm font-semibold text-foreground">Invite a colleague</p>
            <Field label="Full name" value={inviteName} onChange={setInviteName} />
            <Field label="Email" type="email" value={inviteEmail} onChange={setInviteEmail} />
            <label className="block text-sm font-medium text-muted-foreground">
              Role
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as EmployerTeamRole)}
                className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground"
              >
                <option value="employer_contributor">Contributor</option>
                <option value="employer_viewer">Viewer</option>
              </select>
            </label>
            {inviteError ? <p className="text-sm text-destructive">{inviteError}</p> : null}
            {inviteSent ? <p className="text-sm text-success">Invitation sent.</p> : null}
            <ActionButton type="submit" size="sm" icon={<UserPlus className="h-4 w-4" />} loading={invite.isPending}>
              Send invite
            </ActionButton>
          </form>
        </Panel>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm font-medium text-muted-foreground">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground"
      />
    </label>
  );
}
