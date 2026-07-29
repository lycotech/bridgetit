import nodemailer, { type Transporter } from "nodemailer";
import { formatSender, type EmailIdentity } from "./identities";
import { audit, pseudonymise } from "../security/audit";
import { isProduction } from "../security/config";
import { OUTBOX_ENABLED, recordToOutbox } from "./outbox";

/**
 * Outbound mail.
 *
 * THREE transports, chosen at boot from the environment, in priority order:
 *
 *   1. SMTP        — set MAIL_TRANSPORT=smtp (or just set SMTP_HOST).
 *   2. Resend      — set MAIL_TRANSPORT=resend and RESEND_API_KEY.
 *   3. Log-only    — the default when nothing is configured.
 *
 * WHY a log-only transport instead of throwing: an unconfigured mail server
 * must not lose a registration. The row is already committed to the database
 * before send is attempted; if the transport is absent, the message is written
 * to the audit log (subject + recipient only) and the submission still
 * succeeds. The admin dashboard shows the delivery note so nobody assumes a
 * welcome email went out when it did not.
 *
 * CREDENTIALS: read from the environment, here, on the server, once. They are
 * never sent to the browser, never embedded in a build, and never logged —
 * `logCredentialPosture()` prints whether a value is present, never the value.
 */

export interface MailMessage {
  to: string | string[];
  from: EmailIdentity;
  /** Where a human reply should land — the person who submitted the form. */
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
  cc?: string[];
}

export type TransportKind = "smtp" | "resend" | "log";

const env = process.env as Record<string, string | undefined>;

function chooseTransport(): TransportKind {
  const explicit = env.MAIL_TRANSPORT?.toLowerCase();
  if (explicit === "smtp" || explicit === "resend" || explicit === "log") return explicit;
  if (env.SMTP_HOST) return "smtp";
  if (env.RESEND_API_KEY) return "resend";
  return "log";
}

export const TRANSPORT_KIND: TransportKind = chooseTransport();

let smtpTransport: Transporter | null = null;

function getSmtpTransport(): Transporter {
  if (smtpTransport) return smtpTransport;

  const port = Number(env.SMTP_PORT ?? 587);
  /**
   * `secure` means implicit TLS from the first byte (port 465). On 587 the
   * connection starts plaintext and upgrades via STARTTLS, which we REQUIRE —
   * without `requireTLS`, nodemailer will silently fall back to sending
   * credentials and applicant PII in the clear if the server does not offer
   * STARTTLS. That silent downgrade is the whole risk, so it is closed here.
   */
  const secure = (env.SMTP_SECURE ?? (port === 465 ? "ssl" : "starttls")).toLowerCase();

  smtpTransport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: secure === "ssl" || secure === "tls" || secure === "true",
    requireTLS: secure === "starttls",
    auth:
      env.SMTP_USER && env.SMTP_PASSWORD
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
    // Never accept an unverifiable certificate in production: a MITM on the
    // SMTP hop sees every applicant's name, email and phone number.
    tls: { rejectUnauthorized: isProduction },
    pool: true,
    maxConnections: 3,
  });

  return smtpTransport;
}

async function sendViaResend(message: MailMessage): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: formatSender(message.from),
      to: Array.isArray(message.to) ? message.to : [message.to],
      cc: message.cc,
      reply_to: message.replyTo,
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });

  if (!response.ok) {
    // Body may echo the payload; read the status only.
    throw new Error(`Resend rejected the message (HTTP ${response.status})`);
  }
}

export interface SendOutcome {
  delivered: boolean;
  /** Short, non-sensitive note stored against the registration row. */
  note: string;
}

/**
 * Send one message. Never throws — a mail failure must not fail a
 * registration that is already saved.
 */
export async function sendMail(message: MailMessage): Promise<SendOutcome> {
  const recipients = Array.isArray(message.to) ? message.to : [message.to];

  try {
    switch (TRANSPORT_KIND) {
      case "smtp": {
        await getSmtpTransport().sendMail({
          from: formatSender(message.from),
          sender: message.from.address,
          to: recipients,
          cc: message.cc,
          replyTo: message.replyTo,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
        break;
      }
      case "resend": {
        await sendViaResend(message);
        break;
      }
      case "log": {
        /*
         * No transport configured. Keep a readable copy in the development
         * outbox so the codes these messages exist to carry are not simply lost
         * — see email/outbox.ts, which is inert in production. `delivered` stays
         * false either way: the message did not leave the building, and a route
         * that tells the customer otherwise would be lying.
         */
        recordToOutbox(message);
        // Recipients pseudonymised: the audit log records that a welcome mail
        // was due, without becoming a second copy of the mailing list.
        audit({
          action: "mail.not_configured",
          actor: "system",
          outcome: "success",
          target: message.subject,
          detail: { to: recipients.map(pseudonymise), from: message.from.address, outbox: OUTBOX_ENABLED },
        });
        return {
          delivered: false,
          note: OUTBOX_ENABLED
            ? "Mail transport not configured — held in the development outbox. Set RESEND_API_KEY or SMTP_HOST to deliver."
            : "Mail transport not configured — message not sent. Set SMTP_HOST or RESEND_API_KEY.",
        };
      }
    }

    audit({
      action: "mail.sent",
      actor: "system",
      outcome: "success",
      target: message.subject,
      detail: { to: recipients.map(pseudonymise), from: message.from.address },
    });
    return { delivered: true, note: `Sent via ${TRANSPORT_KIND}` };
  } catch (err) {
    /**
     * The raw error can carry the SMTP conversation, which includes the
     * recipient address and sometimes the auth exchange. Log the message text
     * only, and only after it has been through the same redaction as anything
     * else.
     */
    const reason = err instanceof Error ? err.message.slice(0, 200) : "unknown error";
    audit({
      action: "mail.failed",
      actor: "system",
      outcome: "failure",
      target: message.subject,
      detail: { to: recipients.map(pseudonymise), reason },
    });
    return { delivered: false, note: `Delivery failed: ${reason}` };
  }
}

/**
 * Startup posture line. Prints whether each secret is PRESENT, never its value
 * — a boot log that echoes a password is how SMTP credentials end up in a CI
 * artefact that is more widely readable than the secret store itself.
 */
export function logMailPosture(): void {
  console.log(
    JSON.stringify({
      type: "startup.mail",
      transport: TRANSPORT_KIND,
      smtpHost: env.SMTP_HOST ? "configured" : "absent",
      smtpPort: env.SMTP_PORT ?? (env.SMTP_HOST ? "587 (default)" : "absent"),
      smtpUser: env.SMTP_USER ? "configured" : "absent",
      smtpPassword: env.SMTP_PASSWORD ? "configured" : "absent",
      resendKey: env.RESEND_API_KEY ? "configured" : "absent",
    }),
  );
}
