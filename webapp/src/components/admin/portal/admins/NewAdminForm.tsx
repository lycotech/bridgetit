import { useState } from "react";
import { UserPlus } from "lucide-react";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { InfoNote } from "@/components/dashboard/Panel";
import { TextField, SelectField } from "@/components/dashboard/forms";
import { ADMIN_ROLE_SCOPE } from "@/lib/admin/admins";
import { ADMIN_ROLE_LABELS, type AdminRoleName, type CreateAdminInput } from "../../../../../../backend/src/types";

/**
 * Create an administrator.
 *
 * The role list is whatever the server said this caller may assign — not the
 * full vocabulary filtered in the browser. If the list arrives empty the form
 * refuses to render a submit, because offering a choice the server will reject
 * is worse than not offering it.
 *
 * Every role carries its scope in one line at the point of choice. "Operations
 * Admin" means nothing to a person appointing their first colleague; "Registered
 * users, employers and outgoing mail" does.
 */
export function NewAdminForm({
  assignableRoles,
  onSubmit,
  pending,
  error,
}: {
  assignableRoles: AdminRoleName[];
  onSubmit: (input: CreateAdminInput) => void;
  pending: boolean;
  error: string | null;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRoleName | "">("");

  const chosenRole: AdminRoleName | null = role === "" ? null : role;
  const ready = name.trim().length >= 2 && email.includes("@") && chosenRole !== null;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready || chosenRole === null) return;
        onSubmit({ name: name.trim(), email: email.trim().toLowerCase(), role: chosenRole });
      }}
      className="space-y-4"
    >
      <TextField
        label="Full name"
        value={name}
        onChange={setName}
        required
        autoComplete="name"
        placeholder="Adeola Bakare"
      />
      <TextField
        label="Work email"
        type="email"
        value={email}
        onChange={setEmail}
        required
        autoComplete="email"
        placeholder="adeola@getpaybridge.com"
        hint="They sign in with this address. It cannot be changed later from this screen."
      />
      <SelectField
        label="Role"
        value={role}
        onChange={(next) => setRole(next as AdminRoleName | "")}
        required
        options={[
          { value: "", label: "Choose a role" },
          ...assignableRoles.map((value) => ({ value, label: ADMIN_ROLE_LABELS[value] })),
        ]}
        hint={role ? ADMIN_ROLE_SCOPE[role] : "What this person will be able to reach."}
      />

      {error ? (
        <InfoNote tone="attention" role="alert">
          {error}
        </InfoNote>
      ) : (
        <InfoNote tone="neutral">
          PayBridge generates a temporary password and shows it to you once. It is never emailed — you pass it on
          yourself — and it dies after 24 hours or on first use, whichever comes first.
        </InfoNote>
      )}

      <ActionButton
        type="submit"
        size="lg"
        fullWidth
        disabled={!ready}
        loading={pending}
        icon={<UserPlus className="h-4 w-4" />}
      >
        Create administrator
      </ActionButton>
    </form>
  );
}
