import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { isProduction } from "./config";

/**
 * Field-level encryption for the small number of columns that hold
 * identity-theft-grade data: BVN, NIN, passport number, date of birth,
 * residential address, and an administrator's TOTP secret.
 *
 * WHY encrypt individual fields when the database is already access-controlled:
 * access control protects the running system. It does nothing for a stolen
 * backup file, a snapshot copied to a laptop for debugging, a replica with
 * looser grants, or a support engineer with legitimate read access to a table
 * they have no business reading rows of. A BVN plus a date of birth plus an
 * address is everything needed to impersonate someone at a Nigerian bank, so it
 * is the one category of data worth the operational cost of encrypting.
 *
 * WHY AES-256-GCM specifically: GCM is authenticated. Encryption alone (CBC,
 * CTR) leaves the ciphertext malleable — an attacker with write access could
 * flip bits and change a decrypted date of birth without detection. GCM's tag
 * makes tampering a decryption failure instead of a silent corruption.
 *
 * WHAT THIS DOES NOT DO. The key sits in the same environment as the process,
 * so an attacker with code execution on the server can decrypt. Defeating that
 * needs a KMS or HSM holding the key out of process; the interface here
 * (encryptField/decryptField) is deliberately narrow so swapping in a KMS is a
 * change to this file only.
 *
 * THE TRADE-OFF, stated plainly: encrypted columns cannot be searched, sorted
 * or indexed. Accepted — nothing in the product searches by BVN, and a KYC
 * reviewer opens one case at a time. Anything that must stay searchable (state,
 * city, id type, last four digits) is deliberately left in the clear.
 */

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
/** 96 bits is the GCM-native nonce size; anything else forces an extra hash. */
const IV_BYTES = 12;

/**
 * Derive the 32-byte key from KYC_ENCRYPTION_KEY.
 *
 * WHY sha256 over the configured value rather than requiring exactly 32 raw
 * bytes: operators paste base64, hex or a passphrase, and a length mismatch
 * would either crash at the first submission or, worse, tempt someone into
 * padding the key. Hashing normalises any input to a valid AES-256 key. This is
 * NOT key stretching and is not meant to be — the configured value must itself
 * be high-entropy, which is why a short one is refused below.
 */
function encryptionKey(): Buffer {
  const configured = process.env.KYC_ENCRYPTION_KEY;

  if (configured && configured.length >= 32) {
    return createHash("sha256").update(configured).digest();
  }

  /*
   * Refusing to run in production without a key is the point. A silent fallback
   * would mean KYC documents encrypted under an ephemeral key: the writes
   * succeed, nobody notices, and every record becomes permanently unreadable
   * after the next restart. Losing customers' identity data is worse than
   * failing to boot.
   */
  if (isProduction) {
    throw new Error(
      "KYC_ENCRYPTION_KEY is required in production and must be at least 32 characters. " +
        "Generate one with: openssl rand -base64 48",
    );
  }
  return devKey;
}

/**
 * Development-only key, stable for the lifetime of the process. Restarting
 * makes previously written ciphertext undecryptable, which is the correct local
 * behaviour — it can never be mistaken for a working production setup.
 */
const devKey = createHash("sha256").update(randomBytes(32)).digest();

/** True when a real key is configured. Reported in the startup posture line. */
export function fieldCryptoConfigured(): boolean {
  return (process.env.KYC_ENCRYPTION_KEY ?? "").length >= 32;
}

/**
 * Encrypt one field. Output: `v1.<iv>.<tag>.<ciphertext>`, all base64.
 *
 * The version prefix is what makes key rotation possible later: a `v2` reader
 * can recognise and re-encrypt `v1` rows instead of having to guess the format.
 */
export function encryptField(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(".");
}

/**
 * Decrypt one field. Returns null on any failure — wrong key, tampered
 * ciphertext, truncated value, unknown version.
 *
 * WHY null rather than throwing: a reviewer opening a case with one unreadable
 * field should see that field marked unavailable, not a 500 for the whole case.
 * The failure is logged by the caller; a decryption failure is a genuine
 * incident signal (it means either the key changed or a row was altered) and
 * must not be silently swallowed at a higher level.
 */
export function decryptField(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;

  try {
    const iv = Buffer.from(parts[1]!, "base64");
    const tag = Buffer.from(parts[2]!, "base64");
    const ciphertext = Buffer.from(parts[3]!, "base64");
    if (iv.length !== IV_BYTES || tag.length !== 16) return null;

    const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    // Includes the GCM tag mismatch — i.e. the ciphertext was altered.
    return null;
  }
}

/** Encrypt when a value is present; keep null as null. */
export function encryptOptional(plain: string | null | undefined): string | null {
  const trimmed = plain?.trim();
  return trimmed ? encryptField(trimmed) : null;
}

/**
 * Last four characters of an identifier, for display.
 *
 * Kept in the clear on purpose so a reviewer can match a record to a document
 * without decrypting anything, and so the customer can confirm which id they
 * submitted. Four characters of a NIN is not enough to impersonate anyone.
 */
export function last4(value: string): string {
  const cleaned = value.replace(/\s+/g, "");
  return cleaned.length <= 4 ? cleaned : cleaned.slice(-4);
}

/**
 * Mask an identifier for any display that is not an explicit reveal:
 * "12345678901" → "•••••••8901".
 */
export function maskIdentifier(value: string): string {
  const cleaned = value.replace(/\s+/g, "");
  if (cleaned.length <= 4) return "•".repeat(cleaned.length);
  return "•".repeat(cleaned.length - 4) + cleaned.slice(-4);
}
