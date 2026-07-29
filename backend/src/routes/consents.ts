import { Hono } from "hono";
import { prisma } from "../db";
import { requireUser } from "./auth";
import { record } from "../security/audit-store";
import { validate } from "../security/validate";
import { readSession } from "../security/session";
import { clientIp } from "../security/client-ip";
import type { AccountRow } from "../security/account-gate";
import {
  acceptConsentSchema,
  LOCALE_CODES,
  type ConsentVersionView,
  type LocaleCode,
} from "../types";

/**
 * What a person has agreed to, in the language they read it in.
 *
 * The `ConsentVersion` / `UserConsent` tables have existed for a while and were
 * completely empty — no seeded wording, no route to read it, no route to accept
 * it. A consent-versioning system with nothing in it is worse than none, because
 * the schema implies a record exists when it does not.
 *
 * THE POINT OF VERSIONING BY LANGUAGE. Storing "accepted the terms" is not enough
 * when the terms are published in five languages. If somebody agreed to the
 * Pidgin wording and a dispute later turns on a sentence in the English text,
 * what matters is which words they actually read. So the version is keyed by
 * (slug, version, locale), and `UserConsent.readLocale` additionally records the
 * language the interface was in at the moment of acceptance — which can differ
 * from the version's own locale when the interface fell back to English because a
 * translation was not ready.
 *
 * WHAT IS NOT HERE. No acceptance can be created for somebody else: the row is
 * keyed on the session's user id, never on an id from the request. There is no
 * employer-facing route, for the same structural reason as in `preferences.ts` —
 * an employer cannot learn which of their staff accepted which wording, because
 * nothing answers the question.
 */
const consentsRouter = new Hono();

/* ----------------------------------------------------------- launch wording */

/**
 * The wording PayBridge ships with.
 *
 * Held in code rather than in a migration so the text and its hash travel
 * together with the release that introduced them, and seeded idempotently on
 * first read. `version` is a date rather than a counter: with five languages and
 * separate rows per language, "v2" tells you nothing about whether the Pidgin
 * caught up with the English, and a date does.
 *
 * Every `summary` is written to be SPOKEN. The Listen button reads it aloud, so
 * it has to stand alone without the surrounding page — no "as described above",
 * no "the following terms".
 */
const LAUNCH_CONSENTS: {
  slug: string;
  version: string;
  locale: LocaleCode;
  title: string;
  summary: string;
}[] = [
  {
    slug: "bridge_terms",
    version: "2026-07-01",
    locale: "en",
    title: "Taking part of your pay early",
    summary:
      "This is part of the salary you have already earned. It is not free money. " +
      "You will receive the full amount you ask for. PayBridge charges a fee on top of it. " +
      "On your payday, the amount you asked for plus the fee is taken from your salary, once. " +
      "Your employer is told one total figure for the whole company and is never told that you did this.",
  },
  {
    slug: "bridge_terms",
    version: "2026-07-01",
    locale: "pcm",
    title: "Collecting part of your pay before payday",
    summary:
      "Dis na part of salary wey you don already work for. E no be free money. " +
      "You go collect the full amount wey you ask for. PayBridge go add small fee on top. " +
      "When payday reach, dem go take the amount wey you ask for plus the fee from your salary, one time. " +
      "Your employer go only see one total for the whole company. Dem no go know say na you.",
  },
  {
    slug: "privacy",
    version: "2026-07-01",
    locale: "en",
    title: "How PayBridge uses your information",
    summary:
      "PayBridge keeps your pay records so we can work out how much you have earned. " +
      "We keep the settings you choose, like bigger writing or Pidgin, so the app works the same way each time you open it. " +
      "We never record why you chose a setting, and we never ask about your health. " +
      "Your employer cannot see your settings, your savings, or any message you send to us.",
  },
  {
    slug: "privacy",
    version: "2026-07-01",
    locale: "pcm",
    title: "How PayBridge dey use your information",
    summary:
      "PayBridge dey keep your pay record so we go sabi how much you don earn. " +
      "We dey keep the settings wey you choose, like big writing or Pidgin, so the app go work the same way every time you open am. " +
      "We no dey record why you choose any setting, and we no dey ask about your health. " +
      "Your employer no go see your settings, your savings, or any message wey you send give us.",
  },
  {
    slug: "accessibility_statement",
    version: "2026-07-01",
    locale: "en",
    title: "Using PayBridge with a screen reader or without a mouse",
    summary:
      "You can move through every screen with the keyboard alone. " +
      "You can choose bigger writing, stronger colours, less movement, and a simpler home screen. " +
      "You can have any explanation read aloud, and nothing ever plays sound until you press Listen. " +
      "PayBridge is working towards the international WCAG 2.2 AA standard. We have not been formally certified against it.",
  },
  {
    slug: "accessibility_statement",
    version: "2026-07-01",
    locale: "pcm",
    title: "Using PayBridge with screen reader or without mouse",
    summary:
      "You fit move through every screen with keyboard alone. " +
      "You fit choose big writing, strong colour, less movement, and simple home screen. " +
      "You fit make the app read any explanation give you, and nothing go make sound until you press Listen. " +
      "PayBridge dey work towards the international WCAG 2.2 AA standard. Nobody don certify us for am yet.",
  },
];

/**
 * Creates any missing launch wording, once per process.
 *
 * `create`-if-absent rather than `upsert`: the text of a version that people have
 * already accepted must never change under them. If the wording needs to change,
 * that is a new `version` — which is the entire reason this table is keyed by one.
 *
 * The `P2002` catch handles two first requests racing on the (slug, version,
 * locale) unique key; the loser's row already exists, which is the desired state.
 * SQLite has no `skipDuplicates`, so this cannot be done in one `createMany`.
 *
 * The `seeded` latch keeps this off the hot path: without it every read of the
 * terms would issue six existence checks for rows that have not changed since
 * deploy.
 */
let seeded = false;

async function ensureLaunchConsents(): Promise<void> {
  if (seeded) return;
  for (const entry of LAUNCH_CONSENTS) {
    try {
      const existing = await prisma.consentVersion.findUnique({
        where: {
          slug_version_locale: { slug: entry.slug, version: entry.version, locale: entry.locale },
        },
        select: { id: true },
      });
      if (!existing) await prisma.consentVersion.create({ data: entry });
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
    }
  }
  seeded = true;
}

/* ------------------------------------------------------------------- routes */

/**
 * GET /api/consents?locale=pcm — the current wording, and whether the caller has
 * accepted it.
 *
 * Public on purpose. The terms somebody is being asked to agree to must be
 * readable BEFORE they have an account: putting the wording behind a sign-in
 * means the only people who can read it are the people who already agreed to it.
 * The `accepted` flags are the part that needs a session, and they simply come
 * back false when there is not one.
 */
consentsRouter.get("/", async (c) => {
  await ensureLaunchConsents();

  const requested = c.req.query("locale");
  const locale: LocaleCode = (LOCALE_CODES as readonly string[]).includes(requested ?? "")
    ? (requested as LocaleCode)
    : "en";

  const rows = await prisma.consentVersion.findMany({
    where: { retiredAt: null, locale: { in: locale === "en" ? ["en"] : [locale, "en"] } },
    orderBy: [{ slug: "asc" }, { effectiveFrom: "desc" }],
  });

  /*
   * One row per slug, preferring the requested language.
   *
   * The query deliberately fetches the English row as well, so a slug whose
   * translation has not landed yet still has something to show. Falling back to
   * English text is worse than reading it in Pidgin and much better than an empty
   * screen where the terms should be — and because `readLocale` is stored on
   * acceptance, the fallback stays visible in the record afterwards.
   */
  const chosen = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const existing = chosen.get(row.slug);
    if (!existing || (existing.locale !== locale && row.locale === locale)) chosen.set(row.slug, row);
  }
  const current = [...chosen.values()];

  /*
   * Session is optional here, so the cookie is decoded directly rather than
   * through `requireUser()` — that middleware would 401 the anonymous reader
   * this route exists to serve. `c.get("account")` is NOT an option: it is only
   * ever populated by `requireUser`, so reading it here would silently return
   * `undefined` for signed-in people too and every `accepted` flag would come
   * back false.
   *
   * The weaker check is acceptable for exactly this payload. A stale or revoked
   * cookie could show somebody an out-of-date "you already accepted this" badge;
   * it cannot write a consent, because POST /accept runs the full middleware.
   */
  const session = readSession(c);
  const accepted = session
    ? await prisma.userConsent.findMany({
        where: {
          userId: session.sub,
          consentVersionId: { in: current.map((row) => row.id) },
          withdrawnAt: null,
        },
        select: { consentVersionId: true, acceptedAt: true },
      })
    : [];
  const byVersion = new Map(accepted.map((row) => [row.consentVersionId, row.acceptedAt]));

  const data: ConsentVersionView[] = current.map((row) => ({
    id: row.id,
    slug: row.slug,
    version: row.version,
    locale: row.locale as LocaleCode,
    title: row.title,
    summary: row.summary,
    bodyUrl: row.bodyUrl,
    effectiveFrom: row.effectiveFrom.toISOString(),
    accepted: byVersion.has(row.id),
    acceptedAt: byVersion.get(row.id)?.toISOString() ?? null,
  }));

  return c.json({ data: { items: data, locale } });
});

/**
 * POST /api/consents/accept — record that this person agreed to this wording.
 *
 * Upsert rather than create: pressing a confirm button twice, or on a flaky
 * connection, must not be an error the person has to understand. The FIRST
 * acceptance time is preserved on the repeat, because that is the moment that
 * actually happened; only a withdrawal is cleared, so re-accepting after
 * withdrawing works.
 */
consentsRouter.post("/accept", requireUser(), validate("json", acceptConsentSchema), async (c) => {
  const account = c.get("account") as AccountRow;
  const input = c.req.valid("json");

  const version = await prisma.consentVersion.findUnique({ where: { id: input.consentVersionId } });
  if (!version || version.retiredAt) {
    return c.json(
      { error: { message: "That version of the wording is no longer current.", code: "NOT_FOUND" } },
      404,
    );
  }

  const row = await prisma.userConsent.upsert({
    where: { userId_consentVersionId: { userId: account.id, consentVersionId: version.id } },
    create: {
      userId: account.id,
      consentVersionId: version.id,
      readLocale: input.readLocale,
      /*
       * IP and user agent are recorded here and nowhere near the preferences
       * table. A consent record has to be defensible years later, which means
       * knowing the circumstances of the acceptance; a display setting has no such
       * burden, and attaching the same metadata to it would build a movement log
       * out of somebody turning on large text.
       *
       * `clientIp()`, never `x-forwarded-for.split(",")[0]`. The leftmost entry of
       * that chain is written by the caller — see the long note in
       * security/client-ip.ts. An IP the person accepting can choose for
       * themselves is not evidence of anything, which is the whole reason the
       * column exists.
       */
      ip: clientIp(c),
      userAgent: c.req.header("user-agent") ?? null,
    },
    update: { granted: true, withdrawnAt: null, readLocale: input.readLocale },
  });

  await record(c, {
    action: "consent.accepted",
    outcome: "success",
    actorType: "user",
    actorId: account.id,
    actorLabel: account.email,
    targetType: "consent",
    targetId: version.id,
    /*
     * The wording's identity, not its content. An investigator needs to know
     * which text this person agreed to and in which language; the text itself
     * lives in `ConsentVersion` and does not need copying into every row.
     */
    detail: {
      slug: version.slug,
      version: version.version,
      versionLocale: version.locale,
      readLocale: input.readLocale,
    },
  });

  return c.json({
    data: {
      slug: version.slug,
      version: version.version,
      readLocale: row.readLocale,
      acceptedAt: row.acceptedAt.toISOString(),
    },
  });
});

export { consentsRouter };
