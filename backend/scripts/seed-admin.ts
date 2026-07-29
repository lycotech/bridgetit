/**
 * Create the first Super Admin, or issue a fresh temporary password to an
 * existing administrator.
 *
 *   cd backend && npx tsx scripts/seed-admin.ts
 *   cd backend && npx tsx scripts/seed-admin.ts --email someone@example.com --name "Their Name" --role kyc_reviewer
 *   cd backend && npx tsx scripts/seed-admin.ts --reset            # new temporary password for the default admin
 *
 * WHY this is a deployment script and not a route, a migration, or a constant in
 * the source:
 *
 *   - A hard-coded administrator password in the repository is a permanent
 *     credential published to everyone who can read the code, including anyone
 *     who ever clones it, forever. Rotating it later does not un-publish it.
 *   - A self-service "create the first admin" route is a race: whoever finds the
 *     deployment first owns it. There is no way to authenticate the request,
 *     because authentication is the thing being set up.
 *   - A migration runs on every environment automatically, which means the same
 *     credential in staging, CI and production.
 *
 * So the credential is generated here, at deployment time, from the CSPRNG,
 * printed ONCE to the operator's terminal, and stored only as an argon2id hash.
 * It expires 24 hours later or the moment it is first used — whichever comes
 * first — and the administrator cannot reach any part of the portal until they
 * have replaced it, enrolled a second factor, confirmed a recovery address and
 * accepted the security policy.
 *
 * The password is written to stdout and to nothing else: not the audit table,
 * not the application log, not an email, not the response body of any route.
 * Redirecting this script's output to a file is the operator's decision and
 * their responsibility.
 */
import { prisma } from "../src/db";
import { hashPassword, generateStrongPassword } from "../src/security/passwords";
import { ADMIN_ROLES, ADMIN_ROLE_LABELS, isAdminRole, type AdminRole } from "../src/security/admin-roles";
import { record } from "../src/security/audit-store";

/** The account named in the brief, used when no --email is given. */
const DEFAULT_ADMIN = {
  name: "Adeniran Adewole",
  email: "ade@commerceallianceholdings.com",
  role: "super_admin" as AdminRole,
};

/** Matches AdminUser.tempPasswordExpiresAt semantics: 24h, or first use. */
const TEMP_PASSWORD_TTL_MS = 24 * 60 * 60 * 1000;

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(`--${flag}`);
  if (i === -1) return undefined;
  const value = process.argv[i + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

const wants = {
  email: (arg("email") ?? DEFAULT_ADMIN.email).trim().toLowerCase(),
  name: arg("name") ?? DEFAULT_ADMIN.name,
  role: arg("role") ?? DEFAULT_ADMIN.role,
  reset: process.argv.includes("--reset"),
};

if (!isAdminRole(wants.role)) {
  console.error(`\n  Unknown role "${wants.role}".\n  Valid roles: ${ADMIN_ROLES.join(", ")}\n`);
  process.exit(1);
}

const existing = await prisma.adminUser.findUnique({
  where: { email: wants.email },
  select: { id: true, name: true, role: true, status: true, mustChangePassword: true },
});

/*
 * Refuse to silently overwrite a working administrator. WHY: this script is run
 * by hand on a live deployment, and "seed the admin" is exactly the sort of
 * command someone re-runs when they are unsure whether it worked. If a second
 * run quietly reset the password, an administrator with a configured
 * authenticator would be locked out of a privileged account by a no-op.
 *
 * --reset is the explicit, deliberate way to ask for a new temporary password.
 */
if (existing && !wants.reset) {
  console.error(
    `\n  ${wants.email} already exists (${ADMIN_ROLE_LABELS[existing.role as AdminRole] ?? existing.role}, ${existing.status}).` +
      `\n  Nothing was changed.` +
      `\n\n  To issue a new temporary password for this account:` +
      `\n    npx tsx scripts/seed-admin.ts --email ${wants.email} --reset\n`,
  );
  process.exit(1);
}

const temporaryPassword = generateStrongPassword(20);
const passwordHash = await hashPassword(temporaryPassword);
const expiresAt = new Date(Date.now() + TEMP_PASSWORD_TTL_MS);

const admin = existing
  ? await prisma.adminUser.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        mustChangePassword: true,
        tempPasswordExpiresAt: expiresAt,
        // A reset clears the lockout — the operator running this script has
        // strictly more authority than the failed-attempt counter.
        failedLoginCount: 0,
        lockedUntil: null,
        /*
         * Bumping the epoch signs out every session on the account. WHY that is
         * the right default for a password reset: the usual reason to reset is
         * that the credential may be compromised, and leaving live sessions
         * running would mean the reset accomplished nothing.
         *
         * MFA enrolment is deliberately NOT cleared. The second factor is what
         * still protects the account while a freshly printed temporary password
         * sits in a terminal; wiping it here would turn a password reset into a
         * complete authentication bypass for whoever can run this script.
         */
        sessionEpoch: { increment: 1 },
        status: "active",
      },
      select: { id: true, name: true, email: true, role: true, mfaEnabledAt: true },
    })
  : await prisma.adminUser.create({
      data: {
        name: wants.name,
        email: wants.email,
        role: wants.role,
        status: "active",
        passwordHash,
        mustChangePassword: true,
        tempPasswordExpiresAt: expiresAt,
        createdBy: "deployment-seed",
      },
      select: { id: true, name: true, email: true, role: true, mfaEnabledAt: true },
    });

/*
 * The audit trail records that a credential was issued, by what, and for whom.
 * It does not record the credential. `record()` is called with no Context, so
 * there is no IP or device to attach — this action came from a shell, not a
 * request, and inventing an address for it would make the column untrustworthy
 * everywhere else.
 */
await record(null, {
  action: existing ? "admin.password.reset_issued" : "admin.created",
  outcome: "success",
  actorType: "system",
  actorLabel: "deployment-seed",
  targetType: "admin",
  targetId: admin.id,
  detail: { role: admin.role, temporary: true, expiresAt: expiresAt.toISOString() },
});

const label = ADMIN_ROLE_LABELS[admin.role as AdminRole] ?? admin.role;
const rule = "─".repeat(64);

console.log(`
${rule}
  PayBridge — ${existing ? "temporary password reissued" : "first administrator created"}
${rule}

  Name       ${admin.name}
  Role       ${label}
  Email      ${admin.email}
  Password   ${temporaryPassword}
  Expires    ${expiresAt.toUTCString()}  (or immediately on first use)

  Sign in at  /admin/login

  This password is shown once and is not recoverable. It is stored only as an
  argon2id hash and appears in no log, email or database column.

  On first sign-in the portal will require, in order:
    1. a new password  (12+ characters, upper and lower case, number, symbol)
    2. an authenticator app  (scan the QR code, then confirm a live code)
    3. a recovery email address  (confirmed with a code)
    4. acceptance of the administrator security policy
${admin.mfaEnabledAt ? "\n  Note: this account already has an authenticator enrolled. It stays enrolled;\n  the existing second factor is still required at sign-in.\n" : ""}
${rule}
`);

await prisma.$disconnect();
