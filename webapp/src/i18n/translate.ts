import { en, type Catalog, type TranslationKey } from "./catalogs/en";
import { pcm } from "./catalogs/pcm";
import { yo } from "./catalogs/yo";
import { ha } from "./catalogs/ha";
import { ig } from "./catalogs/ig";
import { DEFAULT_LOCALE, type LocaleCode } from "./locales";

export type { TranslationKey, Catalog };
export { en };

const CATALOGS: Record<LocaleCode, Catalog> = { en, pcm, yo, ha, ig };

export type Vars = Record<string, string | number>;

/**
 * Look a key up and fill in its placeholders.
 *
 * The fallback chain is chosen locale → English → the key itself. Returning the
 * key is on purpose: a screen that says `bridge.review_title` is obviously
 * broken and gets fixed, whereas returning "" produces a blank space that ships.
 *
 * Placeholders are `{name}`. A placeholder with no matching variable is left
 * standing rather than blanked, for the same reason.
 */
export function translate(locale: LocaleCode, key: TranslationKey, vars?: Vars): string {
  const template = CATALOGS[locale]?.[key] ?? CATALOGS[DEFAULT_LOCALE][key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = vars[name];
    return value === undefined ? whole : String(value);
  });
}

/** Bound translator, so components call `t("key")` and never carry the locale. */
export type Translator = (key: TranslationKey, vars?: Vars) => string;

export function translatorFor(locale: LocaleCode): Translator {
  return (key, vars) => translate(locale, key, vars);
}

/**
 * How complete a language is. Used by the language picker to label a work in
 * progress honestly, and by the final report — not decoration.
 */
export function coverage(locale: LocaleCode): { done: number; total: number; percent: number } {
  const total = Object.keys(en).length;
  const done = Object.keys(CATALOGS[locale] ?? {}).length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}
