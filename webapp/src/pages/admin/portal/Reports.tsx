import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow, Divider } from "@/components/dashboard/Panel";
import { AsyncPanel, LoadingRows } from "@/components/dashboard/states";
import { useReportsOverview } from "@/lib/admin/reports";

const naira = (v: number) => `₦${v.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;

/**
 * Reports — Admin → Reports.
 *
 * Every figure here is a portfolio-wide aggregate computed live from real
 * data (backend/src/routes/admin-reports.ts) — no individual employer,
 * employee or investor is named on this page. That is what makes `reports.
 * view` safe to grant to more roles than `risk.view`/`kyc.view`.
 */
export default function AdminReports() {
  const overview = useReportsOverview();

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Portfolio"
        title="Reports"
        description="Real aggregates across employers, payroll, credit exposure and Bridge activity. No individual customer detail."
      />

      <AsyncPanel query={overview} loading={<LoadingRows rows={8} />}>
        {(data) => (
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Employers" icon={<BarChart3 className="h-4 w-4" />}>
              <div className="space-y-1">
                {data.employersByStatus.map((r) => (
                  <SummaryRow key={r.status} label={r.status} value={r.count} />
                ))}
              </div>
              {data.employersByTier.length > 0 ? (
                <>
                  <Divider className="my-2" />
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">By tier</p>
                  {data.employersByTier.map((r) => (
                    <SummaryRow key={r.tier} label={`Tier ${r.tier}`} value={r.count} />
                  ))}
                </>
              ) : null}
            </Panel>

            <Panel title="KYC funnel">
              <div className="space-y-1">
                {data.kycFunnel.map((r) => (
                  <SummaryRow key={r.status} label={r.status.replace(/_/g, " ")} value={r.count} />
                ))}
              </div>
            </Panel>

            <Panel title="Credit exposure">
              <div className="space-y-1">
                <SummaryRow label="Total approved exposure" value={naira(data.totalApprovedExposure)} emphasis />
                <SummaryRow label="Available capacity remaining" value={naira(data.totalAvailableExposure)} />
              </div>
            </Panel>

            <Panel title="Payroll">
              <div className="space-y-1">
                <SummaryRow label="Cycles processed" value={data.payrollCyclesProcessed} />
                <SummaryRow label="Total payroll value" value={naira(data.totalPayrollProcessed)} />
              </div>
            </Panel>

            <Panel title="Bridge draws">
              <div className="space-y-1">
                <SummaryRow label="Total requested" value={data.bridgeDraws.requested} />
                <SummaryRow label="Approved" value={data.bridgeDraws.approved} />
                <SummaryRow label="Rejected" value={data.bridgeDraws.rejected} />
                <SummaryRow label="Approved volume" value={naira(data.bridgeDraws.approvedVolume)} emphasis />
              </div>
            </Panel>

            <Panel title="Savings & investments">
              <div className="space-y-1">
                <SummaryRow label="Total savings balance" value={naira(data.savingsTotalBalance)} />
                <SummaryRow label="Total capital committed" value={naira(data.investmentsTotalCommitted)} />
              </div>
            </Panel>
          </div>
        )}
      </AsyncPanel>
    </div>
  );
}
