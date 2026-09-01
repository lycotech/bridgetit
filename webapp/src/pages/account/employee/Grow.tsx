import { PageHeader } from "@/components/dashboard/PageHeader";
import { CreditScoreSection } from "@/pages/account/AccountHome";

/**
 * Real employee Grow — `/account/employee/grow`. The demo's Grow page pairs
 * a wellbeing score with the AI Assist widget; the real product has no
 * wellbeing-score model, so this stays to what's real: the PayBridge Score.
 * The AI Assist widgets themselves are global now (see RealDashboardShell),
 * not scoped to this one page.
 */
export default function EmployeeGrow() {
  return (
    <div className="space-y-6">
      <PageHeader title="Grow" description="Your PayBridge Score, and how it's built." />
      <CreditScoreSection />
    </div>
  );
}
