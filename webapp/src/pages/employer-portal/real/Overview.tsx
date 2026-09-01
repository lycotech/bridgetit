import { ClipboardList, Users, Wallet } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { Panel, SummaryRow } from "@/components/dashboard/Panel";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { useEmployerSession } from "@/lib/employer/session";
import { useEmployerProfile, useEmployerTeam } from "@/lib/employer/company";
import { usePayrollEmployees } from "@/lib/employer/payroll";
import { useSalaryAccountRequests } from "@/lib/employer/salary-account";

/**
 * Real Employer Portal Overview — `/employer-portal`. Summary landing page,
 * matching the demo's Overview role: Employees/Payroll/Salary Account
 * Requests each have their own dedicated page now.
 */
export default function EmployerOverview() {
  const session = useEmployerSession();
  const isAdmin = session.data?.role === "employer_admin";
  const profile = useEmployerProfile(session.data?.authenticated ?? false);
  const team = useEmployerTeam(isAdmin);
  const employees = usePayrollEmployees(session.data?.authenticated ?? false);
  const requests = useSalaryAccountRequests(session.data?.authenticated ?? false);

  const eligibleCount = (employees.data?.items ?? []).filter((e) => e.eligible).length;
  const pendingRequests = (requests.data?.items ?? []).filter((r) => r.status === "pending_review").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={session.data?.employerStatus ?? undefined}
        title={session.data?.employerName ?? "Your company"}
        description={`Signed in as ${session.data?.fullName ?? "—"}`}
      />

      <StatGrid columns={3}>
        <StatCard label="Employees on roster" value={employees.data?.items.length ?? 0} icon={<Users className="h-4 w-4" />} tone="primary" />
        <StatCard label="Eligible for Access" value={eligibleCount} hint="KYC approved and linked" icon={<Wallet className="h-4 w-4" />} tone="success" />
        <StatCard label="Salary account requests" value={pendingRequests} hint="Awaiting your decision" icon={<ClipboardList className="h-4 w-4" />} tone={pendingRequests > 0 ? "attention" : "default"} />
      </StatGrid>

      <Panel title="Company profile" description="Visible to your team. Used for underwriting once you apply.">
        <div className="space-y-1">
          <SummaryRow label="Registered name" value={profile.data?.registeredName ?? "—"} />
          <SummaryRow label="Industry" value={profile.data?.industry ?? "Not set"} />
          <SummaryRow label="Status" value={<StatusBadge status={session.data?.employerStatus ?? "—"} />} />
        </div>
      </Panel>

      {isAdmin && team.data?.items.length ? (
        <Panel title="Team" description="Everyone with access to this company's PayBridge account.">
          <div className="space-y-2">
            {team.data.items.slice(0, 5).map((member) => (
              <div key={member.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{member.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                </div>
                <StatusBadge status={member.status} />
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
