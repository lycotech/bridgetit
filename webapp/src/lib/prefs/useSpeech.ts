import { useCallback, useEffect, useRef, useState } from "react";
import { LOCALES, type LocaleCode } from "@/i18n/locales";
import { usePreferences } from "./PreferencesProvider";

/**
 * Reading the screen aloud, using the browser's own speech engine.
 *
 * NOTHING EVER PLAYS BY ITSELF. There is no autoplay path in this file: speech
 * starts only from `speak()`, which only a press can reach. Audio that begins on
 * its own is a problem for a screen-reader user (two voices at once, neither
 * intelligible), for someone in a quiet room, and for anybody on metered data.
 *
 * WHY THE BROWSER ENGINE and not a cloud voice: it works offline, costs nothing
 * per press, sends no text anywhere, and — the point — the person's own device
 * voice is the one they have already configured to a speed they can follow. A
 * cloud voice would mean posting somebody's balance to a third party to have it
 * read back to them.
 *
 * VOICE SELECTION IS A FALLBACK CHAIN, not a lookup. Almost no device ships a
 * Nigerian Pidgin voice, and an utterance tagged `lang="pcm"` with no matching
 * voice is SILENT on several engines — the button would appear to do nothing.
 * Pidgin is therefore spoken by an English voice, which reads it approximately
 * but audibly. Approximately audible beats exactly silent.
 */

export type SpeechState = "idle" | "speaking" | "paused";

/** Preferred voice languages per locale, most to least wanted. */
const VOICE_CHAIN: Record<LocaleCode, string[]> = {
  en: ["en-NG", "en-GB", "en"],
  // Pidgin: no engine has it. Nigerian English is the closest rhythm available.
  pcm: ["pcm", "en-NG", "en-GB", "en"],
  yo: ["yo-NG", "yo", "en-NG", "en"],
  ha: ["ha-NG", "ha", "en-NG", "en"],
  ig: ["ig-NG", "ig", "en-NG", "en"],
};

function supported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

function pickVoice(locale: LocaleCode): SpeechSynthesisVoice | null {
  // Voices load asynchronously in Chrome; an empty list on the first call is
  // normal and simply means "use the engine default", which still speaks.
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  for (const wanted of VOICE_CHAIN[locale]) {
    const match = voices.find((voice) => voice.lang.toLowerCase().replace("_", "-").startsWith(wanted.toLowerCase()));
    if (match) return match;
  }
  return null;
}

export function useSpeech() {
  const { locale } = usePreferences();
  const [state, setState] = useState<SpeechState>("idle");
  const [available, setAvailable] = useState<boolean>(() => supported());
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  /* Voices arriving later must not leave `available` false forever. */
  useEffect(() => {
    if (!supported()) {
      setAvailable(false);
      return;
    }
    setAvailable(true);
    const synth = window.speechSynthesis;
    const onVoices = () => setAvailable(true);
    synth.addEventListener?.("voiceschanged", onVoices);
    return () => synth.removeEventListener?.("voiceschanged", onVoices);
  }, []);

  const stop = useCallback(() => {
    if (!supported()) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setState("idle");
  }, []);

  /* Leaving the screen stops the voice. Speech that follows somebody onto the
     next page — still reading a balance they have navigated away from — is both
     confusing and a privacy problem in a shared room. */
  useEffect(() => stop, [stop]);

  const speak = useCallback(
    (text: string) => {
      if (!supported() || text.trim().length === 0) return;
      const synth = window.speechSynthesis;
      // Cancel first: two utterances queued on top of each other is the most
      // common way this feature turns into noise.
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = LOCALES[locale].htmlLang;
      const voice = pickVoice(locale);
      if (voice) {
        utterance.voice = voice;
        // Match the tag to the voice actually chosen, or engines re-guess and
        // read Pidgin text with the wrong phonetics.
        utterance.lang = voice.lang;
      }
      // Money read at default speed is a blur of digits. Slightly slower, and
      // not so slow that it sounds broken.
      utterance.rate = 0.92;
      utterance.onend = () => setState("idle");
      utterance.onerror = () => setState("idle");
      utteranceRef.current = utterance;
      setState("speaking");
      synth.speak(utterance);
    },
    [locale],
  );

  const pause = useCallback(() => {
    if (!supported()) return;
    window.speechSynthesis.pause();
    setState("paused");
  }, []);

  const resume = useCallback(() => {
    if (!supported()) return;
    window.speechSynthesis.resume();
    setState("speaking");
  }, []);

  /* Changing language mid-sentence would keep reading in the old voice. */
  useEffect(() => {
    stop();
  }, [locale, stop]);

  return { state, available, speak, pause, resume, stop };
}
