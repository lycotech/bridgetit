import { Check } from "lucide-react";
import { SectionLabel } from "@/components/brand/SectionLabel";
import { Reveal, StaggerGroup, staggerItem } from "@/components/motion/Reveal";
import { MLi } from "@/lib/motion";

/* Public name is always "PayBridge Account" — never "intermediate account",
   "collection account" or "virtual salary wallet". The eventual implementation
   may sit on virtual/dedicated account infrastructure from a regulated bank or
   PSP, but that's an internal detail, not the public name. */
const CAPABILITIES = [
  "Receive eligible workplace payments",
  "Fund savings",
  "Fund investments",
  "Receive transfers from other bank accounts",
  "Support PayBridge Access settlement where activated",
];

export function PayBridgeAccount() {
  return (
    <section id="account" className="section relative border-t border-border">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div>
            <Reveal>
              <SectionLabel>The PayBridge Account</SectionLabel>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-6 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
                Your PayBridge
                <br />
                Account.
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-7 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Every verified PayBridge user can receive a dedicated account linked to their
                PayBridge profile through our regulated banking infrastructure.
              </p>
            </Reveal>

            <Reveal delay={0.15}>
              <div className="mt-8 rounded-2xl border border-primary/30 bg-primary/5 p-6">
                <p className="text-lg font-semibold text-foreground">
                  You do not have to abandon your existing bank.
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Your existing bank can remain your everyday spending account. Where supported,
                  balances remaining after settlement can be transferred automatically to your
                  nominated bank account.
                </p>
              </div>
            </Reveal>
          </div>

          <StaggerGroup className="grid grid-cols-1 gap-3 self-center sm:grid-cols-2">
            {CAPABILITIES.map((cap) => (
              <MLi
                key={cap}
                variants={staggerItem}
                className="flex items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-3.5"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span className="text-sm font-medium text-foreground">{cap}</span>
              </MLi>
            ))}
          </StaggerGroup>
        </div>
      </div>
    </section>
  );
}
