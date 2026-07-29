import { useState } from "react";
import { AlertTriangle, CheckCircle2, KeyRound, Lock, LogOut, ShieldCheck, UserCog, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { InfoNote } from "@/components/dashboard/Panel";
import { SelectField, TextAreaField } from "@/components/dashboard/forms";
import { dateTime, relativeTime } from "@/lib/platform/format";
import { ADMIN_STATUS_TONE, ADMIN_STEP_LABELS, ADMIN_ROLE_SCOPE } from "@/lib/admin/admins";
import { ADMIN_ROLE_LABELS, type AdminRoleName, type AdminUserView } from "../../../../../../backend/src/types";

/**
 * One administrator, expandable into the controls that change them.
 *
 * The controls are collapsed and the destructive ones ask for a reason, which is
 * deliberate friction: every action on this row takes effect on the target's
 * NEXT request, so a mis-click suspends a colleague mid-task rather than at some
 * comfortable future sign-in.
 *
 * Status is a word plus an icon, never a coloured dot alone — the same rule the
 * rest of the portal follows, and the reason "suspended" is readable on a
 * monochrome screen.
 */
export function AdminUserRow({
  admin,
  isSelf,
  assignableRoles,
  lastSuperAdmin,
  onChange,
  onResetPassword,
  onSignOut,
  busy,
}: {
  admin: AdminUserView;
  isSelf: boolean;
  assignableRoles: AdminRoleName[];
  /** True when this is the only active Super Admin — the server will refuse changes. */
  lastSuperAdmin: boolean;
  onChange: (input: { role?: AdminRoleName; status?: "active" | "suspended"; reason?: string }) => void;
  onResetPassword: () => void;
  onSignOut: () => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<AdminRoleName>(admin.role);
  const [reason, setReason] = useState("");

  const suspended = admin.status === "suspended";
  const setupIncomplete = admin.outstanding.length > 0;
  const locked = Boolean(admin.lockedUntil);

  /* Rules 2 and 3 from the router, mirrored here only so the reason is VISIBLE
     rather than arriving as a server error. The server still decides. */
  const blocked = isSelf
    ? "You cannot change your own role or suspend your own account. Ask another Super Admin."
    : lastSuperAdmin
      ? "This is the only active Super Admin. Appoint another one before changing this account."
      : null;

  return (
    <li className="overflow-hidden rounded-2xl border border-border bg-card/60">
      <div className="flex flex-wrap items-start gap-3 px-4 py-3.5">
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            suspended ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground",
          )}
        >
          <UserCog className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-foreground">{admin.name}</span>
            {isSelf ? (
              <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-primary">
                You
              </span>
            ) : null}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em]",
                ADMIN_STATUS_TONE[admin.status] ?? "border-border bg-secondary/60 text-muted-foreground",
              )}
            >
              {suspended ? (
                <XCircle className="h-3 w-3" aria-hidden />
              ) : (
                <CheckCircle2 className="h-3 w-3" aria-hidden />
              )}
              {suspended ? "Suspended" : "Active"}
            </span>
          </p>
          <p className="mt-1 break-words text-xs text-muted-foreground">
            {ADMIN_ROLE_LABELS[admin.role]} · {admin.email}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {admin.lastLoginAt ? (
              <>
                Last signed in {relativeTime(admin.lastLoginAt)}{" "}
                <span className="text-muted-foreground/70">({dateTime(admin.lastLoginAt)})</span>
              </>
            ) : (
              "Has never signed in."
            )}
          </p>

          {(setupIncomplete || locked || admin.mfaEnabled) ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {locked ? (
                <Chip icon={<Lock className="h-3 w-3" />} tone="attention">
                  Locked out until {dateTime(admin.lockedUntil ?? "")}
                </Chip>
              ) : null}
              {admin.mfaEnabled ? (
                <Chip icon={<ShieldCheck className="h-3 w-3" />} tone="good">
                  Authenticator on
                </Chip>
              ) : null}
              {admin.outstanding.map((step) => (
                <Chip key={step} icon={<AlertTriangle className="h-3 w-3" />} tone="attention">
                  Setup owed: {ADMIN_STEP_LABELS[step]}
                </Chip>
              ))}
            </ul>
          ) : null}
        </div>

        <ActionButton
          variant="secondary"
          size="sm"
          onClick={() => setOpen((prev) => !prev)}
          className="shrink-0"
        >
          {open ? "Close" : "Manage"}
        </ActionButton>
      </div>

      {open ? (
        <div className="space-y-4 border-t border-border/70 bg-background/40 px-4 py-4">
          {blocked ? <InfoNote tone="attention">{blocked}</InfoNote> : null}

          <SelectField
            label="Role"
            value={role}
            onChange={(next) => setRole(next as AdminRoleName)}
            disabled={Boolean(blocked)}
            options={assignableRoles.map((value) => ({ value, label: ADMIN_ROLE_LABELS[value] }))}
            hint={ADMIN_ROLE_SCOPE[role]}
          />

          <TextAreaField
            label="Reason for this change"
            value={reason}
            onChange={setReason}
            rows={2}
            optional
            maxLength={500}
            placeholder="Moved to the operations team"
            hint="Kept with the audit record. Never shown to the administrator."
          />

          <div className="flex flex-wrap gap-2">
            <ActionButton
              size="sm"
              disabled={Boolean(blocked) || role === admin.role}
              loading={busy}
              onClick={() => onChange({ role, reason: reason.trim() || undefined })}
            >
              Save role
            </ActionButton>

            {suspended ? (
              <ActionButton
                variant="secondary"
                size="sm"
                disabled={isSelf}
                loading={busy}
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                onClick={() => onChange({ status: "active", reason: reason.trim() || undefined })}
              >
                Reinstate
              </ActionButton>
            ) : (
              <ActionButton
                variant="danger"
                size="sm"
                disabled={Boolean(blocked)}
                loading={busy}
                icon={<XCircle className="h-3.5 w-3.5" />}
                onClick={() => onChange({ status: "suspended", reason: reason.trim() || undefined })}
              >
                Suspend
              </ActionButton>
            )}

            <ActionButton
              variant="secondary"
              size="sm"
              disabled={isSelf}
              loading={busy}
              icon={<KeyRound className="h-3.5 w-3.5" />}
              onClick={onResetPassword}
            >
              New temporary password
            </ActionButton>

            <ActionButton
              variant="secondary"
              size="sm"
              loading={busy}
              icon={<LogOut className="h-3.5 w-3.5" />}
              onClick={onSignOut}
            >
              Sign out everywhere
            </ActionButton>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            A role change, a suspension and a password reset all end this person&apos;s live sessions immediately —
            the effect lands on their very next request, not at their next sign-in.
          </p>
        </div>
      ) : null}
    </li>
  );
}

function Chip({
  children,
  icon,
  tone,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  tone: "good" | "attention";
}) {
  return (
    <li
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tone === "good"
          ? "border-success/35 bg-success/10 text-foreground"
          : "border-gold/40 bg-gold/10 text-foreground",
      )}
    >
      <span aria-hidden>{icon}</span>
      {children}
    </li>
  );
}
