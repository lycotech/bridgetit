import { Link } from "react-router-dom";
import { Hammer } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";

/**
 * A section that exists in the navigation but is not finished yet.
 *
 * WHY this rather than hiding the link: the eight sections are a fixed
 * specification, and an administrator needs to know whether "no KYC queue" means
 * *nothing is waiting* or *the screen is not built*. A blank page cannot tell
 * them apart. This says which, and says what still runs in the meantime.
 */
export function SectionInBuild({
  title,
  description,
  building,
  meanwhile,
}: {
  title: string;
  description: string;
  building: string[];
  meanwhile?: { label: string; to: string };
}) {
  return (
    <div className="space-y-7">
      <PageHeader title={title} description={description} />

      <section className="rounded-2xl border border-dashed border-border bg-card/40 p-6">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Hammer className="h-4 w-4 text-primary" />
          This screen is still being built
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Nothing is broken and nothing is hidden — the work below is in progress. What is already live is signed in,
          audited and safe to use.
        </p>

        <ul className="mt-5 space-y-2">
          {building.map((item) => (
            <li key={item} className="flex gap-2.5 text-sm text-muted-foreground">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
              {item}
            </li>
          ))}
        </ul>

        {meanwhile ? (
          <Link
            to={meanwhile.to}
            className="mt-6 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            {meanwhile.label}
          </Link>
        ) : null}
      </section>
    </div>
  );
}
