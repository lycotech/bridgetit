import { useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, FileText, Lock, ShieldCheck, XCircle } from "lucide-react";
import { Panel, SummaryRow, Divider, InfoNote } from "@/components/dashboard/Panel";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { cn } from "@/lib/utils";
import { dateTime } from "@/lib/platform/format";
import { KYC_STATUS_TONE, useKycDecision, useKycDocumentUrl } from "@/lib/admin/kyc";
import {
  ACCOUNT_TYPE_LABELS,
  ID_TYPE_LABELS,
  KYC_DOC_LABELS,
  KYC_REJECTION_LABELS,
  KYC_REJECTION_REASONS,
  KYC_STATUS_LABELS,
  type KycCaseView,
  type KycRejectionReason,
} from "../../../../../../backend/src/types";

export function KycCaseDetail({
  kycCase,
  canDecide,
}: {
  kycCase: KycCaseView;
  canDecide: boolean;
}) {
  const decide = useKycDecision();
  const docUrl = useKycDocumentUrl();
  const [mode, setMode] = useState<"idle" | "reject">("idle");
  const [reason, setReason] = useState<KycRejectionReason | "">("");
  const [reasonDetail, setReasonDetail] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [openingDoc, setOpeningDoc] = useState<string | null>(null);

  const isPending = kycCase.status === "pending";

  async function openDocument(documentId: string) {
    setOpeningDoc(documentId);
    try {
      const { url } = await docUrl.mutateAsync({ userId: kycCase.userId, documentId });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setError("Could not open that document. Try again.");
    } finally {
      setOpeningDoc(null);
    }
  }

  async function approve() {
    setError(null);
    try {
      await decide.mutateAsync({ userId: kycCase.userId, decision: "approve", internalNote: internalNote || undefined });
      setInternalNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That decision did not go through.");
    }
  }

  async function reject() {
    setError(null);
    if (!reason) {
      setError("Choose a rejection reason.");
      return;
    }
    try {
      await decide.mutateAsync({
        userId: kycCase.userId,
        decision: "reject",
        reason,
        reasonDetail: reasonDetail || undefined,
        internalNote: internalNote || undefined,
      });
      setMode("idle");
      setReason("");
      setReasonDetail("");
      setInternalNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That decision did not go through.");
    }
  }

  return (
    <div className="space-y-5">
      <Panel
        title={kycCase.fullName}
        description={kycCase.email}
        action={
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide",
              KYC_STATUS_TONE[kycCase.status],
            )}
          >
            {KYC_STATUS_LABELS[kycCase.status]}
          </span>
        }
        bodyClassName="space-y-1"
      >
        <SummaryRow label="Account type" value={ACCOUNT_TYPE_LABELS[kycCase.accountType]} />
        <SummaryRow label="Phone" value={kycCase.phone ?? "—"} />
        <SummaryRow label="Submitted" value={kycCase.submittedAt ? dateTime(kycCase.submittedAt) : "—"} />
        {kycCase.reviewedAt ? (
          <>
            <SummaryRow label="Reviewed" value={dateTime(kycCase.reviewedAt)} />
            <SummaryRow label="Reviewed by" value={kycCase.reviewedBy ?? "—"} />
          </>
        ) : null}
      </Panel>

      {kycCase.status === "rejected" && kycCase.rejectionReason ? (
        <InfoNote tone="attention">
          <span className="font-semibold">Reason shown to the applicant: </span>
          {kycCase.rejectionReason}
        </InfoNote>
      ) : null}

      {kycCase.internalNote ? (
        <InfoNote tone="neutral" icon={<Lock className="h-3.5 w-3.5" />}>
          <span className="font-semibold">Reviewer note (not shown to the applicant): </span>
          {kycCase.internalNote}
        </InfoNote>
      ) : null}

      <Panel title="Identity details" bodyClassName="space-y-1">
        <SummaryRow label="ID type" value={kycCase.idType ? ID_TYPE_LABELS[kycCase.idType] : "—"} />
        <SummaryRow label="ID number" value={kycCase.idNumber ?? "Unavailable"} />
        <SummaryRow label="Date of birth" value={kycCase.dateOfBirth ?? "Unavailable"} />
        <SummaryRow label="Address" value={kycCase.address ?? "Unavailable"} />
        {kycCase.bvn ? <SummaryRow label="BVN" value={kycCase.bvn} /> : null}
        <Divider className="my-2" />
        <SummaryRow
          label="Location"
          value={[kycCase.city, kycCase.state, kycCase.country].filter(Boolean).join(", ") || "—"}
        />
        {kycCase.employerName ? <SummaryRow label="Employer" value={kycCase.employerName} /> : null}
        {kycCase.occupation ? <SummaryRow label="Occupation" value={kycCase.occupation} /> : null}
      </Panel>

      <Panel
        title="Documents"
        description="Opens a link good for five minutes. Each open is recorded against your name."
      >
        {kycCase.documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
        ) : (
          <ul className="space-y-2">
            {kycCase.documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{KYC_DOC_LABELS[doc.docType]}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {doc.fileName} · {(doc.sizeBytes / 1024).toFixed(0)} KB
                    </p>
                  </div>
                </div>
                <ActionButton
                  variant="ghost"
                  size="sm"
                  icon={<ExternalLink className="h-3.5 w-3.5" />}
                  loading={openingDoc === doc.id}
                  onClick={() => void openDocument(doc.id)}
                >
                  View
                </ActionButton>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {isPending ? (
        <Panel title="Decision" description={canDecide ? "This case is awaiting a decision." : undefined}>
          {!canDecide ? (
            <InfoNote tone="neutral" icon={<Lock className="h-3.5 w-3.5" />}>
              Your role can view this case but cannot decide it. Ask a KYC reviewer or Super Admin.
            </InfoNote>
          ) : (
            <div className="space-y-4">
              {error ? (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </p>
              ) : null}

              {mode === "idle" ? (
                <div className="flex flex-wrap gap-2.5">
                  <ActionButton
                    variant="primary"
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    loading={decide.isPending}
                    onClick={() => void approve()}
                  >
                    Approve
                  </ActionButton>
                  <ActionButton
                    variant="danger"
                    icon={<XCircle className="h-4 w-4" />}
                    onClick={() => setMode("reject")}
                  >
                    Reject
                  </ActionButton>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-foreground">
                    Reason shown to the applicant
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value as KycRejectionReason)}
                      className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground"
                    >
                      <option value="">Choose a reason…</option>
                      {KYC_REJECTION_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {KYC_REJECTION_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-semibold text-foreground">
                    Additional detail (optional, shown to the applicant)
                    <textarea
                      value={reasonDetail}
                      onChange={(e) => setReasonDetail(e.target.value)}
                      maxLength={500}
                      rows={2}
                      className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    <ActionButton
                      variant="danger"
                      icon={<XCircle className="h-4 w-4" />}
                      loading={decide.isPending}
                      onClick={() => void reject()}
                    >
                      Confirm rejection
                    </ActionButton>
                    <ActionButton variant="ghost" onClick={() => setMode("idle")}>
                      Cancel
                    </ActionButton>
                  </div>
                </div>
              )}

              <label className="block text-sm font-semibold text-foreground">
                Reviewer note (optional, never shown to the applicant)
                <textarea
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  maxLength={2000}
                  rows={2}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground"
                />
              </label>
            </div>
          )}
        </Panel>
      ) : null}

      <p className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Identity fields are decrypted only for this screen and only while you have it open. Opening this case and
        every document link is recorded against your name in the audit trail.
      </p>
    </div>
  );
}
