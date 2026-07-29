import { DEFAULT_LOCALE, isLocaleCode, type LocaleCode } from "@/i18n/locales";
import type { PreferencesView, SupportChannel } from "../../../../backend/src/types";

/**
 * The local copy of somebody's settings.
 *
 * WHY A LOCAL COPY AT ALL, when the server holds the authoritative row: the
 * settings have to apply on the FIRST paint, before any request finishes and
 * whether or not anyone is signed in. A person who needs bigger text needs it on
 * the sign-in screen — the screen they must read before the server knows who they
 * are. Waiting for /api/preferences would mean the accessibility settings arrive
 * last, which is the same as them not working.
 *
 * So: localStorage is the immediate source, the server is the durable one, and the
 * server wins on load for a signed-in person because they may be on a borrowed
 * phone. See `PreferencesProvider`.
 */

const KEY = "paybridge.preferences.v1";

/** The client-side shape. Mirrors PreferencesView minus the server-only stamps. */
export interface LocalPreferences {
  locale: LocaleCode;
  largeText: boolean;
  highContrast: boolean;
  simpleView: boolean;
  readAloud: boolean;
  reduceMotion: boolean;
  supportChannel: SupportChannel;
  textOnly: boolean;
  assistedOnboarding: boolean;
  /** True once the onboarding questions have been answered or skipped. */
  onboardingSettled: boolean;
}

export const LOCAL_DEFAULTS: LocalPreferences = {
  locale: DEFAULT_LOCALE,
  largeText: false,
  highContrast: false,
  simpleView: false,
  readAloud: false,
  reduceMotion: false,
  supportChannel: "whatsapp",
  textOnly: false,
  assistedOnboarding: false,
  onboardingSettled: false,
};

/**
 * Read the stored settings.
 *
 * Every field is validated individually and a bad one falls back to its default
 * rather than throwing the whole object away. A single corrupted key must not cost
 * somebody their high-contrast setting, and a thrown error here would run during
 * the first render of the app.
 */
export function readLocalPreferences(): LocalPreferences {
  if (typeof window === "undefined") return LOCAL_DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return LOCAL_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Record<keyof LocalPreferences, unknown>>;
    return {
      locale: isLocaleCode(parsed.locale) ? parsed.locale : LOCAL_DEFAULTS.locale,
      largeText: bool(parsed.largeText),
      highContrast: bool(parsed.highContrast),
      simpleView: bool(parsed.simpleView),
      readAloud: bool(parsed.readAloud),
      reduceMotion: bool(parsed.reduceMotion),
      supportChannel: channel(parsed.supportChannel),
      textOnly: bool(parsed.textOnly),
      assistedOnboarding: bool(parsed.assistedOnboarding),
      onboardingSettled: bool(parsed.onboardingSettled),
    };
  } catch {
    // Private-browsing modes throw on localStorage access. Defaults, not a crash.
    return LOCAL_DEFAULTS;
  }
}

export function writeLocalPreferences(prefs: LocalPreferences): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Storage full or blocked. The settings still apply for this session; they
    // just will not survive a reload, which is worth no error message.
  }
}

/** Server row → local shape. Used when a signed-in person's row arrives. */
export function fromServer(view: PreferencesView): LocalPreferences {
  return {
    locale: isLocaleCode(view.locale) ? view.locale : LOCAL_DEFAULTS.locale,
    largeText: view.largeText,
    highContrast: view.highContrast,
    simpleView: view.simpleView,
    readAloud: view.readAloud,
    reduceMotion: view.reduceMotion,
    supportChannel: view.supportChannel,
    textOnly: view.textOnly,
    assistedOnboarding: view.assistedOnboarding,
    onboardingSettled: view.onboardingSettled,
  };
}

function bool(value: unknown): boolean {
  return value === true;
}

function channel(value: unknown): SupportChannel {
  return value === "whatsapp" || value === "written" || value === "phone" || value === "callback" || value === "email"
    ? value
    : LOCAL_DEFAULTS.supportChannel;
}
