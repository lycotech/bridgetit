import { useState } from "react";
import { Plus, ShieldCheck, UserCog } from "lucide-react";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, InfoNote } from "@/components/dashboard/Panel";
import { AsyncPanel, EmptyState, LoadingRows } from "@/components/dashboard/states";
import { Modal } from "@/components/dashboard/Modal";
import { NewAdminForm } from "@/components/admin/portal/admins/NewAdminForm";
import { PasswordReveal } from "@/components/admin/portal/admins/PasswordReveal";
import { AdminUserRow } from "@/components/admin/portal/admins/AdminUserRow";
import {
  useAdminUsers,
  useCreateAdmin,
  useResetAdminPassword,
  useSignOutAdmin,
  useUpdateAdmin,
} from "@/lib/admin/admins";
import { ADMIN_ROLE_LABELS, type CreateAdminInput, type IssuedAdminView } from "../../../../../backend/src/types";

/**
 * Admin users — who can sign in to operations, and what each may do.
 *
 * Two things shape this screen.
 *
 * First, a temporary password is visible exactly once, at the moment it is
 * generated, so both creating an administrator and reissuing a password end in a
 * modal that must be dismissed deliberately. The list below can never show one.
 *
 * Second, every rule lives on the server — only a Super Admin may be here at all,
 * nobody may act on themselves, and the last active Super Admin is protected.
 * This page mirrors those rules so the REASON is visible before the attempt, but
 * it never becomes the authority: a disabled button is a courtesy, not a control.
 */
export default function AdminUsers() {
  const [creating, setCreating] = useState(false);
  const [issued, setIssued] = useState<IssuedAdminView | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const admins = useAdminUsers();
  const create = useCreateAdmin();
  const update = useUpdateAdmin();
  const resetPassword = useResetAdminPassword();
  const signOut = useSignOutAdmin();

  const busy = update.isPending || resetPassword.isPending || signOut.isPending;

  const submitNew = async (input: CreateAdminInput) => {
    setCreateError(null);
    try {
      const next = await create.mutateAsync(input);
      setCreating(false);
      setIssued(next);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "We could not create that administrator.");
    }
  };

  /* One shared error line for the row actions. The server's message is the useful
     one — "This is the only active Super Admin" beats any wording invented here. */
  const runRowAction = async (action: () => Promise<unknown>) => {
    setRowError(null);
    try {
      await action();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "That change did not go through.");
    }
  };

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Access control"
        title="Admin users"
        description="Who can sign in to operations, and what each of them is allowed to do. Only a Super Admin can open this section, and the server checks that on every single call."
        actions={
          <ActionButton icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            New administrator
          </ActionButton>
        }
      />

      <Panel
        title="Administrators"
        description="Open a row to change a role, suspend an account, issue a new temporary password or end every live session."
        bodyClassName="space-y-4"
      >
        {rowError ? (
          <InfoNote tone="attention" role="alert">
            {rowError}
          </InfoNote>
        ) : null}

        <AsyncPanel
          query={admins}
          loading={<LoadingRows rows={4} />}
          errorBody="Either this account is not a Super Admin, or the list could not be reached. Nothing was changed."
        >
          {(data) =>
            data.items.length === 0 ? (
              <EmptyState
                icon={<UserCog className="h-5 w-5" />}
                title="No administrators yet"
                body="Create the first administrator account. They will set their own password, enrol an authenticator and accept the policy before anything opens."
                action={
                  <ActionButton icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
                    New administrator
                  </ActionButton>
                }
              />
            ) : (
              <ul className="space-y-2.5">
                {data.items.map((admin) => (
                  <AdminUserRow
                    key={admin.id}
                    admin={admin}
                    isSelf={data.selfId === admin.id}
                    assignableRoles={data.assignableRoles}
                    lastSuperAdmin={admin.role === "super_admin" && admin.status === "active" && data.superAdminCount <= 1}
                    busy={busy}
                    onChange={(input) => void runRowAction(() => update.mutateAsync({ id: admin.id, ...input }))}
                    onResetPassword={() =>
                      void runRowAction(async () => setIssued(await resetPassword.mutateAsync(admin.id)))
                    }
                    onSignOut={() => void runRowAction(() => signOut.mutateAsync(admin.id))}
                  />
                ))}
              </ul>
            )
          }
        </AsyncPanel>
      </Panel>

      <Panel title="What each role can reach" headingLevel={2} bodyClassName="p-0">
        <dl className="divide-y divide-border/70">
          {(["super_admin", "kyc_reviewer", "operations_admin", "demo_manager", "auditor"] as const).map((role) => (
            <div key={role} className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-3 sm:px-5">
              <dt className="w-40 shrink-0 text-sm font-semibold text-foreground">{ADMIN_ROLE_LABELS[role]}</dt>
              <dd className="min-w-0 flex-1 text-sm text-muted-foreground">{ROLE_DETAIL[role]}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <p className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Every action on this page is written to the audit trail with who did it, to whom, and from which address — and
          the record cannot be edited or deleted afterwards.
        </span>
      </p>

      <Modal
        open={creating}
        onClose={() => {
          setCreating(false);
          setCreateError(null);
        }}
        title="New administrator"
        description="PayBridge generates a temporary password and shows it to you once."
        size="wide"
      >
        <AsyncPanel query={admins} loading={<LoadingRows rows={3} />}>
          {(data) => (
            <NewAdminForm
              assignableRoles={data.assignableRoles}
              onSubmit={(input) => void submitNew(input)}
              pending={create.isPending}
              error={createError}
            />
          )}
        </AsyncPanel>
      </Modal>

      <Modal
        open={issued !== null}
        onClose={() => setIssued(null)}
        title="Temporary password"
        description="Copy it now — this is the only time it can be displayed."
        size="wide"
      >
        {issued ? <PasswordReveal issued={issued} onDone={() => setIssued(null)} /> : null}
      </Modal>
    </div>
  );
}

/** Fuller than the one-liner shown at the point of choice — this is the reference table. */
const ROLE_DETAIL: Record<string, string> = {
  super_admin:
    "Everything, including creating administrators, changing roles, suspending accounts and security settings. Keep the number of these small.",
  kyc_reviewer:
    "Identity checks only: approve, reject and request new documents. Can see the documents a person submitted, and nothing about their money.",
  operations_admin: "Registered users, employers and outgoing mail. Cannot manage administrators.",
  demo_manager: "Demonstration invitations only — create, resend and withdraw them.",
  auditor: "Read-only. Can read the audit trail and reports, and can change nothing anywhere.",
};
