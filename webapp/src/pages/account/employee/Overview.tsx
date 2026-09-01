import { Link } from "react-router-dom";
import { Gauge, HeartPulse, Sprout, Wallet } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { useSession } from "@/lib/account/session";

const QUICK_LINKS = [
  { to: "/account/employee/bridge", label: "Bridge", note: "Access pay you've already earned", icon: Gauge },
  { to: "/account/employee/pay", label: "My Pay", note: "Salary account and destination", icon: Wallet },
  { to: "/account/employee/savings", label: "Save", note: "Set money aside", icon: Sprout },
  { to: "/account/employee/grow", label: "Grow", note: "Your PayBridge Score", icon: HeartPulse },
];

/**
 * Real employee Overview — `/account/employee`. A summary landing page,
 * matching the demo's Overview role: Bridge/Pay/Save/Invest/Grow each have
 * their own dedicated page now (see the sibling routes), so this stays
 * light rather than re-stacking every section here too.
 */
export default function EmployeeOverview() {
  const { data: session } = useSession();
  const firstName = session?.user?.fullName?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Verified account"
        title={`Welcome, ${firstName}`}
        description="Your identity is confirmed and your PayBridge account is open."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-4 transition-colors hover:border-primary/40"
          >
            <link.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">{link.label}</span>
              <span className="block text-xs text-muted-foreground">{link.note}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
