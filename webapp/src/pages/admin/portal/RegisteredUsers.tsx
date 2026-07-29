import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { RegistrationsPanel } from "@/components/admin/RegistrationsPanel";
import { adminApi, adminKeys } from "@/lib/admin";

/**
 * Registered users.
 *
 * This is the interest register — everyone who submitted a form on the public
 * site — with filters, search, a detail drawer and an activity timeline.
 *
 * It is deliberately NOT the KYC queue. A registration is a person who asked;
 * an account with submitted documents is a person waiting on a regulated
 * decision. Merging the two would put an Approve button next to rows that have
 * nothing to approve, and that is how the wrong thing gets clicked.
 */
export default function RegisteredUsers() {
  const [segment, setSegment] = useState("");
  const vocabulary = useQuery({
    queryKey: adminKeys.vocabulary,
    queryFn: adminApi.vocabulary,
    staleTime: 10 * 60_000,
  });

  return (
    <div className="space-y-7">
      <PageHeader
        title="Registered users"
        description="Everyone who registered interest through the public site, with their history."
      />
      <RegistrationsPanel segment={segment} onSegmentChange={setSegment} vocabulary={vocabulary.data} />
    </div>
  );
}
