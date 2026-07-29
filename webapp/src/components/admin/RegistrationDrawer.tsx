import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, MailCheck, PhoneCall, Save } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  adminApi,
  adminKeys,
  formatDateTime,
  SEGMENT_LABELS,
  type AdminRegistrationDetail,
  type Vocabulary,
} from "@/lib/admin";
import { InvitationForm } from "@/components/admin/InvitationForm";
import { ActivityTimeline } from "@/components/admin/ActivityTimeline";
import { ApiError } from "@/lib/api";

/** Turn `preferredPilotTimeline` into `Preferred pilot timeline`. */
function humanise(key: string): string {
  const spaced = key.replace(/([A-Z])/g, " $1").replace(/[_-]+/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-3 py-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value || "—"}</dd>
    </div>
  );
}

/** Sentinel for "leave unset" — Radix cannot hold an empty SelectItem value. */
const UNSET = "__unset__";

interface EditState {
  status: string;
  followUpStatus: string;
  pilotPriority: string;
  pipelineStage: string;
  assignedTeam: string;
  assignedTo: string;
  internalNotes: string;
  qualified: string;
}

function initialState(row: AdminRegistrationDetail): EditState {
  return {
    status: row.status,
    followUpStatus: row.followUpStatus ?? "",
    pilotPriority: row.pilotPriority ?? "",
    pipelineStage: row.pipelineStage ?? "",
    assignedTeam: row.assignedTeam ?? "",
    assignedTo: row.assignedTo ?? "",
    internalNotes: row.internalNotes ?? "",
    qualified: row.qualified === null ? "" : row.qualified ? "yes" : "no",
  };
}

/**
 * One registrant, everything about them, and the actions a team member can take.
 *
 * The read-only block shows exactly what the person submitted — including the
 * segment-specific answers stored as JSON — so nobody has to open the database
 * to answer "what did they actually tell us?". Consent is shown with its
 * timestamp because "did they agree to marketing?" is a question that has to be
 * answerable months later.
 */
export function RegistrationDrawer({
  registrationId,
  vocabulary,
  onClose,
}: {
  registrationId: string | null;
  vocabulary?: Vocabulary;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [edit, setEdit] = useState<EditState | null>(null);

  const { data, isPending } = useQuery({
    queryKey: adminKeys.registration(registrationId ?? ""),
    queryFn: () => adminApi.registration(registrationId as string),
    enabled: Boolean(registrationId),
  });

  // Reset the form whenever a different registrant is opened, and re-seed it
  // after a save so the inputs reflect what the server actually stored.
  useEffect(() => {
    setEdit(data ? initialState(data) : null);
  }, [data]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "registrations"] }),
      queryClient.invalidateQueries({ queryKey: adminKeys.stats }),
      registrationId
        ? queryClient.invalidateQueries({ queryKey: adminKeys.registration(registrationId) })
        : Promise.resolve(),
    ]);
  };

  const save = useMutation({
    mutationFn: (extra: Record<string, unknown> = {}) => {
      if (!registrationId || !edit) throw new Error("Nothing to save");
      const patch: Record<string, unknown> = {
        status: edit.status,
        assignedTeam: edit.assignedTeam.trim() || null,
        assignedTo: edit.assignedTo.trim() || null,
        internalNotes: edit.internalNotes.trim() || null,
        qualified: edit.qualified === "" ? null : edit.qualified === "yes",
        ...extra,
      };
      if (edit.followUpStatus) patch.followUpStatus = edit.followUpStatus;
      if (edit.pilotPriority) patch.pilotPriority = edit.pilotPriority;
      if (edit.pipelineStage) patch.pipelineStage = edit.pipelineStage;
      return adminApi.update(registrationId, patch);
    },
    onSuccess: async () => {
      toast.success("Saved");
      await invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "We could not save that"),
  });

  const resend = useMutation({
    mutationFn: () => adminApi.resendWelcome(registrationId as string),
    onSuccess: async (result) => {
      toast.success(result.delivered ? "Welcome email resent" : result.note);
      await invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "We could not resend that email"),
  });

  const details = Object.entries(data?.details ?? {}).filter(
    ([, value]) => value !== null && value !== "" && value !== undefined,
  );

  return (
    <Sheet open={Boolean(registrationId)} onOpenChange={(open) => (open ? null : onClose())}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-border bg-background sm:max-w-xl"
      >
        {isPending || !data || !edit ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <SheetHeader className="text-left">
              <SheetTitle className="font-display text-xl font-extrabold">
                {data.fullName}
              </SheetTitle>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                  {SEGMENT_LABELS[data.segment] ?? data.segment}
                </Badge>
                <Badge variant="outline">{data.status}</Badge>
                {data.demoInvitationStatus ? (
                  <Badge variant="outline" className="border-gold/40 bg-gold/10 text-gold">
                    Demo: {data.demoInvitationStatus}
                  </Badge>
                ) : null}
              </div>
            </SheetHeader>

            <section className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Submitted
              </h3>
              <dl className="mt-2 divide-y divide-border/60">
                <Row label="Email" value={data.email} />
                <Row label="Phone" value={data.phone ?? ""} />
                <Row label="Organisation" value={data.organisation ?? ""} />
                <Row label="Job title" value={data.jobTitle ?? ""} />
                <Row label="Location" value={data.location ?? ""} />
                {details.map(([key, value]) => (
                  <Row key={key} label={humanise(key)} value={String(value)} />
                ))}
              </dl>
            </section>

            <section className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Provenance and consent
              </h3>
              <dl className="mt-2 divide-y divide-border/60">
                <Row label="Registered" value={formatDateTime(data.createdAt)} />
                <Row label="Source page" value={data.sourcePage ?? ""} />
                <Row label="Form type" value={data.formType ?? ""} />
                <Row label="Stage" value={data.stage} />
                <Row
                  label="Privacy policy"
                  value={
                    data.privacyAccepted
                      ? `Accepted ${formatDateTime(data.privacyAcceptedAt)}`
                      : "Not accepted"
                  }
                />
                <Row
                  label="Marketing"
                  value={
                    data.marketingConsent
                      ? `Consented ${formatDateTime(data.marketingConsentAt)}`
                      : "No consent"
                  }
                />
                <Row label="Confirmation sent" value={formatDateTime(data.confirmationSentAt)} />
                <Row label="Team notified" value={formatDateTime(data.notificationSentAt)} />
                <Row label="Last contact" value={formatDateTime(data.lastContactAt)} />
              </dl>
            </section>

            <Separator className="my-6" />

            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Follow-up
              </h3>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    value={edit.status}
                    onValueChange={(value) => setEdit({ ...edit, status: value })}
                  >
                    <SelectTrigger id="edit-status" className="mt-2 h-11 rounded-xl bg-secondary/40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(vocabulary?.statuses ?? [data.status]).map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="edit-follow-up">Follow-up status</Label>
                  <Select
                    value={edit.followUpStatus || UNSET}
                    onValueChange={(value) =>
                      setEdit({ ...edit, followUpStatus: value === UNSET ? "" : value })
                    }
                  >
                    <SelectTrigger
                      id="edit-follow-up"
                      className="mt-2 h-11 rounded-xl bg-secondary/40"
                    >
                      <SelectValue placeholder="Not set" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNSET}>Not set</SelectItem>
                      {(vocabulary?.followUpStatuses ?? []).map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="edit-priority">Pilot priority</Label>
                  <Select
                    value={edit.pilotPriority || UNSET}
                    onValueChange={(value) =>
                      setEdit({ ...edit, pilotPriority: value === UNSET ? "" : value })
                    }
                  >
                    <SelectTrigger
                      id="edit-priority"
                      className="mt-2 h-11 rounded-xl bg-secondary/40"
                    >
                      <SelectValue placeholder="Not set" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNSET}>Not set</SelectItem>
                      {(vocabulary?.pilotPriorities ?? []).map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="edit-qualified">Qualified</Label>
                  <Select
                    value={edit.qualified || UNSET}
                    onValueChange={(value) =>
                      setEdit({ ...edit, qualified: value === UNSET ? "" : value })
                    }
                  >
                    <SelectTrigger
                      id="edit-qualified"
                      className="mt-2 h-11 rounded-xl bg-secondary/40"
                    >
                      <SelectValue placeholder="Not reviewed" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNSET}>Not reviewed</SelectItem>
                      <SelectItem value="yes">Qualified</SelectItem>
                      <SelectItem value="no">Not yet suitable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {data.segment === "employer" ? (
                  <div className="sm:col-span-2">
                    <Label htmlFor="edit-pipeline">Employer pilot stage</Label>
                    <Select
                      value={edit.pipelineStage || UNSET}
                      onValueChange={(value) =>
                        setEdit({ ...edit, pipelineStage: value === UNSET ? "" : value })
                      }
                    >
                      <SelectTrigger
                        id="edit-pipeline"
                        className="mt-2 h-11 rounded-xl bg-secondary/40"
                      >
                        <SelectValue placeholder="Interest Registered" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNSET}>Not set</SelectItem>
                        {(vocabulary?.pipelineStages ?? []).map((value) => (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div>
                  <Label htmlFor="edit-team">Assigned team</Label>
                  <Input
                    id="edit-team"
                    value={edit.assignedTeam}
                    onChange={(e) => setEdit({ ...edit, assignedTeam: e.target.value })}
                    placeholder="Partnerships"
                    className="mt-2 h-11 rounded-xl bg-secondary/40"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-owner">Assigned to</Label>
                  <Input
                    id="edit-owner"
                    value={edit.assignedTo}
                    onChange={(e) => setEdit({ ...edit, assignedTo: e.target.value })}
                    placeholder="Team member"
                    className="mt-2 h-11 rounded-xl bg-secondary/40"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit-notes">Standing summary</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  One paragraph of current context, overwritten each time. For anything worth
                  keeping, add a note in Activity below — those are never overwritten.
                </p>
                <Textarea
                  id="edit-notes"
                  value={edit.internalNotes}
                  onChange={(e) => setEdit({ ...edit, internalNotes: e.target.value })}
                  rows={3}
                  placeholder="Where this lead stands right now. Internal only."
                  className="mt-2 rounded-xl bg-secondary/40"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => save.mutate({})}
                  disabled={save.isPending}
                  className="h-11 rounded-full btn-brand text-sm font-semibold"
                >
                  {save.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save changes
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-full"
                  disabled={save.isPending}
                  onClick={() => save.mutate({ markContactedNow: true })}
                >
                  <PhoneCall className="mr-2 h-4 w-4" />
                  Mark contacted now
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-full"
                  disabled={resend.isPending}
                  onClick={() => resend.mutate()}
                >
                  {resend.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <MailCheck className="mr-2 h-4 w-4" />
                  )}
                  Resend welcome
                </Button>
              </div>
            </section>

            <Separator className="my-6" />

            <ActivityTimeline registrationId={data.id} events={data.events} />

            <Separator className="my-6" />

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Private demonstration
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Invitations are issued deliberately, one person at a time. Registering interest does
                not entitle anyone to demo access.
              </p>

              {data.invitations.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {data.invitations.map((invitation) => (
                    <li
                      key={invitation.id}
                      className="rounded-xl border border-border bg-card/50 p-3 text-xs"
                    >
                      <p className="font-medium text-foreground">
                        {invitation.portal} · {invitation.tokenHint}…
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        Expires {formatDateTime(invitation.expiresAt)} · used {invitation.useCount}/
                        {invitation.maxUses}
                        {invitation.revokedAt ? " · revoked" : ""}
                        {invitation.redeemedAt
                          ? ` · first opened ${formatDateTime(invitation.redeemedAt)}`
                          : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-4">
                <InvitationForm
                  registrationId={data.id}
                  defaultEmail={data.email}
                  defaultName={data.fullName}
                />
              </div>
            </section>

            <div className="h-8" />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
