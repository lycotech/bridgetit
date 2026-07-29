import type { Catalog } from "./en";

/**
 * Yorùbá — scaffold, not a translation.
 *
 * The few entries below are here to prove the overlay works end to end (a key
 * present here wins; a key absent falls back to English). The language is marked
 * `released: false` in locales.ts, so no user can select it yet.
 *
 * To finish it: translate every key in `en.ts`, have a native speaker review the
 * money and fee wording specifically, then set `released: true`.
 */
export const yo: Catalog = {
  "employee.available_amount": "Owó tí ó wà lónìí",
  "employee.available_amount_help": "Èyí jẹ́ apá owó oṣù tí o ti ṣiṣẹ́ fún. Kì í ṣe owó ọ̀fẹ́.",
  "employee.get_help": "Rí ìrànwọ́",
  "prefs.language": "Èdè",
};
