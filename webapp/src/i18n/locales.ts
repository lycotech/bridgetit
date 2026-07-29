/**
 * The languages PayBridge speaks, and the ones it is being built to speak.
 *
 * `released: false` means the catalogue exists and the machinery works, but the
 * translations are not finished — so the language is NOT offered in the picker.
 * Half-translated money copy is worse than English: a person who chooses Yoruba
 * and then meets an English fee breakdown has been told the product is for
 * someone else.
 *
 * Adding a language is therefore two steps, deliberately: fill the catalogue,
 * then flip `released`. Nobody can ship a half-language by accident.
 */
export interface LocaleMeta {
  code: LocaleCode;
  /** The language's name IN that language — how a speaker recognises it. */
  endonym: string;
  /** The name in English, for staff-facing screens and support tickets. */
  english: string;
  /** `lang` attribute value, for screen-reader pronunciation. */
  htmlLang: string;
  released: boolean;
}

export const LOCALE_CODES = ["en", "pcm", "yo", "ha", "ig"] as const;
export type LocaleCode = (typeof LOCALE_CODES)[number];

export const LOCALES: Record<LocaleCode, LocaleMeta> = {
  en: { code: "en", endonym: "English", english: "English", htmlLang: "en-NG", released: true },
  pcm: { code: "pcm", endonym: "Naija Pidgin", english: "Nigerian Pidgin", htmlLang: "pcm", released: true },
  yo: { code: "yo", endonym: "Yorùbá", english: "Yoruba", htmlLang: "yo", released: false },
  ha: { code: "ha", endonym: "Hausa", english: "Hausa", htmlLang: "ha", released: false },
  ig: { code: "ig", endonym: "Igbo", english: "Igbo", htmlLang: "ig", released: false },
};

/** The languages a user may actually pick today. */
export const RELEASED_LOCALES: LocaleMeta[] = LOCALE_CODES.map((code) => LOCALES[code]).filter(
  (locale) => locale.released,
);

export const DEFAULT_LOCALE: LocaleCode = "en";

export function isLocaleCode(value: unknown): value is LocaleCode {
  return typeof value === "string" && (LOCALE_CODES as readonly string[]).includes(value);
}
