import { SectionInBuild } from "@/components/admin/portal/SectionInBuild";

export default function KycReview() {
  return (
    <SectionInBuild
      title="KYC review"
      description="Identity checks waiting on a decision, and the documents behind them."
      building={[
        "The review queue: pending applications oldest first, with the applicant's details side by side with their documents.",
        "Approve, with the decision recorded against your name, the time and your IP address.",
        "Reject with a reason, which the applicant sees where the law allows it, and which lets them resubmit.",
        "Document viewing through short-lived, single-use links — identity documents are encrypted at rest and never sit on a public URL.",
      ]}
      meanwhile={{ label: "See who has registered so far", to: "/admin/users" }}
    />
  );
}
