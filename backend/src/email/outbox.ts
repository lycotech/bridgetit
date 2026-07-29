import { mkdirSync, writeFileSync, readdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { isProduction } from "../security/config";
import type { MailMessage } from "./mailer";

/**
 * Development outbox — where mail goes when no transport is configured.
 *
 * WHY this exists: with no SMTP host and no Resend key, `sendMail` previously
 * recorded "a message was due" and threw the body away. Every flow that depends
 * on a code arriving by email — customer verification, administrator recovery,
 * a private-demonstration invitation — then became untestable, and the honest
 * answer to "did that go to any mail?" was "no, and there is no copy".
 *
 * So messages are written here instead: to disk as .eml files, readable by the
 * Super Admin through the portal. Nothing is faked — `delivered` stays false and
 * the caller still knows the message did not leave the building.
 *
 * HARD RULE: disabled in production, unconditionally, at the top of every
 * function in this file. The bodies contain verification codes, invitation codes
 * and recovery codes in plaintext, because that is what those emails are for. A
 * readable copy of them is acceptable on a developer's machine and is a
 * credential store on a live server. There is no configuration flag to turn this
 * on in production, deliberately — a flag would eventually be set.
 */

const OUTBOX_DIR = join(process.cwd(), ".data", "outbox");

/**
 * How many messages to keep. Old ones are deleted rather than left to grow: this
 * is a debugging aid, not an archive, and an unbounded directory of plaintext
 * codes is a worse problem than a short history.
 */
const MAX_MESSAGES = 60;

export interface OutboxMessage {
  id: string;
  at: string;
  to: string[];
  from: string;
  subject: string;
  text: string;
  html?: string;
}

export const OUTBOX_ENABLED = !isProduction;

function ensureDir(): void {
  mkdirSync(OUTBOX_DIR, { recursive: true });
}

/** Filenames sort chronologically, so `readdir` order is send order. */
function filename(at: Date, subject: string): string {
  const stamp = at.toISOString().replace(/[:.]/g, "-");
  const slug = subject
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${stamp}__${slug || "message"}.json`;
}

function prune(): void {
  const files = readdirSync(OUTBOX_DIR).filter((f) => f.endsWith(".json")).sort();
  for (const stale of files.slice(0, Math.max(0, files.length - MAX_MESSAGES))) {
    try {
      unlinkSync(join(OUTBOX_DIR, stale));
    } catch {
      // A file we cannot delete is not worth failing a send over.
    }
  }
}

/**
 * Record one undelivered message. Never throws — this is called from inside
 * `sendMail`, which is called from routes that have already committed their
 * work, so a filesystem problem here must not turn a successful registration
 * into a 500.
 */
export function recordToOutbox(message: MailMessage): void {
  if (!OUTBOX_ENABLED) return;
  const at = new Date();
  const entry: OutboxMessage = {
    id: filename(at, message.subject).replace(/\.json$/, ""),
    at: at.toISOString(),
    to: Array.isArray(message.to) ? message.to : [message.to],
    from: message.from.address,
    subject: message.subject,
    text: message.text,
    html: message.html,
  };
  try {
    ensureDir();
    writeFileSync(join(OUTBOX_DIR, `${entry.id}.json`), JSON.stringify(entry, null, 2), "utf8");
    prune();
  } catch {
    /* ignore */
  }
}

/** Most recent first, so the portal shows the message someone is waiting for. */
export function readOutbox(limit = 30): OutboxMessage[] {
  if (!OUTBOX_ENABLED) return [];
  try {
    ensureDir();
    return readdirSync(OUTBOX_DIR)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse()
      .slice(0, limit)
      .map((f) => JSON.parse(readFileSync(join(OUTBOX_DIR, f), "utf8")) as OutboxMessage);
  } catch {
    return [];
  }
}

export function clearOutbox(): number {
  if (!OUTBOX_ENABLED) return 0;
  try {
    ensureDir();
    const files = readdirSync(OUTBOX_DIR).filter((f) => f.endsWith(".json"));
    for (const f of files) unlinkSync(join(OUTBOX_DIR, f));
    return files.length;
  } catch {
    return 0;
  }
}
