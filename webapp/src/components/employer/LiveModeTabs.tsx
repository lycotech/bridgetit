import type { ReactNode } from "react";
import { Radio, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmployerSessionGate } from "@/components/employer/EmployerSessionGate";

/**
 * Splits a mock `/employer/*` demo page into two tabs: the existing demo data
 * (unchanged, what a prospect sees on an instant demo invitation) and a live
 * tab reading real PayBridge data, unlocked only behind a real company
 * (employer-portal) sign-in.
 *
 * Sibling to `components/operations/LiveModeTabs.tsx` — same reasoning, same
 * shape, but gated by a real employer session rather than a staff session,
 * because the data behind these pages belongs to one company's own account
 * rather than to PayBridge staff.
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
        <EmployerSessionGate title={gateTitle} description={gateDescription}>
          {live}
        </EmployerSessionGate>
      </TabsContent>
    </Tabs>
  );
}
