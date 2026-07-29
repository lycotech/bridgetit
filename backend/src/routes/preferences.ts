import { Hono } from "hono";
import { prisma } from "../db";
import { requireUser } from "./auth";
import { record } from "../security/audit-store";
import { validate } from "../security/validate";
import type { AccountRow } from "../security/account-gate";
import {
  DEFAULT_PREFERENCES,
  updatePreferencesSchema,
  type LocaleCode,
  type LocaleSource,
  type PreferencesView,
  type SupportChannel,
} from "../types";

/**
 * How PayBridge should behave for one person — Employee → My settings.
 *
 * FOUR RULES, and the fourth is the one that needs stating out loud.
 *
 *   1. Functional preferences only. This router will accept "use bigger writing"
 *      and will never accept, store or ask for a reason. There is no diagnosis
 *      field to populate, so no future caller can populate one by accident.
 *
 *   2. The row is keyed by the SESSION's user id, never by an id in the URL or
 *      the body. There is no `GET /preferences/:userId`, which is why there is no
 *      IDOR to get wrong: the only reachable row is the caller's own.
 *
 *   3. Server-side persistence, not just localStorage. The people most likely to
 *      need Pidgin, bigger writing or Simple View are the least likely to own one
 *      permanent device — a setting that lives only in a browser is lost on a
 *      borrowed phone, at the exact moment it was needed.
 *
 *   4. NO EMPLOYER ENDPOINT EXISTS, here or anywhere. An employer cannot ask this
 *      service which of their staff use Simple View, because there is no route
 *      that answers the question. That is deliberately a structural absence
 *      rather than a permission check: a permission can be widened in a hurry by
 *      someone who does not know why it was narrow.
 */
const preferencesRouter = new Hono();

preferencesRouter.use("*", requireUser());

/** The stored row, or the defaults. Reading never writes. */
function serialise(row: {
  locale: string;
  localeSource: string;
  largeText: boolean;
  highContrast: boolean;
  simpleView: boolean;
  readAloud: boolean;
  reduceMotion: boolean;
  supportChannel: string;
  textOnly: boolean;
  assistedOnboarding: boolean;
  onboardingCompletedAt: Date | null;
  onboardingSkippedAt: Date | null;
  updatedAt: Date;
}): PreferencesView {
  return {
    locale: row.locale as LocaleCode,
    localeSource: row.localeSource as LocaleSource,
    largeText: row.largeText,
    highContrast: row.highContrast,
    simpleView: row.simpleView,
    readAloud: row.readAloud,
    reduceMotion: row.reduceMotion,
    supportChannel: row.supportChannel as SupportChannel,
    textOnly: row.textOnly,
    assistedOnboarding: row.assistedOnboarding,
    onboardingSettled: Boolean(row.onboardingCompletedAt ?? row.onboardingSkippedAt),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * GET /api/preferences — the caller's own settings.
 *
 * Returns defaults rather than 404 when no row exists. A person who has never
 * opened the settings screen has preferences; they are simply the defaults, and
 * making the client handle a missing-row case invites it to invent its own.
 */
preferencesRouter.get("/", async (c) => {
  const account = c.get("account") as AccountRow;
  const row = await prisma.userPreference.findUnique({ where: { userId: account.id } });
  return c.json({ data: row ? serialise(row) : DEFAULT_PREFERENCES });
});

/**
 * PATCH /api/preferences — change some of them.
 *
 * Upserts, so the first toggle creates the row. The audit record names the
 * FIELDS that changed and not their values: knowing that someone adjusted their
 * display settings is useful for support; building a searchable index of who
 * needs what is not, and the trail is read by more people than the preference
 * itself ever should be.
 */
preferencesRouter.patch("/", validate("json", updatePreferencesSchema), async (c) => {
  const account = c.get("account") as AccountRow;
  const input = c.req.valid("json");
  const now = new Date();

  const { onboardingCompleted, onboardingSkipped, ...fields } = input;

  const data = {
    ...fields,
    // A language change is always an active choice unless the caller says
    // otherwise — it never arrives without someone having picked something.
    ...(fields.locale && !fields.localeSource ? { localeSource: "profile" as const } : {}),
    // Timestamped when the request is made, so the queue is ordered by when the
    // person asked rather than by when a staff member noticed.
    ...(fields.assistedOnboarding === true ? { assistedRequestedAt: now } : {}),
    ...(fields.assistedOnboarding === false ? { assistedRequestedAt: null } : {}),
    ...(onboardingCompleted ? { onboardingCompletedAt: now } : {}),
    ...(onboardingSkipped ? { onboardingSkippedAt: now } : {}),
  };

  const row = await prisma.userPreference.upsert({
    where: { userId: account.id },
    create: { userId: account.id, ...data },
    update: data,
  });

  await record(c, {
    action: "preferences.updated",
    outcome: "success",
    actorType: "user",
    actorId: account.id,
    actorLabel: account.email,
    targetType: "preferences",
    targetId: account.id,
    // Field NAMES only. Never the values.
    detail: { fields: Object.keys(input) },
  });

  /*
   * Asking for a human to help with setup is a separate, louder event: it is a
   * request that someone act, not a display tweak, and the support dashboard
   * works a queue built from it.
   */
  if (input.assistedOnboarding === true) {
    await record(c, {
      action: "support.assisted.requested",
      outcome: "success",
      actorType: "user",
      actorId: account.id,
      actorLabel: account.email,
      targetType: "user",
      targetId: account.id,
      detail: { locale: row.locale, supportChannel: row.supportChannel, textOnly: row.textOnly },
    });
  }

  return c.json({ data: serialise(row) });
});

export { preferencesRouter };
