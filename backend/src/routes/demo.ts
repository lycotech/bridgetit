import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { prisma } from "../db";
import { rateLimit } from "../security/rate-limit";
import { pseudonymise } from "../security/audit";
import { record } from "../security/audit-store";
import {
  clearStaffSession,
  issueStaffSession,
  readStaffSession,
  requireDemoAccess,
} from "../security/staff-session";
import { hashInvitationCode, looksLikeInvitationCode } from "../security/codes";
import { formatExpiry } from "../email/templates";
import { demoAccessSchema } from "../types";

const demoRouter = new Hono();

/**
 * Private demonstration access control.
 *
 * The demo environment still exists — it has NOT been deleted. What changed is
 * that reaching it now requires an invitation: the email address a named
 * invitee was invited on, plus the invitation code issued to them by an
 * authorised PayBridge team member. There is no shared password and no link
 * that works on its own.
 *
 * Every attempt, successful or not, is written to DemoAccessLog with a hashed
 * IP, so "who saw the demo and when" is answerable months later.
 *
 * NOTE the 404s. An unauthenticated caller gets "Not found", never "Forbidden".
 * A 403 confirms the route exists, which is precisely the fact the whole
 * section is trying to withhold — the demo must not be discoverable through
 * public route lists or unauthenticated URLs.
 */

// Brute force is the whole threat model for a token endpoint. Tight limits.
demoRouter.use("/redeem", rateLimit({ name: "demo:redeem", limit: 10, windowMs: 10 * 60_000 }));
demoRouter.use("/code", rateLimit({ name: "demo:code", limit: 5, windowMs: 15 * 60_000 }));

function hashedIp(c: Context): string | null {
  const xff = c.req.header("x-forwarded-for");
  const ip =
    xff?.split(",")[0]?.trim() ?? c.req.header("cf-connecting-ip") ?? c.req.header("x-real-ip") ?? null;
  return ip ? pseudonymise(ip) : null;
}

async function logAccess(
  c: Context,
  input: {
    invitationId?: string | null;
    email?: string | null;
    method: string;
    outcome: string;
    path?: string;
  },
): Promise<void> {
  await prisma.demoAccessLog
    .create({
      data: {
        invitationId: input.invitationId ?? null,
        email: input.email ?? null,
        method: input.method,
        outcome: input.outcome,
        path: input.path ?? null,
        ipHash: hashedIp(c),
        userAgent: c.req.header("user-agent")?.slice(0, 300) ?? null,
      },
    })
    .catch(() => {
      /* Never let logging failure block or leak. */
    });
}

/**
 * Redeem an invitation: the invited EMAIL ADDRESS plus the invitation CODE.
 *
 * Two facts, not one. The code arrives by email and email gets forwarded; the
 * address the invitation was issued to is what makes a forwarded code useless to
 * whoever received it. Neither half travels in a URL at any point.
 *
 * On the error messages: this endpoint DOES distinguish expired from revoked
 * from already-used — but only for a caller who supplied the matching email
 * address for a real code. Get the pair right and you are, by construction, the
 * invitee, and the invitee needs to know whether to ask for an extension or a
 * new invitation. Get the email wrong and every outcome collapses to one
 * message, so the endpoint cannot be used to enumerate which codes exist.
 */
demoRouter.post("/redeem", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { message: "Invalid request.", code: "BAD_REQUEST" } }, 400);
  }

  const parsed = demoAccessSchema.safeParse(body);
  if (!parsed.success) {
    await logAccess(c, { method: "invitation", outcome: "denied" });
    return c.json(
      {
        error: {
          message: parsed.error.issues[0]?.message ?? "Enter your email address and invitation code.",
          code: "VALIDATION_ERROR",
        },
      },
      400,
    );
  }
  const { email, code } = parsed.data;

  /** The generic refusal. Used for anything that is not a proven invitee. */
  const unrecognised = () =>
    c.json(
      {
        error: {
          message:
            "We could not match that email address and invitation code. Check both against your invitation, " +
            "or ask your PayBridge contact to send a new one.",
          code: "INVALID_CODE",
        },
      },
      403,
    );

  // Shape check before touching the database, so junk costs no query.
  if (!looksLikeInvitationCode(code)) {
    await logAccess(c, { email, method: "invitation", outcome: "denied" });
    await record(c, {
      action: "invitation.validation.failed",
      outcome: "denied",
      actorType: "invitee",
      // Pseudonymised, not stored in the clear: nobody has proved they own this
      // address, so it is an unverified third party's email until the pair
      // matches. The hash is still enough to answer "how many attempts from the
      // same address?".
      actorLabel: pseudonymise(email),
      detail: { reason: "malformed_code" },
    });
    return unrecognised();
  }

  /*
   * Look the code up BY HASH of its canonical form. Only the hash is stored, so
   * a database dump hands over no working demonstration credential — the same
   * reason you never store a password.
   */
  const invitation = await prisma.demoInvitation.findUnique({
    where: { tokenHash: hashInvitationCode(code) },
  });

  const now = new Date();

  /*
   * A real code was quoted: record that it has been touched, whatever happens
   * next. This is what lets the admin list distinguish "they never tried" from
   * "they tried and something was wrong".
   */
  if (invitation && !invitation.openedAt) {
    await prisma.demoInvitation
      .update({ where: { id: invitation.id }, data: { openedAt: now } })
      .catch(() => null);
  }

  const emailMatches = invitation?.email.toLowerCase() === email;

  if (!invitation || !emailMatches) {
    await logAccess(c, {
      invitationId: invitation?.id ?? null,
      email,
      method: "invitation",
      outcome: "denied",
    });
    await record(c, {
      action: "invitation.validation.failed",
      outcome: "denied",
      actorType: "invitee",
      actorLabel: pseudonymise(email),
      targetType: invitation ? "invitation" : null,
      targetId: invitation?.id ?? null,
      // The audit trail records WHICH it was even though the response does not.
      // Staff investigating a support call need the distinction; the caller does
      // not get it, because that is the enumeration channel.
      detail: { reason: invitation ? "email_mismatch" : "unknown_code" },
    });
    return unrecognised();
  }

  /* -------- From here the caller has proved the pair: be specific with them. */

  const refusals = [
    {
      when: invitation.revokedAt !== null,
      code: "CODE_REVOKED",
      reason: "revoked",
      message:
        "This invitation has been withdrawn. Please contact your PayBridge contact if you still need access.",
    },
    {
      when: invitation.expiresAt <= now,
      code: "CODE_EXPIRED",
      reason: "expired",
      message: `This invitation expired on ${formatExpiry(invitation.expiresAt)}. Ask your PayBridge contact to extend it or send a new one.`,
    },
    {
      when: invitation.useCount >= invitation.maxUses,
      code: "CODE_USED",
      reason: "already_used",
      message:
        invitation.maxUses === 1
          ? "This invitation has already been used. Each code opens the demonstration once — ask your PayBridge contact for a new one."
          : `This invitation has been used its full ${invitation.maxUses} times. Ask your PayBridge contact for a new one.`,
    },
  ];

  const refusal = refusals.find((entry) => entry.when);
  if (refusal) {
    await logAccess(c, {
      invitationId: invitation.id,
      email: invitation.email,
      method: "invitation",
      outcome: "denied",
    });
    await record(c, {
      action: "invitation.validation.failed",
      outcome: "denied",
      actorType: "invitee",
      // The pair matched, so this really is the invitee: attribute it to them.
      actorLabel: invitation.email,
      targetType: "invitation",
      targetId: invitation.id,
      previousStatus: refusal.reason,
      detail: { reason: refusal.reason, codeHint: invitation.tokenHint },
    });
    return c.json({ error: { message: refusal.message, code: refusal.code } }, 403);
  }

  await prisma.demoInvitation.update({
    where: { id: invitation.id },
    data: { useCount: { increment: 1 }, redeemedAt: invitation.redeemedAt ?? now },
  });

  /*
   * The demonstration session is time-limited by construction: four hours
   * absolute, one hour idle, enforced in staff-session.ts. It carries the
   * invitation id so every page view inside the demo is attributable to the
   * invitation that opened it.
   */
  issueStaffSession(c, {
    aud: "demo",
    sub: invitation.email,
    inv: invitation.id,
    portal: invitation.portal,
  });

  await logAccess(c, {
    invitationId: invitation.id,
    email: invitation.email,
    method: "invitation",
    outcome: "granted",
  });
  await record(c, {
    action: "invitation.used",
    outcome: "success",
    actorType: "invitee",
    actorLabel: invitation.email,
    targetType: "invitation",
    targetId: invitation.id,
    previousStatus: invitation.redeemedAt ? "used" : "opened",
    newStatus: invitation.useCount + 1 >= invitation.maxUses ? "used" : "opened",
    detail: {
      codeHint: invitation.tokenHint,
      demoType: invitation.demoType,
      portal: invitation.portal,
      use: `${invitation.useCount + 1}/${invitation.maxUses}`,
    },
  });

  if (invitation.registrationId) {
    await prisma.registration
      .update({
        where: { id: invitation.registrationId },
        data: { demoInvitationStatus: "Demo opened" },
      })
      .catch(() => {});
  }

  return c.json({
    data: {
      access: "granted" as const,
      portal: invitation.portal,
      demoType: invitation.demoType,
      expiresAt: invitation.expiresAt.toISOString(),
    },
  });
});

/*
 * The shared access-code route that used to sit here has been retired.
 *
 * It granted a demonstration session to anyone holding one deployment-wide
 * secret — no named invitee, no expiry of its own, nothing to revoke when a
 * walkthrough audience passed it on. That is the opposite of the requirement
 * that demonstrations be available by invitation only, and it left a second,
 * weaker door on a room the invitation system was carefully locking.
 *
 * A live group walkthrough is served by an invitation with a higher use limit,
 * which stays attributable and revocable.
 */

/**
 * Session probe used by the SPA to decide whether to render the demo at all.
 *
 * Returns 200 with `{ access: "none" }` rather than a 401 so the gate page can
 * render its own form without the browser console filling with errors — and
 * crucially it discloses nothing: the same body is returned to everyone who is
 * not already inside.
 */
demoRouter.get("/session", async (c) => {
  const admin = readStaffSession(c, "admin");
  const demo = admin ?? readStaffSession(c, "demo");
  if (!demo) return c.json({ data: { access: "none" as const, portal: null, viewer: null } });
  return c.json({
    data: {
      access: "granted" as const,
      portal: demo.portal ?? null,
      viewer: demo.aud === "admin" ? "PayBridge team" : demo.sub,
    },
  });
});

demoRouter.post("/logout", async (c) => {
  clearStaffSession(c, "demo");
  return c.json({ data: { access: "none" as const } });
});

/** Record a page view inside the demo — "who accessed it and when", per page. */
demoRouter.post("/beacon", requireDemoAccess(), async (c) => {
  const session = c.get("staff");
  let path = "unknown";
  try {
    const body = (await c.req.json()) as { path?: unknown };
    if (typeof body?.path === "string") path = body.path.slice(0, 200);
  } catch {
    /* keep the default */
  }
  await logAccess(c, {
    invitationId: session?.inv ?? null,
    email: session?.sub ?? null,
    method: session?.aud === "admin" ? "admin" : "invitation",
    outcome: "page_view",
    path,
  });
  return c.body(null, 204);
});

export { demoRouter };
