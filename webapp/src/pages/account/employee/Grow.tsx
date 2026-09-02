import { Gauge } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel, ProgressMeter } from "@/components/dashboard/Panel";
import { useCreditScore } from "@/lib/account/session";
import { CreditScoreSection } from "@/pages/account/AccountHome";

const SCORE_MIN = 300;
const SCORE_MAX = 850;

/**
 * Real employee Grow — `/account/employee/grow`. The demo's Grow page pairs
 * a wellbeing score with lessons, recommendations and a spend-pattern chart
 * — none of which have a real model behind them (no wellbeing score, no
 * lesson content, no behavioural-pattern analysis anywhere in this system).
 * What's real is the PayBridge Score, so this stays focused on that,
 * presented with the same visual weight the demo gives its own score.
 */
export default function EmployeeGrow() {
  const score = useCreditScore(true);
  const value = score.data ? ((score.data.score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Learn" description="Your PayBridge Score, and what it's built from." />

      {score.data ? (
        <Panel title="Where you stand" icon={<Gauge className="h-5 w-5 text-primary" />}>
          <ProgressMeter value={value} label={`${SCORE_MIN}–${SCORE_MAX} range`} right={`${score.data.score} · ${score.data.band}`} tone="primary" />
        </Panel>
      ) : null}

      <CreditScoreSection />
    </div>
  );
}
