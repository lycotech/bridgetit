import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/account/session";
import { LOCALES, type LocaleCode } from "@/i18n/locales";
import { translatorFor, type Translator } from "@/i18n/translate";
import {
  LOCAL_DEFAULTS,
  fromServer,
  readLocalPreferences,
  writeLocalPreferences,
  type LocalPreferences,
} from "./storage";
import type { PreferencesView } from "../../../../backend/src/types";

/**
 * One place that knows how PayBridge should behave for the person using it.
 *
 * THE LOADING ORDER IS THE DESIGN:
 *
 *   1. localStorage, synchronously, during the first render. Somebody who needs
 *      bigger text needs it on the sign-in screen — the screen they have to read
 *      before the server knows who they are.
 *   2. The server row, once a session is confirmed, because settings must survive
 *      a borrowed phone. The people most likely to need Pidgin or Simple View are
 *      the least likely to own one permanent device.
 *
 * Rule 2 normally wins on load. The exception is a change made in THIS session
 * before signing in: someone who switches to Pidgin on the sign-in screen and then
 * signs in should keep Pidgin, and have it saved to their account, rather than
 * watch the server undo the choice they just made.
 *
 * Nothing here is visible to an employer. There is no employer-facing endpoint for
 * any of it, so there is nothing for this provider to leak.
 */

interface PreferencesContextValue {
  prefs: LocalPreferences;
  /** Translate. Falls back to English, then to the key itself — never blank. */
  t: Translator;
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  update: (patch: Partial<LocalPreferences>) => void;
  /** Mark the first-use questions answered or skipped, both locally and server-side. */
  settleOnboarding: (outcome: "completed" | "skipped") => void;
  /** True while a change is being written to the account. */
  saving: boolean;
  /** Set when the last save failed. The setting still applies on this device. */
  saveError: string | null;
  signedIn: boolean;
  /**
   * True while a signed-in person's stored row is still on its way.
   *
   * Only the first-use questions need this. Everything else can safely render
   * from the local copy and update when the row lands, but "have you been asked
   * these six questions before?" cannot: answering from localStorage alone would
   * show the whole flow again to somebody who completed it last month on their
   * own phone and is now signing in on a borrowed one.
   */
  accountLoading: boolean;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export const PREFERENCES_KEY = ["account", "preferences"] as const;

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  // Read synchronously in the initialiser, not in an effect: an effect would paint
  // one frame at default size first, which is a flash of the wrong thing for the
  // person who least needs surprises.
  const [prefs, setPrefs] = useState<LocalPreferences>(() => readLocalPreferences());
  const [saveError, setSaveError] = useState<string | null>(null);

  /** Did this person change something before their account row arrived? */
  const changedLocally = useRef(false);
  const adoptedServerRow = useRef(false);

  const qc = useQueryClient();
  const session = useSession();
  const signedIn = Boolean(session.data && session.data.gate !== "anonymous");

  const server = useQuery({
    queryKey: PREFERENCES_KEY,
    queryFn: () => api.get<PreferencesView>("/api/preferences"),
    enabled: signedIn,
    retry: false,
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.patch<PreferencesView>("/api/preferences", patch),
    onSuccess: (view) => qc.setQueryData(PREFERENCES_KEY, view),
  });

  /* The account row arrives → adopt it, or push up an unsaved local choice. */
  useEffect(() => {
    if (!server.data || adoptedServerRow.current) return;
    adoptedServerRow.current = true;

    if (changedLocally.current) {
      // They chose something while signed out or before the row loaded. Their
      // choice is the newer intent, so it goes up rather than being overwritten.
      save.mutate({
        locale: prefs.locale,
        largeText: prefs.largeText,
        highContrast: prefs.highContrast,
        simpleView: prefs.simpleView,
        readAloud: prefs.readAloud,
        reduceMotion: prefs.reduceMotion,
        supportChannel: prefs.supportChannel,
        textOnly: prefs.textOnly,
      });
      return;
    }

    const next = fromServer(server.data);
    setPrefs(next);
    writeLocalPreferences(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server.data]);

  /* Signing out resets the adoption latch, so the next person's row is read
     fresh rather than being treated as already applied. */
  useEffect(() => {
    if (!signedIn) {
      adoptedServerRow.current = false;
      changedLocally.current = false;
    }
  }, [signedIn]);

  /**
   * Apply the display settings to the document root.
   *
   * On <html> rather than a React wrapper so it also covers anything portalled to
   * document.body — modals and dropdowns included. A high-contrast mode that stops
   * at the edge of a dialog is not a high-contrast mode.
   */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("pb-large-text", prefs.largeText);
    root.classList.toggle("pb-high-contrast", prefs.highContrast);
    root.classList.toggle("pb-reduce-motion", prefs.reduceMotion);
    root.classList.toggle("pb-simple", prefs.simpleView);
    // Assistive technology chooses its voice and pronunciation from this. A page
    // of Pidgin announced as en-NG is read with the wrong rhythm; a page of
    // Yorùbá read as English is unintelligible.
    root.lang = LOCALES[prefs.locale].htmlLang;
  }, [prefs.largeText, prefs.highContrast, prefs.reduceMotion, prefs.simpleView, prefs.locale]);

  const persist = useCallback(
    (patch: Partial<LocalPreferences>, extra?: Record<string, unknown>) => {
      changedLocally.current = true;
      setPrefs((current) => {
        const next = { ...current, ...patch };
        writeLocalPreferences(next);
        return next;
      });

      if (!signedIn) return;
      setSaveError(null);
      // `onboardingSettled` is derived server-side from two timestamps, so it is
      // never sent as a field — `settleOnboarding` sends the flag instead.
      const { onboardingSettled: _ignored, ...fields } = patch;
      const body = { ...fields, ...extra };
      if (Object.keys(body).length === 0) return;
      save.mutate(body as Record<string, unknown>, {
        onError: (error) =>
          setSaveError(
            error instanceof Error
              ? `${error.message} The setting is working on this device but is not saved to your account yet.`
              : "That setting is working on this device but could not be saved to your account.",
          ),
      });
    },
    [save, signedIn],
  );

  const value = useMemo<PreferencesContextValue>(
    () => ({
      prefs,
      t: translatorFor(prefs.locale),
      locale: prefs.locale,
      setLocale: (locale) => persist({ locale }, { locale, localeSource: "profile" }),
      update: (patch) => persist(patch),
      settleOnboarding: (outcome) =>
        persist(
          { onboardingSettled: true },
          outcome === "completed" ? { onboardingCompleted: true } : { onboardingSkipped: true },
        ),
      saving: save.isPending,
      saveError,
      signedIn,
      accountLoading: signedIn && server.isLoading,
    }),
    [prefs, persist, save.isPending, saveError, signedIn, server.isLoading],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

/**
 * Everything about the current person's settings.
 *
 * Falls back to the defaults instead of throwing when there is no provider above
 * it. WHY: a missing provider must not blank a screen — a component rendered
 * outside the tree (a test, a stray route) should still show English at normal
 * size rather than an error boundary.
 */
export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (context) return context;
  return {
    prefs: LOCAL_DEFAULTS,
    t: translatorFor(LOCAL_DEFAULTS.locale),
    locale: LOCAL_DEFAULTS.locale,
    setLocale: () => {},
    update: () => {},
    settleOnboarding: () => {},
    saving: false,
    saveError: null,
    signedIn: false,
    accountLoading: false,
  };
}

/** The translator alone, for components that need nothing else. */
export function useT(): Translator {
  return usePreferences().t;
}
