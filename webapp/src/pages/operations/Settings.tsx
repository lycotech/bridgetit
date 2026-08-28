import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow, InfoNote } from "@/components/dashboard/Panel";
import { DataTable, CellStack } from "@/components/dashboard/DataTable";
import type { Column } from "@/components/dashboard/DataTable";
import { Modal } from "@/components/dashboard/Modal";
import { SelectField, TextField, ToggleRow } from "@/components/dashboard/forms";
import { opsApi, qk } from "@/lib/platform/mock-service";
import { dateTime } from "@/lib/platform/format";
import type { AuditLog, Role } from "@/lib/platform/models";
import { ROLE_LIST, roleMeta } from "@/lib/platform/roles";
import { useAuth } from "@/lib/auth/auth-context";
import { LiveModeTabs } from "@/components/operations/LiveModeTabs";
import RealAuditLogs from "@/pages/admin/portal/AuditLogs";

const FEE_OPTIONS = ["2.5%", "3.0%", "3.5%", "4.0%"];
const SHARE_OPTIONS = ["30%", "40%", "50%", "60%"];
const INTERNAL_ROLES: Role[] = ["ops_officer", "ops_risk", "ops_compliance", "ops_finance", "super_admin"];

export default function OperationsSettingsPage() {
  const { user, can } = useAuth();
  const editable = can("ops.settings.manage");

  const [fee, setFee] = useState(FEE_OPTIONS[0]);
  const [share, setShare] = useState(SHARE_OPTIONS[2]);
  const [cutoff, setCutoff] = useState("18:00");
  const [autoDisburse, setAutoDisburse] = useState(true);
  const [autoMatch, setAutoMatch] = useState(true);
  const [maintenance, setMaintenance] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("ops_officer");

  const logs = useQuery({ queryKey: qk.ops("audit"), queryFn: () => opsApi.auditLogs() });

  const guard = (action: () => void) => {
    if (!editable) {
      toast.error("Only a super administrator can change platform settings");
      return;
    }
    action();
  };

  const columns: Column<AuditLog>[] = [
    {
      key: "actor",
      header: "Actor",
      render: (row) => <CellStack primary={row.actor} secondary={row.actorRole} />,
      sortValue: (row) => row.actor,
    },
    {
      key: "action",
      header: "Action",
      render: (row) => <CellStack primary={row.action} secondary={row.entity} />,
      sortValue: (row) => row.action,
    },
    {
      key: "at",
      header: "When",
      hideBelow: "sm",
      render: (row) => <span className="text-muted-foreground">{dateTime(row.at)}</span>,
      sortValue: (row) => row.at,
    },
    {
      key: "ip",
      header: "IP address",
      hideBelow: "lg",
      render: (row) => <span className="tnum text-muted-foreground">{row.ip}</span>,
      sortValue: (row) => row.ip,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings & audit"
        title="Platform settings"
        description="Product rules, internal access and the full audit trail of everything done inside PayBridge."
        actions={
          <ActionButton variant="secondary" onClick={() => guard(() => setInviteOpen(true))}>
            Invite a colleague
          </ActionButton>
        }
      />

      {editable ? null : (
        <InfoNote tone="attention">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <Lock className="h-3.5 w-3.5" />
            Read only
          </span>{" "}
          — your role ({user ? roleMeta(user.role).label : "internal user"}) can view platform settings but not
          change them. The audit log below is available to every internal role.
        </InfoNote>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Product rules" description="Applies to every employer unless overridden on their account.">
          <div className="space-y-4">
            <SelectField
              label="Standard service fee"
              value={fee}
              onChange={(value) => guard(() => { setFee(value); toast.success(`Service fee set to ${value}`); })}
              options={FEE_OPTIONS.map((value) => ({ value, label: value }))}
              hint="Charged once per Bridge. Always shown to the employee before they confirm."
            />
            <SelectField
              label="Maximum share of earned pay"
              value={share}
              onChange={(value) => guard(() => { setShare(value); toast.success(`Maximum share set to ${value}`); })}
              options={SHARE_OPTIONS.map((value) => ({ value, label: value }))}
              hint="The most an employee can bridge from pay they have already earned."
            />
            <TextField
              label="Daily disbursement cut-off"
              value={cutoff}
              onChange={(value) => guard(() => setCutoff(value))}
              hint="Requests after this time are disbursed the next business morning."
              disabled={!editable}
            />
          </div>
          <InfoNote className="mt-4">
            Employees only ever access pay they have already earned. Nothing here creates credit for an employee.
          </InfoNote>
        </Panel>

        <div className="space-y-6">
          <Panel title="Automation" description="What the platform does without a human in the loop.">
            <div className="divide-y divide-border/70">
              <ToggleRow
                title="Auto-disburse verified Bridge requests"
                description="Requests inside limits are paid immediately."
                checked={autoDisburse}
                onChange={(value) => guard(() => setAutoDisburse(value))}
                disabled={!editable}
              />
              <ToggleRow
                title="Auto-match bank statements"
                description="Match on reference and amount, leave the rest for review."
                checked={autoMatch}
                onChange={(value) => guard(() => setAutoMatch(value))}
                disabled={!editable}
              />
              <ToggleRow
                title="Maintenance mode"
                description="Pause new requests across every portal. Existing transactions continue to settle."
                checked={maintenance}
                onChange={(value) =>
                  guard(() => {
                    setMaintenance(value);
                    toast.info(value ? "Maintenance mode is on" : "Maintenance mode is off");
                  })
                }
                disabled={!editable}
              />
            </div>
          </Panel>

          <Panel title="Internal access" description="Roles available to PayBridge staff.">
            <ul className="space-y-2.5">
              {ROLE_LIST.filter((meta) => INTERNAL_ROLES.includes(meta.role)).map((meta) => (
                <li key={meta.role} className="rounded-2xl border border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                    <span className="shrink-0 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                      {meta.permissions.length} modules
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{meta.description}</p>
                </li>
              ))}
            </ul>
            <InfoNote tone="primary" className="mt-4">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <ShieldAlert className="h-3.5 w-3.5" />
                Internal only
              </span>{" "}
              — the operations sign-in is never linked from the public website. Staff reach it directly.
            </InfoNote>
          </Panel>
        </div>
      </div>

      <Panel title="Your session">
        <div className="divide-y divide-border/70">
          <SummaryRow label="Signed in as" value={user?.fullName ?? "—"} />
          <SummaryRow label="Role" value={user ? roleMeta(user.role).label : "—"} />
          <SummaryRow label="Email" value={user?.email ?? "—"} />
          <SummaryRow label="Last sign-in" value={user ? dateTime(user.lastLoginAt) : "—"} />
          <SummaryRow
            label="Two-factor authentication"
            value={user?.twoFactorEnabled ? "Enabled" : "Coming soon"}
          />
        </div>
      </Panel>

      <LiveModeTabs
        gateTitle="Staff credentials required"
        gateDescription="Sign in with your PayBridge staff account to see the real, append-only audit trail instead of demo data."
        live={<RealAuditLogs />}
        demo={
          <DataTable
            rows={logs.data ?? []}
            columns={columns}
            getRowId={(row) => row.id}
            caption="Each platform setting, with its current value and when it was last changed"
            search={(row) => `${row.actor} ${row.actorRole} ${row.action} ${row.entity} ${row.ip}`}
            searchPlaceholder="Search the audit log by actor, action or entity"
            filters={[
              {
                key: "actorRole",
                label: "Role",
                options: Array.from(new Set((logs.data ?? []).map((row) => row.actorRole))),
                accessor: (row) => row.actorRole,
              },
            ]}
            dateAccessor={(row) => row.at}
            isLoading={logs.isLoading}
            isError={logs.isError}
            onRetry={() => void logs.refetch()}
            emptyTitle="No audit entries yet"
            emptyBody="Every internal action is recorded here with the actor, role, entity and IP address."
            initialSort={{ key: "at", direction: "desc" }}
            pageSize={12}
            exportName="paybridge-audit-log"
            exportRow={(row) => ({
              Actor: row.actor,
              Role: row.actorRole,
              Action: row.action,
              Entity: row.entity,
              When: dateTime(row.at),
              IP: row.ip,
            })}
          />
        }
      />

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite a colleague"
        description="They receive an email invitation and set their own password."
        footer={
          <>
            <ActionButton variant="secondary" onClick={() => setInviteOpen(false)}>
              Cancel
            </ActionButton>
            <ActionButton
              disabled={!inviteEmail.includes("@")}
              onClick={() => {
                setInviteOpen(false);
                toast.success(`Invitation sent to ${inviteEmail}`);
                setInviteEmail("");
              }}
            >
              Send invitation
            </ActionButton>
          </>
        }
      >
        <div className="space-y-4">
          <TextField
            label="Work email"
            value={inviteEmail}
            onChange={setInviteEmail}
            type="email"
            inputMode="email"
            placeholder="name@getpaybridge.com"
          />
          <SelectField
            label="Role"
            value={inviteRole}
            onChange={(value) => setInviteRole(value as Role)}
            options={ROLE_LIST.filter((meta) => INTERNAL_ROLES.includes(meta.role)).map((meta) => ({
              value: meta.role,
              label: meta.label,
            }))}
            hint="Each role only sees the modules it needs."
          />
          <InfoNote>Invitations expire after 72 hours and are recorded in the audit log.</InfoNote>
        </div>
      </Modal>
    </div>
  );
}
