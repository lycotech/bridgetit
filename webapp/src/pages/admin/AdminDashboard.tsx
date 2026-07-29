import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminApi, adminKeys } from "@/lib/admin";
import { useNoIndex } from "@/lib/use-noindex";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { StatTiles } from "@/components/admin/StatTiles";
import { RegistrationsPanel } from "@/components/admin/RegistrationsPanel";
import { InvitationsPanel } from "@/components/admin/InvitationsPanel";
import { AccessLogPanel } from "@/components/admin/AccessLogPanel";

/**
 * The internal dashboard, at an unlinked path (/paybridge-admin).
 *
 * Three layers keep it private, in order of how much they actually matter:
 *   1. the server refuses every /api/admin/* call without an admin session —
 *      this is the real control;
 *   2. nothing renders here until that session is confirmed, so an unauthorised
 *      visitor sees only a sign-in card;
 *   3. it is absent from the navigation, the sitemap and the search index.
 *
 * Layer 3 is housekeeping. Layer 1 is the security boundary.
 */
const AdminConsole = ({ username }: { username: string }) => {
  const queryClient = useQueryClient();
  const [segment, setSegment] = useState("");

  const stats = useQuery({ queryKey: adminKeys.stats, queryFn: adminApi.stats });
  const vocabulary = useQuery({
    queryKey: adminKeys.vocabulary,
    queryFn: adminApi.vocabulary,
    staleTime: 60 * 60 * 1000,
  });

  const logout = useMutation({
    mutationFn: adminApi.logout,
    onSuccess: async () => {
      // Drop every cached admin response, not just the session: the caches hold
      // registrant personal data and must not survive a sign-out.
      queryClient.removeQueries({ queryKey: ["admin"] });
      await queryClient.invalidateQueries({ queryKey: adminKeys.session });
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-5 md:px-8">
          <div className="flex items-center gap-3">
            <Logo className="h-8" />
            <span className="hidden rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground sm:inline">
              Internal
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{username}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-5 py-8 md:px-8">
        <h1 className="font-display text-2xl font-extrabold text-foreground">
          Registrations and pilot pipeline
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Expressions of interest only. Nobody listed here has been verified, approved or onboarded.
        </p>

        <div className="mt-6">
          <StatTiles stats={stats.data} activeSegment={segment} onSelectSegment={setSegment} />
        </div>

        <Tabs defaultValue="registrations" className="mt-8">
          <TabsList>
            <TabsTrigger value="registrations">Registrations</TabsTrigger>
            <TabsTrigger value="invitations">Demo invitations</TabsTrigger>
            <TabsTrigger value="access">Access log</TabsTrigger>
          </TabsList>

          <TabsContent value="registrations" className="mt-6">
            <RegistrationsPanel
              segment={segment}
              onSegmentChange={setSegment}
              vocabulary={vocabulary.data}
            />
          </TabsContent>

          <TabsContent value="invitations" className="mt-6">
            <InvitationsPanel />
          </TabsContent>

          <TabsContent value="access" className="mt-6">
            <AccessLogPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

const AdminDashboard = () => {
  useNoIndex();
  const { data, isPending } = useQuery({
    queryKey: adminKeys.session,
    queryFn: adminApi.session,
    staleTime: 0,
    retry: false,
  });

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.authenticated || !data.username) return <AdminLogin />;

  return <AdminConsole username={data.username} />;
};

export default AdminDashboard;
