/**
 * Where PayBridge can actually be reached.
 *
 * The WhatsApp number and the phone line are EXTERNAL INTEGRATIONS and are read
 * from configuration rather than typed into a component. Until they are set, the
 * channels still work: the request becomes a ticket in the support desk and the
 * screen says a person will make contact — it just does not print a number that
 * nobody answers. Inventing a plausible-looking support line is worse than
 * having none, because somebody will dial it on the day their rent is due.
 *
 * Set VITE_SUPPORT_WHATSAPP (digits, international format, no +) and
 * VITE_SUPPORT_PHONE to switch the two buttons on.
 */

export const SUPPORT_EMAIL = "support@getpaybridge.com";

const WHATSAPP_DIGITS = (import.meta.env.VITE_SUPPORT_WHATSAPP as string | undefined)?.replace(/\D/g, "") ?? "";
const PHONE_RAW = (import.meta.env.VITE_SUPPORT_PHONE as string | undefined) ?? "";

export const supportWhatsApp = WHATSAPP_DIGITS.length >= 8 ? WHATSAPP_DIGITS : null;
export const supportPhone = PHONE_RAW.trim().length >= 7 ? PHONE_RAW.trim() : null;

/** wa.me deep link with the message pre-typed, including the ticket reference. */
export function whatsappLink(message: string): string | null {
  if (!supportWhatsApp) return null;
  return `https://wa.me/${supportWhatsApp}?text=${encodeURIComponent(message)}`;
}

export function telLink(): string | null {
  if (!supportPhone) return null;
  return `tel:${supportPhone.replace(/[^\d+]/g, "")}`;
}

export function mailtoLink(subject: string, body: string): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
