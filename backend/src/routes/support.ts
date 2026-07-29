import { Hono } from "hono";
import { prisma } from "../db";
import { readSession } from "../security/session";
import { rateLimit } from "../security/rate-limit";
import { validate } from "../security/validate";
import { record } from "../security/audit-store";
import { sendMail } from "../email/mailer";
import { supportReceivedEmail } from "../email/templates";
import {
  createSupportTicketSchema,
  SUPPORT_CHANNEL_LABELS,
  type LocaleCode,
  type SupportChannel,
  type SupportMessageView,
  type SupportTicketStatus,
  type SupportTicketView,
} from "../types";
import { z } from "zod";

/**
 * Asking for help — Employee → Get help.
 *
 * THE CENTRAL DECISION: creating a ticket does NOT require being signed in.
 *
 * That looks like a hole and is the opposite. The people who most need to reach a
 * human are the ones who cannot get in: the password is wrong, the OTP never
 * arrived, the account is suspended, the phone is borrowed, the app makes no
 * sense. A support form behind a login wall answers only the people who did not
 * need it. So this endpoint is public, rate-limited by IP, and the ticket simply
 * records whether a session was present.
 *
 * Reading tickets is the reverse: strictly the caller's own, matched on the
 * session's user id, so a reference number seen over someone's shoulder opens
 * nothing.
 *
 * Every request becomes a ticket with a readable reference — no channel is
 * fire-and-forget, including WhatsApp and phone, because "we called you back"
 * has to be checkable by someone other than the person who claims it.
 */
const supportRouter = new Hono();

/**
 * Five requests an hour per address.
 *
 * Set generously on purpose: a confused person sends the same message three
 * times, and the cost of blocking them is that PayBridge looks broken at the
 * moment they were already struggling. It stops a script, not a worried customer.
 */
const CREATE_LIMIT = rateLimit({ name: "support:create", limit: 5, windowMs: 60 * 60_000 });

/** PB-S-7K4M — quotable on a phone call. */
const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newReference(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const body = Array.from(bytes, (byte) => REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length]).join("");
  return `PB-S-${body}`;
}

/**
 * Reference collisions are possible (32^4 ≈ 1M), so this retries rather than
 * trusting the odds. A duplicate reference would attach a stranger's reply to the
 * wrong conversation, which is the one failure mode worth a loop.
 */
async function uniqueReference(): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const reference = newReference();
    const taken = await prisma.supportTicket.findUnique({ where: { reference }, select: { id: true } });
    if (!taken) return reference;
  }
  // Fall back to something certainly unique rather than failing the request. A
  // long reference is inconvenient to read out; losing the ticket is worse.
  return `PB-S-${Date.now().toString(36).toUpperCase()}`;
}

interface TicketRow {
  id: string;
  reference: string;
  channel: string;
  locale: string;
  subject: string;
  body: string;
  status: string;
  assistedOnboarding: boolean;
  textOnly: boolean;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  messages: {
    id: string;
    authorType: string;
    authorLabel: string;
    body: string;
    internal: boolean;
    createdAt: Date;
  }[];
}

/**
 * The customer's view of their own ticket.
 *
 * `internal` messages are dropped HERE, in the serialiser every customer
 * response goes through, rather than being filtered at each call site. A
 * staff-only note leaking into a customer response is the kind of bug that gets
 * written once and copied forever, so there is one place to get it right.
 */
function serialiseForCustomer(row: TicketRow): SupportTicketView {
  const messages: SupportMessageView[] = row.messages
    .filter((message) => !message.internal)
    .map((message) => ({
      id: message.id,
      authorType: message.authorType as SupportMessageView["authorType"],
      authorLabel: message.authorLabel,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    }));

  return {
    id: row.id,
    reference: row.reference,
    channel: row.channel as SupportChannel,
    locale: row.locale as LocaleCode,
    subject: row.subject,
    body: row.body,
    status: row.status as SupportTicketStatus,
    assistedOnboarding: row.assistedOnboarding,
    textOnly: row.textOnly,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    messages,
  };
}

const TICKET_INCLUDE = { messages: { orderBy: { createdAt: "asc" } } } as const;

/**
 * POST /api/support/tickets — ask for help. Public.
 *
 * If a session is present the ticket is linked to the account, and the stored
 * preferences fill in the reply language and the "do not phone me" flag, so a
 * person does not have to state their needs again every time they ask a question.
 * What they typed in the form always wins over the stored preference — the form
 * is this request; the preference is the standing default.
 */
supportRouter.post("/tickets", CREATE_LIMIT, validate("json", createSupportTicketSchema), async (c) => {
  const input = c.req.valid("json");
  const session = readSession(c);

  let userId: string | null = null;
  let stored: { locale: string; textOnly: boolean; supportChannel: string } | null = null;

  if (session?.sub) {
    // Confirm the account exists before linking; a stale cookie must not create
    // a ticket pointing at a deleted row.
    const account = await prisma.user.findUnique({
      where: { id: session.sub },
      select: { id: true, preferences: { select: { locale: true, textOnly: true, supportChannel: true } } },
    });
    if (account) {
      userId = account.id;
      stored = account.preferences;
    }
  }

  const reference = await uniqueReference();

  const ticket = await prisma.supportTicket.create({
    data: {
      reference,
      userId,
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      channel: input.channel,
      locale: input.locale ?? (stored?.locale as LocaleCode | undefined) ?? "en",
      // A standing "do not phone me" is honoured even when this particular form
      // did not repeat it.
      textOnly: input.textOnly || Boolean(stored?.textOnly),
      assistedOnboarding: input.assistedOnboarding,
      callbackWindow: input.callbackWindow || null,
      subject: input.subject,
      body: input.body,
      // A request for a human to walk someone through the app is urgent in a way
      // a question about a fee is not: they are stuck now, and every day of delay
      // is a day they cannot use money they have already earned.
      priority: input.assistedOnboarding ? "high" : "normal",
      messages: {
        create: {
          authorType: "customer",
          authorId: userId,
          authorLabel: input.name,
          body: input.body,
        },
      },
    },
    include: TICKET_INCLUDE,
  });

  await record(c, {
    action: "support.ticket.created",
    outcome: "success",
    actorType: userId ? "user" : "anonymous",
    actorId: userId,
    actorLabel: input.email,
    targetType: "ticket",
    targetId: ticket.reference,
    detail: {
      channel: input.channel,
      locale: ticket.locale,
      textOnly: ticket.textOnly,
      assistedOnboarding: input.assistedOnboarding,
      signedIn: Boolean(userId),
    },
  });

  /*
   * The acknowledgement is best-effort. `sendMail` never throws, and a mail
   * failure must not fail a request that is already saved — the ticket exists and
   * staff can see it whether or not the confirmation went out.
   */
  const mail = await sendMail({
    ...supportReceivedEmail({
      name: input.name,
      reference: ticket.reference,
      channel: SUPPORT_CHANNEL_LABELS[input.channel],
      locale: ticket.locale as LocaleCode,
    }),
    to: input.email,
  }).catch(() => ({ delivered: false, note: "send threw" }));

  return c.json({ data: { ticket: serialiseForCustomer(ticket), acknowledged: mail.delivered } }, 201);
});

/**
 * Everything below is the caller's own history, so a session is mandatory.
 *
 * Not `requireUser()`: a suspended account must still be able to read the
 * conversation about its own suspension. The gate here is "is this your ticket",
 * which is the only question that matters for reading one.
 */
supportRouter.use("/tickets/mine", async (c, next) => {
  const session = readSession(c);
  if (!session?.sub) {
    return c.json({ error: { message: "Sign in to see your past messages.", code: "UNAUTHENTICATED" } }, 401);
  }
  await next();
});
supportRouter.use("/tickets/mine/*", async (c, next) => {
  const session = readSession(c);
  if (!session?.sub) {
    return c.json({ error: { message: "Sign in to see your past messages.", code: "UNAUTHENTICATED" } }, 401);
  }
  await next();
});

/** GET /api/support/tickets/mine — my requests, newest first. */
supportRouter.get("/tickets/mine", async (c) => {
  const session = readSession(c);
  const rows = await prisma.supportTicket.findMany({
    where: { userId: session?.sub ?? "" },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: TICKET_INCLUDE,
  });
  return c.json({ data: { items: rows.map(serialiseForCustomer) } });
});

/**
 * GET /api/support/tickets/mine/:reference — one of my requests.
 *
 * 404 rather than 403 for a ticket belonging to someone else: a 403 would confirm
 * the reference is real, turning the endpoint into a lookup oracle for anyone who
 * glimpsed a reference number.
 */
supportRouter.get("/tickets/mine/:reference", async (c) => {
  const session = readSession(c);
  const row = await prisma.supportTicket.findFirst({
    where: { reference: c.req.param("reference"), userId: session?.sub ?? "" },
    include: TICKET_INCLUDE,
  });
  if (!row) return c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404);
  return c.json({ data: serialiseForCustomer(row) });
});

/**
 * POST /api/support/tickets/mine/:reference/messages — add to the conversation.
 *
 * Replying reopens a ticket that was waiting on the customer, and pulls a
 * resolved one back to open. A person who answers a question should never have to
 * start a new request to be heard again.
 */
supportRouter.post(
  "/tickets/mine/:reference/messages",
  rateLimit({ name: "support:reply", limit: 30, windowMs: 60 * 60_000 }),
  validate("json", z.object({ body: z.string().trim().min(1, "Write your message.").max(4000) })),
  async (c) => {
    const session = readSession(c);
    const { body } = c.req.valid("json");

    const existing = await prisma.supportTicket.findFirst({
      where: { reference: c.req.param("reference"), userId: session?.sub ?? "" },
      select: { id: true, reference: true, status: true, name: true, email: true },
    });
    if (!existing) return c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404);

    const updated = await prisma.supportTicket.update({
      where: { id: existing.id },
      data: {
        status: existing.status === "resolved" || existing.status === "waiting_on_customer" ? "open" : existing.status,
        resolvedAt: existing.status === "resolved" ? null : undefined,
        messages: {
          create: { authorType: "customer", authorId: session?.sub ?? null, authorLabel: existing.name, body },
        },
      },
      include: TICKET_INCLUDE,
    });

    await record(c, {
      action: "support.ticket.replied",
      outcome: "success",
      actorType: "user",
      actorId: session?.sub ?? null,
      actorLabel: existing.email,
      targetType: "ticket",
      targetId: existing.reference,
      previousStatus: existing.status,
      newStatus: updated.status,
      detail: { by: "customer" },
    });

    return c.json({ data: serialiseForCustomer(updated) });
  },
);

export { supportRouter };
