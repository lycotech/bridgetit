import type { ReactNode } from "react";
import { Radio, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InvestorSessionGate } from "@/components/investor/InvestorSessionGate";

/**
 * Splits a mock `/investor/*` demo page into two tabs: the existing demo data
 * (unchanged, what a prospect sees on an instant demo invitation) and a live
 * tab reading real PayBridge data, unlocked only behind a real, active
 * capital-partner account sign-in.
 *
 * Sibling to `components/operations/LiveModeTabs.tsx` and
 * `components/employer/LiveModeTabs.tsx` — same shape, gated by
 * `InvestorSessionGate` instead.
 */
export function LiveModeTabs({
  demo,
  live,
  gateTitle,
  gateDescription,
}: {
  demo: ReactNode;
  live: ReactNode;
  gateTitle: string;
  gateDescription: string;
}) {
  return (
    <Tabs defaultValue="demo">
      <TabsList>
        <TabsTrigger value="demo" className="gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Demo data
        </TabsTrigger>
        <TabsTrigger value="live" className="gap-1.5">
          <Radio className="h-3.5 w-3.5" />
          Live data
        </TabsTrigger>
      </TabsList>

      <TabsContent value="demo" className="mt-6 space-y-6">
        {demo}
      </TabsContent>

      <TabsContent value="live" className="mt-6 space-y-6">
        <InvestorSessionGate title={gateTitle} description={gateDescription}>
          {live}
        </InvestorSessionGate>
      </TabsContent>
    </Tabs>
  );
}
