import { Construction } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";

/**
 * Placeholder for a real page that matches the mock demo's navigation but
 * isn't wired to real data yet. Deliberately honest, not decorative: never
 * show a real logged-in customer an invented number, so this states plainly
 * that the feature isn't available rather than reusing the demo's fictional
 * content. Same layout/chrome as every other real page — only the body
 * differs — so the sidebar and header stay a full replica of the demo from
 * day one while each page's real data lands incrementally.
 */
export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <Panel
        tone="info"
        icon={<Construction className="h-5 w-5 text-primary" />}
        title="Not available yet"
      >
        <p>
          This part of your real account is still being built. It isn&apos;t hidden — it just doesn&apos;t have real
          data behind it yet, so there&apos;s nothing honest to show here today.
        </p>
      </Panel>
    </div>
  );
}
