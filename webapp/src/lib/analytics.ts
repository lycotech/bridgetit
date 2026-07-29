/**
 * Lightweight analytics + attribution.
 * Events are pushed to window.dataLayer / gtag when present, and always
 * logged to the console in dev so tracking can be verified without a vendor.
 */

type EventProps = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export type AnalyticsEvent =
  | "hero_cta_click"
  | "nav_cta_click"
  // Someone who already has an account looking for the way in. Worth measuring
  // separately from the registration CTA: a rising ratio means returning users,
  // not new interest.
  | "nav_sign_in_click"
  // The direct "open an account" link, distinct from the softer Get-on-the-Bridge
  // CTA. Separating them shows whether visitors arrive ready to register.
  | "nav_register_click"
  | "midpage_cta_click"
  | "form_start"
  | "role_select"
  // Segmented registration: which fork the visitor took, and which of the four
  // forms they finished. Segment is a property, never a person.
  | "segment_select"
  | "registration_start"
  | "registration_success"
  | "form_complete"
  | "form_error"
  | "form_submit_success"
  | "faq_interaction"
  | "product_concept_click"
  | "scroll_depth";

export function track(event: AnalyticsEvent, props: EventProps = {}): void {
  const payload = { event, ...props };
  if (typeof window !== "undefined") {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
    window.gtag?.("event", event, props);
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug("[analytics]", event, props);
    }
  }
}

export interface Attribution {
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  referrer?: string;
}

const STORAGE_KEY = "pb_attribution";

/** Capture UTM + referrer on first visit and persist for the session. */
export function captureAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return JSON.parse(existing) as Attribution;

    const params = new URLSearchParams(window.location.search);
    const attribution: Attribution = {
      source: params.get("source") || params.get("utm_source") || "direct",
      utmSource: params.get("utm_source") || undefined,
      utmMedium: params.get("utm_medium") || undefined,
      utmCampaign: params.get("utm_campaign") || undefined,
      utmTerm: params.get("utm_term") || undefined,
      utmContent: params.get("utm_content") || undefined,
      referrer: document.referrer || undefined,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
    return attribution;
  } catch {
    return {};
  }
}

/** Fire scroll-depth events once per threshold. */
export function initScrollDepthTracking(): () => void {
  if (typeof window === "undefined") return () => {};
  const thresholds = [25, 50, 75, 100];
  const fired = new Set<number>();

  const onScroll = () => {
    const scrolled = window.scrollY + window.innerHeight;
    const height = document.documentElement.scrollHeight;
    const pct = Math.min(100, Math.round((scrolled / height) * 100));
    for (const t of thresholds) {
      if (pct >= t && !fired.has(t)) {
        fired.add(t);
        track("scroll_depth", { depth: t });
      }
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  return () => window.removeEventListener("scroll", onScroll);
}
