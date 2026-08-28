import type { ReactNode } from "react";
import { Radio, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminSessionGate } from "@/components/admin/AdminSessionGate";

/**
 * Splits an operations page into two tabs: the existing demo data (unchanged,
 * what a prospect sees on an instant demo invitation) and a live tab reading
 * real PayBridge data, unlocked only behind a real staff sign-in.
 *
 * WHY a tab rather than a straight swap: the mock `/operations/*` pages stay
 * reachable through the same instant demo login prospects already use for the
 * employer/investor demos. Replacing their data source outright would either
 * break that walkthrough or leak real registrant/KYC PII to a demo guest.
 * Keeping both means a prospect still sees a full, realistic queue, and a real
 * staff member gets the same screen backed by the real database once they sign
 * in with real credentials — the exact gate `operations/DemoAccess.tsx` already
 * uses for issuing invitations, reused here for viewing data instead.
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
        <AdminSessionGate title={gateTitle} description={gateDescription}>
          {live}
        </AdminSessionGate>
      </TabsContent>
    </Tabs>
  );
}
