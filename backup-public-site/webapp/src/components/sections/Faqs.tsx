import { SectionLabel } from "@/components/brand/SectionLabel";
import { Reveal } from "@/components/motion/Reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { track } from "@/lib/analytics";

const FAQS = [
  {
    q: "What is PayBridge?",
    a: "PayBridge is workforce-finance infrastructure. It helps eligible employees responsibly use an approved portion of verified income already earned before payday, through participating employers and appropriate financial partners.",
  },
  {
    q: "What does “Bridge It” mean?",
    a: "“Bridge It” means using an approved portion of verified income already earned to help manage a need before payday. It does not mean accessing your full salary or receiving unlimited funds.",
  },
  {
    q: "Is PayBridge a loan app?",
    a: "PayBridge is workforce-finance infrastructure rather than a conventional payday-loan app. It connects verified earnings, participating employers and financial partners under defined rules and controls. Where lending is involved, it is carried out under an FCCPC lender’s licence.",
  },
  {
    q: "Does PayBridge pay my full salary every day?",
    a: "No. Eligible employees may be able to bridge an approved portion of verified income already earned, subject to employer participation, eligibility, limits, charges and applicable terms.",
  },
  {
    q: "How much can I bridge?",
    a: "Only an approved portion of what you have already earned may be bridged. Limits depend on your employer’s programme, your verified earnings and eligibility rules. A portion of your income always stays protected for payday.",
  },
  {
    q: "How are my earnings verified?",
    a: "Earnings are verified through your participating employer’s payroll and approved data sources, so bridging is always connected to work already completed.",
  },
  {
    q: "Does my employer need to participate?",
    a: "Yes. PayBridge is employer-enabled. Your employer needs to participate for eligible employees to bridge earned income.",
  },
  {
    q: "Are there charges?",
    a: "Where charges apply, they are shown clearly before you confirm, along with the effect on your payday. There are no hidden costs.",
  },
  {
    q: "What happens on payday?",
    a: "Payroll completes the cycle and any bridged amount is reconciled transparently, so everyone can see how the cycle settled.",
  },
  {
    q: "Can employers join the pilot?",
    a: "Yes. Employers, HR and payroll teams can join the waitlist to help shape the pilot and be among the first to offer PayBridge.",
  },
  {
    q: "Will PayBridge include savings and investments?",
    a: "The broader vision includes savings, emergency preparation and, over time, investment and wealth-building opportunities. All investment funds are managed by Invest-Trust Asset Management Limited, a SEC-licensed asset manager. These features are still being developed.",
  },
  {
    q: "How can capital and financial partners participate?",
    a: "Capital providers and financial institutions can support monitored workforce-finance programmes built around verified data, clear limits, settlement controls and transparent reporting. Join the waitlist to start the conversation.",
  },
  {
    q: "Is PayBridge live yet?",
    a: "PayBridge is currently being developed. Joining the waitlist gives you early access, pilot updates and launch announcements.",
  },
  {
    q: "How does PayBridge approach risk and compliance?",
    a: "PayBridge is built around verified earnings, approved limits, transparent charges, visible payday impact, and monitoring and reconciliation. Lending is carried out under an FCCPC lender’s licence, and all investment funds are managed by Invest-Trust Asset Management Limited, a SEC-licensed asset manager.",
  },
];

export function Faqs() {
  return (
    <section id="faqs" className="section relative border-t border-border">
      <div className="mx-auto max-w-3xl px-5 md:px-8">
        <div className="text-center">
          <Reveal>
            <div className="flex justify-center">
              <SectionLabel>Questions, answered</SectionLabel>
            </div>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-6 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
              Frequently asked questions
            </h2>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <Accordion type="single" collapsible className="mt-12 w-full">
            {FAQS.map((faq, i) => (
              <AccordionItem key={faq.q} value={`item-${i}`} className="border-border">
                <AccordionTrigger
                  onClick={() => track("faq_interaction", { question: faq.q })}
                  className="text-left font-display text-lg font-semibold text-foreground hover:text-primary hover:no-underline"
                >
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-base leading-relaxed text-muted-foreground">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
