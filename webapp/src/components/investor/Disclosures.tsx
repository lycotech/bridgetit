import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Required investor disclosures. Investors fund approved portfolios and mandates —
 * never individual employees directly.
 */
export function InvestorDisclosure({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-secondary/30 p-4 text-xs leading-relaxed text-muted-foreground",
        className,
      )}
    >
      <p className="flex items-center gap-1.5 font-semibold text-foreground">
        <Info className="h-3.5 w-3.5 text-gold" />
        Important information
      </p>
      <p className="mt-2">
        Capital is invested into an approved PayBridge portfolio or funding mandate. Investors do not lend to
        individual employees, and no investor is matched to any employee, transaction or employer.
      </p>
      <p className="mt-2">
        Investment returns are not guaranteed. Past performance does not guarantee future results. Indicative
        returns are targets, not promises, and your capital may be at risk.
      </p>
      <p className="mt-2">
        Products remain subject to legal, regulatory and investment-manager approval. The regulated entity
        managing investor capital will be identified before launch.
      </p>
    </div>
  );
}

/** Short one-line version for tight spaces. */
export function InvestorDisclosureLine({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>
      Capital is invested through an approved portfolio or funding mandate, never directly to individual
      employees. Returns are not guaranteed and past performance does not guarantee future results.
    </p>
  );
}
