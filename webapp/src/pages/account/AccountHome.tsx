import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Ban,
  Clock3,
  FileWarning,
  LifeBuoy,
  Lock,
  PiggyBank,
  Receipt,
  TrendingUp,
  Zap,
} from "lucide-react";
import { AccountLayout } from "@/components/account/AccountLayout";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { useKycStatus, useSession } from "@/lib/account/session";

/**
 * The customer's own account screen. One page, four faces, chosen by the gate
 * the SERVER computed — pending, rejected, approved or suspended.
 *
 * The locked feature list below is presentational only. Nothing on this page can
 * open a regulated feature, because those endpoints sit behind
 * `requireFinancialAccess` on the server and this build has no client-side path
 * to them at all until the gate is `active`.
 */

const LOCKED_FEATURES = [
  { icon: Zap, label: "Bridge — access earned pay", note: "Available once verified" },
  { icon: Receipt, label: "Transactions", note: "Available once verified" },
  { icon: PiggyBank, label: "Savings", note: "Available once verified" },
  { icon: TrendingUp, label: "Investments", note: "Available once verified" },
];

function LockedFeatures() {
  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Lock className="h-4 w-4 text-muted-foreground" />
        Locked until verification is approved
      </p>
      <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {LOCKED_FEATURES.map((feature) => (
          <li
            key={feature.label}
            className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/60 px-3.5 py-3"
          >
            <feature.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-muted-foreground">{feature.label}</span>
              <span className="block text-xs text-muted-foreground/70">{feature.note}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        PayBridge cannot offer earned-income access, savings or investment features to an account that has not
        completed identity verification. This is a licensing requirement, not a setting.
      </p>
    </div>
  );
}

function Panel({
  tone,
  icon,
  title,
  children,
}: {
  tone: "info" | "warning" | "success" | "danger";
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  const toneClass = {
    info: "border-primary/30 bg-primary/[0.06]",
    warning: "border-amber-500/40 bg-amber-500/[0.07]",
    success: "border-primary/40 bg-primary/[0.06]",
    danger: "border-destructive/40 bg-destructive/10",
  }[tone];

  return (
    <div className={`rounded-2xl border p-5 ${toneClass}`}>
      <p className="flex items-center gap-2.5 font-display text-base font-extrabold text-foreground">
        {icon}
        {title}
      </p>
      <div className="mt-2.5 space-y-3 text-sm leading-relaxed text-foreground/90">{children}</div>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AccountHome() {
  const { data: session } = useSession();
  const gate = session?.gate ?? "kyc_pending";
  const user = session?.user ?? null;
  // Not requested while suspended: the account's own KYC detail is irrelevant to
  // a blocked account and the endpoint would be refused anyway.
  const { data: kyc } = useKycStatus(gate === "kyc_pending" || gate === "kyc_rejected" || gate === "active");

  const firstName = user?.fullName?.split(" ")[0] ?? "there";

  if (gate === "suspended" || gate === "closed") {
    return (
      <AccountLayout
        title={gate === "closed" ? "This account is closed" : "This account is suspended"}
        description="You cannot sign in to PayBridge features while your account is in this state."
      >
        <Panel tone="danger" icon={<Ban className="h-5 w-5 text-destructive" />} title="Access blocked">
          {user?.suspendedReason ? <p>{user.suspendedReason}</p> : null}
          <p>
            Our support team can explain what happens next and what is needed to restore access. Email{" "}
            <a className="font-semibold text-primary hover:underline" href="mailto:support@getpaybridge.com">
              support@getpaybridge.com
            </a>{" "}
            from the address on your account.
          </p>
        </Panel>
        <ActionButton to="/contact" variant="secondary" icon={<LifeBuoy className="h-4 w-4" />}>
          Contact support
        </ActionButton>
      </AccountLayout>
    );
  }

  if (gate === "kyc_rejected") {
    return (
      <AccountLayout
        eyebrow="Identity verification"
        title="Your verification needs attention"
        description="We could not approve your submission. You can correct it and submit again."
      >
        <Panel tone="warning" icon={<FileWarning className="h-5 w-5 text-amber-500" />} title="What we found">
          <p>{user?.kycRejectionReason ?? kyc?.rejectionReason ?? "Please review your details and documents and submit again."}</p>
          <p className="text-xs text-muted-foreground">Reviewed {formatDate(kyc?.reviewedAt ?? user?.kycReviewedAt ?? null)}</p>
        </Panel>
        <ActionButton to="/verify-identity" size="lg" icon={<ArrowRight className="h-4 w-4" />}>
          Update and resubmit
        </ActionButton>
        <LockedFeatures />
      </AccountLayout>
    );
  }

  if (gate === "kyc_pending") {
    return (
      <AccountLayout
        eyebrow="Identity verification"
        title="Verification in progress"
        description={`Thanks, ${firstName}. Your documents are with our review team.`}
      >
        <Panel tone="info" icon={<Clock3 className="h-5 w-5 text-primary" />} title="We are reviewing your submission">
          <p>
            Most reviews finish within one working day. We will email you at{" "}
            <span className="font-semibold">{user?.email}</span> as soon as there is a decision — you do not need to
            do anything else.
          </p>
          <dl className="grid gap-3 pt-1 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Submitted</dt>
              <dd className="text-sm font-medium">{formatDate(kyc?.submittedAt ?? user?.kycSubmittedAt ?? null)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Documents</dt>
              <dd className="text-sm font-medium">{kyc?.documents.length ?? 0} received</dd>
            </div>
          </dl>
        </Panel>
        <LockedFeatures />
      </AccountLayout>
    );
  }

  // gate === "active"
  return (
    <AccountLayout
      eyebrow="Verified account"
      title={`Welcome, ${firstName}`}
      description="Your identity is confirmed and your PayBridge account is open."
    >
      <Panel tone="success" icon={<BadgeCheck className="h-5 w-5 text-primary" />} title="Identity verified">
        <p>
          Approved {formatDate(kyc?.reviewedAt ?? user?.kycReviewedAt ?? null)}. Every PayBridge feature available to
          your account type is now unlocked.
        </p>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2">
        {LOCKED_FEATURES.map((feature) => (
          <div
            key={feature.label}
            className="flex items-start gap-3 rounded-2xl border border-border bg-background px-4 py-4"
          >
            <feature.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">{feature.label.split(" — ")[0]}</span>
              <span className="block text-xs text-muted-foreground">Ready to use</span>
            </span>
          </div>
        ))}
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        Your live dashboard is being connected to these features. In the meantime, our team can walk you through
        anything you need —{" "}
        <Link to="/contact" className="font-semibold text-primary hover:underline">
          get in touch
        </Link>
        .
      </p>
    </AccountLayout>
  );
}
