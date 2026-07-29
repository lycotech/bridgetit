import { Languages } from "lucide-react";
import { RadioCards } from "@/components/dashboard/forms";
import { LOCALE_CODES, LOCALES, RELEASED_LOCALES, type LocaleCode } from "@/i18n/locales";
import { usePreferences } from "@/lib/prefs/PreferencesProvider";

/**
 * Choosing the language PayBridge speaks.
 *
 * RADIO CARDS, NOT A DROPDOWN. A <select> collapses to one visible line and
 * needs a tap, a scroll and a second tap to operate — and for the person who
 * needs this control most, the currently visible line is in a language they
 * cannot read. Every option is on screen at once, in its own language, at a
 * 56px minimum height.
 *
 * ENDONYMS. Each language names itself: "Naija Pidgin", not "Nigerian Pidgin".
 * Somebody looking for their own language is scanning for the word they would
 * use, and `lang` on each label means a screen reader pronounces it correctly
 * instead of reading Yorùbá with English phonetics.
 *
 * The unreleased languages are listed but NOT selectable, and say so in words.
 * Hiding them would be tidier and less honest: a Hausa speaker deserves to know
 * the work is happening. Offering them would be worse than either — a
 * half-translated fee breakdown is how somebody misunderstands what they owe.
 */
export function LanguageSelector({
  legend,
  hint,
  columns = 2,
}: {
  legend?: string;
  hint?: string;
  columns?: 1 | 2;
}) {
  const { locale, setLocale, t } = usePreferences();

  const coming = LOCALE_CODES.map((code) => LOCALES[code]).filter((meta) => !meta.released);

  return (
    <div className="space-y-3">
      <RadioCards<LocaleCode>
        legend={legend ?? t("prefs.language")}
        hint={hint ?? t("prefs.language_help")}
        value={locale}
        onChange={setLocale}
        name="paybridge-language"
        columns={columns}
        options={RELEASED_LOCALES.map((meta) => ({
          value: meta.code,
          // The endonym is the label; the English name is the description, so a
          // support agent and the customer are looking at the same row.
          label: meta.endonym,
          description: meta.endonym === meta.english ? undefined : meta.english,
          icon: <Languages className="h-4 w-4" />,
        }))}
      />

      {coming.length > 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-secondary/20 p-3.5">
          <p className="text-xs font-semibold text-foreground">{t("prefs.language_coming")}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {coming.map((meta) => (
              <li
                key={meta.code}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-2.5 py-1 text-[11px] text-muted-foreground"
              >
                <span lang={meta.htmlLang} className="font-semibold">
                  {meta.endonym}
                </span>
                {/* The state is a word, never a grey pill alone (WCAG 1.4.1). */}
                <span>· {t("prefs.language_not_ready")}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
