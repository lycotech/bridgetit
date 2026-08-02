import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isProduction } from "./config";

/**
 * Stateless, signed invitation linking one `EmployeeRecord` (a payroll
 * roster row) to the real customer account that person eventually registers
 * or already holds — the same construction as the employer team invite
 * tokens (security/employer-session.ts), and for the same reason: no schema
 * column exists to store a token, and none needs to — the signature is the
 * proof, and it expires on its own.
 *
 * The email is embedded in the token (not just the record id) so acceptance
 * can be checked against the CUSTOMER'S OWN verified email rather than trusting
 * whatever the employer typed — see routes/employee-link.ts.
 */

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (value && value.length >= 32) return value;
  if (isProduction) {
    throw new Error("SESSION_SECRET is required in production and must be at least 32 characters.");
  }
  return devSecret;
}
const devSecret = randomBytes(48).toString("base64");

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function signEmployeeLinkInvite(employeeRecordId: string, email: string): string {
  const expires = Date.now() + INVITE_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ id: employeeRecordId, email, exp: expires })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyEmployeeLinkInvite(token: string): { employeeRecordId: string; email: string } | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  if (!safeEqual(mac, sign(payload))) return null;

  let parsed: { id: string; email: string; exp: number };
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed.id || !parsed.email || Date.now() > parsed.exp) return null;
  return { employeeRecordId: parsed.id, email: parsed.email };
}
