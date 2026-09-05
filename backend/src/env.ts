import { z } from "zod";

/**
 * Environment / secret validation.
 *
 * WHY validate at boot rather than at first use: a missing SESSION_SECRET
 * discovered at 3am on the first login attempt is an outage AND, if the code
 * has a fallback default, a silent security failure. Fail fast, loudly, at
 * startup — before the process accepts a single request.
 *
 * WHY values are never printed: an error handler that echoes the offending
 * value is how secrets end up in CI logs, which are usually more widely
 * readable than the secret store itself. This one prints the variable NAME and
 * the rule, never the content.
 */

const rawEnv = process.env as Record<string, string | undefined>;
const isProduction = rawEnv.NODE_ENV === "production";

const envSchema = z.object({
  // Server
  PORT: z.string().optional().default("3000"),
  NODE_ENV: z.string().optional(),

  /**
   * Postgres (Neon). DATABASE_URL is the pooled connection string the app
   * queries through at runtime; DIRECT_URL is the unpooled string Prisma
   * needs for `migrate`. Both required in production — there is no sqlite
   * fallback anymore.
   */
  DATABASE_URL: isProduction
    ? z.string().url().startsWith("postgres", "must be a postgres:// or postgresql:// connection string")
    : z.string().url().optional(),
  DIRECT_URL: isProduction
    ? z.string().url().startsWith("postgres", "must be a postgres:// or postgresql:// connection string")
    : z.string().url().optional(),

  /**
   * Signing key for session cookies. Required in production, minimum 32 chars.
   * Generate with: openssl rand -base64 48
   *
   * WHY required and length-checked: a short or absent key means forgeable
   * sessions — an attacker can mint an admin cookie offline. There is no safe
   * default, so there is no default.
   */
  SESSION_SECRET: isProduction
    ? z.string().min(32, "must be at least 32 characters (openssl rand -base64 48)")
    : z.string().min(32).optional(),

  /** Salt for one-way pseudonyms in audit logs. */
  LOG_SALT: isProduction ? z.string().min(16) : z.string().min(16).optional(),

  /**
   * Key for AES-256-GCM field encryption of KYC identity data.
   *
   * WHY it must be set even outside production, unlike SESSION_SECRET: an
   * ephemeral session key is harmless — sessions end and users sign in again.
   * An ephemeral ENCRYPTION key is data loss. Every identity number, date of
   * birth and address written before a restart becomes permanently
   * undecryptable, and the customer's only remedy is to submit their documents
   * again. The schema therefore warns whenever it is missing, and refuses to
   * boot in production.
   *
   * Generate with: openssl rand -base64 48
   * ROTATION: there is no re-encryption path yet. Changing this value orphans
   * every existing KYC record. Treat it as permanent for the life of the data.
   */
  KYC_ENCRYPTION_KEY: isProduction
    ? z.string().min(32, "must be at least 32 characters (openssl rand -base64 48)")
    : z.string().min(32).optional(),

  /** Extra CORS/CSRF origins for self-hosting: comma-separated exact origins. */
  ALLOWED_ORIGINS: z.string().optional(),

  /**
   * S3-compatible object storage for KYC documents (AWS S3, Cloudflare R2,
   * Backblaze B2). See src/storage/kyc.ts. Required in production — without
   * it, identity-document uploads have nowhere durable to land.
   */
  KYC_S3_BUCKET: isProduction ? z.string().min(1) : z.string().min(1).optional(),
  KYC_S3_REGION: isProduction ? z.string().min(1) : z.string().min(1).optional(),
  KYC_S3_ACCESS_KEY_ID: isProduction ? z.string().min(1) : z.string().min(1).optional(),
  KYC_S3_SECRET_ACCESS_KEY: isProduction ? z.string().min(1) : z.string().min(1).optional(),
  /** Only needed for a non-AWS endpoint (R2, B2, MinIO). */
  KYC_S3_ENDPOINT: z.string().url().optional(),
  /** "true" for providers that need path-style addressing (R2, B2, MinIO). */
  KYC_S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).optional(),

  /**
   * Third-party keys. Optional (the feature is optional) but format-checked so
   * a truncated or placeholder value fails at boot rather than mid-request.
   */
  OPENAI_API_KEY: z
    .string()
    .min(20)
    .refine((v) => v.startsWith("sk-"), "must look like an OpenAI key")
    .optional(),

  /**
   * Anthropic (Claude) API key for the real AI Assistant chat feature
   * (routes/ai-assistant.ts). Optional — without it the endpoint returns a
   * clear "not configured" error instead of the chat working.
   */
  ANTHROPIC_API_KEY: z
    .string()
    .min(20)
    .refine((v) => v.startsWith("sk-ant-"), "must look like an Anthropic key")
    .optional(),

  /**
   * Which Claude model answers the AI Assistant.
   *
   * Configurable so the cost/quality trade can be re-made from the server's
   * env and a restart, without a code change and a redeploy — model choice is
   * an operational decision, not a structural one.
   *
   * Default is Sonnet 5: the assistant answers short support questions over a
   * pre-built data snapshot, which does not need Opus's depth, and Sonnet sits
   * a full pricing tier below it. Set ANTHROPIC_MODEL=claude-opus-5 to go back.
   *
   * NOTE for anyone switching to Haiku: it rejects the `effort` parameter with
   * a 400 ("This model does not support the effort parameter"), so a Haiku
   * switch is not just an env change — `output_config` has to come out of
   * routes/ai-assistant.ts too.
   */
  ANTHROPIC_MODEL: z.string().min(1).default("claude-sonnet-5"),

  /* ------------------------------------------------------------------ MAIL */
  /*
   * Outbound mail. Every one of these is optional: with none of them set the
   * mailer falls back to a log-only transport, so an unconfigured deployment
   * still CAPTURES every registration — it just does not send the
   * acknowledgement. Losing a lead is worse than not emailing it.
   *
   * The credentials live here, server-side, and nowhere else. Nothing in this
   * block is ever sent to the browser or embedded in the frontend bundle.
   */
  MAIL_TRANSPORT: z.enum(["smtp", "resend", "log"]).optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z
    .string()
    .regex(/^\d{2,5}$/, "must be a port number, e.g. 587")
    .optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  /** ssl (implicit TLS, port 465) | starttls (upgrade, port 587) | none (dev). */
  SMTP_SECURE: z.enum(["ssl", "starttls", "none"]).optional(),
  RESEND_API_KEY: z.string().min(10).optional(),

  /*
   * Sender identities and internal inboxes. Defaults live in
   * email/identities.ts; these exist so a deployment can point the four routes
   * at a test mailbox without a code change.
   *
   * NOTE the plural on the employer address: partners@getpaybridge.com.
   * partner@ (singular) is not an alias and will bounce.
   */
  MAIL_FROM_GENERAL: z.string().email().optional(),
  MAIL_FROM_EMPLOYEE: z.string().email().optional(),
  MAIL_FROM_EMPLOYER: z.string().email().optional(),
  MAIL_FROM_CAPITAL: z.string().email().optional(),
  MAIL_INBOX_GENERAL: z.string().email().optional(),
  MAIL_INBOX_EMPLOYEE: z.string().email().optional(),
  MAIL_INBOX_EMPLOYER: z.string().email().optional(),
  MAIL_INBOX_CAPITAL: z.string().email().optional(),
  MAIL_PRIVACY_CONTACT: z.string().email().optional(),

  /* ----------------------------------------------------------- ADMIN/DEMO */
  /*
   * Credentials for the two non-public surfaces. There is no self-service
   * registration for either — every account that can be created is an account
   * an attacker can create.
   */
  ADMIN_USERNAME: z.string().min(3).optional(),
  /** sha256(password) as hex. Preferred over ADMIN_PASSWORD everywhere. */
  ADMIN_PASSWORD_HASH: z
    .string()
    .regex(/^[a-f0-9]{64}$/i, "must be a 64-character sha256 hex digest")
    .optional(),
  /** Plaintext fallback. Accepted in development only; refused in production. */
  ADMIN_PASSWORD: isProduction
    ? z
        .undefined({ message: "must not be set in production — use ADMIN_PASSWORD_HASH" })
        .optional()
    : z.string().min(8).optional(),
  /*
   * DEMO_ACCESS_CODE is deliberately no longer read. A single shared code that
   * opened the demonstration for anyone holding it has been retired in favour of
   * named, expiring, revocable invitations. Left documented rather than silently
   * dropped so an existing deployment's value is understood to be inert.
   */
  /** Public site URL quoted in invitation emails ("visit …"). */
  PUBLIC_SITE_URL: z.string().url().optional(),
  /** Fallback for PUBLIC_SITE_URL, kept for existing deployments. */
  DEMO_BASE_URL: z.string().url().optional(),
});

function validateEnv() {
  const parsed = envSchema.safeParse(rawEnv);

  if (!parsed.success) {
    console.error("❌ Environment validation failed:");
    for (const issue of parsed.error.issues) {
      // Name + rule only. Never the value.
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    console.error("\nSet these in your environment (or the Vibecode ENV tab). Never commit them.");
    process.exit(1);
  }

  // Startup posture line — makes a misconfigured deployment visible in the
  // first lines of the log instead of during an incident.
  console.log(
    JSON.stringify({
      type: "startup",
      env: parsed.data.NODE_ENV ?? "development",
      database: parsed.data.DATABASE_URL ? "configured" : "MISSING",
      kycStorage: parsed.data.KYC_S3_BUCKET ? "configured" : "MISSING",
      sessionSecret: parsed.data.SESSION_SECRET ? "configured" : "ephemeral (dev only)",
      logSalt: parsed.data.LOG_SALT ? "configured" : "default (dev only)",
      // Called out separately from the other secrets because the failure mode is
      // data loss rather than weakened security. See the schema comment.
      kycEncryption: parsed.data.KYC_ENCRYPTION_KEY
        ? "configured"
        : "EPHEMERAL — KYC data will not survive a restart",
      openai: parsed.data.OPENAI_API_KEY ? "configured" : "absent",
      anthropic: parsed.data.ANTHROPIC_API_KEY ? "configured" : "absent",
      // A model name is not a secret, and printing it is how you confirm which
      // model is actually live without reading the code or guessing from a bill.
      anthropicModel: parsed.data.ANTHROPIC_MODEL,
      // Presence only, never the value — see the note above.
      adminLogin: parsed.data.ADMIN_USERNAME ? "configured" : "absent",
    }),
  );

  return parsed.data;
}

export const env = validateEnv();

export type Env = z.infer<typeof envSchema>;

/**
 * NOTE: we deliberately do NOT augment NodeJS.ProcessEnv from this schema.
 * Reading secrets off `process.env` anywhere in the app bypasses validation;
 * importing `env` from this module is the single supported path.
 */
