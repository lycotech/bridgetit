import { useState } from "react";
import { AlertTriangle, Gauge, RefreshCw, ShieldAlert } from "lucide-react";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow, Divider, InfoNote } from "@/components/dashboard/Panel";
import { AsyncPanel, EmptyState, LoadingRows } from "@/components/dashboard/states";
import { adminCan, useAdminSession } from "@/lib/admin/portal-session";
import {
  authorityFromError,
  useCalculateScore,
  useDecisions,
  useEmployerDraws,
  useEmployerLimits,
  useRecordDecision,
  useRiskEmployers,
  useRiskScore,
  useSecondDecision,
} from "@/lib/admin/risk";

const TIER_TONE: Record<string, string> = {
  A: "border-success/40 bg-success/10 text-success",
  B: "border-protected/40 bg-protected/10 text-protected",
  C: "border-gold/40 bg-gold/10 text-gold",
  D: "border-amber-500/40 bg-amber-500/10 text-amber-500",
  E: "border-destructive/40 bg-destructive/10 text-destructive",
};

const naira = (v: number | null) =>
  v === null ? "—" : `₦${v.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;

/**
 * Credit risk — Admin → Credit risk.
 *
 * The first real caller of the eir/risk engine (policy/identity/financial/
 * payroll/behavioural/compliance/industry/knockouts/limits/score.ts). See
 * backend/src/routes/admin-risk.ts's header for exactly what is and is not
 * covered — notably, the full 19-stage application workflow is NOT enforced
 * here, and the authority matrix ships unconfigured (every threshold null),
 * so most decisions will correctly report "no authority configured" until
 * someone builds a policy-editor screen.
 */
export default function CreditRisk() {
  const session = useAdminSession();
  const canDecide = adminCan(session.data, "risk.decide");

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const employers = useRiskEmployers(search);
  const score = useRiskScore(selected);
  const decisions = useDecisions(selected);
  const limits = useEmployerLimits(selected);
  const draws = useEmployerDraws(selected);
  const calculate = useCalculateScore();
  const recordDecision = useRecordDecision();
  const second = useSecondDecision();

  const [reason, setReason] = useState("");
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [authorityNote, setAuthorityNote] = useState<string | null>(null);

  async function decide(decision: "approve" | "decline") {
    if (!selected) return;
    setDecisionError(null);
    setAuthorityNote(null);
    if (!reason.trim()) {
      setDecisionError("Give a reason for this decision.");
      return;
    }
    try {
      await recordDecision.mutateAsync({ employerId: selected, decision, reason });
      setReason("");
    } catch (err) {
      const authority = authorityFromError(err);
      if (authority) {
        setAuthorityNote(
          `${authority.explanation} Required: ${authority.requiredLevelLabel}${authority.dualApprovalRequired ? " (needs a second approver)" : ""}.`,
        );
      }
      setDecisionError(err instanceof Error ? err.message : "That decision could not be recorded.");
    }
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Underwriting"
        title="Credit risk"
        description="Score an employer against the credit policy, review knockouts and limit recommendations, and record a decision."
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Panel title="Employers" bodyClassName="space-y-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or industry"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground"
          />
          <AsyncPanel query={employers} loading={<LoadingRows rows={5} />}>
            {(data) =>
              data.items.length === 0 ? (
                <EmptyState icon={<Gauge className="h-5 w-5" />} title="No employers" body="No company matches this search." />
              ) : (
                <ul className="space-y-2">
                  {data.items.map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(e.id)}
                        className={`w-full rounded-2xl border px-3.5 py-3 text-left transition-colors ${
                          selected === e.id ? "border-primary/60 bg-primary/[0.06]" : "border-border bg-card/60 hover:border-border/80"
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-foreground">{e.registeredName}</span>
                          {e.currentTier ? (
                            <span
                              className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${TIER_TONE[e.currentTier] ?? ""}`}
                            >
                              Tier {e.currentTier}
                            </span>
                          ) : (
                            <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                              Not scored
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {e.status} · {e.industry ?? "No industry set"}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {e.teamMemberCount} team · {e.rosterCount} employees
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            }
          </AsyncPanel>
        </Panel>

        <div className="space-y-5">
          {!selected ? (
            <Panel title="No employer selected" description="Choose one from the list to score it." />
          ) : (
            <>
              {(() => {
                const employer = employers.data?.items.find((e) => e.id === selected);
                if (!employer) return null;
                return (
                  <Panel title={employer.registeredName} description="Company profile — real team seats and payroll roster size.">
                    <div className="space-y-1">
                      <SummaryRow label="Status" value={employer.status} />
                      <SummaryRow label="Industry" value={employer.industry ?? "Not set"} />
                      <SummaryRow label="Employer Portal team seats" value={String(employer.teamMemberCount)} />
                      <SummaryRow label="Payroll roster (real, uploaded)" value={String(employer.rosterCount)} />
                    </div>
                  </Panel>
                );
              })()}
              <AsyncPanel query={score} loading={<LoadingRows rows={6} />}>
              {(data) => (
                <div className="space-y-5">
                  <Panel
                    title={data ? `Score: ${data.totalScore} — Tier ${data.tier}` : "Not yet scored"}
                    description={data?.explanation}
                    action={
                      <ActionButton
                        size="sm"
                        icon={<RefreshCw className="h-3.5 w-3.5" />}
                        loading={calculate.isPending}
                        onClick={() => selected && calculate.mutate(selected)}
                      >
                        {data ? "Recalculate" : "Calculate score"}
                      </ActionButton>
                    }
                  >
                    {!data ? (
                      <p className="text-sm text-muted-foreground">
                        No score has been calculated for this employer yet. Calculating reads real employer, payroll, director
                        and compliance data — most of which is still incomplete for a freshly onboarded company, so a thin
                        score is expected, not a bug.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        <SummaryRow label="Recommended route" value={data.recommendedRoute.replace(/_/g, " ")} />
                        <SummaryRow label="Decision permitted" value={data.decisionPermitted ? "Yes" : "No"} />
                        <SummaryRow
                          label="Data completeness"
                          value={`${Math.round(data.dataCompleteness.percent)}%${data.dataCompleteness.sufficientForDecision ? "" : " (thin)"}`}
                        />
                      </div>
                    )}
                  </Panel>

                  {data ? (
                    <>
                      <Panel title="Score components">
                        <div className="space-y-2">
                          {data.components.map((c) => (
                            <div key={c.component} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">{c.label}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {c.classification.replace(/_/g, " ")} · weight {c.weight.toFixed(0)}%
                                  {c.dataInsufficient ? " · insufficient data" : ""}
                                </p>
                              </div>
                              <span className="shrink-0 text-sm font-bold tnum text-foreground">{c.rawScore}</span>
                            </div>
                          ))}
                        </div>
                      </Panel>

                      <Panel
                        title={`Knockouts (${data.knockouts.triggeredCount} triggered)`}
                        description={data.knockouts.blocked ? "Blocked — no decision can be recorded." : undefined}
                      >
                        {data.knockouts.evaluations.filter((k) => k.triggered).length === 0 ? (
                          <p className="text-sm text-muted-foreground">All rules passed.</p>
                        ) : (
                          <ul className="space-y-2">
                            {data.knockouts.evaluations
                              .filter((k) => k.triggered)
                              .map((k) => (
                                <li key={k.ruleKey} className="rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5">
                                  <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                    <ShieldAlert className="h-4 w-4 text-destructive" />
                                    {k.label}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">{k.evidence}</p>
                                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-destructive">
                                    {k.consequence?.replace(/_/g, " ")} {k.overridable ? "· overridable" : "· not overridable"}
                                  </p>
                                </li>
                              ))}
                          </ul>
                        )}
                      </Panel>

                      <Panel title="Recommended limits" description={data.limits.noLimitReason ?? undefined}>
                        {data.limits.products.filter((p) => p.offered).length === 0 ? (
                          <p className="text-sm text-muted-foreground">No products recommended at this tier.</p>
                        ) : (
                          <div className="space-y-1">
                            {data.limits.products
                              .filter((p) => p.offered)
                              .map((p) => (
                                <SummaryRow key={p.product} label={p.product.replace(/_/g, " ")} value={p.displayLimit} hint={p.reason} />
                              ))}
                            <Divider className="my-2" />
                            <SummaryRow label="Total recommended exposure" value={naira(data.limits.totalRecommendedExposure)} emphasis />
                          </div>
                        )}
                      </Panel>

                      <Panel title="Decision">
                        {!canDecide ? (
                          <InfoNote tone="neutral">Your role can view this score but cannot record a decision.</InfoNote>
                        ) : (
                          <div className="space-y-3">
                            <label className="block text-sm font-semibold text-foreground">
                              Reason
                              <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows={2}
                                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground"
                              />
                            </label>
                            {decisionError ? (
                              <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                {decisionError}
                              </p>
                            ) : null}
                            {authorityNote ? <InfoNote tone="attention">{authorityNote}</InfoNote> : null}
                            <div className="flex flex-wrap gap-2.5">
                              <ActionButton
                                variant="primary"
                                loading={recordDecision.isPending}
                                onClick={() => void decide("approve")}
                              >
                                Approve
                              </ActionButton>
                              <ActionButton
                                variant="danger"
                                loading={recordDecision.isPending}
                                onClick={() => void decide("decline")}
                              >
                                Decline
                              </ActionButton>
                            </div>
                          </div>
                        )}
                      </Panel>

                      {decisions.data?.items.length ? (
                        <Panel title="Decision history">
                          <ul className="space-y-2">
                            {decisions.data.items.map((d) => (
                              <li key={d.id} className="rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5">
                                <p className="text-sm font-semibold text-foreground">
                                  {d.decision} by {d.decidedByLabel} ({d.authorityLevel.replace(/_/g, " ")})
                                </p>
                                <p className="mt-0.5 text-xs text-muted-foreground">{d.reason}</p>
                                {!d.finalised ? (
                                  <div className="mt-2 flex items-center gap-2">
                                    <span className="text-xs font-semibold text-gold">Awaiting a second approver</span>
                                    {canDecide ? (
                                      <ActionButton
                                        size="sm"
                                        variant="ghost"
                                        loading={second.isPending}
                                        onClick={() => selected && second.mutate({ employerId: selected, decisionId: d.id })}
                                      >
                                        Second this decision
                                      </ActionButton>
                                    ) : null}
                                  </div>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </Panel>
                      ) : null}
                    </>
                  ) : null}
                </div>
              )}
            </AsyncPanel>
            </>
          )}

          {selected && limits.data?.items.length ? (
            <Panel
              title="Active facilities"
              description="Real-time capacity — the ceiling every Bridge draw request checks against."
            >
              <div className="space-y-1">
                {limits.data.items.map((l) => (
                  <SummaryRow
                    key={l.id}
                    label={`${l.product.replace(/_/g, " ")} (${l.status})`}
                    value={`${naira(l.availableAmount)} of ${naira(l.approvedAmount)} available`}
                  />
                ))}
              </div>
            </Panel>
          ) : null}

          {selected && draws.data?.items.length ? (
            <Panel
              title="Bridge draw activity"
              description="Individual employee draws — staff-only. Employers only ever see the aggregate."
            >
              <ul className="space-y-2">
                {draws.data.items.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{d.reference}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {d.status}
                        {d.rejectionReason ? ` — ${d.rejectionReason}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-bold tnum text-foreground">{naira(d.requestedAmount)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
