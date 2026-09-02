import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BookOpen, Check, Gauge, HeartPulse, Lightbulb, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, ProgressMeter, SummaryRow, InfoNote, Divider } from "@/components/dashboard/Panel";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { AsyncPanel, LoadingPanel } from "@/components/dashboard/states";
import { BarSeries, TrendChart } from "@/components/dashboard/charts";
import { employeeApi, qk } from "@/lib/platform/mock-service";
import { longDate, naira } from "@/lib/platform/format";
import { useAccountId } from "@/lib/platform/use-account";
import type { Pillar } from "@/lib/platform/models";

const PILLAR_TONE: Record<Pillar, "primary" | "available" | "protected" | "gold"> = {
  Bridge: "primary",
  Save: "protected",
  Invest: "available",
  Grow: "gold",
};

/** Demo internal score, 300-850 — not a bureau-reported credit score. */
function creditScoreBand(score: number): string {
  if (score >= 750) return "Excellent";
  if (score >= 650) return "Good";
  if (score >= 550) return "Fair";
  return "Building";
}

export default function EmployeeGrowPage() {
  const employeeId = useAccountId("employee");
  const queryClient = useQueryClient();

  const report = useQuery({
    queryKey: qk.employeeWellbeing(employeeId),
    queryFn: () => employeeApi.wellbeing(employeeId),
  });
  const pattern = useQuery({
    queryKey: ["employee", "spend-pattern"],
    queryFn: () => employeeApi.spendPattern(),
  });
  const overview = useQuery({
    queryKey: qk.employeeOverview(employeeId),
    queryFn: () => employeeApi.overview(employeeId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: qk.employeeWellbeing(employeeId) });
    void queryClient.invalidateQueries({ queryKey: qk.employeeOverview(employeeId) });
  };

  const completeLesson = useMutation({
    mutationFn: (moduleId: string) => employeeApi.completeLesson(moduleId),
    onSuccess: () => {
      invalidate();
      toast.success("Lesson finished");
    },
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => employeeApi.dismissRecommendation(id),
    onSuccess: () => invalidate(),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Learn"
        title="Your financial wellbeing"
        description="What your money habits are telling us, what would help most next, and the short lessons behind each suggestion. The aim is a calmer month — not more Bridge."
      />

      <AsyncPanel query={report}>
        {(data) => (
          <div className="space-y-6">
            <StatGrid columns={4}>
              <StatCard
                label="Wellbeing score"
                value={`${data.score}/100`}
                hint={`${data.band} — across Bridge, Save, Invest and Grow`}
                tone="primary"
                icon={<HeartPulse className="h-4 w-4" />}
              />
              <StatCard
                label="Credit score"
                value={overview.data ? `${overview.data.employee.creditScore}` : "—"}
                hint={overview.data ? `${creditScoreBand(overview.data.employee.creditScore)} · PayBridge internal score` : "Loading"}
                tone="success"
                icon={<Gauge className="h-4 w-4" />}
              />
              <StatCard
                label="Service fees avoided"
                value={naira(data.feesAvoided)}
                hint="As your monthly Bridge amounts came down"
                tone="protected"
              />
              <StatCard
                label="Lessons finished"
                value={`${data.learning.filter((m) => m.progressPct >= 100).length}/${data.learning.length}`}
                icon={<BookOpen className="h-4 w-4" />}
              />
            </StatGrid>

            <Panel
              title="Where you stand across the four pillars"
              description="Each one is a guide, never a score you can fail."
            >
              <div className="space-y-5">
                {data.pillars.map((pillar) => (
                  <div key={pillar.pillar}>
                    <ProgressMeter
                      value={pillar.score}
                      label={pillar.pillar}
                      right={`${pillar.score}/100`}
                      tone={PILLAR_TONE[pillar.pillar]}
                    />
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{pillar.summary}</p>
                  </div>
                ))}
              </div>
            </Panel>

            {data.recommendations.length > 0 ? (
              <Panel
                title="What would help most next"
                description="Suggestions that reduce how much Bridge you need come first."
              >
                <ul className="space-y-4">
                  {data.recommendations.map((rec) => (
                    <li key={rec.id} className="rounded-2xl border border-border bg-secondary/30 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                              {rec.pillar}
                            </span>
                            {rec.reducesBridgeUse ? (
                              <span className="rounded-full border border-protected/40 bg-protected/10 px-2 py-0.5 text-[11px] font-medium text-foreground">
                                Could mean less Bridge
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm font-semibold text-foreground">{rec.title}</p>
                          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{rec.body}</p>
                          <p className="mt-2 text-xs font-medium text-primary">{rec.impact}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => dismiss.mutate(rec.id)}
                          aria-label={`Hide: ${rec.title}`}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-3">
                        <ActionButton to={rec.actionTo} variant="secondary">
                          {rec.actionLabel}
                        </ActionButton>
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : (
              <Panel title="What would help most next">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Nothing outstanding right now. We will let you know when your patterns change.
                </p>
              </Panel>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              <Panel
                title="What we noticed"
                description="Drawn from your own activity. Never shared with your employer."
              >
                <div className="space-y-4">
                  {data.insights.map((insight, index) => (
                    <div key={insight.id}>
                      {index > 0 ? <Divider className="mb-4" /> : null}
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Lightbulb className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{insight.body}</p>
                          <p className="mt-1.5 text-[11px] text-muted-foreground/80">
                            Noticed {longDate(insight.observedAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel
                title="Your Bridge amounts over time"
                description="The number PayBridge wants to see fall as your cushion grows."
              >
                <TrendChart data={data.bridgeTrend} height={200} tone="primary" />
                <div className="mt-4 divide-y divide-border/70">
                  <SummaryRow
                    label="This month"
                    value={naira(data.bridgeTrend[data.bridgeTrend.length - 1]?.value ?? 0)}
                    tone="primary"
                  />
                  <SummaryRow
                    label="Six months ago"
                    value={naira(data.bridgeTrend[0]?.value ?? 0)}
                    tone="muted"
                  />
                </div>
              </Panel>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title="Short lessons" description="A few minutes each. Plain language, no jargon.">
                <ul className="space-y-4">
                  {data.learning.map((module) => (
                    <li key={module.id} className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">{module.title}</p>
                          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            {module.category} · {module.minutes} min
                          </p>
                        </div>
                        {module.progressPct >= 100 ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-protected/40 bg-protected/10 px-2.5 py-1 text-[11px] font-semibold text-foreground">
                            <Check className="h-3 w-3" /> Finished
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{module.summary}</p>
                      <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-foreground">
                        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                        {module.takeaway}
                      </p>
                      <ProgressMeter
                        className="mt-3"
                        value={module.progressPct}
                        label="Progress"
                        right={`${module.progressPct}%`}
                        tone="gold"
                      />
                      {module.progressPct < 100 ? (
                        <div className="mt-3">
                          <ActionButton
                            variant="secondary"
                            loading={completeLesson.isPending && completeLesson.variables === module.id}
                            onClick={() => completeLesson.mutate(module.id)}
                          >
                            {module.progressPct > 0 ? "Continue lesson" : "Start lesson"}
                          </ActionButton>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Panel>

              <div className="space-y-6">
                <Panel
                  title="When money tends to be needed"
                  description="A general pattern across employees like you."
                >
                  {pattern.isLoading ? (
                    <LoadingPanel />
                  ) : (
                    <BarSeries
                      data={pattern.data ?? []}
                      height={200}
                      tone="available"
                      format={(value) => `${value}%`}
                    />
                  )}
                  <InfoNote className="mt-4">
                    This is a general pattern, not your personal spending. PayBridge never shares what you spend
                    with your employer.
                  </InfoNote>
                </Panel>

                <Panel title="Plan your next month" description="Two tools, both built from your own numbers.">
                  <ul className="space-y-3">
                    <li className="rounded-2xl border border-border bg-secondary/30 p-4">
                      <p className="text-sm font-semibold text-foreground">Cushion planner</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        See what setting aside a little more each payday would do to the tight week.
                      </p>
                      <Link
                        to="/employee/savings"
                        className="mt-2 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline"
                      >
                        Open Save →
                      </Link>
                    </li>
                    <li className="rounded-2xl border border-border bg-secondary/30 p-4">
                      <p className="text-sm font-semibold text-foreground">Where should this money sit?</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        Money you need this month belongs in savings. Money you will not touch for years can work
                        harder.
                      </p>
                      <Link
                        to="/employee/invest"
                        className="mt-2 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline"
                      >
                        Open Invest →
                      </Link>
                    </li>
                  </ul>
                </Panel>
              </div>
            </div>

            <InfoNote>
              Insights and suggestions are generated from your own activity to support your financial wellbeing.
              They are not investment advice. Where a suggestion involves a savings or investment product, the
              product terms and applicable disclosures apply.
            </InfoNote>
          </div>
        )}
      </AsyncPanel>
    </div>
  );
}
