/**
 * PROJECT FORTRESS — the PayBridge security and trust programme.
 *
 * WHY THIS FILE EXISTS
 * The eight pillars are quoted in three places: the public trust page, the
 * operations control centre, and PROJECT-FORTRESS.md. When a programme is
 * retyped in each place it drifts, and a security page that overstates reality
 * is worse than no page at all — it is a claim a regulator or an enterprise
 * buyer can hold you to. One definition, imported everywhere.
 *
 * HONESTY RULE (enforced by the `status` field)
 * Every control carries its real maturity. "live" means it is running in this
 * codebase today. "building" means partially delivered. "planned" means
 * designed and scheduled but not yet built. We publish the planned ones too:
 * a buyer's security questionnaire will ask anyway, and an honest roadmap wins
 * more diligence reviews than a wall of green ticks nobody believes.
 */

/** Re-exported so security copy and the brand lockup cannot drift apart. */
export { TAGLINE } from "@/lib/brand";

export type ControlStatus = "live" | "building" | "planned";

export const STATUS_LABEL: Record<ControlStatus, string> = {
  live: "In place",
  building: "In build",
  planned: "Before launch",
};

export interface FortressControl {
  name: string;
  detail: string;
  status: ControlStatus;
}

export interface FortressPillar {
  id: string;
  number: string;
  title: string;
  summary: string;
  /** The question this pillar answers for an employer, employee or regulator. */
  question: string;
  /** Plain-language explanation of why this pillar exists at all. */
  why: string;
  controls: FortressControl[];
}

export const FORTRESS_PILLARS: FortressPillar[] = [
  {
    id: "product-architecture",
    number: "01",
    title: "Secure Product Architecture",
    summary: "Controls built into PayBridge.",
    question: "Is the product itself built safely?",
    why:
      "Security added at the end is a coat of paint. Security designed in is structural. Every screen, every request and every record in PayBridge starts from deny-by-default: nothing is visible or possible until a rule explicitly allows it.",
    controls: [
      {
        name: "Deny-by-default permissions",
        detail:
          "Eleven defined roles across employee, employer, investor and operations. A capability that has not been explicitly granted is refused, so a forgotten update fails closed rather than open.",
        status: "live",
      },
      {
        name: "Employer privacy firewall",
        detail:
          "Employers see payroll obligations and settlement totals. They do not see which employee bridged, how much, how often, or any savings, investment or wellbeing activity. This is a structural rule, not a display choice.",
        status: "building",
      },
      {
        name: "Hardened sessions and cookies",
        detail:
          "Signed session tokens with a 12-hour absolute and 30-minute idle expiry, HttpOnly and Secure cookies with the __Host- prefix, and a new session identity issued at every privilege change.",
        status: "live",
      },
      {
        name: "Cross-site request forgery protection",
        detail:
          "Origin pinning plus a double-submit token on every state-changing request, so another website cannot make your browser act on your behalf.",
        status: "live",
      },
      {
        name: "Content Security Policy",
        detail:
          "The browser is instructed which code may run and where data may be sent. Injected scripts do not execute and cannot ship data to an outside collector.",
        status: "live",
      },
      {
        name: "Input validation and safe output",
        detail:
          "Every field is validated against a shared schema before it reaches the database, and every export is escaped so a spreadsheet cannot be turned into a weapon.",
        status: "live",
      },
      {
        name: "Multi-factor authentication",
        detail:
          "Step-up verification, tracked per session rather than per user, required for payroll approval and every operations action. Passkey support is kept enabled at the browser policy layer.",
        status: "planned",
      },
    ],
  },
  {
    id: "development-pipeline",
    number: "02",
    title: "Secure Development Pipeline",
    summary: "Automated checks on every code change.",
    question: "Can an unsafe change reach production?",
    why:
      "People get tired, deadlines compress, and reviewers miss things. Automation does not. Every check that runs on every change is a class of mistake that cannot reach your payroll — regardless of who was on shift.",
    controls: [
      {
        name: "Type and lint gates",
        detail:
          "The build fails on a type error or lint error in either the app or the API. A whole category of runtime failure never ships.",
        status: "live",
      },
      {
        name: "Dependency vulnerability scanning",
        detail:
          "Every change is audited against published advisories. Known-vulnerable packages are pinned to patched versions, and remaining findings are recorded with a written reason rather than silently ignored.",
        status: "live",
      },
      {
        name: "Secret scanning",
        detail:
          "An automated sweep blocks API keys, private keys and credentials from entering the codebase — the most common cause of real-world breaches.",
        status: "live",
      },
      {
        name: "Production build verification",
        detail:
          "The deployable build is produced and its security headers and policy are checked on every change, so a protection cannot be quietly dropped.",
        status: "live",
      },
      {
        name: "Peer review on protected branches",
        detail:
          "No change reaches the main branch without a second pair of eyes and a green pipeline.",
        status: "planned",
      },
    ],
  },
  {
    id: "infrastructure",
    number: "03",
    title: "Infrastructure Protection",
    summary: "Cloud, database, network and secrets security.",
    question: "Is the ground the product stands on secure?",
    why:
      "Perfect application code on a misconfigured server is still a breach. Most published incidents are not clever exploits — they are an open storage bucket, a database reachable from the internet, or a key that was never rotated.",
    controls: [
      {
        name: "Secrets outside the codebase",
        detail:
          "Signing keys, database credentials and API keys are supplied by the environment and validated at start-up. The service refuses to start in production if a required secret is missing, and no secret value is ever written to a log.",
        status: "live",
      },
      {
        name: "Encryption in transit",
        detail:
          "HTTPS enforced with strict transport security, so a downgrade to plain HTTP is refused by the browser itself.",
        status: "live",
      },
      {
        name: "Encryption at rest",
        detail:
          "Database and backup volumes encrypted, with payroll identifiers and bank details additionally protected at field level.",
        status: "planned",
      },
      {
        name: "Private database networking",
        detail:
          "The database accepts connections only from the application network. It is not reachable from the public internet at any address.",
        status: "planned",
      },
      {
        name: "Key rotation schedule",
        detail:
          "Scheduled rotation of signing keys and third-party credentials, with immediate rotation on any suspicion of exposure.",
        status: "planned",
      },
      {
        name: "Least-privilege infrastructure access",
        detail:
          "Named human accounts with multi-factor authentication, time-bound elevation for production access, and no shared logins.",
        status: "planned",
      },
    ],
  },
  {
    id: "financial-crime",
    number: "04",
    title: "Financial Crime Controls",
    summary: "Transaction monitoring, limits and fraud detection.",
    question: "Can PayBridge be used to move money it should not move?",
    why:
      "A platform that moves earned income is a target for account takeover, mule activity and collusion. These controls exist to protect employees from having their pay stolen, employers from payroll fraud, and PayBridge from being used as a laundering channel.",
    controls: [
      {
        name: "Availability tied to confirmed net earnings",
        detail:
          "Bridge availability is calculated from confirmed net pay after statutory and contractual deductions — never from gross salary. You cannot bridge money that will not exist on payday.",
        status: "live",
      },
      {
        name: "Layered limits",
        detail:
          "Per-request, daily, weekly and pay-cycle caps applied together, plus a floor that protects a minimum take-home amount on payday.",
        status: "live",
      },
      {
        name: "Velocity and behaviour monitoring",
        detail:
          "Rapid repeat requests, unusual timing, sudden increases against a personal baseline, and requests immediately following a bank-detail change are scored and escalated.",
        status: "live",
      },
      {
        name: "Automatic pause on critical exceptions",
        detail:
          "A critical payroll exception pauses further Bridge availability for the affected population until it is resolved. Already-disbursed transactions are never altered silently — corrections are recorded as new, visible entries.",
        status: "live",
      },
      {
        name: "Cooling-off on sensitive changes",
        detail:
          "A change to payout details starts a hold before further disbursement — the single most effective control against account-takeover payout theft.",
        status: "building",
      },
      {
        name: "Sanctions, PEP and KYC screening",
        detail:
          "Identity verification and watchlist screening at onboarding and on an ongoing basis, with regulatory reporting workflows for operations.",
        status: "planned",
      },
      {
        name: "Four-eyes on high-value release",
        detail:
          "Disbursements above a defined threshold require a second authorised approver.",
        status: "planned",
      },
    ],
  },
  {
    id: "assurance",
    number: "05",
    title: "Independent Assurance",
    summary: "Code audit and penetration testing.",
    question: "Has anyone outside the team tried to break it?",
    why:
      "Every team is blind to its own assumptions. The only honest measure of security is what someone who does not share those assumptions can do to you — and it is far cheaper to pay for that finding than to receive it from an attacker.",
    controls: [
      {
        name: "Internal security audit",
        detail:
          "Full OWASP Top 10 review of every page, component, API route, authentication flow, session, database interaction and file upload, with findings tiered and tracked to closure.",
        status: "live",
      },
      {
        name: "Documented residual risk",
        detail:
          "Every accepted risk is written down with its reasoning, rather than closed quietly. What we have not fixed is as visible as what we have.",
        status: "live",
      },
      {
        name: "Independent penetration test",
        detail:
          "Third-party testing of the platform and its infrastructure before handling live payroll, repeated annually and after significant change.",
        status: "planned",
      },
      {
        name: "Responsible disclosure programme",
        detail:
          "A published route for security researchers to report issues safely, with a commitment to acknowledge and act.",
        status: "planned",
      },
      {
        name: "Third-party and partner due diligence",
        detail:
          "Security review of payroll connectors, banking partners and the asset manager before integration, and on review.",
        status: "planned",
      },
    ],
  },
  {
    id: "data-protection",
    number: "06",
    title: "Data Protection",
    summary: "Privacy, consent, retention and access governance.",
    question: "Who can see an employee's financial life?",
    why:
      "PayBridge holds the most sensitive information most people have: what they earn, what they owe, and when they run short. The product's central promise is that using it never becomes visible to an employer. Privacy here is not a compliance exercise — it is the product.",
    controls: [
      {
        name: "Employer blindness by design",
        detail:
          "Employers never see individual Bridge usage, frequency, amounts, savings, investments or financial wellbeing information. They see the settlement total they owe, and nothing that identifies behaviour.",
        status: "building",
      },
      {
        name: "Data minimisation",
        detail:
          "We collect only what a decision requires. A field with no decision attached to it is a liability, not an asset.",
        status: "live",
      },
      {
        name: "Pseudonymised audit trail",
        detail:
          "Audit logs identify actors by a salted one-way pseudonym. The trail stays linkable for investigations without becoming a second copy of the customer database.",
        status: "live",
      },
      {
        name: "Explicit, recorded consent",
        detail:
          "Consent is captured with its purpose, time and version, and can be withdrawn as easily as it was given.",
        status: "building",
      },
      {
        name: "Retention and deletion schedule",
        detail:
          "Defined retention periods per data category, with automated deletion and a documented route to export or erase personal data on request.",
        status: "planned",
      },
      {
        name: "Access governance",
        detail:
          "Every internal view of personal data is logged and periodically reviewed. Access to production personal data is the exception, requested and time-bound.",
        status: "planned",
      },
    ],
  },
  {
    id: "resilience",
    number: "07",
    title: "Operational Resilience",
    summary: "Backups, disaster recovery and incident response.",
    question: "What happens on the worst day?",
    why:
      "Payday does not move. An outage on the wrong morning is not an inconvenience — it is people not being paid. Resilience is measured by how quickly and how completely you recover, and that is only knowable if you have actually practised it.",
    controls: [
      {
        name: "Fail-closed behaviour",
        detail:
          "Under uncertainty the platform stops rather than guesses. A corrupt session is discarded, an unverified request is refused, and a missing configuration prevents start-up instead of running in an unknown state.",
        status: "live",
      },
      {
        name: "Immutable settlement history",
        detail:
          "Completed and disbursed Bridge transactions are never altered silently. Corrections are appended as new, attributable records so the history always reconciles.",
        status: "live",
      },
      {
        name: "Automated encrypted backups",
        detail:
          "Point-in-time recovery with off-site encrypted copies and a defined recovery point and recovery time objective.",
        status: "planned",
      },
      {
        name: "Tested disaster recovery",
        detail:
          "Restores rehearsed on a schedule. A backup that has never been restored is an assumption, not a backup.",
        status: "planned",
      },
      {
        name: "Incident response plan",
        detail:
          "Named roles, severity definitions, communication templates and regulatory notification timelines, rehearsed rather than written and filed.",
        status: "planned",
      },
      {
        name: "Payroll continuity path",
        detail:
          "A defined manual fallback so employer settlement can complete even during a platform incident.",
        status: "planned",
      },
    ],
  },
  {
    id: "monitoring",
    number: "08",
    title: "Continuous Monitoring",
    summary: "Alerts, logs, vulnerabilities and threat response.",
    question: "Would we know?",
    why:
      "The average breach is discovered months after it begins, usually by someone outside the company. Detection speed is the difference between an incident and a catastrophe — and it is the one security property you cannot buy at the last minute.",
    controls: [
      {
        name: "Structured audit logging",
        detail:
          "Security-relevant events are written as structured records with a request identifier, resistant to tampering by injected text and stripped of sensitive values.",
        status: "live",
      },
      {
        name: "Rate limiting and abuse detection",
        detail:
          "Sliding-window limits across the API with tighter thresholds on authentication and sign-up, defeating credential stuffing and automated abuse.",
        status: "live",
      },
      {
        name: "Continuous dependency monitoring",
        detail:
          "New advisories against packages we depend on are surfaced automatically rather than discovered at the next audit.",
        status: "live",
      },
      {
        name: "Real-time alerting",
        detail:
          "Paging on authentication anomalies, privilege changes, disbursement spikes and error-rate deviations, routed to a human who is awake.",
        status: "planned",
      },
      {
        name: "Append-only log retention",
        detail:
          "Audit records shipped to storage that even an administrator cannot rewrite, retained for the regulatory period.",
        status: "planned",
      },
      {
        name: "Threat intelligence review",
        detail:
          "Scheduled review of emerging attack patterns against payroll and earned-wage platforms, feeding back into the controls above.",
        status: "planned",
      },
    ],
  },
];

/** Aggregate counts, computed rather than typed by hand so they cannot go stale. */
export function fortressProgress() {
  const all = FORTRESS_PILLARS.flatMap((p) => p.controls);
  return {
    total: all.length,
    live: all.filter((c) => c.status === "live").length,
    building: all.filter((c) => c.status === "building").length,
    planned: all.filter((c) => c.status === "planned").length,
  };
}
