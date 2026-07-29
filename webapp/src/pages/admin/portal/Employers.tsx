import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { RegistrationsPanel } from "@/components/admin/RegistrationsPanel";
import { adminApi, adminKeys } from "@/lib/admin";

/**
 * Employers.
 *
 * The same register, pinned to the employer segment. `onSegmentChange` is a
 * no-op rather than an unfiltered escape hatch: an administrator who wants the
 * full list has "Registered users" in the sidebar, and a filter that silently
 * un-pins itself makes it unclear which page you are actually on.
 */
export default function Employers() {
  const vocabulary = useQuery({
    queryKey: adminKeys.vocabulary,
    queryFn: adminApi.vocabulary,
    staleTime: 10 * 60_000,
  });

  return (
    <div className="space-y-7">
      <PageHeader
        title="Employers"
        description="Organisations that registered to run PayBridge for their people."
      />
      <RegistrationsPanel segment="employer" onSegmentChange={() => {}} vocabulary={vocabulary.data} />
    </div>
  );
}
