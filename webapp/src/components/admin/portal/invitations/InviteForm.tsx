import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { SelectField, TextAreaField, TextField, CheckboxField } from "@/components/dashboard/forms";
import { Button } from "@/components/ui/button";
import { useCreateInvitation, type IssuedInvitation } from "@/lib/admin/invitations";
import { DEMO_TYPES, DEMO_TYPE_LABELS, type DemoType } from "../../../../../../backend/src/types";

/**
 * Create a demonstration invitation.
 *
 * Two decisions worth explaining:
 *
 * The expiry is a datetime-local input with sensible presets rather than a
 * free-text duration. "72 hours" requires the administrator to do date
 * arithmetic to answer "so when does this die?" — which is the exact question
 * they will be asked on the phone.
 *
 * `maxUses` defaults to 1. A demonstration code that opens repeatedly is a
 * shared password with a nice format; one use per invited person keeps the
 * access log meaningful.
 */
const PRESETS = [
  { label: "24 hours", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "7 days", hours: 168 },
  { label: "30 days", hours: 720 },
];

/** `datetime-local` wants `YYYY-MM-DDTHH:mm` in LOCAL time, not an ISO string. */
function toLocalInput(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

function presetValue(hours: number): string {
  return toLocalInput(new Date(Date.now() + hours * 60 * 60 * 1000));
}

export function InviteForm({
  onIssued,
  onCancel,
  defaultEmail = "",
  defaultName = "",
  registrationId,
}: {
  onIssued: (issued: IssuedInvitation) => void;
  onCancel?: () => void;
  defaultEmail?: string;
  defaultName?: string;
  registrationId?: string;
}) {
  const create = useCreateInvitation();

  const [inviteeName, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [organisation, setOrganisation] = useState("");
  const [demoType, setDemoType] = useState<DemoType>("full_platform");
  const [expiresAt, setExpiresAt] = useState(presetValue(72));
  const [maxUses, setMaxUses] = useState("1");
  const [internalNote, setNote] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const issued = await create.mutateAsync({
        inviteeName: inviteeName.trim(),
        email: email.trim(),
        organisation: organisation.trim(),
        demoType,
        // The local value carries no zone, so it is converted explicitly here
        // rather than left for the server to guess at.
        expiresAt: new Date(expiresAt).toISOString(),
        maxUses: Number(maxUses) || 1,
        internalNote: internalNote.trim(),
        registrationId: registrationId ?? "",
        sendEmail,
      });
      onIssued(issued);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not create that invitation.");
    }
  };

  const ready = inviteeName.trim().length >= 2 && /.+@.+\..+/.test(email) && expiresAt.length > 0;

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Invitee's name" value={inviteeName} onChange={setName} placeholder="Adaeze Okonkwo" />
        <TextField
          label="Email address"
          value={email}
          onChange={setEmail}
          type="email"
          inputMode="email"
          placeholder="name@company.com"
          hint="The code only works from this address."
        />
        <TextField
          label="Organisation"
          value={organisation}
          onChange={setOrganisation}
          optional
          placeholder="Company or institution"
        />
        <SelectField
          label="Demonstration type"
          value={demoType}
          onChange={(value) => setDemoType(value as DemoType)}
          options={DEMO_TYPES.map((type) => ({ value: type, label: DEMO_TYPE_LABELS[type] }))}
          hint="Decides which part of PayBridge the code opens."
        />
      </div>

      <div className="space-y-2.5">
        <TextField
          label="Expires"
          value={expiresAt}
          onChange={setExpiresAt}
          type="datetime-local"
          hint="Shown to the invitee in their invitation. 90 days maximum."
        />
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setExpiresAt(presetValue(preset.hours))}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          label="Maximum uses"
          value={maxUses}
          onChange={setMaxUses}
          options={[
            { value: "1", label: "1 — single use (recommended)" },
            { value: "2", label: "2 uses" },
            { value: "3", label: "3 uses" },
            { value: "5", label: "5 uses" },
            { value: "10", label: "10 uses" },
          ]}
          hint="How many demonstration sessions this code may open."
        />
      </div>

      <TextAreaField
        label="Internal note"
        value={internalNote}
        onChange={setNote}
        optional
        rows={3}
        placeholder="Why this person was invited, who owns the relationship, what to show them."
        hint="Staff only. Never included in the invitation."
      />

      <CheckboxField checked={sendEmail} onChange={setSendEmail}>
        <span className="font-medium text-foreground">Email the invitation now</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          Leave this off to generate the code and pass it on yourself.
        </span>
      </CheckboxField>

      {error ? (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2.5">
        <ActionButton type="submit" size="lg" loading={create.isPending} disabled={!ready}>
          Generate invitation code
        </ActionButton>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
