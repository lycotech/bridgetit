import { FileText } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";

/**
 * Real investor Statements — `/account/investor/statements`. No statement
 * generator exists in this system yet — honest placeholder, not the demo's
 * sample documents.
 */
export default function InvestorStatements() {
  return (
    <div className="space-y-6">
      <PageHeader title="Statements" description="Portfolio statements and tax documents." />
      <Panel tone="info" icon={<FileText className="h-5 w-5 text-primary" />} title="Not available yet">
        <p>
          PayBridge doesn't yet generate statements or tax documents. Your real commitment history is always
          available on the Transactions page in the meantime.
        </p>
      </Panel>
    </div>
  );
}
