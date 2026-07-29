import { BRIDGERS, CAPITAL, PARTNERSHIPS, TEAM, type EmailIdentity } from "./identities";
import type { LocaleCode, Segment } from "../types";

/**
 * Email bodies.
 *
 * The four confirmation messages below are APPROVED COPY and are reproduced
 * word for word. Do not "improve" the wording: several sentences are
 * disclaimers ("Registration does not mean that access has been approved",
 * "This acknowledgement is not an offer...") whose exact phrasing is the point.
 * Layout, colours and spacing are free; the sentences are not.
 */

/**
 * Escape before interpolating anything a stranger typed into an HTML email.
 *
 * WHY this matters for an INTERNAL notification specifically: the reader is a
 * PayBridge staff member with an admin session, opening the mail in a client
 * that renders HTML. An applicant who types `<img src=x onerror=...>` into
 * "what they want from PayBridge" is aiming at exactly that person. The plain
 * -text part needs no escaping; the HTML part always does.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const NAVY = "#091320";
const TEAL = "#22B490";
const GOLD = "#D6B166";
const OFF_WHITE = "#F8F6F2";

/**
 * The small print at the foot of every message.
 *
 * PUBLIC is the default and is written for someone who filled in a form. It is
 * wrong on an administrator security notice — "you registered your interest"
 * tells the reader this is marketing, and the one thing a security notice has
 * to do is get read. STAFF says who the mail is for and what to do if it was
 * not expected, which is the only actionable sentence in a breach.
 */
const FOOTER = {
  public:
    "You are receiving this because you registered your interest at getpaybridge.com. " +
    "PayBridge will never ask you to send a BVN, NIN, identity document, bank statement, " +
    "payroll file or bank login by email. Verification, when it begins, happens only inside " +
    "a secure PayBridge portal.",
  staff:
    "This is an automated security notice for a PayBridge administrator account. " +
    "If you did not perform this action, your credentials may be compromised: contact " +
    "the Super Admin immediately and change your password. PayBridge will never email you " +
    "a password, an authenticator secret or a recovery code you did not just request.",
} as const;

/** Shared responsive shell. Table-based because email clients are 1999. */
function shell(options: {
  heading: string;
  bodyHtml: string;
  signOff: string;
  footer?: keyof typeof FOOTER;
}): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${NAVY};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${NAVY};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#0E1B2C;border-radius:16px;overflow:hidden;">
        <tr><td style="height:4px;background:linear-gradient(90deg,${TEAL},${GOLD});font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:36px 32px 8px;">
          <p style="margin:0;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:${TEAL};font-weight:700;">PayBridge</p>
          <h1 style="margin:14px 0 0;font-size:26px;line-height:1.25;color:${OFF_WHITE};font-weight:800;">${options.heading}</h1>
        </td></tr>
        <tr><td style="padding:20px 32px 8px;color:#C4D0DE;font-size:15px;line-height:1.65;">
          ${options.bodyHtml}
        </td></tr>
        <tr><td style="padding:24px 32px 36px;">
          <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:${GOLD};letter-spacing:0.4px;">From Payroll to Prosperity.</p>
          <p style="margin:0;font-size:14px;color:${OFF_WHITE};font-weight:600;">${options.signOff}</p>
        </td></tr>
        <tr><td style="padding:18px 32px;background:#0A1526;border-top:1px solid rgba(255,255,255,0.07);">
          <p style="margin:0;font-size:11px;line-height:1.6;color:#7C8CA0;">
            ${FOOTER[options.footer ?? "public"]}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function paragraphs(lines: string[]): string {
  return lines.map((l) => `<p style="margin:0 0 14px;">${l}</p>`).join("\n          ");
}

export interface BuiltEmail {
  subject: string;
  from: EmailIdentity;
  text: string;
  html: string;
}

/* ======================================================= CONFIRMATION MAILS */

export function employeeConfirmation(): BuiltEmail {
  const text = `Welcome to PayBridge.

You are now part of our early community of Bridgers: hardworking people who believe payroll should do more than arrive once a month.

PayBridge is being built to help employees reduce payday pressure, access responsible financial support through work and build stronger financial wellbeing.

We will keep you informed about the pilot programme, employer onboarding and when activation becomes available.

Registration does not mean that access has been approved. Eligibility and verification will take place when your employer is onboarded.

From Payroll to Prosperity.
PayBridge`;

  return {
    subject: "Welcome to PayBridge. You’re officially on the bridge.",
    from: BRIDGERS,
    text,
    html: shell({
      heading: "Welcome to PayBridge.",
      signOff: "PayBridge",
      bodyHtml: paragraphs([
        "You are now part of our early community of <strong style=\"color:#F8F6F2;\">Bridgers</strong>: hardworking people who believe payroll should do more than arrive once a month.",
        "PayBridge is being built to help employees reduce payday pressure, access responsible financial support through work and build stronger financial wellbeing.",
        "We will keep you informed about the pilot programme, employer onboarding and when activation becomes available.",
        `<span style="display:block;padding:14px 16px;border-left:3px solid ${GOLD};background:rgba(214,177,102,0.08);border-radius:0 8px 8px 0;color:#DCC79B;">Registration does not mean that access has been approved. Eligibility and verification will take place when your employer is onboarded.</span>`,
      ]),
    }),
  };
}

export function employerConfirmation(): BuiltEmail {
  const text = `Thank you for registering your organisation with PayBridge.

You have joined as a prospective Bridge Partner: an employer interested in improving workforce financial wellbeing through smarter payroll support.

PayBridge is being designed to help employers support their people without becoming lenders, disrupting payroll operations or encouraging unhealthy borrowing.

Our Partnerships team will review the information provided and contact you to understand:

  - your workforce profile;
  - payroll structure;
  - salary-payment history;
  - employee financial-wellbeing needs; and
  - readiness for a controlled pilot.

Registration does not constitute approval or create a financial obligation.

From Payroll to Prosperity.
PayBridge Partnerships`;

  const list = [
    "your workforce profile;",
    "payroll structure;",
    "salary-payment history;",
    "employee financial-wellbeing needs; and",
    "readiness for a controlled pilot.",
  ]
    .map((i) => `<li style="margin:0 0 6px;">${i}</li>`)
    .join("");

  return {
    subject: "Welcome to PayBridge. Let’s build a stronger workforce.",
    from: PARTNERSHIPS,
    text,
    html: shell({
      heading: "Thank you for registering your organisation with PayBridge.",
      signOff: "PayBridge Partnerships",
      bodyHtml: `${paragraphs([
        "You have joined as a prospective <strong style=\"color:#F8F6F2;\">Bridge Partner</strong>: an employer interested in improving workforce financial wellbeing through smarter payroll support.",
        "PayBridge is being designed to help employers support their people without becoming lenders, disrupting payroll operations or encouraging unhealthy borrowing.",
        "Our Partnerships team will review the information provided and contact you to understand:",
      ])}
          <ul style="margin:0 0 14px;padding-left:20px;color:#C4D0DE;">${list}</ul>
          ${paragraphs([
            `<span style="display:block;padding:14px 16px;border-left:3px solid ${GOLD};background:rgba(214,177,102,0.08);border-radius:0 8px 8px 0;color:#DCC79B;">Registration does not constitute approval or create a financial obligation.</span>`,
          ])}`,
    }),
  };
}

export function capitalConfirmation(): BuiltEmail {
  const text = `Thank you for registering your interest in exploring a capital partnership with PayBridge.

We are developing structured infrastructure connecting employers, payroll, responsible income access and workforce financial wellbeing.

Our Capital team will review the information submitted and contact you where your mandate, capital profile and preferred structure align with the programme.

This acknowledgement is not an offer, investment recommendation, commitment, acceptance of funds or guarantee of participation.

Any future engagement will remain subject to legal structuring, regulatory requirements, due diligence, source-of-funds verification, suitability assessment and definitive documentation.

From Payroll to Prosperity.
PayBridge Capital`;

  return {
    subject: "PayBridge Capital Partnership Interest Received",
    from: CAPITAL,
    text,
    html: shell({
      heading: "Thank you for registering your interest in exploring a capital partnership with PayBridge.",
      signOff: "PayBridge Capital",
      bodyHtml: paragraphs([
        "We are developing structured infrastructure connecting employers, payroll, responsible income access and workforce financial wellbeing.",
        "Our Capital team will review the information submitted and contact you where your mandate, capital profile and preferred structure align with the programme.",
        `<span style="display:block;padding:14px 16px;border-left:3px solid ${GOLD};background:rgba(214,177,102,0.08);border-radius:0 8px 8px 0;color:#DCC79B;">This acknowledgement is not an offer, investment recommendation, commitment, acceptance of funds or guarantee of participation.<br><br>Any future engagement will remain subject to legal structuring, regulatory requirements, due diligence, source-of-funds verification, suitability assessment and definitive documentation.</span>`,
      ]),
    }),
  };
}

export function generalConfirmation(enquiryType: string): BuiltEmail {
  const text = `Thank you for contacting PayBridge.

We have received your ${enquiryType.toLowerCase()} and a member of the PayBridge team will review it and respond to this email address.

PayBridge is building payroll infrastructure that connects employers, earned-income access and workforce financial wellbeing.

Please note that PayBridge will never ask you to send a BVN, NIN, identity document, bank statement, payroll file or incorporation document by email.

From Payroll to Prosperity.
PayBridge`;

  return {
    subject: "We’ve received your message — PayBridge",
    from: TEAM,
    text,
    html: shell({
      heading: "Thank you for contacting PayBridge.",
      signOff: "PayBridge",
      bodyHtml: paragraphs([
        `We have received your ${escapeHtml(enquiryType.toLowerCase())} and a member of the PayBridge team will review it and respond to this email address.`,
        "PayBridge is building payroll infrastructure that connects employers, earned-income access and workforce financial wellbeing.",
        `<span style="display:block;padding:14px 16px;border-left:3px solid ${GOLD};background:rgba(214,177,102,0.08);border-radius:0 8px 8px 0;color:#DCC79B;">Please note that PayBridge will never ask you to send a BVN, NIN, identity document, bank statement, payroll file or incorporation document by email.</span>`,
      ]),
    }),
  };
}

export function confirmationFor(segment: Segment, enquiryType = "General enquiry"): BuiltEmail {
  switch (segment) {
    case "employee":
      return employeeConfirmation();
    case "employer":
      return employerConfirmation();
    case "capital_partner":
      return capitalConfirmation();
    case "general":
      return generalConfirmation(enquiryType);
  }
}

/* ==================================================== INTERNAL NOTIFICATION */

const SEGMENT_LABEL: Record<Segment, string> = {
  employee: "Employee registration (Bridger)",
  employer: "Employer registration (Bridge Partner)",
  capital_partner: "Capital-partner registration (Bridge Capital Partner)",
  general: "General enquiry",
};

/**
 * The message that reaches the PayBridge inbox.
 *
 * Reply-To is set to the submitter, so hitting Reply in any mail client
 * answers the person directly rather than the shared mailbox. That is set on
 * the message in the route, not here.
 */
export function internalNotification(input: {
  segment: Segment;
  from: EmailIdentity;
  fields: Array<[string, string]>;
  submittedAt: Date;
  sourcePage?: string | null;
  marketingConsent: boolean;
  registrationId: string;
  returning: boolean;
}): BuiltEmail {
  const label = SEGMENT_LABEL[input.segment];
  const name = input.fields.find(([k]) => /name/i.test(k))?.[1] ?? "Unknown";

  const meta: Array<[string, string]> = [
    ["Submitted", input.submittedAt.toISOString()],
    ["Source page", input.sourcePage ?? "unknown"],
    ["Form type", input.segment],
    ["Privacy policy", "Acknowledged"],
    ["Marketing consent", input.marketingConsent ? "Given" : "Not given"],
    ["Record id", input.registrationId],
    ["Repeat submission", input.returning ? "Yes — existing record refreshed" : "No"],
  ];

  const all = [...input.fields, ...meta];

  const text = [
    `${label}`,
    "",
    ...all.map(([k, v]) => `${k}: ${v}`),
    "",
    "Reply to this email to respond to the registrant directly.",
    "",
    "Reminder: do not request a BVN, NIN, bank statement, payroll file, identity",
    "document or source-of-funds record by email. Use the secure verification",
    "portal once activation begins.",
  ].join("\n");

  const rows = all
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.07);color:#7C8CA0;font-size:13px;white-space:nowrap;vertical-align:top;">${escapeHtml(
          k,
        )}</td><td style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.07);color:${OFF_WHITE};font-size:14px;">${escapeHtml(
          v,
        ).replace(/\n/g, "<br>")}</td></tr>`,
    )
    .join("");

  return {
    subject: `[${input.segment}] ${label} — ${name}`,
    from: input.from,
    text,
    html: shell({
      heading: label,
      signOff: "PayBridge internal notification",
      bodyHtml: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px;">${rows}</table>
          <p style="margin:0 0 12px;">Reply to this email to respond to the registrant directly.</p>
          <p style="margin:0;padding:12px 14px;border-left:3px solid ${GOLD};background:rgba(214,177,102,0.08);border-radius:0 8px 8px 0;color:#DCC79B;font-size:13px;">
            Do not request a BVN, NIN, bank statement, payroll file, identity document or
            source-of-funds record by email. Use the secure verification portal once activation begins.
          </p>`,
    }),
  };
}

/* ========================================================= DEMO INVITATION */

/**
 * Human-readable expiry, in UTC, for an invitation message.
 *
 * UTC and named explicitly. An invitee in Lagos and an administrator in London
 * reading "expires 16:00" disagree by an hour, and the one who guesses wrong
 * finds a dead code. Stating the zone costs four characters.
 */
export function formatExpiry(at: Date): string {
  const date = at.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const time = at.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  return `${date} at ${time} UTC`;
}

/**
 * The private-demonstration invitation.
 *
 * This message carries a CODE, not a link, and that is a deliberate constraint
 * rather than a stylistic one:
 *
 *   - A code entered on our own page cannot leak through a Referer header, a
 *     browser history entry, a proxy log or a shared screenshot of the URL bar.
 *   - A code plus the invited email address is two facts. A link is one fact
 *     that works for whoever holds it, including whoever the mail was forwarded
 *     to.
 *
 * The internal note is NOT included here. It is why the invitation was issued,
 * written by staff for staff, and putting it in the invitee's mail is how "chase
 * — they went quiet after the pricing call" ends up being read by the prospect.
 */
export function demoInvitationCode(input: {
  code: string;
  expiresAt: Date;
  inviteeName?: string | null;
  demoTypeLabel?: string | null;
  siteUrl?: string | null;
}): BuiltEmail {
  const greeting = input.inviteeName ? `Hello ${input.inviteeName},` : "Hello,";
  const expiry = formatExpiry(input.expiresAt);
  const site = input.siteUrl?.replace(/^https?:\/\//, "") ?? "getpaybridge.com";

  const text = `${greeting}

You have been invited to a private demonstration of PayBridge.

Access the demonstration using the email address associated with this invitation and the code below.

Invitation code: ${input.code}
Expiry: ${expiry}

Visit ${site} and select Private Demonstration in the footer.
${input.demoTypeLabel ? `\nYou have been invited to: ${input.demoTypeLabel}.\n` : ""}
The code only works with the email address this invitation was sent to, so please do not forward it.

The environment you will see contains fictional demonstration data only. No real employee, employer or payroll information is present. It is shared for evaluation purposes and remains confidential.

From Payroll to Prosperity.
PayBridge Partnerships`;

  return {
    subject: "Your private PayBridge demonstration",
    from: PARTNERSHIPS,
    text,
    html: shell({
      heading: "Your private PayBridge demonstration",
      signOff: "PayBridge Partnerships",
      bodyHtml: `${paragraphs([
        escapeHtml(greeting),
        "You have been invited to a private demonstration of PayBridge.",
        "Access the demonstration using the email address associated with this invitation and the code below.",
      ])}
          <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 18px;">
            <tr><td style="padding:16px 22px;border:1px solid rgba(45,212,191,0.35);border-radius:12px;background:rgba(45,212,191,0.08);">
              <span style="display:block;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#9FB3C8;">Invitation code</span>
              <span style="display:block;margin-top:6px;font-family:'SFMono-Regular',Consolas,monospace;font-size:26px;font-weight:700;letter-spacing:0.14em;color:${OFF_WHITE};">${escapeHtml(input.code)}</span>
              <span style="display:block;margin-top:10px;font-size:13px;color:#9FB3C8;">Expiry: <strong style="color:${OFF_WHITE};">${escapeHtml(expiry)}</strong></span>
            </td></tr>
          </table>
          ${paragraphs([
            `Visit <strong style="color:${OFF_WHITE};">${escapeHtml(site)}</strong> and select <strong style="color:${TEAL};">Private Demonstration</strong> in the footer.`,
            ...(input.demoTypeLabel ? [`You have been invited to: ${escapeHtml(input.demoTypeLabel)}.`] : []),
            "The code only works with the email address this invitation was sent to, so please do not forward it.",
            `<span style="display:block;padding:14px 16px;border-left:3px solid ${GOLD};background:rgba(214,177,102,0.08);border-radius:0 8px 8px 0;color:#DCC79B;">The environment contains fictional demonstration data only. No real employee, employer or payroll information is present. It is shared for evaluation purposes and remains confidential.</span>`,
          ])}`,
    }),
  };
}

/* ================================================== ACCOUNT VERIFICATION */

/**
 * The 6-digit code that confirms an email address.
 *
 * The code is IN this message, which is the whole point — and the reason the
 * template takes no other account data. A verification mail that also recites
 * the account's phone number or KYC state turns a mistyped address at
 * registration into a disclosure.
 */
export function verificationCodeEmail(input: { code: string; recipientName?: string | null; minutes: number }): BuiltEmail {
  const greeting = input.recipientName ? `Hello ${input.recipientName},` : "Hello,";

  const text = `${greeting}

Your PayBridge verification code is:

${input.code}

This code expires in ${input.minutes} minutes. Enter it on the verification screen to confirm your email address.

If you did not create a PayBridge account, you can ignore this message and no account will be activated.

PayBridge will never ask you to send a BVN, NIN, identity document, bank statement or bank login by email.

From Payroll to Prosperity.
PayBridge`;

  return {
    subject: `Your PayBridge verification code: ${input.code}`,
    from: BRIDGERS,
    text,
    html: shell({
      heading: "Confirm your email address",
      signOff: "PayBridge",
      bodyHtml: `${paragraphs([escapeHtml(greeting), "Enter this code on the verification screen to confirm your email address."])}
          <p style="margin:0 0 18px;"><span style="display:inline-block;background:rgba(34,180,144,0.12);border:1px solid ${TEAL};color:${OFF_WHITE};font-size:30px;font-weight:800;letter-spacing:10px;padding:16px 24px;border-radius:12px;font-family:'SF Mono',Menlo,Consolas,monospace;">${escapeHtml(input.code)}</span></p>
          ${paragraphs([
            `This code expires in <strong style="color:${OFF_WHITE};">${input.minutes} minutes</strong>.`,
            "If you did not create a PayBridge account, ignore this message and no account will be activated.",
          ])}`,
    }),
  };
}

/* ================================================ ADMINISTRATOR SECURITY */

/**
 * "Your administrator password was changed."
 *
 * Required by the security spec alongside signing every other session out, and
 * the two belong together: invalidating sessions stops an attacker who already
 * has the password, and this message is what tells the real owner that it
 * happened. Without the mail, a successful account takeover is silent.
 *
 * It names the time and the address the change came from, and nothing else. No
 * password, no reset link, no session token — a security notice that carries a
 * credential is a phishing template with our letterhead on it.
 */
export function adminPasswordChangedEmail(input: {
  name: string;
  at: Date;
  ip?: string | null;
  otherSessionsEnded: boolean;
}): BuiltEmail {
  const when = input.at.toUTCString();
  const from = input.ip ? ` from ${input.ip}` : "";
  const ended = input.otherSessionsEnded
    ? "Every other signed-in session on your account has been ended, so anyone else holding it has been signed out."
    : "";

  const text = `Hello ${input.name},

The password on your PayBridge administrator account was changed on ${when}${from}.

${ended}

If you made this change, no action is needed.

If you did NOT make this change, your account may be compromised. Contact the Super Admin immediately.

PayBridge Security`;

  return {
    subject: "Your PayBridge administrator password was changed",
    from: TEAM,
    text,
    html: shell({
      heading: "Your administrator password was changed",
      signOff: "PayBridge Security",
      footer: "staff",
      bodyHtml: paragraphs([
        escapeHtml(`Hello ${input.name},`),
        `The password on your PayBridge administrator account was changed on <strong style="color:${OFF_WHITE};">${escapeHtml(when)}</strong>${escapeHtml(from)}.`,
        ...(ended ? [ended] : []),
        `<span style="display:block;padding:14px 16px;border-left:3px solid ${GOLD};background:rgba(214,177,102,0.08);border-radius:0 8px 8px 0;color:#DCC79B;">If you did not make this change, your account may be compromised. Contact the Super Admin immediately.</span>`,
      ]),
    }),
  };
}

/**
 * The code that proves an administrator's recovery address.
 *
 * The recovery address is a route back into a privileged account, so it cannot
 * simply be typed and trusted — an unverified one is either a typo (locking the
 * administrator out of their own recovery) or an attacker's inbox (handing them
 * a way in). This code is what turns the claim into a fact.
 */
export function adminRecoveryCodeEmail(input: { code: string; name: string; minutes: number }): BuiltEmail {
  const text = `Hello ${input.name},

Use this code to confirm this address as the recovery contact for your PayBridge administrator account:

${input.code}

The code expires in ${input.minutes} minutes.

If you were not setting up administrator recovery, someone may have entered your address by mistake — or deliberately. Do not share this code with anyone.

PayBridge Security`;

  return {
    subject: `PayBridge administrator recovery code: ${input.code}`,
    from: TEAM,
    text,
    html: shell({
      heading: "Confirm your recovery address",
      signOff: "PayBridge Security",
      footer: "staff",
      bodyHtml: `${paragraphs([
        escapeHtml(`Hello ${input.name},`),
        "Enter this code in the portal to confirm this address as the recovery contact for your administrator account.",
      ])}
          <p style="margin:0 0 18px;"><span style="display:inline-block;background:rgba(34,180,144,0.12);border:1px solid ${TEAL};color:${OFF_WHITE};font-size:30px;font-weight:800;letter-spacing:10px;padding:16px 24px;border-radius:12px;font-family:'SF Mono',Menlo,Consolas,monospace;">${escapeHtml(input.code)}</span></p>
          ${paragraphs([
            `This code expires in <strong style="color:${OFF_WHITE};">${input.minutes} minutes</strong>.`,
            "Do not share it with anyone, including someone claiming to be from PayBridge.",
          ])}`,
    }),
  };
}

/**
 * "An administrator account has been created for you."
 *
 * CARRIES NO CREDENTIAL, and that is the whole design. The temporary password is
 * shown once, in the portal, to the Super Admin who created the account, and is
 * handed over by whatever channel they trust. WHY not email it: a mail that
 * contains a working privileged credential is a phishing template with our
 * letterhead — it teaches the recipient that a PayBridge email carrying a
 * password is normal, and it puts the credential in two mailboxes and every
 * server between them.
 *
 * So this message does the one thing email is safe for: telling a real person
 * that something happened, and what they should expect next.
 */
export function adminAccountCreatedEmail(input: {
  name: string;
  roleLabel: string;
  createdBy: string;
  signInPath: string;
}): BuiltEmail {
  const text = `Hello ${input.name},

A PayBridge administrator account has been created for you by ${input.createdBy}.

  Role: ${input.roleLabel}
  Sign in at: ${input.signInPath}

Your temporary password is NOT in this email. ${input.createdBy} will pass it to you directly, and it stops working 24 hours after it was created or the moment it is first used, whichever comes first.

The first time you sign in, PayBridge will require you to set your own password, enrol an authenticator app, confirm a recovery email address and accept the administrator security policy. Nothing else in the portal opens until all four are done.

If you were not expecting this, reply to this message and do not sign in.

PayBridge Security`;

  return {
    subject: "Your PayBridge administrator account",
    from: TEAM,
    text,
    html: shell({
      heading: "Your administrator account is ready",
      signOff: "PayBridge Security",
      footer: "staff",
      bodyHtml: paragraphs([
        escapeHtml(`Hello ${input.name},`),
        `A PayBridge administrator account has been created for you by <strong style="color:${OFF_WHITE};">${escapeHtml(input.createdBy)}</strong>.`,
        `Role: <strong style="color:${OFF_WHITE};">${escapeHtml(input.roleLabel)}</strong><br>Sign in at: <strong style="color:${OFF_WHITE};">${escapeHtml(input.signInPath)}</strong>`,
        `<span style="display:block;padding:14px 16px;border-left:3px solid ${GOLD};background:rgba(214,177,102,0.08);border-radius:0 8px 8px 0;color:#DCC79B;">Your temporary password is not in this email. ${escapeHtml(input.createdBy)} will pass it to you directly. It stops working 24 hours after it was created, or the moment it is first used — whichever comes first.</span>`,
        "The first time you sign in you will be required to set your own password, enrol an authenticator app, confirm a recovery email address and accept the administrator security policy. Nothing else in the portal opens until all four are done.",
        "If you were not expecting this, reply to this message and do not sign in.",
      ]),
    }),
  };
}

/**
 * A change to someone's administrator access — role changed, suspended, or
 * reinstated.
 *
 * WHY the person losing access is told: a suspension they discover by being
 * locked out mid-task is indistinguishable from an outage, and the first thing
 * they will do is try again from another device, which looks exactly like an
 * attack in the trail. It also means an unauthorised change to a privileged
 * account cannot happen quietly — the account holder is a witness.
 *
 * The internal reason is deliberately NOT included. It is written for the audit
 * trail and for a Super Admin, and may reference an investigation the subject
 * must not be tipped off about.
 */
export function adminAccessChangedEmail(input: {
  name: string;
  change: "role" | "suspended" | "reinstated";
  roleLabel: string;
  at: Date;
}): BuiltEmail {
  const when = input.at.toUTCString();

  const line =
    input.change === "suspended"
      ? "Your PayBridge administrator access has been suspended. You have been signed out everywhere and cannot sign in until a Super Admin reinstates the account."
      : input.change === "reinstated"
        ? `Your PayBridge administrator access has been reinstated. You can sign in again as ${input.roleLabel}.`
        : `Your PayBridge administrator role has been changed to ${input.roleLabel}. You have been signed out, and the new role applies the next time you sign in.`;

  const subject =
    input.change === "suspended"
      ? "Your PayBridge administrator access has been suspended"
      : input.change === "reinstated"
        ? "Your PayBridge administrator access has been reinstated"
        : "Your PayBridge administrator role has changed";

  const text = `Hello ${input.name},

${line}

This took effect on ${when}.

If you did not expect this change, contact the Super Admin immediately.

PayBridge Security`;

  return {
    subject,
    from: TEAM,
    text,
    html: shell({
      heading: subject.replace("Your PayBridge administrator ", "Your administrator "),
      signOff: "PayBridge Security",
      footer: "staff",
      bodyHtml: paragraphs([
        escapeHtml(`Hello ${input.name},`),
        escapeHtml(line),
        `This took effect on <strong style="color:${OFF_WHITE};">${escapeHtml(when)}</strong>.`,
        `<span style="display:block;padding:14px 16px;border-left:3px solid ${GOLD};background:rgba(214,177,102,0.08);border-radius:0 8px 8px 0;color:#DCC79B;">If you did not expect this change, contact the Super Admin immediately.</span>`,
      ]),
    }),
  };
}

/* ================================================================= SUPPORT */

/**
 * "We have your message" — sent the moment a help request lands.
 *
 * LOCALISED, and that is the whole point of the function. Somebody who chose to
 * ask for help in Pidgin and receives an English acknowledgement has been told
 * that the language choice was decoration. English and Pidgin are written out
 * below; the other languages fall back to English until their catalogues are
 * finished, which is visible here rather than hidden behind a lookup that
 * silently returns nothing.
 *
 * It contains NO account information — not a balance, not a bridge amount, not
 * even the account status. It is a receipt, and email is not a private channel:
 * a shared phone, a work laptop or a forwarded inbox reads it too.
 */
export function supportReceivedEmail(input: {
  name: string;
  reference: string;
  /** Human label for the reply channel they chose. */
  channel: string;
  locale: LocaleCode;
}): BuiltEmail {
  const pidgin = input.locale === "pcm";

  const heading = pidgin ? "We get your message" : "We have your message";

  const lines = pidgin
    ? [
        `How you dey ${input.name},`,
        `We don receive wetin you send. Your reference na <strong style="color:${OFF_WHITE};">${escapeHtml(input.reference)}</strong> — keep am, e go help us find your message quick quick.`,
        `We go reply you through: <strong style="color:${OFF_WHITE};">${escapeHtml(input.channel)}</strong>. Real person go answer you inside one working day.`,
        `If you tell us say make we no call you, we no go call. We go write you.`,
        `Remember: PayBridge no go ever ask you for your password, your PIN, your BVN abi your bank details through email.`,
      ]
    : [
        `Hello ${input.name},`,
        `We have received your message. Your reference is <strong style="color:${OFF_WHITE};">${escapeHtml(input.reference)}</strong> — keep it, and we can find your message straight away.`,
        `We will reply by: <strong style="color:${OFF_WHITE};">${escapeHtml(input.channel)}</strong>. A real person answers, within one working day.`,
        `If you told us not to phone you, we will not phone you. We will write instead.`,
        `One thing to remember: PayBridge will never ask you for your password, your PIN, your BVN or your bank details by email.`,
      ];

  const text = pidgin
    ? `How you dey ${input.name},

We don receive wetin you send.

  Reference: ${input.reference}
  We go reply through: ${input.channel}

Real person go answer you inside one working day. If you tell us make we no call you, we no go call — we go write you.

PayBridge no go ever ask you for your password, your PIN, your BVN abi your bank details through email.

PayBridge Team`
    : `Hello ${input.name},

We have received your message.

  Reference: ${input.reference}
  We will reply by: ${input.channel}

A real person answers, within one working day. If you told us not to phone you, we will not phone you — we will write instead.

PayBridge will never ask you for your password, your PIN, your BVN or your bank details by email.

PayBridge Team`;

  return {
    subject: pidgin ? `We get your message — ${input.reference}` : `We have your message — ${input.reference}`,
    from: BRIDGERS,
    text,
    html: shell({
      heading,
      signOff: "PayBridge Team",
      bodyHtml: paragraphs(lines.map((line, index) => (index === 0 ? escapeHtml(line) : line))),
    }),
  };
}

/**
 * A staff reply to a help request, delivered by email.
 *
 * The reply text is written by a support agent and is passed through
 * `escapeHtml` before it reaches the template. WHY that matters here more than
 * elsewhere: this is the one place where text typed by one human is rendered
 * into HTML sent to another, which is precisely the shape of a stored-XSS or a
 * spoofed-instruction attack ("PayBridge Security: confirm your PIN below").
 */
export function supportReplyEmail(input: {
  name: string;
  reference: string;
  reply: string;
  locale: LocaleCode;
  agentLabel: string;
}): BuiltEmail {
  const pidgin = input.locale === "pcm";

  const intro = pidgin
    ? `How you dey ${input.name}, we get answer for your message (${input.reference}):`
    : `Hello ${input.name}, here is our reply to your message (${input.reference}):`;

  const closing = pidgin
    ? "If e no clear, just reply dis email abi open Get help inside di app. We dey here."
    : "If that is not clear, reply to this email or open Get help in the app. We are here.";

  const text = `${intro}

${input.reply}

${closing}

${input.agentLabel}
PayBridge Team`;

  return {
    subject: pidgin ? `Answer from PayBridge — ${input.reference}` : `Reply from PayBridge — ${input.reference}`,
    from: BRIDGERS,
    text,
    html: shell({
      heading: pidgin ? "Answer from PayBridge" : "Reply from PayBridge",
      signOff: `${input.agentLabel} · PayBridge Team`,
      bodyHtml: paragraphs([
        escapeHtml(intro),
        `<span style="display:block;padding:14px 16px;border-left:3px solid ${TEAL};background:rgba(34,180,144,0.08);border-radius:0 8px 8px 0;white-space:pre-wrap;">${escapeHtml(input.reply)}</span>`,
        escapeHtml(closing),
      ]),
    }),
  };
}
