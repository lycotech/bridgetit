import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileText, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow, InfoNote } from "@/components/dashboard/Panel";
import { AsyncPanel } from "@/components/dashboard/states";
import { Stepper } from "@/components/dashboard/Stepper";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { UploadDropzone } from "@/components/dashboard/forms";
import type { SimulatedFile } from "@/components/dashboard/forms";
import { InvestorDisclosure } from "@/components/investor/Disclosures";
import { investorApi, qk } from "@/lib/platform/mock-service";
import { shortDate } from "@/lib/platform/format";
import { useAccountId } from "@/lib/platform/use-account";

const KYB_STEPS = ["Details", "Documents", "Review", "Verified"];

const REQUIRED = [
  { category: "Certificate of incorporation", note: "CAC certificate or equivalent" },
  { category: "Board resolution", note: "Authorising the investment" },
  { category: "Directors' identification", note: "Valid ID for each signatory" },
  { category: "Proof of address", note: "Utility bill or bank statement, under three months old" },
  { category: "Source of funds", note: "Bank statement or audited accounts" },
];

const MANDATE_DOCS = [
  { title: "Information memorandum", detail: "Mandate objectives, strategy and risks" },
  { title: "Subscription agreement", detail: "Terms of your commitment" },
  { title: "Fee schedule", detail: "Management and performance fees in full" },
  { title: "Risk disclosure statement", detail: "How capital may be at risk" },
];

function stepForStatus(status: string): number {
  if (status === "Verified") return 3;
  if (status === "Submitted" || status === "In review") return 2;
  return 1;
}

export default function InvestorDocumentsPage() {
  const investorId = useAccountId("investor");
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<SimulatedFile[]>([]);

  const overview = useQuery({
    queryKey: qk.investorOverview(investorId),
    queryFn: () => investorApi.overview(investorId),
  });

  const submit = useMutation({
    mutationFn: () =>
      investorApi.submitKyb(
        investorId,
        files.map((file) => ({ name: file.name, category: file.category })),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.investorOverview(investorId) });
      setFiles([]);
      toast.success("Documents submitted for review");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "We could not submit those documents"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Documents"
        title="Verification and mandate documents"
        description="Complete your KYB once, then access every mandate document in one place."
      />

      <AsyncPanel query={overview}>
        {(data) => {
          const verified = data.investor.kybStatus === "Verified";
          return (
            <div className="space-y-6">
              <Panel
                title="Know Your Business verification"
                description="Required before capital can be committed."
              >
                <Stepper steps={KYB_STEPS} current={stepForStatus(data.investor.kybStatus)} className="mb-5" />
                <div className="divide-y divide-border/70">
                  <SummaryRow label="Investor" value={data.investor.name} />
                  <SummaryRow label="Investor type" value={data.investor.type} />
                  <SummaryRow label="Accreditation" value={data.investor.accreditation} />
                  <SummaryRow label="Status" value={<StatusBadge status={data.investor.kybStatus} />} />
                  <SummaryRow label="On file since" value={shortDate(data.investor.joinedAt)} />
                </div>

                {verified ? (
                  <InfoNote tone="primary" className="mt-4">
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Verification complete
                    </span>{" "}
                    — your documents are on file. We will contact you if anything needs refreshing.
                  </InfoNote>
                ) : (
                  <div className="mt-5 space-y-4">
                    <ul className="grid gap-2.5 sm:grid-cols-2">
                      {REQUIRED.map((item) => (
                        <li
                          key={item.category}
                          className="rounded-2xl border border-border bg-secondary/30 p-3.5"
                        >
                          <p className="text-sm font-semibold text-foreground">{item.category}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{item.note}</p>
                        </li>
                      ))}
                    </ul>
                    <UploadDropzone
                      label="Upload your documents"
                      hint="PDF or image. You can upload several at once."
                      category="KYB"
                      files={files}
                      onFilesChange={setFiles}
                    />
                    {files.length > 0 ? (
                      <ul className="space-y-2">
                        {files.map((file) => (
                          <li
                            key={file.name}
                            className="flex items-center gap-2.5 rounded-xl border border-border px-3.5 py-2.5 text-xs text-muted-foreground"
                          >
                            <FileText className="h-3.5 w-3.5 text-primary" />
                            <span className="truncate text-foreground">{file.name}</span>
                            <span className="ml-auto tnum">{file.sizeKb} KB</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <ActionButton
                      loading={submit.isPending}
                      disabled={files.length === 0}
                      onClick={() => submit.mutate()}
                    >
                      Submit for review
                    </ActionButton>
                  </div>
                )}
              </Panel>

              <Panel title="Mandate documents" description="The full terms for every PayBridge portfolio.">
                <ul className="space-y-2.5">
                  {MANDATE_DOCS.map((doc) => (
                    <li key={doc.title} className="flex items-center gap-3.5 rounded-2xl border border-border p-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                        <FileText className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">{doc.title}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{doc.detail}</span>
                      </span>
                      <ActionButton
                        size="sm"
                        variant="secondary"
                        onClick={() => toast.info("Mandate documents are issued once the mandate is approved")}
                      >
                        Request
                      </ActionButton>
                    </li>
                  ))}
                </ul>
                <InfoNote tone="primary" className="mt-4">
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Before launch
                  </span>{" "}
                  — the regulated entity managing investor capital will be named in these documents, together
                  with the appointed custodian.
                </InfoNote>
              </Panel>

              <InvestorDisclosure />
            </div>
          );
        }}
      </AsyncPanel>
    </div>
  );
}
